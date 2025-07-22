/**
 * 公开随机图片API端点
 * 这是唯一的公开API端点，直接返回随机图片文件
 */

import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '@/lib/database';
import { CloudinaryService } from '@/lib/cloudinary';
import { withSecurity } from '@/lib/security';
import { withErrorHandler } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import { AppError, ErrorType } from '@/types/errors';

// 强制动态渲染
export const dynamic = 'force-dynamic'

const cloudinaryService = CloudinaryService.getInstance();

/**
 * 处理随机图片请求
 * GET /api/random[?参数]
 */
async function getRandomImage(request: NextRequest): Promise<Response> {
  const startTime = performance.now();

  try {
    // 解析查询参数
    const searchParams = request.nextUrl.searchParams;
    const queryParams: Record<string, string> = {};

    // 将所有查询参数转换为键值对
    searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    // 记录API请求
    logger.apiRequest('GET', '/api/random', {
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

    // 验证和解析参数
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

    // 根据参数筛选图片
    let targetGroupIds: string[] = [];
    
    if (allowedGroupIds.length > 0) {
      // 使用参数指定的分组
      targetGroupIds = allowedGroupIds;
    } else if (apiConfig.defaultScope === 'groups' && apiConfig.defaultGroups.length > 0) {
      // 使用默认分组
      targetGroupIds = apiConfig.defaultGroups;
    }
    // 如果targetGroupIds为空，则从所有图片中选择

    // 获取随机图片
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
    logger.info('随机图片已选择', {
      type: 'api_response',
      imageId: randomImage.id,
      publicId: randomImage.publicId,
      groupId: randomImage.groupId,
      params: queryParams
    });

    const duration = Math.round(performance.now() - startTime);

    // 记录成功响应
    logger.apiResponse('GET', '/api/random', 302, duration, {
      imageId: randomImage.id,
      redirectUrl: randomImage.url
    });

    // 确保图片URL使用HTTPS协议
    const secureImageUrl = randomImage.url.replace(/^http:/, 'https:');

    // 重定向到图片URL
    return NextResponse.redirect(secureImageUrl, {
      status: 302,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate', // 禁用缓存保证随机性
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Image-Id': randomImage.id,
        'X-Image-PublicId': randomImage.publicId,
        'X-Response-Time': `${duration}ms`
      }
    });

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
 * 验证和解析请求参数
 */
async function validateAndParseParams(
  queryParams: Record<string, string>,
  apiConfig: any
): Promise<{ allowedGroupIds: string[]; hasInvalidParams: boolean }> {
  const allowedGroupIds: string[] = [];
  let hasInvalidParams = false;

  // 如果没有配置允许的参数，则允许所有请求
  if (!apiConfig.allowedParameters || apiConfig.allowedParameters.length === 0) {
    return { allowedGroupIds: [], hasInvalidParams: false };
  }

  // 检查每个查询参数
  for (const [paramName, paramValue] of Object.entries(queryParams)) {
    // 查找对应的参数配置
    const paramConfig = apiConfig.allowedParameters.find(
      (p: any) => p.name === paramName && p.isEnabled
    );

    if (!paramConfig) {
      // 参数未配置或已禁用，标记为无效
      logger.warn('未配置的参数', {
        type: 'api_validation',
        param: paramName,
        value: paramValue
      });
      hasInvalidParams = true;
      continue;
    }

    // 检查参数值是否在允许范围内
    if (!paramConfig.allowedValues.includes(paramValue)) {
      logger.warn('参数值不在允许范围内', {
        type: 'api_validation',
        param: paramName,
        value: paramValue,
        allowedValues: paramConfig.allowedValues
      });
      hasInvalidParams = true;
      continue;
    }

    // 添加对应的分组ID
    if (paramConfig.mappedGroups && paramConfig.mappedGroups.length > 0) {
      allowedGroupIds.push(...paramConfig.mappedGroups);
    }
  }

  // 去重
  const uniqueGroupIds = [...new Set(allowedGroupIds)];

  return { 
    allowedGroupIds: uniqueGroupIds, 
    hasInvalidParams 
  };
}

/**
 * 从指定分组中获取随机图片
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
  })(getRandomImage)
);