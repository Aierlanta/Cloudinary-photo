/**
 * Backup/Restore 流程（模拟集成测试，无真实数据库改动）
 * 目标：
 * 1) 验证插入使用参数化（不使用 $executeRawUnsafe 进行 INSERT）
 * 2) 验证还原原子性：失败中途不进行 RENAME，且已创建的临时表被清理
 * 3) 验证 FOREIGN_KEY_CHECKS 在错误时也会在 finally 中恢复
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Mock } from 'jest-mock';

// 先 mock PrismaClient，确保导入 BackupService 时使用的是模拟客户端
jest.mock('@prisma/client', () => {
  const mkClient = () => ({
    $queryRaw: jest.fn(),
    $queryRawUnsafe: jest.fn(),
    $executeRaw: jest.fn(),
    $executeRawUnsafe: jest.fn(),
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    // 仅为向下兼容的模型接口（本测试不实际触达数据库）
    aPIConfig: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue(undefined),
    },
    image: { createMany: jest.fn() },
    group: { createMany: jest.fn() },
    counter: { createMany: jest.fn() },
    systemLog: { create: jest.fn(), createMany: jest.fn() },
  });

  const instances: any[] = [];
  const PrismaClient = jest.fn(() => {
    const inst = mkClient();
    instances.push(inst);
    return inst;
  });

  // 简化版 Prisma.sql/join/raw，占位用以区分是否为参数化对象
  const Prisma = {
    sql: (strings: TemplateStringsArray, ...values: any[]) => ({ __tag: 'sql', strings, values }),
    join: (items: any[], sep?: any) => ({ __tag: 'join', items, sep }),
    raw: (val: string) => ({ __tag: 'raw', val }),
  };

  return { PrismaClient, Prisma };
});

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

    // 列举备份库/主库表
    (backup.$queryRaw as Mock).mockResolvedValue([{ TABLE_NAME: 'users' }]);
    (main.$queryRaw as Mock).mockResolvedValue([{ TABLE_NAME: 'users' }]);

    // 备份库：SHOW CREATE TABLE + SELECT 数据
    (backup.$queryRawUnsafe as Mock).mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('SHOW CREATE TABLE')) {
        return Promise.resolve([{ 'Create Table': 'CREATE TABLE `users` (`id` varchar(191), `name` text)' }]);
      }
      if (typeof sql === 'string' && sql.includes('SELECT * FROM `users`')) {
        return Promise.resolve([{ id: '1', name: "Alice's Toy" }]);
      }
      return Promise.resolve([]);
    });

    // 主库：所有 DDL/DML 默认成功
    (main.$executeRawUnsafe as Mock).mockResolvedValue(0);
    (main.$executeRaw as Mock).mockResolvedValue(0);

    const ok = await BackupService.getInstance().restoreFromBackup();
    expect(ok).toBe(true);

    // 验证 INSERT 使用参数化：不使用 $executeRawUnsafe 执行 INSERT
    const unsafeMainCalls = (main.$executeRawUnsafe as Mock).mock.calls.map(args => args[0]);
    expect(unsafeMainCalls.some((s: any) => typeof s === 'string' && /INSERT\s+INTO/i.test(s))).toBe(false);

    // 应至少调用一次 $executeRaw（参数化对象）
    expect((main.$executeRaw as Mock).mock.calls.length).toBeGreaterThan(0);
    const firstParamCallArg = (main.$executeRaw as Mock).mock.calls[0][0];
    expect(typeof firstParamCallArg).not.toBe('string');

    // 验证出现原子 RENAME
    expect(unsafeMainCalls.some((s: any) => typeof s === 'string' && s.includes('RENAME TABLE'))).toBe(true);
  });

  it('re-enables FOREIGN_KEY_CHECKS in finally even when drop fails', async () => {
    const { default: BackupService } = await import('@/lib/backup');
    const { main, backup } = getClients();

    // 让 initializeBackupDatabase 能枚举出表
    (main.$queryRaw as Mock).mockResolvedValue([{ TABLE_NAME: 't1' }]);
    (backup.$queryRaw as Mock).mockResolvedValue([{ TABLE_NAME: 't1' }]);

    // dropAllBackupTables 阶段：SET=0 成功，DROP 失败，finally 中 SET=1 必须执行
    (backup.$executeRawUnsafe as Mock).mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('SET FOREIGN_KEY_CHECKS = 0')) return Promise.resolve(0);
      if (typeof sql === 'string' && sql.startsWith('DROP TABLE')) return Promise.reject(new Error('DB connection failed'));
      if (typeof sql === 'string' && sql.includes('SET FOREIGN_KEY_CHECKS = 1')) return Promise.resolve(0);
      return Promise.resolve(0);
    });

    // SHOW CREATE TABLE 主库结构
    (main.$queryRawUnsafe as Mock).mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('SHOW CREATE TABLE')) {
        return Promise.resolve([{ 'Create Table': 'CREATE TABLE `t1` (`id` int)' }]);
      }
      return Promise.resolve([]);
    });

    // 其余 DDL 默认成功
    (backup.$executeRaw as Mock).mockResolvedValue(0);
    (main.$executeRawUnsafe as Mock).mockResolvedValue(0);

    await BackupService.getInstance().initializeBackupDatabase();

    // 验证最终调用了 SET FOREIGN_KEY_CHECKS = 1
    const calls = (backup.$executeRawUnsafe as Mock).mock.calls.map(args => args[0]);
    expect(calls.some((s: any) => typeof s === 'string' && s.includes('SET FOREIGN_KEY_CHECKS = 1'))).toBe(true);
  });

  it('does not perform RENAME and cleans tmp tables when restore fails mid-way', async () => {
    const { default: BackupService } = await import('@/lib/backup');
    const { main, backup } = getClients();

    // 两张备份表：t1 正常，t2 在读取数据时抛错
    (backup.$queryRaw as Mock).mockResolvedValue([{ TABLE_NAME: 't1' }, { TABLE_NAME: 't2' }]);
    (main.$queryRaw as Mock).mockResolvedValue([]); // 主库初始无业务表

    (backup.$queryRawUnsafe as Mock).mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('SHOW CREATE TABLE')) {
        // 针对 t1 / t2 的建表语句
        return Promise.resolve([{ 'Create Table': 'CREATE TABLE `tX` (`id` int)' }]);
      }
      if (typeof sql === 'string' && sql.includes('SELECT * FROM `t1`')) {
        return Promise.resolve([{ id: 1 }]);
      }
      if (typeof sql === 'string' && sql.includes('SELECT * FROM `t2`')) {
        return Promise.reject(new Error('Something broke!'));
      }
      return Promise.resolve([]);
    });

    // 主库 DDL 默认成功
    (main.$executeRawUnsafe as Mock).mockResolvedValue(0);
    (main.$executeRaw as Mock).mockResolvedValue(0);

    const ok = await BackupService.getInstance().restoreFromBackup();
    expect(ok).toBe(false);

    const unsafeMainCalls = (main.$executeRawUnsafe as Mock).mock.calls.map(args => args[0] as any);
    // 不应出现 RENAME TABLE（因为中途失败）
    expect(unsafeMainCalls.some((s: any) => typeof s === 'string' && s.includes('RENAME TABLE'))).toBe(false);
    // 应清理已创建的临时表 t1__tmp_restore
    expect(unsafeMainCalls.some((s: any) => typeof s === 'string' && s.includes('DROP TABLE IF EXISTS `t1__tmp_restore`'))).toBe(true);
  });
});


