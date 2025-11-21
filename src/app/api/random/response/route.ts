/**
 * /api/random/response
 * 根据指定 imageId 返回图片数据流（专供 /api/random?response=true 使用）
 */

import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '@/lib/database';
import { CloudinaryService } from '@/lib/cloudinary';
import { withSecurity } from '@/lib/security';
import { withErrorHandler } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import { AppError, ErrorType } from '@/types/errors';
import { convertTgStateToProxyUrl } from '@/lib/image-utils';
import {
  adjustImageTransparency,
  parseTransparencyParams,
  convertImageOutput,
  OutputFormat
} from '@/lib/image-processor';
import { buildFetchInitFor } from '@/lib/telegram-proxy';

const cloudinaryService = CloudinaryService.getInstance();

const SUPPORTED_FORMATS: OutputFormat[] = ['jpeg', 'png', 'webp', 'gif'];
const MIME_TO_FORMAT: Record<string, OutputFormat> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

function normalizeOutputFormat(format?: string): OutputFormat | null {
  if (!format) {
    return null;
  }
  const normalized = format.toLowerCase();
  const mapped = normalized === 'jpg' ? 'jpeg' : normalized;
  return SUPPORTED_FORMATS.includes(mapped as OutputFormat) ? (mapped as OutputFormat) : null;
}

export const dynamic = 'force-dynamic';

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

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return realIP || 'unknown';
}

export async function serveRandomResponse(
  request: NextRequest,
  options?: { imageId?: string }
): Promise<Response> {
  const startTime = performance.now();
  const url = new URL(request.url);
  const queryParams = Object.fromEntries(url.searchParams.entries());
  const imageId = options?.imageId ?? queryParams.imageId;
  const requestedFormat = normalizeOutputFormat(queryParams.format);

  if (queryParams.format && !requestedFormat) {
    throw new AppError(ErrorType.VALIDATION_ERROR, '不支持的输出格式', 400);
  }

  let requestedQuality: number | undefined;
  if (typeof queryParams.quality !== 'undefined') {
    const parsedQuality = Number(queryParams.quality);
    if (!Number.isFinite(parsedQuality) || parsedQuality < 1 || parsedQuality > 100) {
      throw new AppError(ErrorType.VALIDATION_ERROR, '图片质量需为1-100之间的数字', 400);
    }
    requestedQuality = Math.round(parsedQuality);
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
    path: '/api/random/response',
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

  if (!apiConfig.enableDirectResponse) {
    throw new AppError(ErrorType.FORBIDDEN, '直接响应模式未启用，请使用 /api/random', 403);
  }

  if (apiConfig.apiKeyEnabled) {
    const providedKey = queryParams.key;
    if (!providedKey || providedKey !== apiConfig.apiKey) {
      throw new AppError(ErrorType.UNAUTHORIZED, 'API Key无效', 401);
    }
  }

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

  if (isCloudinaryUrl(imageUrl)) {
    try {
      imageBuffer = await cloudinaryService.downloadImage(image.publicId);
    } catch (error) {
      logger.warn('Cloudinary下载失败，使用URL回退获取', {
        type: 'api_random_response_fallback',
        error: error instanceof Error ? error.message : 'unknown'
      });
      const resp = await fetch(imageUrl, buildFetchInitFor(imageUrl, { cache: 'no-store' } as RequestInit));
      if (!resp.ok) {
        throw error;
      }
      const ab = await resp.arrayBuffer();
      imageBuffer = Buffer.from(ab);
    }
  } else {
    const resp = await fetch(imageUrl, buildFetchInitFor(imageUrl, { cache: 'no-store' } as RequestInit));
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    }
    const ab = await resp.arrayBuffer();
    imageBuffer = Buffer.from(ab);
  }

  let finalBuffer = imageBuffer;
  let finalMimeType = mimeType;
  if (transparencyOptions) {
    const processed = await adjustImageTransparency(imageBuffer, transparencyOptions);
    finalBuffer = processed.buffer;
    finalMimeType = processed.mimeType;
  }

  const needsFormatConversion = requestedFormat || typeof requestedQuality !== 'undefined';
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

  logger.apiResponse('GET', '/api/random/response', 200, duration, {
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

async function handleRandomResponse(request: NextRequest): Promise<Response> {
  return serveRandomResponse(request);
}

export const GET = withErrorHandler(
  withSecurity({
    rateLimit: 'public',
    allowedMethods: ['GET'],
    enableAccessLog: true
  })(handleRandomResponse)
);

