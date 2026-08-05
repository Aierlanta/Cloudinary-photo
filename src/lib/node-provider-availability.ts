import type { Image, SwarmProvider } from '@/types/models';

export const NODE_PROVIDER_KEYS: SwarmProvider[] = ['cloudinary', 'tgstate', 'telegram', 'custom'];

/** 与图库筛选一致：ownerNodeId 为空的历史图片统一映射到该哨兵节点 */
export const UNKNOWN_OWNER_NODE_ID = 'unknown';

export type NodeProviderAvailability = Record<string, Record<SwarmProvider, boolean>>;

export interface ExcludedNodeProvider {
  ownerNodeId: string;
  provider: SwarmProvider;
}

function createDefaultProviderFlags(overrides?: Partial<Record<SwarmProvider, boolean>>): Record<SwarmProvider, boolean> {
  return {
    cloudinary: overrides?.cloudinary !== false,
    tgstate: overrides?.tgstate !== false,
    telegram: overrides?.telegram !== false,
    custom: overrides?.custom !== false
  };
}

export function createDefaultNodeProviderAvailability(): NodeProviderAvailability {
  return {};
}

export function resolveOwnerNodeIdForAvailability(
  ownerNodeId?: string | null
): string {
  if (!ownerNodeId) {
    return UNKNOWN_OWNER_NODE_ID;
  }
  return ownerNodeId;
}

/**
 * 规范化节点图床可用性配置。
 * 缺省 / 缺项视为启用（true）；只有显式 false 才视为禁用。
 */
export function normalizeNodeProviderAvailability(
  input?: Record<string, Partial<Record<SwarmProvider, boolean>> | Record<string, boolean>> | null
): NodeProviderAvailability {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return createDefaultNodeProviderAvailability();
  }

  const normalized: NodeProviderAvailability = {};

  for (const [nodeId, providers] of Object.entries(input)) {
    if (!nodeId || !providers || typeof providers !== 'object' || Array.isArray(providers)) {
      continue;
    }

    const providerFlags = providers as Partial<Record<SwarmProvider, boolean>>;
    normalized[nodeId] = createDefaultProviderFlags({
      cloudinary: providerFlags.cloudinary,
      tgstate: providerFlags.tgstate,
      telegram: providerFlags.telegram,
      custom: providerFlags.custom
    });
  }

  return normalized;
}

/**
 * 收集被显式禁用的 (节点, 图床) 组合。
 */
export function buildExcludedNodeProviders(
  availability?: NodeProviderAvailability | null
): ExcludedNodeProvider[] {
  const normalized = normalizeNodeProviderAvailability(availability);
  const excluded: ExcludedNodeProvider[] = [];

  for (const [ownerNodeId, providers] of Object.entries(normalized)) {
    for (const provider of NODE_PROVIDER_KEYS) {
      if (providers[provider] === false) {
        excluded.push({ ownerNodeId, provider });
      }
    }
  }

  return excluded.sort((left, right) => {
    const nodeCompare = left.ownerNodeId.localeCompare(right.ownerNodeId);
    if (nodeCompare !== 0) return nodeCompare;
    return left.provider.localeCompare(right.provider);
  });
}

/**
 * 稳定摘要，用于预取 cache key，避免不同策略互相污染。
 */
export function buildNodeProviderAvailabilityCacheKey(
  availability?: NodeProviderAvailability | null
): string {
  const excluded = buildExcludedNodeProviders(availability);
  if (excluded.length === 0) return 'all';
  return excluded.map((item) => `${item.ownerNodeId}:${item.provider}`).join(',');
}

/**
 * 判断图片是否允许进入公开 API 出图池。
 * ownerNodeId 为空时映射为 unknown，可按节点配置禁用。
 */
export function isImageAllowedByNodeProviderAvailability(
  image: Pick<Image, 'primaryProvider'> & { ownerNodeId?: string | null },
  availability?: NodeProviderAvailability | null
): boolean {
  const ownerNodeId = resolveOwnerNodeIdForAvailability(image.ownerNodeId);

  const provider = image.primaryProvider;
  if (
    provider !== 'cloudinary'
    && provider !== 'tgstate'
    && provider !== 'telegram'
    && provider !== 'custom'
  ) {
    return true;
  }

  const normalized = normalizeNodeProviderAvailability(availability);
  const nodeFlags = normalized[ownerNodeId];
  if (!nodeFlags) return true;
  return nodeFlags[provider] !== false;
}

export function ensureNodeProviderAvailabilityEntry(
  availability: NodeProviderAvailability | undefined,
  nodeId: string
): Record<SwarmProvider, boolean> {
  const normalized = normalizeNodeProviderAvailability(availability);
  if (!normalized[nodeId]) {
    normalized[nodeId] = createDefaultProviderFlags();
  }
  return normalized[nodeId];
}

/**
 * 构建 Prisma where 片段：排除指定 (节点, 图床) 组合，且不误伤 ownerNodeId=null 的历史图。
 * SQL 三值逻辑下 `NOT (ownerNodeId = X AND ...)` 会把 NULL 行一并滤掉，因此改用显式 OR 放行。
 */
export function buildExcludeNodeProviderWhereConditions(
  excludeNodeProviders: ExcludedNodeProvider[]
): Record<string, unknown>[] {
  const conditions: Record<string, unknown>[] = [];

  for (const pair of excludeNodeProviders) {
    if (!pair?.ownerNodeId || !pair?.provider) continue;

    if (pair.ownerNodeId === UNKNOWN_OWNER_NODE_ID) {
      conditions.push({
        OR: [
          { ownerNodeId: { not: null } },
          { primaryProvider: { not: pair.provider } }
        ]
      });
      continue;
    }

    conditions.push({
      OR: [
        { ownerNodeId: null },
        { ownerNodeId: { not: pair.ownerNodeId } },
        { primaryProvider: { not: pair.provider } }
      ]
    });
  }

  return conditions;
}

export function isExcludedByNodeProvider(
  image: { ownerNodeId?: string | null; primaryProvider?: string | null },
  excludeNodeProviders: ExcludedNodeProvider[]
): boolean {
  if (!image.primaryProvider || excludeNodeProviders.length === 0) {
    return false;
  }

  const ownerNodeId = resolveOwnerNodeIdForAvailability(image.ownerNodeId);
  return excludeNodeProviders.some(
    (pair) => pair.ownerNodeId === ownerNodeId && pair.provider === image.primaryProvider
  );
}
