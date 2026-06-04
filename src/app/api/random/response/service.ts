import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '@/lib/database';
import { CloudinaryService } from '@/lib/cloudinary';
import { logger } from '@/lib/logger';
import { AppError, ErrorType } from '@/types/errors';
import { convertTgStateToProxyUrl } from '@/lib/image-utils';
import {
  adjustImageTransparency,
  parseTransparencyParams,
  convertImageOutput,
  OutputFormat,
  resizeImage,
  ResizeFit
} from '@/lib/image-processor';
import { buildFetchInitFor, redactTelegramBotTokenInUrl } from '@/lib/telegram-proxy';
import {
  getCloudinaryManagedFormat,
  type ManagedResponseEndpoint,
  validateManagedResponseParams
} from '@/lib/response-params';
import { createRemoteOwnerRedirect } from '@/lib/swarm-node';
import { attachPerfHeadersToResponse, createRequestMetrics } from '@/lib/perf';
import type { RequestMetrics } from '@/lib/perf';
import {
  buildFinalResponseCacheKey,
  finalResponseCache,
  type ResponseOutputVariant
} from '@/lib/response-cache';

const cloudinaryService = CloudinaryService.getInstance();

const MIME_TO_FORMAT: Record<string, OutputFormat> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};
const MAX_RESIZE_DIMENSION = 3000;

function isCloudinaryUrl(urlStr: string): boolean {
  try {
    const { hostname } = new URL(urlStr);
    if (hostname === 'res.cloudinary.com') {
      return true;
    }
    if (/^res-[1-5]\.cloudinary\.com$/i.test(hostname)) {
      return true;
    }
    const customHosts = (process.env.CLOUDINARY_ALLOWED_HOSTS || '')
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
    return customHosts.includes(hostname.toLowerCase());
  } catch {
    return false;
  }
}

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
      return 'image/jpeg';
  }
}

function parseDimension(raw?: string, name?: string): number | undefined {
  if (typeof raw === 'undefined') return undefined;
  if (raw === '') return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0 || value > MAX_RESIZE_DIMENSION) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      `${name || 'dimension'} 必须在 1-${MAX_RESIZE_DIMENSION} 之间`,
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

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return realIP || 'unknown';
}

function buildManagedCacheControl(image: any, requestPath: string): string {
  const isDeterministicPath = requestPath !== '/api/random';
  const isTelegramSource = image?.primaryProvider === 'telegram' || !!image?.telegramBotToken;

  if (!isDeterministicPath || isTelegramSource) {
    return 'no-cache, no-store, must-revalidate';
  }

  return 'public, max-age=300, s-maxage=900, stale-while-revalidate=86400';
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
}

function normalizeMimeType(mimeType: string | null | undefined, fallback: string): string {
  if (mimeType && mimeType.toLowerCase().startsWith('image/')) {
    return mimeType;
  }
  return fallback;
}

function parseTelegramBotId(image: any): string | undefined {
  if (image.storageMetadata) {
    try {
      const meta = JSON.parse(image.storageMetadata);
      if (meta?.telegramBotId) return String(meta.telegramBotId);
    } catch {
      // ignore
    }
  }
  if (image.telegramBotToken) {
    const prefix = image.telegramBotToken.split(':')[0];
    if (/^\d+$/.test(prefix)) return prefix;
  }
  return undefined;
}

function buildDownloadCandidates(image: any, request: NextRequest, imageUrl: string): DownloadCandidate[] {
  const candidates: DownloadCandidate[] = [];
  const botId = parseTelegramBotId(image);

  if (image.telegramFileId) {
    const tgUrl = new URL('/api/telegram/image', request.url);
    tgUrl.searchParams.set('file_id', image.telegramFileId);
    if (botId) tgUrl.searchParams.set('bot_id', botId);
    if (image.telegramFilePath) tgUrl.searchParams.set('file_path', image.telegramFilePath);
    candidates.push({ url: tgUrl.toString(), reason: 'telegram-file-id' });
  }

  if (image.telegramFilePath && image.telegramBotToken) {
    candidates.push({
      url: `https://api.telegram.org/file/bot${image.telegramBotToken}/${image.telegramFilePath}`,
      reason: 'telegram-direct-path'
    });
  }

  candidates.push({ url: imageUrl, reason: 'resolved-url' });

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.url)) return false;
    seen.add(candidate.url);
    return true;
  });
}

async function downloadFromCandidate(
  candidate: DownloadCandidate,
  baseMimeType: string
): Promise<{ buffer: Buffer; mimeType: string; usedUrl: string; reason: string }> {
  const response = await fetch(candidate.url, buildFetchInitFor(candidate.url, { cache: 'no-store' } as RequestInit));
  if (!response.ok) {
    throw new HttpStatusError(response.status, response.statusText, candidate.url);
  }
  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: normalizeMimeType(response.headers.get('content-type'), baseMimeType),
    usedUrl: candidate.url,
    reason: candidate.reason
  };
}

async function downloadImageWithCandidates(
  image: any,
  request: NextRequest,
  imageUrl: string,
  baseMimeType: string
): Promise<{ buffer: Buffer; mimeType: string; usedUrl: string; reason: string }> {
  const candidates = buildDownloadCandidates(image, request, imageUrl);
  let lastStatus: number | undefined;
  let lastUrl: string | undefined;
  let lastError: unknown;

  for (const candidate of candidates) {
    try {
      return await downloadFromCandidate(candidate, baseMimeType);
    } catch (error) {
      lastError = error;
      if (error instanceof HttpStatusError) {
        lastStatus = error.status;
        lastUrl = error.url;
        logger.warn('随机响应图片下载失败', {
          type: 'api_random_response_download',
          status: error.status,
          statusText: error.statusText,
          url: redactTelegramBotTokenInUrl(error.url),
          reason: candidate.reason
        });
      } else {
        logger.warn('随机响应图片下载异常', {
          type: 'api_random_response_download',
          error: redactTelegramBotTokenInUrl(error instanceof Error ? error.message : String(error)),
          url: redactTelegramBotTokenInUrl(candidate.url),
          reason: candidate.reason
        });
      }
    }
  }

  if (lastStatus === 404 || lastStatus === 410) {
    const safeUrl = lastUrl ? redactTelegramBotTokenInUrl(lastUrl) : 'unknown';
    throw new AppError(
      ErrorType.NOT_FOUND,
      `源图返回 ${lastStatus} (${safeUrl})`,
      404,
      { url: safeUrl, status: lastStatus }
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

export async function serveRandomResponse(
  request: NextRequest,
  options?: {
    imageId?: string;
    image?: Awaited<ReturnType<typeof databaseService.getImage>> | null;
    requireDirectResponseEnabled?: boolean;
    requestPath?: string;
    skipNodeHandoff?: boolean;
    skipApiKeyAuth?: boolean;
    metrics?: RequestMetrics;
  }
): Promise<Response> {
  const url = new URL(request.url);
  const queryParams = Object.fromEntries(url.searchParams.entries());
  const imageId = options?.imageId ?? queryParams.imageId;
  const targetWidth = parseDimension(queryParams.width, 'width');
  const targetHeight = parseDimension(queryParams.height, 'height');
  const resizeFit = parseFit(queryParams.fit);
  const requestPath = options?.requestPath || '/api/random/response';
  const requireDirectResponseEnabled = options?.requireDirectResponseEnabled ?? true;
  const metrics = options?.metrics ?? createRequestMetrics(requestPath);

  if (resizeFit && !targetWidth && !targetHeight) {
    throw new AppError(ErrorType.VALIDATION_ERROR, '指定 fit 时需提供 width 或 height', 400);
  }

  if (!imageId) {
    throw new AppError(ErrorType.VALIDATION_ERROR, '缺少 imageId 参数', 400);
  }

  const transparencyOptions = parseTransparencyParams(queryParams.opacity, queryParams.bgColor);
  const redactedParams = { ...queryParams };
  if (typeof redactedParams.key !== 'undefined') {
    redactedParams.key = '***';
  }

  logger.info('收到随机响应图片请求', {
    type: 'api_request',
    method: 'GET',
    path: requestPath,
    params: redactedParams,
    ip: getClientIP(request),
    userAgent: request.headers.get('user-agent')
  });

  const apiConfig = await metrics.time('db.api_config', async () => databaseService.getAPIConfig(metrics));
  if (!apiConfig) {
    throw new AppError(ErrorType.INTERNAL_ERROR, 'API配置未初始化', 500);
  }

  if (!apiConfig.isEnabled) {
    throw new AppError(ErrorType.FORBIDDEN, 'API服务暂时不可用', 403);
  }

  if (requireDirectResponseEnabled && !apiConfig.enableDirectResponse) {
    throw new AppError(ErrorType.FORBIDDEN, '直接响应模式未启用，请使用 /api/random', 403);
  }

  if (apiConfig.apiKeyEnabled && !options?.skipApiKeyAuth) {
    const providedKey = queryParams.key;
    if (!providedKey || providedKey !== apiConfig.apiKey) {
      throw new AppError(ErrorType.UNAUTHORIZED, 'API Key无效', 401);
    }
  }

  const endpoint: ManagedResponseEndpoint = requestPath === '/api/random' ? 'random' : 'response';
  const { requestedFormat, requestedQuality } = validateManagedResponseParams(queryParams, apiConfig, endpoint);
  const image = options?.image ?? await metrics.time('db.image_lookup', async () => databaseService.getImage(imageId));
  if (!options?.image) {
    metrics.addDbQueries(1);
  }
  if (!image) {
    throw new AppError(ErrorType.NOT_FOUND, '图片不存在', 404);
  }

  if (!options?.skipNodeHandoff) {
    const mode = requestPath === '/api/random' ? 'random-response' : 'response';
    const ownerRedirect = createRemoteOwnerRedirect(request, image, mode);
    if (ownerRedirect) {
      metrics.setMeta('mode', 'owner_handoff');
      return attachPerfHeadersToResponse(ownerRedirect, metrics);
    }
  }

  const outputVariant: ResponseOutputVariant = {
    format: requestedFormat,
    quality: requestedQuality,
    transparency: transparencyOptions,
    width: targetWidth,
    height: targetHeight,
    fit: resizeFit
  };
  const finalCacheKey = buildFinalResponseCacheKey(image as any, outputVariant);
  const cacheControl = buildManagedCacheControl(image, requestPath);
  const cached = finalResponseCache.get(finalCacheKey);
  if (cached) {
    metrics.setMeta('mode', 'final-cache');
    logger.apiResponse('GET', requestPath, 200, Math.round(metrics.finish().totalMs), {
      imageId: image.id,
      imageSize: cached.size,
      mimeType: cached.mimeType,
      cache: 'final-hit'
    });

    const response = new NextResponse(new Uint8Array(cached.buffer), {
      status: 200,
      headers: {
        'Content-Type': cached.mimeType,
        'Content-Length': cached.size.toString(),
        'Cache-Control': cacheControl,
        ...(cacheControl.includes('no-store')
          ? {
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          : {}),
        'X-Image-Id': image.id,
        'X-Image-PublicId': image.publicId,
        'X-Transfer-Mode': 'final-cache'
      }
    });
    return attachPerfHeadersToResponse(response, metrics);
  }

  let imageUrl = image.url.replace(/^http:/, 'https:');
  imageUrl = convertTgStateToProxyUrl(imageUrl);

  try {
    const urlObj = new URL(imageUrl, request.url);
    if (urlObj.pathname.startsWith('/api/telegram/image')) {
      const telegramFilePath = (image as any).telegramFilePath;
      if (telegramFilePath && !urlObj.searchParams.get('file_path')) {
        urlObj.searchParams.set('file_path', telegramFilePath);
      }
    }
    imageUrl = urlObj.toString();
  } catch {
    // ignore
  }

  const mimeType = getMimeTypeFromUrl(image.url);
  let imageBuffer: Buffer;
  let finalMimeType = mimeType;
  let usedCloudinaryNativeTransform = false;
  const canUseCloudinaryNativeTransform =
    isCloudinaryUrl(imageUrl) &&
    !transparencyOptions &&
    (targetWidth || targetHeight || resizeFit || requestedFormat || typeof requestedQuality !== 'undefined');

  if (canUseCloudinaryNativeTransform) {
    try {
      const transformation: Record<string, string | number> = {};
      if (targetWidth) {
        transformation.width = targetWidth;
      }
      if (targetHeight) {
        transformation.height = targetHeight;
      }
      if (targetWidth || targetHeight) {
        transformation.crop = resizeFit === 'contain' ? 'fit' : 'fill';
      }
      if (typeof requestedQuality !== 'undefined') {
        transformation.quality = requestedQuality;
      }
      if (requestedFormat) {
        transformation.fetch_format = getCloudinaryManagedFormat(requestedFormat);
        finalMimeType = requestedFormat === 'jpeg' ? 'image/jpeg' : 'image/webp';
      }

      imageBuffer = await metrics.time('origin.cloudinary_transform', async () => (
        cloudinaryService.downloadImage(image.publicId, [transformation])
      ));
      finalMimeType = requestedFormat
        ? (requestedFormat === 'jpeg' ? 'image/jpeg' : 'image/webp')
        : finalMimeType;
      usedCloudinaryNativeTransform = true;
    } catch (error) {
      logger.warn('Cloudinary原生转换失败，回退到服务端处理', {
        type: 'api_random_response_fallback',
        error: error instanceof Error ? error.message : 'unknown'
      });
      const downloaded = await metrics.time('origin.download_fallback', async () => (
        downloadImageWithCandidates(image, request, imageUrl, mimeType)
      ));
      imageBuffer = downloaded.buffer;
      finalMimeType = downloaded.mimeType;
    }
  } else if (isCloudinaryUrl(imageUrl)) {
    try {
      imageBuffer = await metrics.time('origin.cloudinary_download', async () => (
        cloudinaryService.downloadImage(image.publicId)
      ));
    } catch (error) {
      logger.warn('Cloudinary下载失败，使用URL回退获取', {
        type: 'api_random_response_fallback',
        error: error instanceof Error ? error.message : 'unknown'
      });
      const downloaded = await metrics.time('origin.download_fallback', async () => (
        downloadImageWithCandidates(image, request, imageUrl, mimeType)
      ));
      imageBuffer = downloaded.buffer;
      finalMimeType = downloaded.mimeType;
    }
  } else {
    const downloaded = await metrics.time('origin.download', async () => (
      downloadImageWithCandidates(image, request, imageUrl, mimeType)
    ));
    imageBuffer = downloaded.buffer;
    finalMimeType = downloaded.mimeType;
  }

  let finalBuffer = imageBuffer;
  if (transparencyOptions) {
    const processed = await metrics.time('transform.transparency', async () => (
      adjustImageTransparency(imageBuffer, transparencyOptions)
    ));
    finalBuffer = processed.buffer;
    finalMimeType = processed.mimeType;
  }

  if ((targetWidth || targetHeight) && !usedCloudinaryNativeTransform) {
    const resized = await metrics.time('transform.resize', async () => (
      resizeImage(finalBuffer, {
        width: targetWidth,
        height: targetHeight,
        fit: resizeFit
      })
    ));
    finalBuffer = resized.buffer;
    finalMimeType = resized.mimeType ?? finalMimeType;
  }

  const needsFormatConversion =
    !usedCloudinaryNativeTransform &&
    (requestedFormat || typeof requestedQuality !== 'undefined');
  if (needsFormatConversion) {
    const fallbackFormat = MIME_TO_FORMAT[finalMimeType] || 'jpeg';
    const targetFormat = requestedFormat ?? fallbackFormat;
    const converted = await metrics.time('transform.output', async () => (
      convertImageOutput(finalBuffer, {
        format: targetFormat,
        quality: requestedQuality
      })
    ));
    finalBuffer = converted.buffer;
    finalMimeType = converted.mimeType;
  }

  const size = finalBuffer.length;
  const responseMode =
    transparencyOptions || targetWidth || targetHeight || requestedFormat || typeof requestedQuality !== 'undefined'
      ? 'transform'
      : 'buffer';
  metrics.setMeta('mode', responseMode);
  finalResponseCache.set(finalCacheKey, {
    buffer: finalBuffer,
    mimeType: finalMimeType,
    size,
    imageId: image.id,
    publicId: image.publicId,
    ownerNodeId: image.ownerNodeId,
    createdAt: Date.now()
  });

  logger.apiResponse('GET', requestPath, 200, Math.round(metrics.finish().totalMs), {
    imageId: image.id,
    imageSize: size,
    mimeType: finalMimeType,
    transparency: transparencyOptions ? 'processed' : 'original',
    outputFormat: finalMimeType,
    outputQuality: requestedQuality ?? 'original'
  });

  const response = new NextResponse(new Uint8Array(finalBuffer), {
    status: 200,
    headers: {
      'Content-Type': finalMimeType,
      'Content-Length': size.toString(),
      'Cache-Control': cacheControl,
      ...(cacheControl.includes('no-store')
        ? {
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        : {}),
      'X-Image-Id': image.id,
      'X-Image-PublicId': image.publicId,
      'X-Transfer-Mode': responseMode
    }
  });
  return attachPerfHeadersToResponse(response, metrics);
}

