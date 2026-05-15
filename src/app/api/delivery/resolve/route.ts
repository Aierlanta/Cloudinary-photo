import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '@/lib/database';
import { withSecurity } from '@/lib/security';
import { withErrorHandler } from '@/lib/error-handler';
import { AppError, ErrorType } from '@/types/errors';
import { convertTgStateToProxyUrl } from '@/lib/image-utils';
import {
  type DeliveryMode,
  createRemoteOwnerRedirect,
  verifyHandoffParams
} from '@/lib/swarm-node';
import { serveRandomResponse } from '@/app/api/random/response/service';
import { serveAdminImageFileFromOwner } from '@/lib/admin-image-file-service';

export const dynamic = 'force-dynamic';

function isDeliveryMode(value: string | null): value is DeliveryMode {
  return value === 'random-redirect' ||
    value === 'random-response' ||
    value === 'response' ||
    value === 'admin-file';
}

function isTelegramImage(image: { primaryProvider?: string; url: string }): boolean {
  return image.primaryProvider === 'telegram' ||
    image.url.includes('api.telegram.org/file/bot') ||
    image.url.includes('/api/telegram/image');
}

async function deliverRedirectMode(request: NextRequest, imageId: string): Promise<Response> {
  const image = await databaseService.getImage(imageId);
  if (!image) {
    throw new AppError(ErrorType.NOT_FOUND, '图片不存在', 404);
  }

  const remoteRedirect = createRemoteOwnerRedirect(request, image, 'random-redirect');
  if (remoteRedirect) {
    return remoteRedirect;
  }

  if (isTelegramImage(image)) {
    return serveRandomResponse(request, {
      imageId,
      requireDirectResponseEnabled: false,
      requestPath: '/api/random',
      skipNodeHandoff: true
    });
  }

  let targetUrl = image.url.replace(/^http:/, 'https:');
  targetUrl = convertTgStateToProxyUrl(targetUrl);
  const absoluteTarget = targetUrl.startsWith('http')
    ? targetUrl
    : new URL(targetUrl, request.url).toString();

  const response = NextResponse.redirect(absoluteTarget, 302);
  response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Image-Id', image.id);
  response.headers.set('X-Image-PublicId', image.publicId);
  return response;
}

async function resolveDelivery(request: NextRequest): Promise<Response> {
  try {
    verifyHandoffParams(request.nextUrl.searchParams);
  } catch (error) {
    throw new AppError(
      ErrorType.UNAUTHORIZED,
      error instanceof Error ? error.message : '跨节点交付签名无效',
      401
    );
  }

  const imageId = request.nextUrl.searchParams.get('imageId');
  const mode = request.nextUrl.searchParams.get('mode');
  if (!imageId || !isDeliveryMode(mode)) {
    throw new AppError(ErrorType.VALIDATION_ERROR, '跨节点交付参数无效', 400);
  }

  if (mode === 'admin-file') {
    return serveAdminImageFileFromOwner(request, imageId);
  }

  if (mode === 'random-response' || mode === 'response') {
    return serveRandomResponse(request, {
      imageId,
      requireDirectResponseEnabled: false,
      requestPath: mode === 'random-response' ? '/api/random' : '/api/response',
      skipNodeHandoff: true
    });
  }

  return deliverRedirectMode(request, imageId);
}

export const GET = withErrorHandler(
  withSecurity({
    rateLimit: 'public',
    allowedMethods: ['GET'],
    enableAccessLog: true
  })(resolveDelivery)
);
