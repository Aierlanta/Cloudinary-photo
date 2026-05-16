export {};

type AnyMock = jest.Mock<any, any[]>;

const makePrismaMock = () => ({
  $queryRaw: jest.fn() as AnyMock,
  $queryRawUnsafe: jest.fn() as AnyMock,
  $executeRawUnsafe: jest.fn() as AnyMock,
  $executeRaw: jest.fn() as AnyMock,
  $transaction: jest.fn((items: Promise<unknown>[]) => Promise.all(items)) as AnyMock,
  $connect: jest.fn().mockResolvedValue(undefined) as AnyMock,
  $disconnect: jest.fn().mockResolvedValue(undefined) as AnyMock,
  aPIConfig: {
    findUnique: jest.fn() as AnyMock,
    upsert: jest.fn() as AnyMock
  },
  systemLog: {
    create: jest.fn() as AnyMock
  }
});

const mainMock = makePrismaMock();
const backupMock = makePrismaMock();

jest.mock('@prisma/client', () => {
  const ctor = jest
    .fn()
    .mockImplementationOnce(() => mainMock)
    .mockImplementationOnce(() => backupMock);

  const sqlTag = (strings: TemplateStringsArray, ...values: any[]) =>
    strings.reduce((acc, s, i) => acc + s + (i < values.length ? String(values[i]) : ''), '');

  return {
    PrismaClient: ctor,
    Prisma: {
      sql: sqlTag,
      raw: (value: string) => value,
      join: (items: any[], sep: string = ',') => items.map(String).join(sep),
    },
  };
});

process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/test';
process.env.BACKUP_DATABASE_URL = 'mysql://test:test@localhost:3306/bak';

describe('BackupService shadow snapshot backup & restore (mocked)', () => {
  let backupService: any;

  beforeAll(async () => {
    const mod = await import('@/lib/backup');
    backupService = mod.BackupService.getInstance();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    let lockOwner = '';
    mainMock.aPIConfig.findUnique.mockResolvedValue(null);
    mainMock.aPIConfig.upsert.mockResolvedValue({ id: 'backup_status' });
    mainMock.systemLog.create.mockResolvedValue(undefined);
    backupMock.$executeRawUnsafe.mockResolvedValue(0);
    backupMock.$executeRaw.mockImplementation((sql: string) => {
      const match = String(sql).match(/VALUES\s*\(\s*backup,\s*(snap_[^,\s]+)/);
      if (match) {
        lockOwner = match[1];
      }
      return Promise.resolve(0);
    });
    backupMock.$transaction.mockImplementation((items: Promise<unknown>[]) => Promise.all(items));
    backupMock.$queryRaw.mockImplementation((sql: string) => {
      if (String(sql).includes('SELECT owner')) {
        return Promise.resolve([{ owner: lockOwner, expiresAt: new Date(Date.now() + 1000) }]);
      }
      return Promise.resolve([]);
    });
  });

  it('performBackup creates a completed shadow snapshot and includes migration metadata', async () => {
    mainMock.$queryRaw.mockResolvedValueOnce([
      { TABLE_NAME: 'groups' },
      { TABLE_NAME: '_prisma_migrations' }
    ]);

    mainMock.$queryRawUnsafe.mockImplementation((sql: string) => {
      if (sql.includes('SHOW CREATE TABLE `groups`')) {
        return Promise.resolve([{ 'Create Table': 'CREATE TABLE `groups` (`id` varchar(191))' }]);
      }
      if (sql.includes('SHOW CREATE TABLE `_prisma_migrations`')) {
        return Promise.resolve([{ 'Create Table': 'CREATE TABLE `_prisma_migrations` (`id` varchar(191))' }]);
      }
      if (sql.includes('COUNT(*) as count FROM `groups`')) {
        return Promise.resolve([{ count: 1 }]);
      }
      if (sql.includes('COUNT(*) as count FROM `_prisma_migrations`')) {
        return Promise.resolve([{ count: 1 }]);
      }
      if (sql.startsWith('SELECT * FROM `groups`')) {
        return Promise.resolve([{ id: 'g1' }]);
      }
      if (sql.startsWith('SELECT * FROM `_prisma_migrations`')) {
        return Promise.resolve([{ id: 'migration-1' }]);
      }
      return Promise.resolve([]);
    });

    backupMock.$queryRawUnsafe.mockImplementation((sql: string) => {
      if (sql.includes('COUNT(*) as count FROM `__bk_')) {
        return Promise.resolve([{ count: 1 }]);
      }
      return Promise.resolve([]);
    });

    const result = await backupService.performBackup();

    expect(result.success).toBe(true);
    expect(result.copiedTables).toEqual(['groups', '_prisma_migrations']);
    expect(result.snapshotId).toMatch(/^snap_/);
    expect(backupMock.$executeRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS `_backup_snapshots`'));
    expect(backupMock.$executeRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE `__bk_'));
    expect(mainMock.aPIConfig.upsert).toHaveBeenCalledTimes(1);
    expect(mainMock.systemLog.create).toHaveBeenCalledTimes(1);
  });

  it('restoreFromBackup restores from active manifest and preserves backup_status', async () => {
    mainMock.aPIConfig.findUnique.mockResolvedValue({
      id: 'backup_status',
      isEnabled: true,
      defaultScope: 'backup',
      defaultGroups: '{"lastBackupTime":null}',
      allowedParameters: null,
      enableDirectResponse: false,
      apiKeyEnabled: false,
      apiKey: null
    });

    backupMock.$queryRawUnsafe.mockImplementation((sql: string) => {
      if (sql.includes('FROM `_backup_snapshots`')) {
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
      if (sql.includes('COUNT(*) as count FROM `__bk_active_0`')) {
        return Promise.resolve([{ count: 1 }]);
      }
      if (sql.startsWith('SELECT * FROM `__bk_active_0`')) {
        return Promise.resolve([{ id: 'g1' }]);
      }
      return Promise.resolve([]);
    });

    backupMock.$queryRaw.mockResolvedValue([{
      snapshotId: 'snap_active',
      sourceTableName: 'groups',
      backupTableName: '__bk_active_0',
      rowCount: 1,
      schemaHash: 'hash',
      createTableSql: 'CREATE TABLE `groups` (`id` varchar(191))',
      status: 'completed',
      error: null
    }]);

    mainMock.$queryRaw.mockResolvedValue([{ TABLE_NAME: 'groups' }]);
    mainMock.$executeRawUnsafe.mockResolvedValue(0);
    mainMock.$executeRaw.mockResolvedValue(0);

    const result = await backupService.restoreFromBackup();

    expect(result.success).toBe(true);
    expect(result.snapshotId).toBe('snap_active');
    expect(result.copiedTables).toEqual(['groups']);
    expect(mainMock.$executeRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('RENAME TABLE'));
    expect(mainMock.aPIConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'backup_status' }
      })
    );
  });
});


