import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { Image } from '@/types/models';

export type DeliveryMode = 'random-redirect' | 'random-response' | 'response' | 'admin-file';

const SIGNATURE_PARAM = 'signature';
const DEFAULT_HANDOFF_TTL_SECONDS = 120;

export interface BackendNodeInfo {
  id: string;
  name: string;
  baseUrl: string;
  isCurrent?: boolean;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function normalizeBaseUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    url.pathname = trimTrailingSlash(url.pathname);
    url.search = '';
    url.hash = '';
    return trimTrailingSlash(url.toString());
  } catch {
    return undefined;
  }
}

export function getCurrentNodeId(): string {
  return process.env.NODE_ID?.trim() || 'local';
}

export function getCurrentNodeName(): string {
  return process.env.NODE_NAME?.trim() || getCurrentNodeId();
}

export function getConfiguredPublicBaseUrl(): string | undefined {
  return normalizeBaseUrl(process.env.PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_PUBLIC_API_BASE_URL);
}

export function getRequestBaseUrl(request: NextRequest): string {
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const proto = forwardedProto || request.nextUrl.protocol.replace(':', '');
  const host = forwardedHost || request.headers.get('host') || request.nextUrl.host;
  return `${proto}://${host}`;
}

export function getCurrentNodeBaseUrl(request?: NextRequest): string {
  return getConfiguredPublicBaseUrl() || (request ? normalizeBaseUrl(getRequestBaseUrl(request)) : undefined) || 'http://localhost:3000';
}

export function getCurrentNode(request?: NextRequest): BackendNodeInfo {
  return {
    id: getCurrentNodeId(),
    name: getCurrentNodeName(),
    baseUrl: getCurrentNodeBaseUrl(request),
    isCurrent: true
  };
}

export function getImageOwner(image: Pick<Image, 'ownerNodeId' | 'ownerNodeBaseUrl'>, request?: NextRequest): BackendNodeInfo {
  return {
    id: image.ownerNodeId || getCurrentNodeId(),
    name: image.ownerNodeId || getCurrentNodeName(),
    baseUrl: normalizeBaseUrl(image.ownerNodeBaseUrl) || getCurrentNodeBaseUrl(request)
  };
}

export function isImageOwnedByCurrentNode(image: Pick<Image, 'ownerNodeId' | 'ownerNodeBaseUrl'>, request?: NextRequest): boolean {
  const owner = getImageOwner(image, request);
  const currentId = getCurrentNodeId();
  if (owner.id && owner.id === currentId) return true;

  const ownerBase = normalizeBaseUrl(owner.baseUrl);
  const currentBase = normalizeBaseUrl(getCurrentNodeBaseUrl(request));
  return !!ownerBase && !!currentBase && ownerBase === currentBase;
}

function getHandoffSecret(): string {
  const secret = process.env.NODE_HANDOFF_SECRET || process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!secret) {
    throw new Error('NODE_HANDOFF_SECRET、SESSION_SECRET 或 ADMIN_PASSWORD 至少需要配置一个');
  }
  return secret;
}

function canonicalizeParams(params: URLSearchParams): string {
  return Array.from(params.entries())
    .filter(([key]) => key !== SIGNATURE_PARAM)
    .sort(([aKey, aValue], [bKey, bValue]) => {
      if (aKey === bKey) return aValue.localeCompare(bValue);
      return aKey.localeCompare(bKey);
    })
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

function signParams(params: URLSearchParams): string {
  return createHmac('sha256', getHandoffSecret())
    .update(canonicalizeParams(params))
    .digest('base64url');
}

export function verifyHandoffParams(params: URLSearchParams): void {
  const signature = params.get(SIGNATURE_PARAM);
  const expiresRaw = params.get('expires');
  const expires = expiresRaw ? Number(expiresRaw) : NaN;

  if (!signature || !Number.isFinite(expires)) {
    throw new Error('跨节点交付签名缺失');
  }
  if (Date.now() > expires) {
    throw new Error('跨节点交付签名已过期');
  }

  const expected = signParams(params);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('跨节点交付签名无效');
  }
}

export function buildSignedResolveUrl(
  ownerBaseUrl: string,
  request: NextRequest,
  image: Pick<Image, 'id'>,
  mode: DeliveryMode,
  ttlSeconds = DEFAULT_HANDOFF_TTL_SECONDS
): URL {
  const target = new URL('/api/delivery/resolve', ownerBaseUrl);
  request.nextUrl.searchParams.forEach((value, key) => {
    if ([SIGNATURE_PARAM, 'expires', 'imageId', 'mode', 'sourceNodeId', 'sourceNodeBaseUrl'].includes(key)) {
      return;
    }
    target.searchParams.append(key, value);
  });

  target.searchParams.set('imageId', image.id);
  target.searchParams.set('mode', mode);
  target.searchParams.set('sourceNodeId', getCurrentNodeId());
  target.searchParams.set('sourceNodeBaseUrl', getCurrentNodeBaseUrl(request));
  target.searchParams.set('expires', String(Date.now() + ttlSeconds * 1000));
  target.searchParams.set(SIGNATURE_PARAM, signParams(target.searchParams));
  return target;
}

export function createRemoteOwnerRedirect(
  request: NextRequest,
  image: Pick<Image, 'id' | 'ownerNodeId' | 'ownerNodeBaseUrl'>,
  mode: DeliveryMode
): NextResponse | null {
  if (isImageOwnedByCurrentNode(image, request)) {
    return null;
  }

  const owner = getImageOwner(image, request);
  const ownerBaseUrl = normalizeBaseUrl(owner.baseUrl);
  if (!ownerBaseUrl) {
    return null;
  }

  const resolveUrl = buildSignedResolveUrl(ownerBaseUrl, request, image, mode);
  const response = NextResponse.redirect(resolveUrl.toString(), 302);
  response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Swarm-Redirect', 'owner-node');
  response.headers.set('X-Owner-Node-Id', owner.id);
  return response;
}

export function applyNoReferrer(headers: Headers): Headers {
  headers.set('Referrer-Policy', 'no-referrer');
  return headers;
}
