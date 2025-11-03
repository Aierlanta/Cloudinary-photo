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
import { adjustImageTransparency, parseTransparencyParams } from '@/lib/image-processor';

// 强制动态渲染
export const dynamic = 'force-dynamic'

const cloudinaryService = CloudinaryService.getInstance();

// ---------------- 预缓存（内存）实现 ----------------
// 以参数筛选结果为维度的单槽预取缓存：同一筛选条件维持一个“下一张”的缓冲
// key 规则：当无分组限制时使用 'all'，否则使用 'groups:<排序后的分组ID,逗号分隔>'
interface PrefetchedItem {
  buffer: Buffer;
  mimeType: string;
  size: number;
  imageId: string;
  publicId: string;
  url: string;
  createdAt: number;
}

/**
 * 判断是否 Cloudinary 资源 URL
 * 支持：
 * - 标准域名：res.cloudinary.com
 * - 分片域名：res-1.cloudinary.com 到 res-5.cloudinary.com
 * - 自定义域名：通过 CLOUDINARY_ALLOWED_HOSTS 环境变量配置（逗号分隔）
 */
function isCloudinaryUrl(urlStr: string): boolean {
  try {
    const { hostname } = new URL(urlStr);
    
    // 标准 Cloudinary 域名
    if (hostname === 'res.cloudinary.com') {
      return true;
    }
    
    // Cloudinary 分片域名（res-1 到 res-5）
    if (/^res-[1-5]\.cloudinary\.com$/i.test(hostname)) {
      return true;
    }
    
    // 自定义域名白名单（可选）
    const customHosts = (process.env.CLOUDINARY_ALLOWED_HOSTS || '')
      .split(',')
      .map(h => h.trim().toLowerCase())
      .filter(Boolean);
    
    if (customHosts.length > 0 && customHosts.includes(hostname.toLowerCase())) {
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
}

interface PrefetchSlot {
  item?: PrefetchedItem;
  inflight?: Promise<void>;
  expiresAt?: number;
}

const PREFETCH_TTL_MS = Number(process.env.RESPONSE_PREFETCH_TTL_MS ?? '120000'); // 预取缓存TTL（毫秒），默认2分钟
const prefetchCache = new Map<string, PrefetchSlot>();

function buildGroupKey(groupIds: string[]): string {
  if (!groupIds || groupIds.length === 0) return 'all';
  const uniqueSorted = Array.from(new Set(groupIds)).sort();
  return `groups:${uniqueSorted.join(',')}`;
}

function takePrefetched(key: string): PrefetchedItem | undefined {
  const slot = prefetchCache.get(key);
  if (!slot || !slot.item) return undefined;
  const item = slot.item;
  // 单槽语义：消费即置空
  slot.item = undefined;
  return item;
}

async function prefetchNext(key: string, groupIds: string[]): Promise<void> {
  // 已有进行中的预取则复用
  const existing = prefetchCache.get(key);
  if (existing?.inflight) return existing.inflight;

  const inflight = (async () => {
    try {
      // 选择下一张随机图片（与当前筛选条件一致）
      const img = await getRandomImageFromGroups(groupIds);
      if (!img) return; // 无可用图片，跳过
      const mimeType = getMimeTypeFromUrl(img.url);
      // 优先按 URL 判断图床：Cloudinary 才走 Cloudinary 下载，否则直接 URL 抓取
      let buffer: Buffer;
      const secureUrl = img.url.replace(/^http:/, 'https:');
      if (isCloudinaryUrl(secureUrl)) {
        try {
          buffer = await cloudinaryService.downloadImage(img.publicId);
        } catch (err) {
          logger.warn('Cloudinary下载失败，使用URL回退获取', { type: 'api_prefetch_fallback', error: err instanceof Error ? err.message : 'unknown' });
          const resp = await fetch(secureUrl, { cache: 'no-store' } as RequestInit);
          if (!resp.ok) throw err;
          const ab = await resp.arrayBuffer();
          buffer = Buffer.from(ab);
        }
      } else {
        const resp = await fetch(secureUrl, { cache: 'no-store' } as RequestInit);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        const ab = await resp.arrayBuffer();
        buffer = Buffer.from(ab);
      }
      const size = buffer.length;

      prefetchCache.set(key, {
        item: {
          buffer,
          mimeType,
          size,
          imageId: img.id,
          publicId: img.publicId,
          url: img.url,
          createdAt: Date.now()
        },
        inflight: undefined
      });

      logger.info('预取完成', { type: 'api_prefetch', key, imageId: img.id, size });
    } catch (err) {
      // 失败不影响主流程
      logger.warn('预取失败', { type: 'api_prefetch', key, error: err instanceof Error ? err.message : 'unknown' });
    } finally {
      const s = prefetchCache.get(key);
      if (s) s.inflight = undefined;
    }
  })();

  prefetchCache.set(key, { ...(existing || {}), inflight });
  await inflight; // 注意：调用方通常不 await；这里确保返回的是相同Promise
}

// 测试辅助：重置预取缓存（仅测试调用）
export function __resetPrefetchCacheForTests() {
  prefetchCache.clear();
}


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

    // 解析透明度参数
    const transparencyOptions = parseTransparencyParams(
      queryParams.opacity,
      queryParams.bgColor
    );

    logger.info('收到直接响应图片请求', {
      type: 'api_request',
      method: 'GET',
      path: '/api/response',
      params: queryParams,
      transparency: transparencyOptions ? 'enabled' : 'disabled',
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

    // 预取命中优先：若存在相同筛选条件的预取结果，直接返回并异步预取下一张
    // 透明度处理会在预取的原始图片上完成，避免重复拉取源图
    const cacheKey = buildGroupKey(targetGroupIds);
    const prefetched = takePrefetched(cacheKey);
    if (prefetched) {
      let finalBuffer = prefetched.buffer;
      let finalMimeType = prefetched.mimeType;

      if (transparencyOptions) {
        const processed = await adjustImageTransparency(prefetched.buffer, transparencyOptions);
        finalBuffer = processed.buffer;
        finalMimeType = processed.mimeType;
      }

      const finalSize = finalBuffer.length;
      const duration = Math.round(performance.now() - startTime);

      logger.info('预取命中，直接返回', {
        type: 'api_prefetch',
        key: cacheKey,
        imageId: prefetched.imageId,
        size: finalSize,
        transparency: transparencyOptions ? 'processed' : 'original'
      });

      // 异步预取下一张（不阻塞响应）
      prefetchNext(cacheKey, targetGroupIds).catch(() => {});

      return new NextResponse(new Uint8Array(finalBuffer), {
        status: 200,
        headers: {
          'Content-Type': finalMimeType,
          'Content-Length': finalSize.toString(),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Image-Id': prefetched.imageId,
          'X-Image-PublicId': prefetched.publicId,
          'X-Image-Size': finalSize.toString(),
          'X-Response-Time': `${duration}ms`,
          'X-Transfer-Mode': transparencyOptions ? 'prefetch-processed' : 'prefetch'
        }
      });
    }


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

    {
      // 直接缓冲模式（便于与预取缓存对接）
      let imageBuffer: Buffer;
      if (isCloudinaryUrl(imageUrl)) {
        try {
          imageBuffer = await cloudinaryService.downloadImage(randomImage.publicId);
        } catch (err) {
          logger.warn('Cloudinary下载失败，使用URL回退获取', { type: 'api_response_fallback', error: err instanceof Error ? err.message : 'unknown' });
          const resp = await fetch(imageUrl, { cache: 'no-store' } as RequestInit);
          if (!resp.ok) throw err;
          const ab = await resp.arrayBuffer();
          imageBuffer = Buffer.from(ab);
        }
      } else {
        const resp = await fetch(imageUrl, { cache: 'no-store' } as RequestInit);
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        }
        const ab = await resp.arrayBuffer();
        imageBuffer = Buffer.from(ab);
      }
      // 应用透明度处理（如果需要）
      let finalBuffer = imageBuffer;
      let finalMimeType = mimeType;
      if (transparencyOptions) {
        const processed = await adjustImageTransparency(imageBuffer, transparencyOptions);
        finalBuffer = processed.buffer;
        finalMimeType = processed.mimeType;
      }

      const size = finalBuffer.length;
      const duration = Math.round(performance.now() - startTime);

      // 记录成功响应
      logger.apiResponse('GET', '/api/response', 200, duration, {
        imageId: randomImage.id,
        imageSize: size,
        mimeType: finalMimeType,
        mode: 'buffered',
        transparency: transparencyOptions ? 'processed' : 'original'
      });

      // 异步预取下一张（不阻塞响应；透明度请求同样复用原图预取流程）
      prefetchNext(cacheKey, targetGroupIds).catch(() => {});

      // 返回缓冲响应
      return new NextResponse(new Uint8Array(finalBuffer), {
        status: 200,
        headers: {
          'Content-Type': finalMimeType,
          'Content-Length': size.toString(),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Image-Id': randomImage.id,
          'X-Image-PublicId': randomImage.publicId,
          'X-Response-Time': `${duration}ms`,
          'X-Image-Size': size.toString(),
          'X-Transfer-Mode': transparencyOptions ? 'buffered-processed' : 'buffered'
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
  
  // 保留查询参数（不参与业务参数校验）
  const RESERVED_PARAMS = new Set(['opacity', 'bgColor']);
  const filteredEntries = Object.entries(queryParams).filter(([key]) => !RESERVED_PARAMS.has(key));

  // 如果没有配置允许的参数，直接返回
  if (!apiConfig.allowedParameters || apiConfig.allowedParameters.length === 0) {
    // 当存在非保留参数时才判定为无效
    if (filteredEntries.length > 0) {
      hasInvalidParams = true;
    }
    return { allowedGroupIds, hasInvalidParams };
  }

  // 验证每个查询参数
  for (const [paramName, paramValue] of filteredEntries) {
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
