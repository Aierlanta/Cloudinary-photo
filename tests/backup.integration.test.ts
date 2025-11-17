// Server-side integration-like tests with full PrismaClient mocked.
// We do NOT touch real databases; all Prisma calls are mocked.

import type { Mock } from 'jest-mock';

// Prepare PrismaClient double-instances: main and backup
type AnyRecord = Record<string, any>;

const makePrismaMock = () => ({
  $queryRaw: jest.fn() as Mock,
  $queryRawUnsafe: jest.fn() as Mock,
  $executeRawUnsafe: jest.fn() as Mock,
  $connect: jest.fn().mockResolvedValue(undefined) as Mock,
  $disconnect: jest.fn().mockResolvedValue(undefined) as Mock,
  aPIConfig: {
    findUnique: jest.fn() as Mock,
    upsert: jest.fn() as Mock
  },
  systemLog: {
    create: jest.fn() as Mock
  }
});

const mainMock = makePrismaMock();
const backupMock = makePrismaMock();

jest.mock('@prisma/client', () => {
  const ctor = jest
    .fn()
    .mockImplementationOnce(() => mainMock)
    .mockImplementationOnce(() => backupMock);
  return { PrismaClient: ctor };
});

// Ensure env URLs are set (tests run in node env project)
process.env.DATABASE_URL = process.env.DATABASE_URL || 'mysql://test:test@localhost:3306/test';
process.env.BACKUP_DATABASE_URL = 'mysql://test:test@localhost:3306/bak';

describe('BackupService dynamic backup & restore (mocked)', () => {
  let BackupService: any;
  let backupService: any;

  beforeAll(async () => {
    const mod = await import('@/lib/backup');
    BackupService = mod.BackupService;
    backupService = BackupService.getInstance();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('performBackup should enumerate and copy all non-system tables', async () => {
    // 1) List tables in main (filter out _prisma_migrations)
    (mainMock.$queryRaw as Mock).mockResolvedValueOnce([
      { TABLE_NAME: 'groups' },
      { TABLE_NAME: 'images' },
      { TABLE_NAME: '_prisma_migrations' }
    ]);

    // 2) SHOW CREATE for each table from main
    (mainMock.$queryRawUnsafe as Mock).mockImplementation((sql: string) => {
      if (sql.includes('SHOW CREATE TABLE `groups`')) {
        return Promise.resolve([{ 'Create Table': 'CREATE TABLE `groups` ( `id` varchar(191) )' }]);
      }
      if (sql.includes('SHOW CREATE TABLE `images`')) {
        return Promise.resolve([{ 'Create Table': 'CREATE TABLE `images` ( `id` varchar(191) )' }]);
      }
      if (sql.includes('COUNT(*) as count FROM `groups`')) {
        return Promise.resolve([{ count: 1 }]);
      }
      if (sql.includes('COUNT(*) as count FROM `images`')) {
        return Promise.resolve([{ count: 2 }]);
      }
      if (sql.startsWith('SELECT * FROM `groups`')) {
        return Promise.resolve([{ id: 'g1' }]);
      }
      if (sql.startsWith('SELECT * FROM `images`')) {
        return Promise.resolve([{ id: 'i1' }, { id: 'i2' }]);
      }
      return Promise.resolve([]);
    });

    // 3) backup DB executes DDL/DML
    (backupMock.$executeRawUnsafe as Mock).mockResolvedValue(0);

    // 4) Status reads/writes
    (mainMock.aPIConfig.findUnique as Mock).mockResolvedValue(null);
    (mainMock.aPIConfig.upsert as Mock).mockResolvedValue({ id: 'backup_status' });
    (mainMock.systemLog.create as Mock).mockResolvedValue(undefined);

    const ok = await backupService.performBackup();
    expect(ok).toBe(true);

    // Main should enumerate tables once
    expect(mainMock.$queryRaw).toHaveBeenCalledTimes(1);
    // Backup should clear tables and then create/insert (at least called)
    const backupExecCalls = (backupMock.$executeRawUnsafe as Mock).mock.calls.map(args => String(args[0]));
    // Foreign key toggles
    expect(backupExecCalls.some(s => s.includes('SET FOREIGN_KEY_CHECKS = 0'))).toBe(true);
    expect(backupExecCalls.some(s => s.includes('SET FOREIGN_KEY_CHECKS = 1'))).toBe(true);
    // Delete on target tables
    expect(backupExecCalls.some(s => s.includes('DELETE FROM `groups`'))).toBe(true);
    expect(backupExecCalls.some(s => s.includes('DELETE FROM `images`'))).toBe(true);
    // Recreate/insert traces
    expect(backupExecCalls.some(s => s.includes('DROP TABLE IF EXISTS `groups`'))).toBe(true);
    expect(backupExecCalls.some(s => s.includes('DROP TABLE IF EXISTS `images`'))).toBe(true);
    expect(backupExecCalls.some(s => s.includes('CREATE TABLE'))).toBe(true);
    expect(backupExecCalls.some(s => s.includes('INSERT INTO `groups`'))).toBe(true);
    expect(backupExecCalls.some(s => s.includes('INSERT INTO `images`'))).toBe(true);

    // Status updated
    expect(mainMock.aPIConfig.upsert).toHaveBeenCalledTimes(1);
    expect(mainMock.systemLog.create).toHaveBeenCalledTimes(1);
  });

  it('restoreFromBackup should rebuild from backup and preserve backup_status', async () => {
    // Preserve backup_status
    (mainMock.aPIConfig.findUnique as Mock).mockResolvedValue({
      id: 'backup_status',
      isEnabled: true,
      defaultScope: 'backup',
      defaultGroups: '{"lastBackupTime":null}',
      allowedParameters: null,
      enableDirectResponse: false,
      apiKeyEnabled: false,
      apiKey: null
    });

    // Main has some tables to drop
    (mainMock.$queryRaw as Mock).mockResolvedValueOnce([
      { TABLE_NAME: 'groups' },
      { TABLE_NAME: 'images' },
      { TABLE_NAME: 'api_configs' }
    ]);

    // Backup lists tables (includes api_configs)
    (backupMock.$queryRaw as Mock).mockResolvedValueOnce([
      { TABLE_NAME: 'groups' },
      { TABLE_NAME: 'images' },
      { TABLE_NAME: 'api_configs' }
    ]);

    // Backup SHOW CREATE TABLE and SELECT data
    (backupMock.$queryRawUnsafe as Mock).mockImplementation((sql: string) => {
      if (sql.includes('SHOW CREATE TABLE `groups`')) {
        return Promise.resolve([{ 'Create Table': 'CREATE TABLE `groups` ( `id` varchar(191) )' }]);
      }
      if (sql.includes('SHOW CREATE TABLE `images`')) {
        return Promise.resolve([{ 'Create Table': 'CREATE TABLE `images` ( `id` varchar(191) )' }]);
      }
      if (sql.includes('SHOW CREATE TABLE `api_configs`')) {
        return Promise.resolve([{ 'Create Table': 'CREATE TABLE `api_configs` ( `id` varchar(191) )' }]);
      }
      if (sql.startsWith('SELECT * FROM `groups`')) {
        return Promise.resolve([{ id: 'g1' }]);
      }
      if (sql.startsWith('SELECT * FROM `images`')) {
        return Promise.resolve([{ id: 'i1' }]);
      }
      if (sql.startsWith('SELECT * FROM `api_configs`')) {
        return Promise.resolve([
          { id: 'backup_status', isEnabled: true },
          { id: 'default', isEnabled: true }
        ]);
      }
      return Promise.resolve([]);
    });

    (mainMock.$executeRawUnsafe as Mock).mockResolvedValue(0);

    const ok = await backupService.restoreFromBackup();
    expect(ok).toBe(true);

    // INSERTs into api_configs should not include backup_status row
    const mainExecCalls = (mainMock.$executeRawUnsafe as Mock).mock.calls.map(args => String(args[0]));
    const apiInsert = mainExecCalls.find(s => s.includes('INSERT INTO `api_configs`'));
    expect(apiInsert).toBeTruthy();
    if (apiInsert) {
      expect(apiInsert.includes('backup_status')).toBe(false);
    }
    // backup_status should be restored via upsert
    expect(mainMock.aPIConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'backup_status' }
      })
    );
  });
});


