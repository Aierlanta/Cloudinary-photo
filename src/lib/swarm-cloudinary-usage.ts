import type { APIConfig } from '@/types/models';
import { CloudinaryService } from '@/lib/cloudinary';
import { isStorageEnabled, StorageProvider } from '@/lib/storage';
import { getConfiguredBackendNodes, getCurrentNodeId } from '@/lib/swarm-node';
import { logger } from '@/lib/logger';
import {
  isCloudinaryUsageThresholdExceeded,
  normalizeCloudinaryUsageThreshold
} from '@/lib/cloudinary-usage-threshold';
import {
  buildExcludedNodeProviders,
  type ExcludedNodeProvider
} from '@/lib/node-provider-availability';

/**
 * 蜂群各节点 Cloudinary 用量的服务端缓存，供出图链路做阈值判断。
 * 采用 stale-while-revalidate：过期后后台刷新，绝不阻塞出图请求；
 * 无缓存数据时视为未超限（fail-open）。
 */

const USAGE_CACHE_TTL_MS = 60_000;
const USAGE_FETCH_TIMEOUT_MS = 5_000;

interface NodeUsageEntry {
  usedPercent?: number;
}

interface UsageCache {
  entries: Record<string, NodeUsageEntry>;
  expiresAt: number;
}

let usageCache: UsageCache = {
  entries: {},
  expiresAt: 0
};
let usageRefreshPromise: Promise<void> | null = null;

function parseUsedPercent(value: unknown): number | undefined {
  const percent = Number(value);
  return Number.isFinite(percent) ? percent : undefined;
}

async function fetchLocalUsedPercent(): Promise<number | undefined> {
  if (!isStorageEnabled(StorageProvider.CLOUDINARY)) {
    return undefined;
  }

  const configured = !!(
    process.env.CLOUDINARY_CLOUD_NAME
    && process.env.CLOUDINARY_API_KEY
    && process.env.CLOUDINARY_API_SECRET
  );
  if (!configured) {
    return undefined;
  }

  try {
    const usageStats = await CloudinaryService.getInstance().getUsageStats();
    return parseUsedPercent(usageStats?.credits?.used_percent);
  } catch (error) {
    logger.warn('获取本节点Cloudinary用量失败', {
      type: 'cloudinary_usage_threshold',
      error: error instanceof Error ? error.message : String(error)
    });
    return undefined;
  }
}

async function fetchRemoteUsedPercent(baseUrl: string): Promise<number | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), USAGE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/status?mode=cloudinary`, {
      cache: 'no-store',
      redirect: 'follow',
      signal: controller.signal
    });
    if (!response.ok) {
      return undefined;
    }

    const payload = await response.json().catch(() => null) as {
      data?: { cloudinary?: { credits?: { used_percent?: unknown } } };
    } | null;
    return parseUsedPercent(payload?.data?.cloudinary?.credits?.used_percent);
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

async function refreshUsageCache(): Promise<void> {
  const nodes = getConfiguredBackendNodes();
  const currentNodeId = getCurrentNodeId();

  const entries = await Promise.all(nodes.map(async (node) => {
    const usedPercent = node.id === currentNodeId || node.isCurrent
      ? await fetchLocalUsedPercent()
      : await fetchRemoteUsedPercent(node.baseUrl);
    return [node.id, { usedPercent }] as const;
  }));

  usageCache = {
    entries: Object.fromEntries(entries),
    expiresAt: Date.now() + USAGE_CACHE_TTL_MS
  };
}

function ensureUsageRefresh(): Promise<void> {
  if (!usageRefreshPromise) {
    usageRefreshPromise = refreshUsageCache()
      .catch((error) => {
        logger.warn('刷新Cloudinary用量缓存失败', {
          type: 'cloudinary_usage_threshold',
          error: error instanceof Error ? error.message : String(error)
        });
      })
      .finally(() => {
        usageRefreshPromise = null;
      });
  }
  return usageRefreshPromise;
}

/**
 * 返回当前已超阈值的节点ID列表（仅基于缓存数据，不阻塞调用方）。
 * 缓存过期或为空时触发后台刷新，本次先按现有数据（或放行）处理。
 */
export function getThresholdExceededCloudinaryNodeIds(
  config: APIConfig['cloudinaryUsageThreshold']
): string[] {
  const normalized = normalizeCloudinaryUsageThreshold(config);
  if (!normalized.enabled || Object.keys(normalized.nodes).length === 0) {
    return [];
  }

  if (Date.now() > usageCache.expiresAt) {
    void ensureUsageRefresh();
  }

  const exceeded: string[] = [];
  for (const nodeId of Object.keys(normalized.nodes)) {
    const usedPercent = usageCache.entries[nodeId]?.usedPercent;
    if (isCloudinaryUsageThresholdExceeded(normalized, nodeId, usedPercent)) {
      exceeded.push(nodeId);
    }
  }
  return exceeded.sort();
}

/**
 * 手动开关排除项 + 阈值超限排除项，合并去重后的有效排除列表。
 */
export function buildEffectiveExcludedNodeProviders(
  apiConfig: Pick<APIConfig, 'nodeProviderAvailability' | 'cloudinaryUsageThreshold'>
): ExcludedNodeProvider[] {
  const manual = buildExcludedNodeProviders(apiConfig.nodeProviderAvailability);
  const exceededNodeIds = getThresholdExceededCloudinaryNodeIds(apiConfig.cloudinaryUsageThreshold);

  if (exceededNodeIds.length === 0) {
    return manual;
  }

  const merged = new Map<string, ExcludedNodeProvider>();
  for (const pair of manual) {
    merged.set(`${pair.ownerNodeId}:${pair.provider}`, pair);
  }
  for (const ownerNodeId of exceededNodeIds) {
    const key = `${ownerNodeId}:cloudinary`;
    if (!merged.has(key)) {
      merged.set(key, { ownerNodeId, provider: 'cloudinary' });
    }
  }

  return Array.from(merged.values()).sort((left, right) => {
    const nodeCompare = left.ownerNodeId.localeCompare(right.ownerNodeId);
    if (nodeCompare !== 0) return nodeCompare;
    return left.provider.localeCompare(right.provider);
  });
}

/** 仅用于测试：重置缓存状态 */
export function __resetCloudinaryUsageCacheForTests(): void {
  usageCache = { entries: {}, expiresAt: 0 };
  usageRefreshPromise = null;
}

/** 仅用于测试：注入缓存数据 */
export function __setCloudinaryUsageCacheForTests(
  entries: Record<string, number | undefined>,
  ttlMs = USAGE_CACHE_TTL_MS
): void {
  usageCache = {
    entries: Object.fromEntries(
      Object.entries(entries).map(([nodeId, usedPercent]) => [nodeId, { usedPercent }])
    ),
    expiresAt: Date.now() + ttlMs
  };
}
