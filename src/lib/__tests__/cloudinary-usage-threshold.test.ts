import {
  createDefaultCloudinaryUsageThreshold,
  isCloudinaryUsageThresholdExceeded,
  normalizeCloudinaryUsageThreshold
} from '../cloudinary-usage-threshold';

describe('cloudinary-usage-threshold', () => {
  it('缺省配置应为禁用且无节点阈值', () => {
    expect(createDefaultCloudinaryUsageThreshold()).toEqual({ enabled: false, nodes: {} });
    expect(normalizeCloudinaryUsageThreshold(undefined)).toEqual({ enabled: false, nodes: {} });
    expect(normalizeCloudinaryUsageThreshold(null)).toEqual({ enabled: false, nodes: {} });
    expect(normalizeCloudinaryUsageThreshold([] as any)).toEqual({ enabled: false, nodes: {} });
  });

  it('规范化应丢弃非法阈值并只保留 1-100 的数字', () => {
    const normalized = normalizeCloudinaryUsageThreshold({
      enabled: true,
      nodes: {
        nodeA: 90,
        nodeB: 0,
        nodeC: 101,
        nodeD: Number.NaN,
        nodeE: '80' as unknown as number,
        '': 50
      }
    });

    expect(normalized).toEqual({
      enabled: true,
      nodes: {
        nodeA: 90,
        nodeE: 80
      }
    });
  });

  it('enabled 仅显式 true 生效', () => {
    expect(normalizeCloudinaryUsageThreshold({ enabled: 1 as unknown as boolean, nodes: {} }).enabled).toBe(false);
    expect(normalizeCloudinaryUsageThreshold({ enabled: true, nodes: {} }).enabled).toBe(true);
  });

  it('阈值判断：达到阈值即超限', () => {
    const config = { enabled: true, nodes: { nodeA: 90 } };
    expect(isCloudinaryUsageThresholdExceeded(config, 'nodeA', 89.9)).toBe(false);
    expect(isCloudinaryUsageThresholdExceeded(config, 'nodeA', 90)).toBe(true);
    expect(isCloudinaryUsageThresholdExceeded(config, 'nodeA', 100)).toBe(true);
  });

  it('总开关关闭、无节点阈值或用量未知时应放行', () => {
    expect(isCloudinaryUsageThresholdExceeded({ enabled: false, nodes: { nodeA: 90 } }, 'nodeA', 99)).toBe(false);
    expect(isCloudinaryUsageThresholdExceeded({ enabled: true, nodes: {} }, 'nodeA', 99)).toBe(false);
    expect(isCloudinaryUsageThresholdExceeded({ enabled: true, nodes: { nodeA: 90 } }, 'nodeB', 99)).toBe(false);
    expect(isCloudinaryUsageThresholdExceeded({ enabled: true, nodes: { nodeA: 90 } }, 'nodeA', undefined)).toBe(false);
    expect(isCloudinaryUsageThresholdExceeded({ enabled: true, nodes: { nodeA: 90 } }, 'nodeA', null)).toBe(false);
    expect(isCloudinaryUsageThresholdExceeded({ enabled: true, nodes: { nodeA: 90 } }, 'nodeA', Number.NaN)).toBe(false);
  });
});
