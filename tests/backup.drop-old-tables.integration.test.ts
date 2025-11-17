/**
 * BackupService 集成测试（server 项目）
 * 关注点：还原流程中旧表清理失败时，应以 error 级别汇总告警
 */
import { BackupService } from '@/lib/backup';
import { Logger } from '@/lib/logger';

// Mock Prisma Client（为 BackupService 顶层实例提供能力）
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    aPIConfig: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({})
    },
    systemLog: {
      create: jest.fn()
    },
    $queryRaw: jest.fn(),
    $queryRawUnsafe: jest.fn(),
    $executeRaw: jest.fn().mockResolvedValue(0),
    $executeRawUnsafe: jest.fn().mockResolvedValue(0),
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined)
  };

  return {
    PrismaClient: jest.fn().mockImplementation(() => mockPrisma)
  };
});

// 获取 mock Prisma 实例以便在测试中配置行为
const { PrismaClient } = require('@prisma/client');
const mockPrisma = new PrismaClient();

describe('BackupService - 旧表清理失败时的错误日志（server）', () => {
  let service: BackupService;
  const mockLogger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  } as unknown as Logger;

  beforeEach(() => {
    jest.clearAllMocks();

    // 重置单例，确保隔离
    (BackupService as any).instance = undefined;
    jest.spyOn(Logger, 'getInstance').mockReturnValue(mockLogger as any);

    // 依次返回备份库与主库的表列表（均包含 users）
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ TABLE_NAME: 'users' }]) // getAllTablesFromBackup
      .mockResolvedValueOnce([{ TABLE_NAME: 'users' }]); // getAllTables

    // SHOW CREATE TABLE -> 返回一个可用的建表语句
    mockPrisma.$queryRawUnsafe.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.startsWith('SHOW CREATE TABLE')) {
        return Promise.resolve([{ 'Create Table': 'CREATE TABLE `users` (`id` int)' }]);
      }
      if (typeof sql === 'string' && sql.startsWith('SELECT * FROM `users`')) {
        // 让数据为空，跳过插入过程
        return Promise.resolve([]);
      }
      return Promise.resolve(0);
    });

    // 模拟 DROP 旧表失败：命中 __old_ 关键字时抛错
    mockPrisma.$executeRawUnsafe.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('DROP TABLE IF EXISTS') && sql.includes('__old_')) {
        return Promise.reject(new Error('mock drop old table failed'));
      }
      return Promise.resolve(0);
    });

    service = BackupService.getInstance();
  });

  it('当清理旧表失败时，应以 error 级别记录并包含 __old_ 提示', async () => {
    await service.restoreFromBackup();

    expect((mockLogger as any).error).toHaveBeenCalledWith(
      expect.stringContaining('未能成功清理')
    );
    expect((mockLogger as any).error).toHaveBeenCalledWith(
      expect.stringContaining('__old_')
    );
  });
});


