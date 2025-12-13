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
import { convertTgStateToProxyUrl } from '@/lib/image-utils';
import { buildFetchInitFor } from '@/lib/telegram-proxy';
import type { Image } from '@/types/models';


// 强制动态渲染
export const dynamic = 'force-dynamic'
const cloudinaryService = CloudinaryService.getInstance();

// ---------------- 预缓存（内存）实现 ----------------
// 以参数筛选结果为维度的单槽预取缓存：同一筛选条件维持一个“下一张”的缓冲
// key 规则：无筛选时使用 'all'；否则拼接 providers/groups 的排序结果
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

function buildFilterKey(groupIds: string[], providers: string[]): string {
  const parts: string[] = [];
  const uniqueProviders = Array.from(new Set((providers || []).filter(Boolean))).sort();
  const uniqueGroups = Array.from(new Set((groupIds || []).filter(Boolean))).sort();

  if (uniqueProviders.length > 0) {
    parts.push(`providers:${uniqueProviders.join(',')}`);
  }
  if (uniqueGroups.length > 0) {
    parts.push(`groups:${uniqueGroups.join(',')}`);
  }

  if (parts.length === 0) return 'all';
  return parts.join('|');
}

function takePrefetched(key: string): PrefetchedItem | undefined {
  const slot = prefetchCache.get(key);
  if (!slot) return undefined;

  if (slot.expiresAt && slot.expiresAt <= Date.now()) {
    prefetchCache.delete(key);
    return undefined;
  }
  if (!slot.item) return undefined;
  const item = slot.item;
  // 单槽语义：消费即置空
  slot.item = undefined;
  return item;
}

class HttpStatusError extends Error {
  status: number;
  statusText: string;
  url: string;

  constructor(status: number, statusText: string, url: string) {
    super(`HTTP ${status}: ${statusText}`);
    this.status = status;
    this.statusText = statusText;
    this.url = url;
  }
}

interface DownloadCandidate {
  url: string;
  reason: string;
  preferCloudinary?: boolean;
}

function parseTelegramBotId(image: Image): string | undefined {
  if (image.storageMetadata) {
    try {
      const meta = JSON.parse(image.storageMetadata);
      if (meta?.telegramBotId) {
        return String(meta.telegramBotId);
      }
    } catch {
      // ignore
    }
  }

  if (image.telegramBotToken) {
    const prefix = image.telegramBotToken.split(':')[0];
    if (/^\d+$/.test(prefix)) {
      return prefix;
    }
  }
  return undefined;
}

function buildDownloadCandidates(image: Image, request?: NextRequest): DownloadCandidate[] {
  const candidates: DownloadCandidate[] = [];
  const botId = parseTelegramBotId(image);

  if (image.telegramFileId) {
    const tgUrl = new URL('/api/telegram/image', request?.url ?? 'http://localhost');
    tgUrl.searchParams.set('file_id', image.telegramFileId);
    if (botId) tgUrl.searchParams.set('bot_id', botId);
    if (image.telegramFilePath && !tgUrl.searchParams.get('file_path')) {
      tgUrl.searchParams.set('file_path', image.telegramFilePath);
    }
    candidates.push({ url: tgUrl.toString(), reason: 'telegram-file-id' });
  }

  if (image.telegramFilePath && image.telegramBotToken) {
    const direct = `https://api.telegram.org/file/bot${image.telegramBotToken}/${image.telegramFilePath}`;
    candidates.push({ url: direct, reason: 'telegram-direct-path' });
  }

  let secureUrl = image.url.replace(/^http:/, 'https:');
  secureUrl = convertTgStateToProxyUrl(secureUrl);
  try {
    const urlObj = new URL(secureUrl, request?.url ?? 'http://localhost');
    if (urlObj.pathname.startsWith('/api/telegram/image')) {
      if (image.telegramFilePath && !urlObj.searchParams.get('file_path')) {
        urlObj.searchParams.set('file_path', image.telegramFilePath);
      }
      if (botId && !urlObj.searchParams.get('bot_id')) {
        urlObj.searchParams.set('bot_id', botId);
      }
    }
    secureUrl = urlObj.toString();
  } catch {
    // ignore
  }

  candidates.push({
    url: secureUrl,
    reason: 'stored-url',
    preferCloudinary: isCloudinaryUrl(secureUrl)
  });

  // 去重（按URL）
  const seen = new Set<string>();
  return candidates.filter(c => {
    if (seen.has(c.url)) return false;
    seen.add(c.url);
    return true;
  });
}

async function downloadFromCandidate(
  candidate: DownloadCandidate,
  image: Image,
  baseMimeType: string
): Promise<{ buffer: Buffer; mimeType: string; usedUrl: string; reason: string }> {
  // Cloudinary 优先（可回退到 fetch）
  if (candidate.preferCloudinary || isCloudinaryUrl(candidate.url)) {
    try {
      const buf = await cloudinaryService.downloadImage(image.publicId);
      return { buffer: buf, mimeType: baseMimeType, usedUrl: candidate.url, reason: candidate.reason };
    } catch (err) {
      logger.warn('Cloudinary下载失败，使用URL回退获取', {
        type: 'api_download_fallback',
        error: err instanceof Error ? err.message : 'unknown',
        url: candidate.url
      });
    }
  }

  const resp = await fetch(candidate.url, buildFetchInitFor(candidate.url, { cache: 'no-store' } as RequestInit));
  if (!resp.ok) {
    throw new HttpStatusError(resp.status, resp.statusText, candidate.url);
  }
  const ab = await resp.arrayBuffer();
  const buffer = Buffer.from(ab);
  const mimeType = normalizeMimeType(resp.headers.get('content-type'), baseMimeType);
  return { buffer, mimeType, usedUrl: candidate.url, reason: candidate.reason };
}

async function downloadImageWithCandidates(
  image: Image,
  request: NextRequest | undefined,
  baseMimeType: string
): Promise<{ buffer: Buffer; mimeType: string; usedUrl: string; reason: string }> {
  const candidates = buildDownloadCandidates(image, request);
  let lastStatus: number | undefined;
  let lastUrl: string | undefined;
  let lastError: any;

  for (const candidate of candidates) {
    try {
      return await downloadFromCandidate(candidate, image, baseMimeType);
    } catch (err) {
      lastError = err;
      if (err instanceof HttpStatusError) {
        lastStatus = err.status;
        lastUrl = err.url;
        logger.warn('图片下载失败', {
          type: 'api_download',
          status: err.status,
          statusText: err.statusText,
          url: err.url,
          reason: candidate.reason
        });
      } else {
        logger.warn('图片下载异常', {
          type: 'api_download',
          error: err instanceof Error ? err.message : String(err),
          url: candidate.url,
          reason: candidate.reason
        });
      }
    }
  }

  if (lastStatus === 404 || lastStatus === 410) {
    throw new AppError(
      ErrorType.NOT_FOUND,
      `源图返回 404 (${lastUrl ?? 'unknown'})`,
      404,
      { url: lastUrl, status: lastStatus }
    );
  }

  if (lastStatus && lastStatus >= 500) {
    throw new AppError(
      ErrorType.EXTERNAL_SERVICE_ERROR,
      `源图服务错误 (${lastStatus})`,
      502,
      { url: lastUrl, status: lastStatus }
    );
  }

  throw new AppError(
    ErrorType.INTERNAL_ERROR,
    '下载图片失败',
    500,
    { url: lastUrl, status: lastStatus, error: lastError instanceof Error ? lastError.message : String(lastError ?? '') }
  );
}

async function prefetchNext(key: string, groupIds: string[], providers: string[], request?: NextRequest): Promise<void> {
  // 已有进行中的预取则复用
  const existing = prefetchCache.get(key);
  if (existing?.inflight) return existing.inflight;

  const inflight = (async () => {
    try {
      // 选择下一张随机图片（与当前筛选条件一致）
      const img = await getRandomImageFromGroupsAndProviders(groupIds, providers);
      if (!img) return; // 无可用图片，跳过
      const baseMimeType = getMimeTypeFromUrl(img.url);
      const downloaded = await downloadImageWithCandidates(img, request, baseMimeType);
      const size = downloaded.buffer.length;

      prefetchCache.set(key, {
        item: {
          buffer: downloaded.buffer,
          mimeType: downloaded.mimeType,
          size,
          imageId: img.id,
          publicId: img.publicId,
          url: img.url,
          createdAt: Date.now()
        },
        inflight: undefined,
        expiresAt: Date.now() + PREFETCH_TTL_MS
      });

      logger.info('预取完成', {
        type: 'api_prefetch',
        key,
        imageId: img.id,
        size,
        via: downloaded.reason,
        url: downloaded.usedUrl
      });
    } catch (err) {
      // 失败不影响主流程
      logger.warn('预取失败', {
        type: 'api_prefetch',
        key,
        error: err instanceof Error ? err.message : 'unknown',
        status: err instanceof AppError ? err.statusCode : undefined
      });
    } finally {
      const s = prefetchCache.get(key);
      if (s) s.inflight = undefined;
    }
  })();

  prefetchCache.set(key, { ...(existing || {}), inflight, expiresAt: Date.now() + PREFETCH_TTL_MS });
  await inflight; // 注意：调用方通常不 await；这里确保返回的是相同Promise
}

// 测试辅助：重置预取缓存（仅测试调用）
function resetPrefetchCacheForTests() {
  prefetchCache.clear();
}

// 测试辅助：等待指定 key 的预取完成（仅测试调用）
async function waitForPrefetchForTests(key: string, timeoutMs: number = 500): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const slot = prefetchCache.get(key);
    if (slot?.item) return;

    if (slot?.inflight) {
      try {
        await slot.inflight;
      } catch {
        // ignore
      }
    }

    await new Promise((r) => setTimeout(r, 5));
  }
}

function getPrefetchKeysForTests(): string[] {
  return Array.from(prefetchCache.keys());
}

function getPrefetchStateForTests(key: string): {
  hasSlot: boolean;
  hasItem: boolean;
  hasInflight: boolean;
  expiresAt?: number;
} {
  const slot = prefetchCache.get(key);
  return {
    hasSlot: !!slot,
    hasItem: !!slot?.item,
    hasInflight: !!slot?.inflight,
    expiresAt: slot?.expiresAt,
  };
}

if (process.env.NODE_ENV === 'test') {
  (globalThis as { __resetPrefetchCacheForTests?: () => void; __waitForPrefetchForTests?: (key: string, timeoutMs?: number) => Promise<void>; __getPrefetchKeysForTests?: () => string[] }).__resetPrefetchCacheForTests = resetPrefetchCacheForTests;
  (globalThis as { __resetPrefetchCacheForTests?: () => void; __waitForPrefetchForTests?: (key: string, timeoutMs?: number) => Promise<void>; __getPrefetchKeysForTests?: () => string[] }).__waitForPrefetchForTests = waitForPrefetchForTests;
  (globalThis as { __resetPrefetchCacheForTests?: () => void; __waitForPrefetchForTests?: (key: string, timeoutMs?: number) => Promise<void>; __getPrefetchKeysForTests?: () => string[]; __getPrefetchStateForTests?: (key: string) => { hasSlot: boolean; hasItem: boolean; hasInflight: boolean; expiresAt?: number } }).__getPrefetchKeysForTests = getPrefetchKeysForTests;
  (globalThis as { __resetPrefetchCacheForTests?: () => void; __waitForPrefetchForTests?: (key: string, timeoutMs?: number) => Promise<void>; __getPrefetchKeysForTests?: () => string[]; __getPrefetchStateForTests?: (key: string) => { hasSlot: boolean; hasItem: boolean; hasInflight: boolean; expiresAt?: number } }).__getPrefetchStateForTests = getPrefetchStateForTests;
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
    const redactedParams = { ...queryParams } as Record<string, string>;
    if (typeof redactedParams.key !== 'undefined') {
      redactedParams.key = '***';
    }

    // 解析透明度参数
    const transparencyOptions = parseTransparencyParams(
      queryParams.opacity,
      queryParams.bgColor
    );

    logger.info('收到直接响应图片请求', {
      type: 'api_request',
      method: 'GET',
      path: '/api/response',
      params: redactedParams,
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

    // 验证 API Key（如果启用）
    if (apiConfig.apiKeyEnabled) {
      const providedKey = queryParams.key;

      if (!providedKey) {
        logger.warn('API访问被拒绝 - 缺少API Key', {
          type: 'api_auth',
          ip: getClientIP(request),
          userAgent: request.headers.get('user-agent')
        });

        throw new AppError(
          ErrorType.UNAUTHORIZED,
          '缺少API Key参数',
          401
        );
      }

      if (providedKey !== apiConfig.apiKey) {
        logger.warn('API访问被拒绝 - API Key无效', {
          type: 'api_auth',
          ip: getClientIP(request),
          userAgent: request.headers.get('user-agent')
        });

        throw new AppError(
          ErrorType.UNAUTHORIZED,
          'API Key无效',
          401
        );
      }

      logger.info('API Key验证通过', {
        type: 'api_auth',
        ip: getClientIP(request)
      });
    }

    // 验证和解析参数（复用现有逻辑）
    const { allowedGroupIds, allowedProviders, hasInvalidParams } = await validateAndParseParams(
      queryParams,
      apiConfig
    );

    if (hasInvalidParams) {
      logger.warn('API请求包含无效参数', {
        type: 'api_validation',
        params: redactedParams,
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
    const cacheKey = buildFilterKey(targetGroupIds, allowedProviders);
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
      prefetchNext(cacheKey, targetGroupIds, allowedProviders, request).catch(() => {});

      return new NextResponse(bufferToStream(finalBuffer), {
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
        'X-Transfer-Mode': transparencyOptions ? 'prefetch-processed' : 'prefetch',
        'Content-Disposition': `inline; filename="${buildFilename(prefetched.imageId, finalMimeType)}"`
      }
    });
  }


    // 获取随机图片（复用现有逻辑）
    const randomImage = await getRandomImageFromGroupsAndProviders(targetGroupIds, allowedProviders);

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
      params: redactedParams
    });

    // 确定图片的MIME类型
    const mimeType = getMimeTypeFromUrl(randomImage.url);
    const downloadResult = await downloadImageWithCandidates(randomImage, request, mimeType);

    // 应用透明度处理（如果需要）
    let finalBuffer = downloadResult.buffer;
    let finalMimeType = downloadResult.mimeType;
    if (transparencyOptions) {
      const processed = await adjustImageTransparency(downloadResult.buffer, transparencyOptions);
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
      transparency: transparencyOptions ? 'processed' : 'original',
      via: downloadResult.reason,
      url: downloadResult.usedUrl
    });

    // 异步预取下一张（不阻塞响应；透明度请求同样复用原图预取流程）
    prefetchNext(cacheKey, targetGroupIds, allowedProviders, request).catch(() => {});

    // 返回缓冲响应
    return new NextResponse(bufferToStream(finalBuffer), {
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
        'X-Transfer-Mode': transparencyOptions ? 'buffered-processed' : 'buffered',
        'Content-Disposition': `inline; filename="${buildFilename(randomImage.id, finalMimeType)}"`
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

function normalizeMimeType(mimeType: string | null | undefined, fallback: string): string {
  if (mimeType && mimeType.toLowerCase().startsWith('image/')) {
    return mimeType;
  }
  return fallback;
}

function getExtensionFromMime(mimeType: string): string {
  if (!mimeType) return 'jpg';
  const lower = mimeType.toLowerCase();
  if (lower.includes('jpeg')) return 'jpg';
  if (lower.includes('png')) return 'png';
  if (lower.includes('gif')) return 'gif';
  if (lower.includes('webp')) return 'webp';
  if (lower.includes('svg')) return 'svg';
  if (lower.includes('bmp')) return 'bmp';
  if (lower.includes('tiff')) return 'tif';
  return 'jpg';
}

function buildFilename(imageId: string, mimeType: string): string {
  const ext = getExtensionFromMime(mimeType);
  return `${imageId}.${ext}`;
}

function bufferToStream(buffer: Buffer): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(buffer));
      controller.close();
    }
  });
}

/**
 * 验证和解析查询参数（复用自 /api/random）
 */
async function validateAndParseParams(
  queryParams: Record<string, string>,
  apiConfig: any
): Promise<{ allowedGroupIds: string[]; allowedProviders: string[]; hasInvalidParams: boolean }> {
  const allowedGroupIds: string[] = [];
  const allowedProviders: string[] = [];
  let hasInvalidParams = false;

  // 保留查询参数（不参与业务参数校验）
  const RESERVED_PARAMS = new Set(['opacity', 'bgColor', 'key']);
  const filteredEntries = Object.entries(queryParams).filter(([key]) => !RESERVED_PARAMS.has(key));

  // 如果没有配置允许的参数，直接返回
  if (!apiConfig.allowedParameters || apiConfig.allowedParameters.length === 0) {
    // 当存在非保留参数时才判定为无效
    if (filteredEntries.length > 0) {
      hasInvalidParams = true;
    }
    return { allowedGroupIds, allowedProviders, hasInvalidParams };
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

    // 根据参数类型累积过滤条件
    if (paramConfig.type === 'provider') {
      if (paramConfig.mappedProviders && paramConfig.mappedProviders.length > 0) {
        allowedProviders.push(...paramConfig.mappedProviders);
      }
    } else {
      allowedGroupIds.push(...paramConfig.mappedGroups);
    }
  }

  // 去重
  const uniqueGroupIds = [...new Set(allowedGroupIds)];
  const uniqueProviders = [...new Set(allowedProviders)];

  return {
    allowedGroupIds: uniqueGroupIds,
    allowedProviders: uniqueProviders,
    hasInvalidParams
  };
}

/**
 * 从指定分组中获取随机图片（复用自 /api/random）
 */
async function getRandomImageFromGroups(groupIds: string[], provider?: string): Promise<Image | null> {
  if (groupIds.length === 0) {
    // 从所有图片中选择
    const images = await databaseService.getRandomImagesIncludingTelegram(1, undefined, undefined, provider);
    return images[0] || null;
  }

  // 从指定分组中选择
  // 如果有多个分组，随机选择一个分组，然后从该分组中获取随机图片
  const randomGroupIndex = Math.floor(Math.random() * groupIds.length);
  const selectedGroupId = groupIds[randomGroupIndex];

  const images = await databaseService.getRandomImagesIncludingTelegram(1, selectedGroupId, undefined, provider);
  const image = images[0] || null;

  if (!image && groupIds.length > 1) {
    // 如果选中的分组没有图片，尝试其他分组
    for (const groupId of groupIds) {
      if (groupId !== selectedGroupId) {
        const fallbackImages = await databaseService.getRandomImagesIncludingTelegram(1, groupId, undefined, provider);
        const fallbackImage = fallbackImages[0] || null;
        if (fallbackImage) {
          return fallbackImage;
        }
      }
    }
  }

  return image;
}

async function getRandomImageFromGroupsAndProviders(groupIds: string[], providers: string[]): Promise<Image | null> {
  const uniqueProviders = [...new Set((providers || []).filter(Boolean))];
  if (uniqueProviders.length === 0) {
    return getRandomImageFromGroups(groupIds);
  }

  // 2A：先均匀随机选 provider，再从该 provider 范围内取随机图；失败则回退到其它 provider
  const randomProviderIndex = Math.floor(Math.random() * uniqueProviders.length);
  const selectedProvider = uniqueProviders[randomProviderIndex];
  const tryProviders = [selectedProvider, ...uniqueProviders.filter(p => p !== selectedProvider)];

  for (const p of tryProviders) {
    const img = await getRandomImageFromGroups(groupIds, p);
    if (img) return img;
  }

  return null;
}

// 应用安全中间件和错误处理
export const GET = withErrorHandler(
  withSecurity({
    rateLimit: 'public',
    allowedMethods: ['GET'],
    enableAccessLog: true // 启用访问日志记录
  })(getImageResponse)
);
