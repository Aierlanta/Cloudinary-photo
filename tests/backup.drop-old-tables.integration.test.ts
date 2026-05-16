import { Logger } from '@/lib/logger';

process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/test';
process.env.BACKUP_DATABASE_URL = 'mysql://test:test@localhost:3306/bak';

// Mock Prisma Client（为 BackupService 顶层实例提供能力）
jest.mock('@prisma/client', () => {
  const mockMain = {
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
  const mockBackup = {
    ...mockMain,
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
    PrismaClient: jest.fn()
      .mockImplementationOnce(() => mockMain)
      .mockImplementationOnce(() => mockBackup),
    Prisma: {
      sql: (strings: TemplateStringsArray, ...values: any[]) => (
        strings.reduce((acc, s, i) => acc + s + (i < values.length ? String(values[i]) : ''), '')
      ),
      raw: (value: string) => value,
      join: (items: any[], sep: string = ',') => items.map(String).join(sep),
    }
  };
});

let mockMain: any;
let mockBackup: any;

describe('BackupService - 旧表清理失败时的错误日志（server）', () => {
  let service: any;
  const mockLogger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  } as unknown as Logger;

  beforeEach(() => {
    jest.clearAllMocks();

    // 重置单例，确保隔离
    const { BackupService } = require('@/lib/backup');
    const { PrismaClient } = require('@prisma/client');
    const prismaResults = (PrismaClient as jest.Mock).mock.results;
    mockMain = prismaResults[0].value;
    mockBackup = prismaResults[1].value;
    (BackupService as any).instance = undefined;
    jest.spyOn(Logger, 'getInstance').mockReturnValue(mockLogger as any);

    mockBackup.$queryRawUnsafe.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('FROM `_backup_snapshots`')) {
        return Promise.resolve([{
          id: 'snap_active',
          status: 'completed',
          isActive: true,
          startedAt: new Date(),
          completedAt: new Date(),
          tableCount: 1,
          totalRows: 0,
          error: null,
          metadata: null
        }]);
      }
      if (typeof sql === 'string' && sql.includes('COUNT(*) as count FROM `__bk_users`')) {
        return Promise.resolve([{ count: 0 }]);
      }
      return Promise.resolve([]);
    });

    mockBackup.$queryRaw.mockResolvedValue([{
      snapshotId: 'snap_active',
      sourceTableName: 'users',
      backupTableName: '__bk_users',
      rowCount: 0,
      schemaHash: 'hash',
      createTableSql: 'CREATE TABLE `users` (`id` int)',
      status: 'completed',
      error: null
    }]);
    mockMain.$queryRaw.mockResolvedValue([{ TABLE_NAME: 'users' }]);

    mockMain.$executeRawUnsafe.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('DROP TABLE IF EXISTS') && sql.includes('__old_')) {
        return Promise.reject(new Error('mock drop old table failed'));
      }
      return Promise.resolve(0);
    });
    mockMain.$executeRaw.mockResolvedValue(0);

    service = BackupService.getInstance();
  });

  it('当清理旧表失败时，应在结构化结果中返回 warning', async () => {
    const result = await service.restoreFromBackup();

    expect(result.success).toBe(true);
    expect(result.warnings.some((warning: string) => warning.includes('__old_'))).toBe(true);
  });
});


