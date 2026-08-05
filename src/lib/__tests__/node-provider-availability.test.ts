import {
  UNKNOWN_OWNER_NODE_ID,
  buildExcludeNodeProviderWhereConditions,
  buildExcludedNodeProviders,
  buildNodeProviderAvailabilityCacheKey,
  isExcludedByNodeProvider,
  isImageAllowedByNodeProviderAvailability,
  normalizeNodeProviderAvailability
} from '../node-provider-availability';

describe('node-provider-availability', () => {
  it('缺省配置应视为全部启用', () => {
    expect(normalizeNodeProviderAvailability(undefined)).toEqual({});
    expect(buildExcludedNodeProviders(undefined)).toEqual([]);
    expect(buildNodeProviderAvailabilityCacheKey(undefined)).toBe('all');
  });

  it('只有显式 false 才会进入排除列表', () => {
    const normalized = normalizeNodeProviderAvailability({
      nodeA: {
        cloudinary: false,
        tgstate: true
      },
      nodeB: {
        telegram: false
      }
    });

    expect(normalized).toEqual({
      nodeA: {
        cloudinary: false,
        tgstate: true,
        telegram: true,
        custom: true
      },
      nodeB: {
        cloudinary: true,
        tgstate: true,
        telegram: false,
        custom: true
      }
    });

    expect(buildExcludedNodeProviders(normalized)).toEqual([
      { ownerNodeId: 'nodeA', provider: 'cloudinary' },
      { ownerNodeId: 'nodeB', provider: 'telegram' }
    ]);
    expect(buildNodeProviderAvailabilityCacheKey(normalized)).toBe('nodeA:cloudinary,nodeB:telegram');
  });

  it('图片允许性判断应尊重节点与图床组合', () => {
    const availability = normalizeNodeProviderAvailability({
      nodeA: { cloudinary: false },
      [UNKNOWN_OWNER_NODE_ID]: { cloudinary: false }
    });

    expect(isImageAllowedByNodeProviderAvailability({
      ownerNodeId: 'nodeA',
      primaryProvider: 'cloudinary'
    }, availability)).toBe(false);

    expect(isImageAllowedByNodeProviderAvailability({
      ownerNodeId: 'nodeA',
      primaryProvider: 'telegram'
    }, availability)).toBe(true);

    expect(isImageAllowedByNodeProviderAvailability({
      ownerNodeId: 'nodeB',
      primaryProvider: 'cloudinary'
    }, availability)).toBe(true);

    expect(isImageAllowedByNodeProviderAvailability({
      ownerNodeId: undefined,
      primaryProvider: 'cloudinary'
    }, availability)).toBe(false);

    expect(isImageAllowedByNodeProviderAvailability({
      ownerNodeId: null,
      primaryProvider: 'telegram'
    }, availability)).toBe(true);
  });

  it('排除 where 条件应显式放行 null 归属图，除非禁用 unknown', () => {
    expect(buildExcludeNodeProviderWhereConditions([
      { ownerNodeId: 'nodeA', provider: 'cloudinary' }
    ])).toEqual([
      {
        OR: [
          { ownerNodeId: null },
          { ownerNodeId: { not: 'nodeA' } },
          { primaryProvider: { not: 'cloudinary' } }
        ]
      }
    ]);

    expect(buildExcludeNodeProviderWhereConditions([
      { ownerNodeId: UNKNOWN_OWNER_NODE_ID, provider: 'cloudinary' }
    ])).toEqual([
      {
        OR: [
          { ownerNodeId: { not: null } },
          { primaryProvider: { not: 'cloudinary' } }
        ]
      }
    ]);
  });

  it('内存过滤也应把空归属映射为 unknown', () => {
    const excluded = [
      { ownerNodeId: UNKNOWN_OWNER_NODE_ID, provider: 'cloudinary' as const }
    ];

    expect(isExcludedByNodeProvider({
      ownerNodeId: null,
      primaryProvider: 'cloudinary'
    }, excluded)).toBe(true);

    expect(isExcludedByNodeProvider({
      ownerNodeId: undefined,
      primaryProvider: 'telegram'
    }, excluded)).toBe(false);

    expect(isExcludedByNodeProvider({
      ownerNodeId: 'nodeA',
      primaryProvider: 'cloudinary'
    }, excluded)).toBe(false);
  });
});
