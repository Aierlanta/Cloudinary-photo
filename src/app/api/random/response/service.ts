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
import { buildFetchInitFor } from '@/lib/telegram-proxy';
import {
  getCloudinaryManagedFormat,
  validateManagedResponseParams
} from '@/lib/response-params';

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

async function downloadBufferFromUrl(url: string): Promise<Buffer> {
  const response = await fetch(url, buildFetchInitFor(url, { cache: 'no-store' } as RequestInit));
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function serveRandomResponse(
  request: NextRequest,
  options?: {
    imageId?: string;
    requireDirectResponseEnabled?: boolean;
    requestPath?: string;
  }
): Promise<Response> {
  const startTime = performance.now();
  const url = new URL(request.url);
  const queryParams = Object.fromEntries(url.searchParams.entries());
  const imageId = options?.imageId ?? queryParams.imageId;
  const targetWidth = parseDimension(queryParams.width, 'width');
  const targetHeight = parseDimension(queryParams.height, 'height');
  const resizeFit = parseFit(queryParams.fit);
  const requestPath = options?.requestPath || '/api/random/response';
  const requireDirectResponseEnabled = options?.requireDirectResponseEnabled ?? true;

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

  let apiConfig = await databaseService.getAPIConfig();

  if (!apiConfig) {
    await databaseService.initialize();
    apiConfig = await databaseService.getAPIConfig();
    if (!apiConfig) {
      throw new AppError(ErrorType.INTERNAL_ERROR, 'API配置错误', 500);
    }
  }

  if (!apiConfig.isEnabled) {
    throw new AppError(ErrorType.FORBIDDEN, 'API服务暂时不可用', 403);
  }

  if (requireDirectResponseEnabled && !apiConfig.enableDirectResponse) {
    throw new AppError(ErrorType.FORBIDDEN, '直接响应模式未启用，请使用 /api/random', 403);
  }

  if (apiConfig.apiKeyEnabled) {
    const providedKey = queryParams.key;
    if (!providedKey || providedKey !== apiConfig.apiKey) {
      throw new AppError(ErrorType.UNAUTHORIZED, 'API Key无效', 401);
    }
  }

  const { requestedFormat, requestedQuality } = validateManagedResponseParams(queryParams, apiConfig);

  const image = await databaseService.getImage(imageId);
  if (!image) {
    throw new AppError(ErrorType.NOT_FOUND, '图片不存在', 404);
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
    !targetWidth &&
    !targetHeight &&
    !resizeFit &&
    (requestedFormat || typeof requestedQuality !== 'undefined');

  if (canUseCloudinaryNativeTransform) {
    try {
      const transformation: Record<string, string | number> = {};
      if (typeof requestedQuality !== 'undefined') {
        transformation.quality = requestedQuality;
      }
      if (requestedFormat) {
        transformation.fetch_format = getCloudinaryManagedFormat(requestedFormat);
        finalMimeType = requestedFormat === 'jpeg' ? 'image/jpeg' : 'image/webp';
      }

      imageBuffer = await cloudinaryService.downloadImage(image.publicId, [transformation]);
      finalMimeType = requestedFormat
        ? (requestedFormat === 'jpeg' ? 'image/jpeg' : 'image/webp')
        : finalMimeType;
      usedCloudinaryNativeTransform = true;
    } catch (error) {
      logger.warn('Cloudinary原生转换失败，回退到服务端处理', {
        type: 'api_random_response_fallback',
        error: error instanceof Error ? error.message : 'unknown'
      });
      imageBuffer = await downloadBufferFromUrl(imageUrl);
      finalMimeType = mimeType;
    }
  } else if (isCloudinaryUrl(imageUrl)) {
    try {
      imageBuffer = await cloudinaryService.downloadImage(image.publicId);
    } catch (error) {
      logger.warn('Cloudinary下载失败，使用URL回退获取', {
        type: 'api_random_response_fallback',
        error: error instanceof Error ? error.message : 'unknown'
      });
      imageBuffer = await downloadBufferFromUrl(imageUrl);
    }
  } else {
    imageBuffer = await downloadBufferFromUrl(imageUrl);
  }

  let finalBuffer = imageBuffer;
  if (transparencyOptions) {
    const processed = await adjustImageTransparency(imageBuffer, transparencyOptions);
    finalBuffer = processed.buffer;
    finalMimeType = processed.mimeType;
  }

  if (targetWidth || targetHeight) {
    const resized = await resizeImage(finalBuffer, {
      width: targetWidth,
      height: targetHeight,
      fit: resizeFit
    });
    finalBuffer = resized.buffer;
    finalMimeType = resized.mimeType ?? finalMimeType;
  }

  const needsFormatConversion =
    !usedCloudinaryNativeTransform &&
    (requestedFormat || typeof requestedQuality !== 'undefined');
  if (needsFormatConversion) {
    const fallbackFormat = MIME_TO_FORMAT[finalMimeType] || 'jpeg';
    const targetFormat = requestedFormat ?? fallbackFormat;
    const converted = await convertImageOutput(finalBuffer, {
      format: targetFormat,
      quality: requestedQuality
    });
    finalBuffer = converted.buffer;
    finalMimeType = converted.mimeType;
  }

  const size = finalBuffer.length;
  const duration = Math.round(performance.now() - startTime);

  logger.apiResponse('GET', requestPath, 200, duration, {
    imageId: image.id,
    imageSize: size,
    mimeType: finalMimeType,
    transparency: transparencyOptions ? 'processed' : 'original',
    outputFormat: finalMimeType,
    outputQuality: requestedQuality ?? 'original'
  });

  return new NextResponse(new Uint8Array(finalBuffer), {
    status: 200,
    headers: {
      'Content-Type': finalMimeType,
      'Content-Length': size.toString(),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Image-Id': image.id,
      'X-Image-PublicId': image.publicId,
      'X-Response-Time': `${duration}ms`,
      'X-Transfer-Mode': transparencyOptions ? 'processed' : 'original'
    }
  });
}

