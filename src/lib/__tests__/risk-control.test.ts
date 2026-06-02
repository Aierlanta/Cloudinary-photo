import {
  clearRiskControlCache,
  evaluatePublicRiskControl,
  getOrCreateSecurityConfig,
  isIPInCidr,
  validateWhitelistCidr
} from '../risk-control';
import { prisma } from '../prisma';

jest.mock('../prisma', () => ({
    prisma: {
      securityConfig: {
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn()
      },
    iPWhitelistEntry: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    accessLog: {
      groupBy: jest.fn()
    }
  }
}));

describe('risk-control', () => {
  const mockPrisma = prisma as any;

  beforeEach(() => {
    jest.clearAllMocks();
    clearRiskControlCache();
    mockPrisma.iPWhitelistEntry.findMany.mockResolvedValue([]);
    mockPrisma.securityConfig.upsert.mockResolvedValue({
      id: 'default',
      guardEnabled: false,
      guardAutoEnabled: false,
      guardTriggerWindowMinutes: 5,
      guardTriggerUniqueIpThreshold: 50,
      whitelistOnlyEnabled: false,
      guardTriggeredAt: null,
      guardTriggeredReason: null,
      createdAt: new Date('2026-06-02T00:00:00Z'),
      updatedAt: new Date('2026-06-02T00:00:00Z')
    });
  });

  it('应支持 IPv4、IPv6、localhost 和 CIDR 匹配', () => {
    expect(isIPInCidr('192.168.1.10', '192.168.1.0/24')).toBe(true);
    expect(isIPInCidr('192.168.2.10', '192.168.1.0/24')).toBe(false);
    expect(isIPInCidr('::1', '::1/128')).toBe(true);
    expect(isIPInCidr('127.0.0.1', '127.0.0.1')).toBe(true);
  });

  it('应拒绝非法白名单条目', () => {
    expect(() => validateWhitelistCidr('not-an-ip')).toThrow('白名单条目必须是有效的 IP 或 CIDR');
    expect(() => validateWhitelistCidr('')).toThrow('白名单 IP/CIDR 不能为空');
  });

  it('默认风控配置应通过 upsert 原子创建或读取', async () => {
    const config = await getOrCreateSecurityConfig();

    expect(mockPrisma.securityConfig.upsert).toHaveBeenCalledWith({
      where: { id: 'default' },
      update: {},
      create: expect.objectContaining({
        id: 'default',
        guardEnabled: false,
        guardAutoEnabled: false,
        guardTriggerWindowMinutes: 5,
        guardTriggerUniqueIpThreshold: 50,
        whitelistOnlyEnabled: false
      })
    });
    expect(config.id).toBe('default');
  });

  it('白名单模式应阻止非白名单 IP', async () => {
    mockPrisma.securityConfig.upsert.mockResolvedValue({
      id: 'default',
      guardEnabled: false,
      guardAutoEnabled: false,
      guardTriggerWindowMinutes: 5,
      guardTriggerUniqueIpThreshold: 50,
      whitelistOnlyEnabled: true,
      guardTriggeredAt: null,
      guardTriggeredReason: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const decision = await evaluatePublicRiskControl('203.0.113.10');

    expect(decision.whitelistOnlyBlocked).toBe(true);
    expect(decision.guardLimited).toBe(false);
  });

  it('白名单 IP 应豁免白名单模式和警戒限流', async () => {
    mockPrisma.securityConfig.upsert.mockResolvedValue({
      id: 'default',
      guardEnabled: true,
      guardAutoEnabled: false,
      guardTriggerWindowMinutes: 5,
      guardTriggerUniqueIpThreshold: 50,
      whitelistOnlyEnabled: true,
      guardTriggeredAt: null,
      guardTriggeredReason: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    mockPrisma.iPWhitelistEntry.findMany.mockResolvedValue([
      {
        id: 'wl_1',
        cidr: '203.0.113.0/24',
        note: null,
        isEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);

    const decision = await evaluatePublicRiskControl('203.0.113.10');

    expect(decision.isWhitelisted).toBe(true);
    expect(decision.whitelistOnlyBlocked).toBe(false);
    expect(decision.guardLimited).toBe(false);
  });

  it('自动警戒达到阈值时应开启警戒状态', async () => {
    mockPrisma.securityConfig.upsert.mockResolvedValue({
      id: 'default',
      guardEnabled: false,
      guardAutoEnabled: true,
      guardTriggerWindowMinutes: 5,
      guardTriggerUniqueIpThreshold: 2,
      whitelistOnlyEnabled: false,
      guardTriggeredAt: null,
      guardTriggeredReason: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    mockPrisma.iPWhitelistEntry.findMany.mockResolvedValue([
      {
        id: 'wl_1',
        cidr: '10.0.0.0/24',
        note: null,
        isEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
    mockPrisma.accessLog.groupBy.mockResolvedValue([
      { ip: '203.0.113.1' },
      { ip: '203.0.113.2' },
      { ip: '10.0.0.8' }
    ]);
    mockPrisma.securityConfig.update.mockResolvedValue({
      id: 'default',
      guardEnabled: true,
      guardAutoEnabled: true,
      guardTriggerWindowMinutes: 5,
      guardTriggerUniqueIpThreshold: 2,
      whitelistOnlyEnabled: false,
      guardTriggeredAt: new Date(),
      guardTriggeredReason: '5 分钟内检测到 2 个非白名单 IP 请求',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const decision = await evaluatePublicRiskControl('203.0.113.1');

    expect(mockPrisma.securityConfig.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ guardEnabled: true })
    }));
    expect(decision.guardLimited).toBe(true);
  });
});
