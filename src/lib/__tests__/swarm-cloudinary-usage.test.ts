jest.mock('@/lib/cloudinary', () => ({
  CloudinaryService: {
    getInstance: jest.fn(() => ({
      getUsageStats: jest.fn()
    }))
  }
}));

jest.mock('@/lib/storage', () => ({
  isStorageEnabled: jest.fn(() => false),
  StorageProvider: { CLOUDINARY: 'cloudinary' }
}));

jest.mock('@/lib/swarm-node', () => ({
  getConfiguredBackendNodes: jest.fn(() => []),
  getCurrentNodeId: jest.fn(() => 'local')
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

import {
  __resetCloudinaryUsageCacheForTests,
  __setCloudinaryUsageCacheForTests,
  buildEffectiveExcludedNodeProviders,
  getThresholdExceededCloudinaryNodeIds
} from '../swarm-cloudinary-usage';

describe('swarm-cloudinary-usage', () => {
  beforeEach(() => {
    __resetCloudinaryUsageCacheForTests();
  });

  afterEach(() => {
    __resetCloudinaryUsageCacheForTests();
  });

  it('总开关关闭时不产生任何阈值排除', () => {
    __setCloudinaryUsageCacheForTests({ nodeA: 99 });
    expect(getThresholdExceededCloudinaryNodeIds({ enabled: false, nodes: { nodeA: 90 } })).toEqual([]);
    expect(getThresholdExceededCloudinaryNodeIds(undefined)).toEqual([]);
  });

  it('用量达到阈值的节点应被识别为超限', () => {
    __setCloudinaryUsageCacheForTests({ nodeA: 95, nodeB: 50 });
    expect(getThresholdExceededCloudinaryNodeIds({
      enabled: true,
      nodes: { nodeA: 90, nodeB: 90 }
    })).toEqual(['nodeA']);
  });

  it('缓存无数据时放行（fail-open）', () => {
    expect(getThresholdExceededCloudinaryNodeIds({
      enabled: true,
      nodes: { nodeA: 90 }
    })).toEqual([]);
  });

  it('有效排除列表 = 手动开关 + 阈值超限，且去重', () => {
    __setCloudinaryUsageCacheForTests({ nodeA: 95, nodeB: 95 });

    const effective = buildEffectiveExcludedNodeProviders({
      nodeProviderAvailability: {
        nodeA: { cloudinary: false, tgstate: true, telegram: false, custom: true }
      },
      cloudinaryUsageThreshold: {
        enabled: true,
        nodes: { nodeA: 90, nodeB: 90 }
      }
    });

    expect(effective).toEqual([
      { ownerNodeId: 'nodeA', provider: 'cloudinary' },
      { ownerNodeId: 'nodeA', provider: 'telegram' },
      { ownerNodeId: 'nodeB', provider: 'cloudinary' }
    ]);
  });

  it('阈值未超限时仅保留手动排除', () => {
    __setCloudinaryUsageCacheForTests({ nodeA: 10 });

    const effective = buildEffectiveExcludedNodeProviders({
      nodeProviderAvailability: {
        nodeB: { cloudinary: true, tgstate: false, telegram: true, custom: true }
      },
      cloudinaryUsageThreshold: {
        enabled: true,
        nodes: { nodeA: 90 }
      }
    });

    expect(effective).toEqual([
      { ownerNodeId: 'nodeB', provider: 'tgstate' }
    ]);
  });
});
