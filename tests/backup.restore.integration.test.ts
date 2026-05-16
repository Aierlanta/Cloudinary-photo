export {};

type AnyMock = jest.Mock<any, any[]>;

jest.mock('@prisma/client', () => {
  const mkClient = () => ({
    $queryRaw: jest.fn(),
    $queryRawUnsafe: jest.fn(),
    $executeRaw: jest.fn(),
    $executeRawUnsafe: jest.fn(),
    $transaction: jest.fn((items: Promise<unknown>[]) => Promise.all(items)),
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    aPIConfig: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue(undefined),
    },
    systemLog: { create: jest.fn() },
  });

  const instances: any[] = [];
  const PrismaClient = jest.fn(() => {
    const inst = mkClient();
    instances.push(inst);
    return inst;
  });

  const Prisma = {
    sql: (strings: TemplateStringsArray, ...values: any[]) => ({ __tag: 'sql', strings, values }),
    join: (items: any[], sep?: any) => ({ __tag: 'join', items, sep }),
    raw: (val: string) => ({ __tag: 'raw', val }),
  };

  return { PrismaClient, Prisma };
});

process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/test';
process.env.BACKUP_DATABASE_URL = 'mysql://test:test@localhost:3306/bak';

describe('BackupService restore (mocked integration)', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  function getClients() {
    const { PrismaClient } = require('@prisma/client') as any;
    const results = (PrismaClient as any).mock?.results || [];
    const main = results[0]?.value;
    const backup = results[1]?.value;
    return { main, backup, PrismaClient };
  }

  it('uses parameterized INSERT (no unsafe INSERT) and performs atomic rename', async () => {
    const { default: BackupService } = await import('@/lib/backup');
    const { main, backup } = getClients();

    (backup.$queryRawUnsafe as AnyMock).mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('FROM `_backup_snapshots`')) {
        return Promise.resolve([{
          id: 'snap_active',
          status: 'completed',
          isActive: true,
          startedAt: new Date(),
          completedAt: new Date(),
          tableCount: 1,
          totalRows: 1,
          error: null,
          metadata: null
        }]);
      }
      if (typeof sql === 'string' && sql.includes('COUNT(*) as count FROM `__bk_users`')) {
        return Promise.resolve([{ count: 1 }]);
      }
      if (typeof sql === 'string' && sql.includes('SELECT * FROM `__bk_users`')) {
        return Promise.resolve([{ id: '1', name: "Alice's Toy" }]);
      }
      return Promise.resolve([]);
    });

    (backup.$queryRaw as AnyMock).mockResolvedValue([{
      snapshotId: 'snap_active',
      sourceTableName: 'users',
      backupTableName: '__bk_users',
      rowCount: 1,
      schemaHash: 'hash',
      createTableSql: 'CREATE TABLE `users` (`id` varchar(191), `name` text)',
      status: 'completed',
      error: null
    }]);
    (main.$queryRaw as AnyMock).mockResolvedValue([{ TABLE_NAME: 'users' }]);
    (main.$executeRawUnsafe as AnyMock).mockResolvedValue(0);
    (main.$executeRaw as AnyMock).mockResolvedValue(0);

    const result = await BackupService.getInstance().restoreFromBackup();
    expect(result.success).toBe(true);

    const unsafeMainCalls = (main.$executeRawUnsafe as AnyMock).mock.calls.map(args => args[0]);
    expect(unsafeMainCalls.some((s: any) => typeof s === 'string' && /INSERT\s+INTO/i.test(s))).toBe(false);

    expect((main.$executeRaw as AnyMock).mock.calls.length).toBeGreaterThan(0);
    const firstParamCallArg = (main.$executeRaw as AnyMock).mock.calls[0][0];
    expect(typeof firstParamCallArg).not.toBe('string');

    expect(unsafeMainCalls.some((s: any) => typeof s === 'string' && s.includes('RENAME TABLE'))).toBe(true);
  });

  it('initializeBackupDatabase creates control tables only', async () => {
    const { default: BackupService } = await import('@/lib/backup');
    const { backup } = getClients();
    (backup.$executeRawUnsafe as AnyMock).mockResolvedValue(0);

    const result = await BackupService.getInstance().initializeBackupDatabase();

    expect(result.success).toBe(true);
    const calls = (backup.$executeRawUnsafe as AnyMock).mock.calls.map(args => args[0]);
    expect(calls.some((s: any) => typeof s === 'string' && s.includes('CREATE TABLE IF NOT EXISTS `_backup_snapshots`'))).toBe(true);
    expect(calls.some((s: any) => typeof s === 'string' && s.includes('CREATE TABLE IF NOT EXISTS `_backup_snapshot_tables`'))).toBe(true);
    expect(calls.some((s: any) => typeof s === 'string' && s.includes('CREATE TABLE IF NOT EXISTS `_backup_locks`'))).toBe(true);
  });

  it('does not perform RENAME and cleans tmp tables when restore fails mid-way', async () => {
    const { default: BackupService } = await import('@/lib/backup');
    const { main, backup } = getClients();

    (backup.$queryRawUnsafe as AnyMock).mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('FROM `_backup_snapshots`')) {
        return Promise.resolve([{
          id: 'snap_active',
          status: 'completed',
          isActive: true,
          startedAt: new Date(),
          completedAt: new Date(),
          tableCount: 2,
          totalRows: 2,
          error: null,
          metadata: null
        }]);
      }
      if (typeof sql === 'string' && sql.includes('COUNT(*) as count FROM `__bk_t1`')) {
        return Promise.resolve([{ count: 1 }]);
      }
      if (typeof sql === 'string' && sql.includes('COUNT(*) as count FROM `__bk_t2`')) {
        return Promise.resolve([{ count: 1 }]);
      }
      if (typeof sql === 'string' && sql.includes('SELECT * FROM `__bk_t1`')) {
        return Promise.resolve([{ id: 1 }]);
      }
      if (typeof sql === 'string' && sql.includes('SELECT * FROM `__bk_t2`')) {
        return Promise.reject(new Error('Something broke!'));
      }
      return Promise.resolve([]);
    });

    (backup.$queryRaw as AnyMock).mockResolvedValue([
      {
        snapshotId: 'snap_active',
        sourceTableName: 't1',
        backupTableName: '__bk_t1',
        rowCount: 1,
        schemaHash: 'hash',
        createTableSql: 'CREATE TABLE `t1` (`id` int)',
        status: 'completed',
        error: null
      },
      {
        snapshotId: 'snap_active',
        sourceTableName: 't2',
        backupTableName: '__bk_t2',
        rowCount: 1,
        schemaHash: 'hash',
        createTableSql: 'CREATE TABLE `t2` (`id` int)',
        status: 'completed',
        error: null
      }
    ]);
    (main.$queryRaw as AnyMock).mockResolvedValue([]);
    (main.$executeRawUnsafe as AnyMock).mockResolvedValue(0);
    (main.$executeRaw as AnyMock).mockResolvedValue(0);

    const result = await BackupService.getInstance().restoreFromBackup();
    expect(result.success).toBe(false);

    const unsafeMainCalls = (main.$executeRawUnsafe as AnyMock).mock.calls.map(args => args[0] as any);
    expect(unsafeMainCalls.some((s: any) => typeof s === 'string' && s.includes('RENAME TABLE'))).toBe(false);
    expect(unsafeMainCalls.some((s: any) => typeof s === 'string' && s.includes('DROP TABLE IF EXISTS `__restore_'))).toBe(true);
  });
});


