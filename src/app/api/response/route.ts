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
import {
  adjustImageTransparency,
  parseTransparencyParams,
  convertImageOutput,
  resizeImage,
  type ResizeFit,
  type TransparencyOptions
} from '@/lib/image-processor';
import { convertTgStateToProxyUrl } from '@/lib/image-utils';
import { buildFetchInitFor, redactTelegramBotTokenInUrl } from '@/lib/telegram-proxy';
import type { Image } from '@/types/models';
import { validateManagedResponseParams } from '@/lib/response-params';
import {
  parseSelectionParams,
  type TimeWeightingOptions
} from '@/lib/selection-params';
import {
  buildRandomPrefetchCacheKey,
  getRandomPrefetchTtlMs,
  randomPrefetchCache,
  type CachedImageResponse,
  type ResponseOutputVariant
} from '@/lib/response-cache';
import {
  buildRemoteOwnerResolve,
  getExplicitlyOfflineNodeIds,
  isImageOwnedByCurrentNode
} from '@/lib/swarm-node';
import {
  buildExcludedNodeProviders,
  buildNodeProviderAvailabilityCacheKey,
  isExcludedByNodeProvider,
  isImageAllowedByNodeProviderAvailability,
  type ExcludedNodeProvider,
  type NodeProviderAvailability
} from '@/lib/node-provider-availability';


// 强制动态渲染
export const dynamic = 'force-dynamic'
const cloudinaryService = CloudinaryService.getInstance();
const MAX_RESIZE_DIMENSION = 3000;

interface ResponseResizeOptions {
  width?: number;
  height?: number;
  fit?: ResizeFit;
}

interface ResponseProcessingOptions {
  transparencyOptions: TransparencyOptions | null;
  requestedFormat?: 'jpeg' | 'webp';
  requestedQuality?: number;
  resizeOptions: ResponseResizeOptions;
}

function parseDimension(raw: string | undefined, name: string): number | undefined {
  if (typeof raw === 'undefined' || raw === '') return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0 || value > MAX_RESIZE_DIMENSION) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      `${name} 必须在 1-${MAX_RESIZE_DIMENSION} 之间`,
      400
    );
  }
  return Math.round(value);
}

function parseFit(raw?: string): ResizeFit | undefined {
  if (!raw) return undefined;
  const normalized = raw.toLowerCase();
  if (normalized === 'cover' || normalized === 'contain') {
    return normalized;
  }
  throw new AppError(ErrorType.VALIDATION_ERROR, 'fit 仅支持 cover 或 contain', 400);
}

function parseResizeOptions(queryParams: Record<string, string>): ResponseResizeOptions {
  const resizeOptions = {
    width: parseDimension(queryParams.width, 'width'),
    height: parseDimension(queryParams.height, 'height'),
    fit: parseFit(queryParams.fit)
  };

  if (resizeOptions.fit && !resizeOptions.width && !resizeOptions.height) {
    throw new AppError(ErrorType.VALIDATION_ERROR, '指定 fit 时需提供 width 或 height', 400);
  }

  return resizeOptions;
}

function buildOutputVariant(options: ResponseProcessingOptions): ResponseOutputVariant {
  return {
    format: options.requestedFormat,
    quality: options.requestedQuality,
    transparency: options.transparencyOptions,
    width: options.resizeOptions.width,
    height: options.resizeOptions.height,
    fit: options.resizeOptions.fit
  };
}

function hasOutputTransform(options: ResponseProcessingOptions): boolean {
  return Boolean(
    options.transparencyOptions ||
    options.requestedFormat ||
    typeof options.requestedQuality !== 'undefined' ||
    options.resizeOptions.width ||
    options.resizeOptions.height
  );
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

function copyOwnerResponseHeaders(ownerHeaders: Headers): Headers {
  const headers = new Headers();
  [
    'content-type',
    'content-disposition',
    'cache-control',
    'pragma',
    'expires',
    'x-image-id',
    'x-image-publicid',
    'x-image-size',
    'x-transfer-mode'
  ].forEach((key) => {
    const value = ownerHeaders.get(key);
    if (value) headers.set(key, value);
  });

  headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  headers.set('Pragma', 'no-cache');
  headers.set('Expires', '0');
  return headers;
}

async function proxyRemoteOwnerResponse(
  request: NextRequest,
  image: Pick<Image, 'id' | 'publicId' | 'ownerNodeId'>,
  mode: 'response' = 'response'
): Promise<Response | null> {
  const remoteResolve = buildRemoteOwnerResolve(request, image, mode);
  if (!remoteResolve) return null;

  try {
    const ownerResponse = await fetch(remoteResolve.url, {
      cache: 'no-store',
      redirect: 'follow'
    });
    const headers = copyOwnerResponseHeaders(ownerResponse.headers);
    headers.set('X-Image-Id', image.id);
    headers.set('X-Image-PublicId', image.publicId);
    headers.set('X-Swarm-Proxy', 'owner-node');
    headers.set('X-Owner-Node-Id', remoteResolve.owner.id);

    return new NextResponse(ownerResponse.body, {
      status: ownerResponse.status,
      statusText: ownerResponse.statusText,
      headers
    });
  } catch (error) {
    logger.warn('远端 owner 节点响应代理失败', {
      type: 'swarm_owner_proxy',
      imageId: image.id,
      ownerNodeId: remoteResolve.owner.id,
      ownerNodeResolvedBaseUrl: remoteResolve.owner.baseUrl,
      error: error instanceof Error ? error.message : String(error)
    });
    throw new AppError(
      ErrorType.EXTERNAL_SERVICE_ERROR,
      'owner 节点响应失败',
      502,
      {
        imageId: image.id,
        ownerNodeId: remoteResolve.owner.id
      }
    );
  }
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
        error: err instanceof Error ? redactTelegramBotTokenInUrl(err.message) : 'unknown',
        url: redactTelegramBotTokenInUrl(candidate.url)
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
          url: redactTelegramBotTokenInUrl(err.url),
          reason: candidate.reason
        });
      } else {
        logger.warn('图片下载异常', {
          type: 'api_download',
          error: redactTelegramBotTokenInUrl(err instanceof Error ? err.message : String(err)),
          url: redactTelegramBotTokenInUrl(candidate.url),
          reason: candidate.reason
        });
      }
    }
  }

  if (lastStatus === 404 || lastStatus === 410) {
    const safeUrl = lastUrl ? redactTelegramBotTokenInUrl(lastUrl) : (lastUrl ?? 'unknown');
    throw new AppError(
      ErrorType.NOT_FOUND,
      `源图返回 404 (${safeUrl})`,
      404,
      { url: lastUrl ? redactTelegramBotTokenInUrl(lastUrl) : lastUrl, status: lastStatus }
    );
  }

  if (lastStatus && lastStatus >= 500) {
    throw new AppError(
      ErrorType.EXTERNAL_SERVICE_ERROR,
      `源图服务错误 (${lastStatus})`,
      502,
      { url: lastUrl ? redactTelegramBotTokenInUrl(lastUrl) : lastUrl, status: lastStatus }
    );
  }

  throw new AppError(
    ErrorType.INTERNAL_ERROR,
    '下载图片失败',
    500,
    {
      url: lastUrl ? redactTelegramBotTokenInUrl(lastUrl) : lastUrl,
      status: lastStatus,
      error: redactTelegramBotTokenInUrl(lastError instanceof Error ? lastError.message : String(lastError ?? ''))
    }
  );
}

async function buildFinalResponsePayload(
  image: Image,
  request: NextRequest | undefined,
  options: ResponseProcessingOptions
): Promise<CachedImageResponse & { via: string; usedUrl: string }> {
  const baseMimeType = getMimeTypeFromUrl(image.url);
  const downloaded = await downloadImageWithCandidates(image, request, baseMimeType);

  let finalBuffer = downloaded.buffer;
  let finalMimeType = downloaded.mimeType;

  if (options.transparencyOptions) {
    const processed = await adjustImageTransparency(finalBuffer, options.transparencyOptions);
    finalBuffer = processed.buffer;
    finalMimeType = processed.mimeType;
  }

  if (options.resizeOptions.width || options.resizeOptions.height) {
    const resized = await resizeImage(finalBuffer, {
      width: options.resizeOptions.width,
      height: options.resizeOptions.height,
      fit: options.resizeOptions.fit
    });
    finalBuffer = resized.buffer;
    finalMimeType = resized.mimeType ?? finalMimeType;
  }

  const needsManagedConversion = options.requestedFormat || typeof options.requestedQuality !== 'undefined';
  if (needsManagedConversion) {
    const converted = await convertImageOutput(finalBuffer, {
      format: options.requestedFormat ?? (normalizeMimeType(finalMimeType, 'image/jpeg').includes('webp') ? 'webp' : 'jpeg'),
      quality: options.requestedQuality
    });
    finalBuffer = converted.buffer;
    finalMimeType = converted.mimeType;
  }

  return {
    buffer: finalBuffer,
    mimeType: finalMimeType,
    size: finalBuffer.length,
    imageId: image.id,
    publicId: image.publicId,
    ownerNodeId: image.ownerNodeId,
    primaryProvider: image.primaryProvider,
    createdAt: Date.now(),
    via: downloaded.reason,
    usedUrl: downloaded.usedUrl
  };
}

async function prefetchNext(
  key: string,
  groupIds: string[],
  providers: string[],
  processingOptions: ResponseProcessingOptions,
  timeWeighting?: TimeWeightingOptions,
  request?: NextRequest,
  excludeNodeProviders: ExcludedNodeProvider[] = []
): Promise<void> {
  const ttlMs = getRandomPrefetchTtlMs(timeWeighting);
  const existingInflight = randomPrefetchCache.getInflight(key);
  if (existingInflight) return existingInflight;

  const inflight = (async () => {
    try {
      let attempts = 0;
      const maxAttempts = Math.max(randomPrefetchCache.getPerKey() * 3, 3);

      while (randomPrefetchCache.getItemCount(key) < randomPrefetchCache.getPerKey() && attempts < maxAttempts) {
        attempts += 1;
        const img = await getRandomImageFromGroupsAndProviders(
          groupIds,
          providers,
          timeWeighting,
          excludeNodeProviders
        );
        if (!img) return;
        if (!isImageOwnedByCurrentNode(img, request)) continue;

        const payload = await buildFinalResponsePayload(img, request, processingOptions);
        randomPrefetchCache.enqueue(key, payload, ttlMs);

        logger.info('预取完成', {
          type: 'api_prefetch',
          key,
          imageId: img.id,
          size: payload.size,
          ttlMs,
          via: payload.via,
          url: redactTelegramBotTokenInUrl(payload.usedUrl)
        });
      }
    } catch (err) {
      // 失败不影响主流程
      logger.warn('预取失败', {
        type: 'api_prefetch',
        key,
        error: err instanceof Error ? redactTelegramBotTokenInUrl(err.message) : 'unknown',
        status: err instanceof AppError ? err.statusCode : undefined
      });
    } finally {
      randomPrefetchCache.clearInflight(key);
    }
  })();

  randomPrefetchCache.setInflight(key, inflight, ttlMs);
  await inflight;
}

// 测试辅助：重置预取缓存（仅测试调用）
function resetPrefetchCacheForTests() {
  randomPrefetchCache.reset();
}

// 测试辅助：等待指定 key 的预取完成（仅测试调用）
async function waitForPrefetchForTests(key: string, timeoutMs: number = 500): Promise<void> {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    const state = randomPrefetchCache.getState(key);
    if (state.itemCount > 0 && !state.hasInflight) return;

    const inflight = randomPrefetchCache.getInflight(key);
    if (inflight) {
      try {
        await inflight;
      } catch {
        // ignore
      }
    }

    await new Promise((r) => setTimeout(r, 5));
  }
}

function getPrefetchKeysForTests(): string[] {
  return randomPrefetchCache.keys();
}

function getPrefetchStateForTests(key: string): {
  hasSlot: boolean;
  hasItem: boolean;
  itemCount: number;
  hasInflight: boolean;
  expiresAt?: number;
} {
  return randomPrefetchCache.getState(key);
}

function setPrefetchSlotForTests(key: string, expiresAt: number, hasItem: boolean = true) {
  randomPrefetchCache.setSlotForTests(
    key,
    expiresAt,
    hasItem
      ? {
          buffer: Buffer.from('test'),
          mimeType: 'image/jpeg',
          size: 4,
          imageId: key,
          publicId: key,
          createdAt: Date.now()
        }
      : undefined
  );
}

if (process.env.NODE_ENV === 'test') {
  (globalThis as { __resetPrefetchCacheForTests?: () => void; __waitForPrefetchForTests?: (key: string, timeoutMs?: number) => Promise<void>; __getPrefetchKeysForTests?: () => string[] }).__resetPrefetchCacheForTests = resetPrefetchCacheForTests;
  (globalThis as { __resetPrefetchCacheForTests?: () => void; __waitForPrefetchForTests?: (key: string, timeoutMs?: number) => Promise<void>; __getPrefetchKeysForTests?: () => string[] }).__waitForPrefetchForTests = waitForPrefetchForTests;
  (globalThis as { __resetPrefetchCacheForTests?: () => void; __waitForPrefetchForTests?: (key: string, timeoutMs?: number) => Promise<void>; __getPrefetchKeysForTests?: () => string[]; __getPrefetchStateForTests?: (key: string) => { hasSlot: boolean; hasItem: boolean; itemCount: number; hasInflight: boolean; expiresAt?: number } }).__getPrefetchKeysForTests = getPrefetchKeysForTests;
  (globalThis as { __resetPrefetchCacheForTests?: () => void; __waitForPrefetchForTests?: (key: string, timeoutMs?: number) => Promise<void>; __getPrefetchKeysForTests?: () => string[]; __getPrefetchStateForTests?: (key: string) => { hasSlot: boolean; hasItem: boolean; itemCount: number; hasInflight: boolean; expiresAt?: number } }).__getPrefetchStateForTests = getPrefetchStateForTests;
  (globalThis as { __setPrefetchSlotForTests?: (key: string, expiresAt: number, hasItem?: boolean) => void }).__setPrefetchSlotForTests = setPrefetchSlotForTests;
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

    const { requestedFormat, requestedQuality } = validateManagedResponseParams(queryParams, apiConfig);
    const selectionParams = parseSelectionParams(queryParams, apiConfig);
    const resizeOptions = parseResizeOptions(queryParams);
    const processingOptions: ResponseProcessingOptions = {
      transparencyOptions,
      requestedFormat,
      requestedQuality,
      resizeOptions
    };
    const outputVariant = buildOutputVariant(processingOptions);

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

    const nodeProviderAvailability = apiConfig.nodeProviderAvailability as NodeProviderAvailability | undefined;
    const excludeNodeProviders = buildExcludedNodeProviders(nodeProviderAvailability);
    const nodeProviderAvailabilityKey = buildNodeProviderAvailabilityCacheKey(nodeProviderAvailability);

    // 预取命中优先：队列项已经完成输出处理，命中后直接消费并异步补齐
    const cacheKey = buildRandomPrefetchCacheKey({
      groupIds: targetGroupIds,
      providers: allowedProviders,
      timeWeighting: selectionParams.timeWeighting,
      output: outputVariant,
      nodeProviderAvailabilityKey
    });
    const prefetched = randomPrefetchCache.take(cacheKey);
    if (
      prefetched
      && isImageAllowedByNodeProviderAvailability(
        {
          ownerNodeId: prefetched.ownerNodeId,
          primaryProvider: prefetched.primaryProvider
        },
        nodeProviderAvailability
      )
    ) {
      const ownerProxyResponse = await proxyRemoteOwnerResponse(request, {
        id: prefetched.imageId,
        publicId: prefetched.publicId,
        ownerNodeId: prefetched.ownerNodeId
      });
      if (ownerProxyResponse) {
        ownerProxyResponse.headers.set('X-Prefetch-Owner-Recheck', 'proxied');
        return ownerProxyResponse;
      }

      const duration = Math.round(performance.now() - startTime);

      logger.info('预取命中，直接返回', {
        type: 'api_prefetch',
        key: cacheKey,
        imageId: prefetched.imageId,
        size: prefetched.size,
        outputTransform: hasOutputTransform(processingOptions)
      });

      prefetchNext(
        cacheKey,
        targetGroupIds,
        allowedProviders,
        processingOptions,
        selectionParams.timeWeighting,
        request,
        excludeNodeProviders
      ).catch(() => {});

      return new NextResponse(bufferToStream(prefetched.buffer), {
        status: 200,
        headers: {
          'Content-Type': prefetched.mimeType,
          'Content-Length': prefetched.size.toString(),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Image-Id': prefetched.imageId,
          'X-Image-PublicId': prefetched.publicId,
          'X-Image-Size': prefetched.size.toString(),
          'X-Response-Time': `${duration}ms`,
          'X-Transfer-Mode': hasOutputTransform(processingOptions) ? 'prefetch-processed' : 'prefetch',
          'Content-Disposition': `inline; filename="${buildFilename(prefetched.imageId, prefetched.mimeType)}"`
        }
      });
    }


    // 获取随机图片（复用现有逻辑）
    const randomImage = await getRandomImageFromGroupsAndProviders(
      targetGroupIds,
      allowedProviders,
      selectionParams.timeWeighting,
      excludeNodeProviders
    );

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

    const ownerProxyResponse = await proxyRemoteOwnerResponse(request, randomImage);
    if (ownerProxyResponse) {
      return ownerProxyResponse;
    }

    const payload = await buildFinalResponsePayload(randomImage, request, processingOptions);
    const size = payload.size;
    const duration = Math.round(performance.now() - startTime);

    // 记录成功响应
    logger.apiResponse('GET', '/api/response', 200, duration, {
      imageId: randomImage.id,
      imageSize: size,
      mimeType: payload.mimeType,
      mode: 'buffered',
      transparency: transparencyOptions ? 'processed' : 'original',
      outputTransform: hasOutputTransform(processingOptions),
      via: payload.via,
      url: redactTelegramBotTokenInUrl(payload.usedUrl)
    });

    // 异步补齐预取队列（不阻塞响应）
    prefetchNext(
      cacheKey,
      targetGroupIds,
      allowedProviders,
      processingOptions,
      selectionParams.timeWeighting,
      request,
      excludeNodeProviders
    ).catch(() => {});

    // 返回缓冲响应
    return new NextResponse(bufferToStream(payload.buffer), {
      status: 200,
      headers: {
        'Content-Type': payload.mimeType,
        'Content-Length': size.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Image-Id': randomImage.id,
        'X-Image-PublicId': randomImage.publicId,
        'X-Response-Time': `${duration}ms`,
        'X-Image-Size': size.toString(),
        'X-Transfer-Mode': hasOutputTransform(processingOptions) ? 'buffered-processed' : 'buffered',
        'Content-Disposition': `inline; filename="${buildFilename(randomImage.id, payload.mimeType)}"`
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
  const RESERVED_PARAMS = new Set(['opacity', 'bgColor', 'key', 'origin', 'format', 'quality', 'width', 'height', 'fit', 'timeWindow', 'timeWeight', 'timeStart', 'timeEnd', 'timeZone']);
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
      const providers = Array.isArray(paramConfig.mappedProviders) ? paramConfig.mappedProviders : [];
      if (providers.length > 0) allowedProviders.push(...providers);
    } else {
      const groups = Array.isArray(paramConfig.mappedGroups) ? paramConfig.mappedGroups : [];
      if (groups.length > 0) allowedGroupIds.push(...groups);
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
async function getRandomImageFromGroups(
  groupIds: string[],
  provider?: string,
  timeWeighting?: TimeWeightingOptions
): Promise<Image | null> {
  const selector = (databaseService as any).selectRandomImages;
  if (typeof selector === 'function') {
    const result = await selector.call(databaseService, {
      count: 1,
      groupIds,
      providers: provider ? [provider] : undefined,
      includeTelegram: true,
      timeWeighting
    });
    return result.images[0] || null;
  }

  if (timeWeighting) {
    throw new AppError(
      ErrorType.INTERNAL_ERROR,
      '当前数据库服务不支持时间窗口加权随机',
      500
    );
  }

  if (groupIds.length === 0) {
    const images = await databaseService.getRandomImagesIncludingTelegram(1, undefined, undefined, provider);
    return images[0] || null;
  }

  const randomGroupIndex = Math.floor(Math.random() * groupIds.length);
  const selectedGroupId = groupIds[randomGroupIndex];
  const images = await databaseService.getRandomImagesIncludingTelegram(1, selectedGroupId, undefined, provider);
  const image = images[0] || null;

  if (!image && groupIds.length > 1) {
    for (const groupId of groupIds) {
      if (groupId === selectedGroupId) {
        continue;
      }
      const fallbackImages = await databaseService.getRandomImagesIncludingTelegram(1, groupId, undefined, provider);
      const fallbackImage = fallbackImages[0] || null;
      if (fallbackImage) {
        return fallbackImage;
      }
    }
  }

  return image;
}

async function getRandomImageFromGroupsAndProviders(
  groupIds: string[],
  providers: string[],
  timeWeighting?: TimeWeightingOptions,
  excludeNodeProviders: ExcludedNodeProvider[] = []
): Promise<Image | null> {
  const excludeOwnerNodeIds = await getExplicitlyOfflineNodeIds();
  const selector = (databaseService as any).selectRandomImages;
  if (typeof selector === 'function') {
    const result = await selector.call(databaseService, {
      count: 1,
      groupIds,
      providers,
      includeTelegram: true,
      excludeOwnerNodeIds,
      excludeNodeProviders,
      timeWeighting
    });
    return result.images[0] || null;
  }

  if (timeWeighting) {
    throw new AppError(
      ErrorType.INTERNAL_ERROR,
      '当前数据库服务不支持时间窗口加权随机',
      500
    );
  }

  const uniqueProviders = [...new Set((providers || []).filter(Boolean))];
  if (uniqueProviders.length === 0) {
    const image = await getRandomImageFromGroups(groupIds);
    if (
      image
      && !(image.ownerNodeId && excludeOwnerNodeIds.includes(image.ownerNodeId))
      && !isExcludedByNodeProvider(image, excludeNodeProviders)
    ) {
      return image;
    }
    return null;
  }

  const randomProviderIndex = Math.floor(Math.random() * uniqueProviders.length);
  const selectedProvider = uniqueProviders[randomProviderIndex];
  const tryProviders = [selectedProvider, ...uniqueProviders.filter((provider) => provider !== selectedProvider)];

  for (const provider of tryProviders) {
    const image = await getRandomImageFromGroups(groupIds, provider);
    if (
      image
      && !(image.ownerNodeId && excludeOwnerNodeIds.includes(image.ownerNodeId))
      && !isExcludedByNodeProvider(image, excludeNodeProviders)
    ) {
      return image;
    }
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
