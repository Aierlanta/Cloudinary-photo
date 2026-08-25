import type { CloudinaryUsageThresholdConfig } from '@/types/models';

/**
 * Cloudinary 用量阈值配置的纯工具函数。
 * 该模块不依赖任何服务端资源，前后端均可引用。
 */

export function createDefaultCloudinaryUsageThreshold(): CloudinaryUsageThresholdConfig {
  return {
    enabled: false,
    nodes: {}
  };
}

/**
 * 规范化阈值配置：enabled 仅显式 true 生效；阈值必须是 1-100 的有限数字，否则丢弃该节点项。
 */
export function normalizeCloudinaryUsageThreshold(
  input?: Partial<CloudinaryUsageThresholdConfig> | null
): CloudinaryUsageThresholdConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return createDefaultCloudinaryUsageThreshold();
  }

  const nodes: Record<string, number> = {};
  if (input.nodes && typeof input.nodes === 'object' && !Array.isArray(input.nodes)) {
    for (const [nodeId, rawThreshold] of Object.entries(input.nodes)) {
      if (!nodeId) continue;
      const threshold = Number(rawThreshold);
      if (Number.isFinite(threshold) && threshold >= 1 && threshold <= 100) {
        nodes[nodeId] = threshold;
      }
    }
  }

  return {
    enabled: input.enabled === true,
    nodes
  };
}

/**
 * 判断某节点的用量是否达到阈值。
 * 用量未知（undefined/null/NaN）时放行（fail-open），避免误伤。
 */
export function isCloudinaryUsageThresholdExceeded(
  config: CloudinaryUsageThresholdConfig | undefined | null,
  nodeId: string,
  usedPercent: number | undefined | null
): boolean {
  const normalized = normalizeCloudinaryUsageThreshold(config);
  if (!normalized.enabled) return false;

  const threshold = normalized.nodes[nodeId];
  if (typeof threshold !== 'number') return false;

  if (usedPercent === undefined || usedPercent === null || !Number.isFinite(usedPercent)) {
    return false;
  }

  return usedPercent >= threshold;
}
