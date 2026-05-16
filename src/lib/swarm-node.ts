import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { Image } from '@/types/models';

export type DeliveryMode = 'random-redirect' | 'random-response' | 'response' | 'admin-file' | 'admin-preview';
export type BackendNodeHealthStatus = 'online' | 'degraded' | 'offline' | 'unknown';

const SIGNATURE_PARAM = 'signature';
const DEFAULT_HANDOFF_TTL_SECONDS = 120;
const NODE_STATUS_CACHE_TTL_MS = 15_000;
const NODE_STATUS_FETCH_TIMEOUT_MS = 5_000;

export interface BackendNodeInfo {
  id: string;
  name: string;
  baseUrl: string;
  isCurrent?: boolean;
}

export interface RemoteOwnerResolve {
  owner: BackendNodeInfo;
  url: URL;
}

interface NodeStatusCacheEntry {
  statuses: Record<string, BackendNodeHealthStatus>;
  expiresAt: number;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizeNodeInput(
  input: Partial<BackendNodeInfo> | null | undefined,
  fallbackIndex: number
): BackendNodeInfo | null {
  const id = input?.id?.trim() || `node-${fallbackIndex + 1}`;
  const baseUrl = normalizeBaseUrl(input?.baseUrl);
  if (!baseUrl) {
    return null;
  }

  return {
    id,
    name: input?.name?.trim() || id,
    baseUrl,
    isCurrent: Boolean(input?.isCurrent)
  };
}

let nodeStatusCache: NodeStatusCacheEntry = {
  statuses: {},
  expiresAt: 0
};
let nodeStatusRefreshPromise: Promise<Record<string, BackendNodeHealthStatus>> | null = null;

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

export function getConfiguredBackendNodes(request?: NextRequest): BackendNodeInfo[] {
  const rawNodes = process.env.NEXT_PUBLIC_BACKEND_NODES;
  const collected: BackendNodeInfo[] = [
    getCurrentNode(request)
  ];

  if (rawNodes) {
    try {
      const parsed = JSON.parse(rawNodes);
      if (Array.isArray(parsed)) {
        parsed.forEach((item, index) => {
          const node = normalizeNodeInput(item, index);
          if (node) {
            collected.push(node);
          }
        });
      }
    } catch {
      rawNodes.split(',').forEach((part, index) => {
        const [id, name, baseUrl] = part.split('|').map((value) => value?.trim());
        const node = normalizeNodeInput({
          id,
          name,
          baseUrl: baseUrl || name || id
        }, index);
        if (node) {
          collected.push(node);
        }
      });
    }
  }

  const deduped: BackendNodeInfo[] = [];
  const seenIds = new Set<string>();
  const seenBaseUrls = new Set<string>();
  for (const node of collected) {
    const normalizedBaseUrl = normalizeBaseUrl(node.baseUrl);
    if (!normalizedBaseUrl) {
      continue;
    }
    if (seenIds.has(node.id) || seenBaseUrls.has(normalizedBaseUrl)) {
      continue;
    }
    seenIds.add(node.id);
    seenBaseUrls.add(normalizedBaseUrl);
    deduped.push({
      ...node,
      baseUrl: normalizedBaseUrl
    });
  }

  return deduped;
}

async function probeNodeHealth(node: BackendNodeInfo): Promise<BackendNodeHealthStatus> {
  if (node.isCurrent) {
    return 'online';
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NODE_STATUS_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${trimTrailingSlash(node.baseUrl)}/api/status?mode=summary`, {
      cache: 'no-store',
      redirect: 'follow',
      signal: controller.signal
    });

    if (!response.ok) {
      return 'offline';
    }

    const payload = await response.json().catch(() => null) as {
      data?: { status?: string };
    } | null;
    const status = payload?.data?.status;
    if (status === 'healthy') {
      return 'online';
    }
    if (status === 'degraded') {
      return 'degraded';
    }
    return 'unknown';
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return 'unknown';
    }
    return 'offline';
  } finally {
    clearTimeout(timeout);
  }
}

async function refreshConfiguredNodeStatuses(request?: NextRequest): Promise<Record<string, BackendNodeHealthStatus>> {
  const nodes = getConfiguredBackendNodes(request);
  const entries = await Promise.all(nodes.map(async (node) => ([
    node.id,
    await probeNodeHealth(node)
  ] as const)));
  const statuses = Object.fromEntries(entries);
  nodeStatusCache = {
    statuses,
    expiresAt: Date.now() + NODE_STATUS_CACHE_TTL_MS
  };
  return statuses;
}

function ensureNodeStatusRefresh(request?: NextRequest): Promise<Record<string, BackendNodeHealthStatus>> {
  if (!nodeStatusRefreshPromise) {
    nodeStatusRefreshPromise = refreshConfiguredNodeStatuses(request)
      .finally(() => {
        nodeStatusRefreshPromise = null;
      });
  }
  return nodeStatusRefreshPromise;
}

function collectOfflineNodeIds(statuses: Record<string, BackendNodeHealthStatus>): string[] {
  return Object.entries(statuses)
    .filter(([nodeId, status]) => nodeId !== getCurrentNodeId() && status === 'offline')
    .map(([nodeId]) => nodeId);
}

export async function getExplicitlyOfflineNodeIds(request?: NextRequest): Promise<string[]> {
  const nodes = getConfiguredBackendNodes(request);
  if (nodes.length <= 1) {
    return [];
  }

  const hasCachedStatuses = Object.keys(nodeStatusCache.statuses).length > 0;
  if (!hasCachedStatuses) {
    const statuses = await ensureNodeStatusRefresh(request);
    return collectOfflineNodeIds(statuses);
  }

  if (Date.now() > nodeStatusCache.expiresAt) {
    void ensureNodeStatusRefresh(request).catch(() => {});
  }

  return collectOfflineNodeIds(nodeStatusCache.statuses);
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
    if ([SIGNATURE_PARAM, 'expires', 'imageId', 'mode', 'sourceNodeId', 'sourceNodeBaseUrl', 'key'].includes(key)) {
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

export function buildRemoteOwnerResolve(
  request: NextRequest,
  image: Pick<Image, 'id' | 'ownerNodeId' | 'ownerNodeBaseUrl'>,
  mode: DeliveryMode
): RemoteOwnerResolve | null {
  if (isImageOwnedByCurrentNode(image, request)) {
    return null;
  }

  const owner = getImageOwner(image, request);
  const ownerBaseUrl = normalizeBaseUrl(owner.baseUrl);
  if (!ownerBaseUrl) {
    return null;
  }

  return {
    owner,
    url: buildSignedResolveUrl(ownerBaseUrl, request, image, mode)
  };
}

export function createRemoteOwnerRedirect(
  request: NextRequest,
  image: Pick<Image, 'id' | 'ownerNodeId' | 'ownerNodeBaseUrl'>,
  mode: DeliveryMode
): NextResponse | null {
  const remoteResolve = buildRemoteOwnerResolve(request, image, mode);
  if (!remoteResolve) return null;

  const response = NextResponse.redirect(remoteResolve.url.toString(), 302);
  response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Swarm-Redirect', 'owner-node');
  response.headers.set('X-Owner-Node-Id', remoteResolve.owner.id);
  return response;
}

export function applyNoReferrer(headers: Headers): Headers {
  headers.set('Referrer-Policy', 'no-referrer');
  return headers;
}
