/**
 * 直接响应图片API端点
 * 返回图片数据流而不是重定向
 */

import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '@/lib/database';
import { CloudinaryService } from '@/lib/cloudinary';
import { withSecurity } from '@/lib/security';
import { withErrorHandler } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import { AppError, ErrorType } from '@/types/errors';

const cloudinaryService = CloudinaryService.getInstance();

/**
 * 处理直接图片响应请求
 * GET /api/response[?参数]
 */
async function getImageResponse(request: NextRequest): Promise<Response> {
  const startTime = performance.now();
  
  try {
    // 解析查询参数
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    logger.info('收到直接响应图片请求', {
      type: 'api_request',
      method: 'GET',
      path: '/api/response',
      params: queryParams,
      ip: getClientIP(request),
      userAgent: request.headers.get('user-agent')
    });

    // 获取API配置
    let apiConfig = await databaseService.getAPIConfig();

    if (!apiConfig) {
      // 如果API配置不存在，尝试初始化数据库
      logger.info('API配置未找到，正在初始化数据库...', { type: 'api_config' });
      await databaseService.initialize();

      // 重新获取配置
      apiConfig = await databaseService.getAPIConfig();

      if (!apiConfig) {
        logger.error('API配置未找到', new Error('API配置错误'), { type: 'api_config' });
        throw new AppError(
          ErrorType.INTERNAL_ERROR,
          'API配置错误',
          500
        );
      }
    }

    // 检查API是否启用
    if (!apiConfig.isEnabled) {
      logger.warn('API访问被拒绝 - API已禁用', {
        type: 'api_access',
        ip: getClientIP(request),
        userAgent: request.headers.get('user-agent')
      });

      throw new AppError(
        ErrorType.FORBIDDEN,
        'API服务暂时不可用',
        403
      );
    }

    // 检查直接响应模式是否启用
    if (!apiConfig.enableDirectResponse) {
      logger.warn('直接响应模式未启用', {
        type: 'api_access',
        ip: getClientIP(request),
        userAgent: request.headers.get('user-agent')
      });

      throw new AppError(
        ErrorType.FORBIDDEN,
        '直接响应模式未启用，请使用 /api/random 端点',
        403
      );
    }

    // 验证和解析参数（复用现有逻辑）
    const { allowedGroupIds, hasInvalidParams } = await validateAndParseParams(
      queryParams,
      apiConfig
    );

    if (hasInvalidParams) {
      logger.warn('API请求包含无效参数', {
        type: 'api_validation',
        params: queryParams,
        ip: getClientIP(request)
      });

      throw new AppError(
        ErrorType.VALIDATION_ERROR,
        '请求参数无效',
        400
      );
    }

    // 根据参数筛选图片（复用现有逻辑）
    let targetGroupIds: string[] = [];
    
    if (allowedGroupIds.length > 0) {
      // 使用参数指定的分组
      targetGroupIds = allowedGroupIds;
    } else if (apiConfig.defaultScope === 'groups' && apiConfig.defaultGroups.length > 0) {
      // 使用默认分组
      targetGroupIds = apiConfig.defaultGroups;
    }
    // 如果targetGroupIds为空，则从所有图片中选择

    // 获取随机图片（复用现有逻辑）
    const randomImage = await getRandomImageFromGroups(targetGroupIds);
    
    if (!randomImage) {
      logger.warn('没有找到符合条件的图片', {
        type: 'api_response',
        params: queryParams,
        targetGroupIds,
        imageCount: 0
      });

      throw new AppError(
        ErrorType.NOT_FOUND,
        '没有找到符合条件的图片',
        404
      );
    }

    // 记录图片选择
    logger.info('随机图片已选择，准备流式传输', {
      type: 'api_response',
      imageId: randomImage.id,
      publicId: randomImage.publicId,
      groupId: randomImage.groupId,
      params: queryParams
    });

    // 确定图片的MIME类型
    const mimeType = getMimeTypeFromUrl(randomImage.url);

    // 获取图片URL用于流式传输
    const imageUrl = randomImage.url.replace(/^http:/, 'https:');

    try {
      // 使用 fetch 获取图片流
      const imageResponse = await fetch(imageUrl);

      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.status}`);
      }

      const duration = Math.round(performance.now() - startTime);

      // 记录成功响应
      logger.apiResponse('GET', '/api/response', 200, duration, {
        imageId: randomImage.id,
        imageUrl: imageUrl,
        mimeType
      });

      // 获取图片大小（如果可用）
      const contentLength = imageResponse.headers.get('content-length');

      // 创建响应头
      const responseHeaders = new Headers({
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=3600', // 缓存1小时
        'X-Image-Id': randomImage.id,
        'X-Image-PublicId': randomImage.publicId,
        'X-Response-Time': `${duration}ms`
      });

      // 如果有内容长度，添加到响应头
      if (contentLength) {
        responseHeaders.set('Content-Length', contentLength);
        responseHeaders.set('X-Image-Size', contentLength);
      }

      // 返回流式响应
      return new NextResponse(imageResponse.body, {
        status: 200,
        headers: responseHeaders
      });

    } catch (streamError) {
      // 如果流式传输失败，回退到缓冲模式
      logger.warn('流式传输失败，回退到缓冲模式', {
        type: 'api_fallback',
        imageId: randomImage.id,
        error: streamError instanceof Error ? streamError.message : '未知错误'
      });

      const imageBuffer = await cloudinaryService.downloadImage(randomImage.publicId);

      const duration = Math.round(performance.now() - startTime);

      // 记录回退响应
      logger.apiResponse('GET', '/api/response', 200, duration, {
        imageId: randomImage.id,
        imageSize: imageBuffer.length,
        mimeType,
        mode: 'fallback'
      });

      // 返回缓冲响应
      return new NextResponse(imageBuffer, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': imageBuffer.length.toString(),
          'Cache-Control': 'public, max-age=3600',
          'X-Image-Id': randomImage.id,
          'X-Image-PublicId': randomImage.publicId,
          'X-Response-Time': `${duration}ms`,
          'X-Image-Size': imageBuffer.length.toString(),
          'X-Transfer-Mode': 'buffered'
        }
      });
    }

  } catch (error) {
    // 错误会被withErrorHandler中间件处理
    throw error;
  }
}

/**
 * 获取客户端IP地址
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  return realIP || 'unknown';
}

/**
 * 从URL推断MIME类型
 */
function getMimeTypeFromUrl(url: string): string {
  const extension = url.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    case 'bmp':
      return 'image/bmp';
    case 'tiff':
    case 'tif':
      return 'image/tiff';
    default:
      return 'image/jpeg'; // 默认为JPEG
  }
}

/**
 * 验证和解析查询参数（复用自 /api/random）
 */
async function validateAndParseParams(
  queryParams: Record<string, string>,
  apiConfig: any
): Promise<{ allowedGroupIds: string[]; hasInvalidParams: boolean }> {
  const allowedGroupIds: string[] = [];
  let hasInvalidParams = false;

  // 如果没有配置允许的参数，直接返回
  if (!apiConfig.allowedParameters || apiConfig.allowedParameters.length === 0) {
    // 检查是否有任何查询参数
    if (Object.keys(queryParams).length > 0) {
      hasInvalidParams = true;
    }
    return { allowedGroupIds, hasInvalidParams };
  }

  // 验证每个查询参数
  for (const [paramName, paramValue] of Object.entries(queryParams)) {
    const paramConfig = apiConfig.allowedParameters.find(
      (p: any) => p.name === paramName && p.isEnabled
    );

    if (!paramConfig) {
      // 参数未配置或已禁用
      hasInvalidParams = true;
      continue;
    }

    // 检查参数值是否在允许范围内
    if (!paramConfig.allowedValues.includes(paramValue)) {
      hasInvalidParams = true;
      continue;
    }

    // 添加对应的分组ID
    allowedGroupIds.push(...paramConfig.mappedGroups);
  }

  // 去重
  const uniqueGroupIds = [...new Set(allowedGroupIds)];

  return { 
    allowedGroupIds: uniqueGroupIds, 
    hasInvalidParams 
  };
}

/**
 * 从指定分组中获取随机图片（复用自 /api/random）
 */
async function getRandomImageFromGroups(groupIds: string[]) {
  if (groupIds.length === 0) {
    // 从所有图片中选择
    const images = await databaseService.getRandomImages(1);
    return images[0] || null;
  }

  // 从指定分组中选择
  // 如果有多个分组，随机选择一个分组，然后从该分组中获取随机图片
  const randomGroupIndex = Math.floor(Math.random() * groupIds.length);
  const selectedGroupId = groupIds[randomGroupIndex];

  const images = await databaseService.getRandomImages(1, selectedGroupId);
  const image = images[0] || null;

  if (!image && groupIds.length > 1) {
    // 如果选中的分组没有图片，尝试其他分组
    for (const groupId of groupIds) {
      if (groupId !== selectedGroupId) {
        const fallbackImages = await databaseService.getRandomImages(1, groupId);
        const fallbackImage = fallbackImages[0] || null;
        if (fallbackImage) {
          return fallbackImage;
        }
      }
    }
  }

  return image;
}

// 应用安全中间件和错误处理
export const GET = withErrorHandler(
  withSecurity({
    rateLimit: 'public',
    allowedMethods: ['GET']
  })(getImageResponse)
);
