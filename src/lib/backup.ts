/**
 * 数据库备份和还原服务
 * 使用独立备份库保存可验证的 shadow snapshot。
 */

import { createHash, randomBytes } from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { ConfigurationError, DatabaseError } from '@/types/errors';
import { LogLevel, Logger } from './logger';

const BACKUP_STATUS_CONFIG_ID = 'backup_status';
const SNAPSHOT_TABLE = '_backup_snapshots';
const SNAPSHOT_TABLES_TABLE = '_backup_snapshot_tables';
const LOCK_TABLE = '_backup_locks';
const BACKUP_TABLE_PREFIX = '__bk_';
const RESTORE_TABLE_PREFIX = '__restore_';
const BATCH_SIZE = 500;
const BACKUP_LOCK_TTL_MS = 30 * 60 * 1000;

function getBackupDatabaseUrl(): string | undefined {
  return process.env.BACKUP_DATABASE_URL?.trim() || undefined;
}

const DATABASE_URL = process.env.DATABASE_URL;
const BACKUP_DATABASE_URL = getBackupDatabaseUrl();

const mainPrisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL
    }
  }
});

const backupPrisma = BACKUP_DATABASE_URL
  ? new PrismaClient({
      datasources: {
        db: {
          url: BACKUP_DATABASE_URL
        }
      }
    })
  : null;

type BackupOperation = 'backup' | 'restore' | 'initialize' | 'cron';
type BackupOperationStatus = 'completed' | 'failed' | 'skipped';

export interface BackupTableResult {
  tableName: string;
  backupTableName?: string;
  rowCount: number;
  schemaHash?: string;
  success: boolean;
  error?: string;
}

export interface BackupOperationResult {
  operation: BackupOperation;
  status: BackupOperationStatus;
  success: boolean;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  snapshotId?: string;
  tableCount: number;
  totalRows: number;
  copiedTables: string[];
  failedTables: BackupTableResult[];
  warnings: string[];
  error?: string;
  skippedReason?: string;
}

export interface BackupStatus {
  lastBackupTime: Date | null;
  lastBackupSuccess: boolean;
  lastBackupError?: string;
  backupCount: number;
  isAutoBackupEnabled: boolean;
  backupDatabaseConfigured: boolean;
  activeSnapshotId?: string;
  lastBackupDurationMs?: number;
  lastBackupTableCount?: number;
  lastBackupRowCount?: number;
  lastBackupFailedTables?: BackupTableResult[];
  lastBackupResult?: BackupOperationResult;
}

interface SnapshotRecord {
  id: string;
  status: 'pending' | 'completed' | 'failed';
  isActive: boolean | number;
  startedAt: Date;
  completedAt: Date | null;
  tableCount: number;
  totalRows: number;
  error: string | null;
  metadata: string | null;
}

interface SnapshotTableRecord {
  snapshotId: string;
  sourceTableName: string;
  backupTableName: string;
  rowCount: number;
  schemaHash: string;
  createTableSql: string;
  status: 'completed' | 'failed';
  error: string | null;
}

function safeJsonStringify(value: unknown): string {
  return JSON.stringify(value, (_key, item) => (
    typeof item === 'bigint' ? item.toString() : item
  ));
}

function hashText(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function quoteIdentifier(identifier: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(identifier)) {
    throw new DatabaseError(`非法数据库标识符: ${identifier}`);
  }
  return `\`${identifier}\``;
}

function trimTrailingComma(line: string): string {
  return line.replace(/,\s*$/, '');
}

function buildOperationResult(params: {
  operation: BackupOperation;
  status: BackupOperationStatus;
  startedAt: Date;
  snapshotId?: string;
  copiedTables?: string[];
  failedTables?: BackupTableResult[];
  warnings?: string[];
  totalRows?: number;
  error?: string;
  skippedReason?: string;
}): BackupOperationResult {
  const completedAt = new Date();
  const copiedTables = params.copiedTables || [];
  const failedTables = params.failedTables || [];
  return {
    operation: params.operation,
    status: params.status,
    success: params.status === 'completed',
    startedAt: params.startedAt,
    completedAt,
    durationMs: completedAt.getTime() - params.startedAt.getTime(),
    snapshotId: params.snapshotId,
    tableCount: copiedTables.length + failedTables.length,
    totalRows: params.totalRows || 0,
    copiedTables,
    failedTables,
    warnings: params.warnings || [],
    error: params.error,
    skippedReason: params.skippedReason
  };
}

function getDatabaseIdentity(urlValue?: string): string | undefined {
  if (!urlValue) return undefined;
  try {
    const url = new URL(urlValue);
    return [
      url.protocol,
      url.hostname.toLowerCase(),
      url.port || '',
      url.pathname.replace(/\/+$/, '')
    ].join('|');
  } catch {
    return undefined;
  }
}

function createSnapshotId(): string {
  return `snap_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`;
}

function createBackupTableName(snapshotId: string, index: number): string {
  const compactSnapshotId = snapshotId.replace(/^snap_/, '').replace(/_/g, '');
  return `${BACKUP_TABLE_PREFIX}${compactSnapshotId}_${index.toString(36)}`;
}

function createRestoreTableName(index: number): string {
  return `${RESTORE_TABLE_PREFIX}${Date.now().toString(36)}_${index.toString(36)}`;
}

function isBackupInternalTable(tableName: string): boolean {
  return tableName === SNAPSHOT_TABLE
    || tableName === SNAPSHOT_TABLES_TABLE
    || tableName === LOCK_TABLE
    || tableName.startsWith(BACKUP_TABLE_PREFIX)
    || tableName.startsWith(RESTORE_TABLE_PREFIX)
    || tableName.includes('__old_')
    || tableName.includes('__tmp_restore');
}

function transformCreateTableSql(
  createTableSql: string,
  targetTableName: string,
  options?: { stripForeignKeys?: boolean }
): string {
  const stripForeignKeys = options?.stripForeignKeys === true;
  const renamed = createTableSql.replace(
    /CREATE TABLE `[^`]+`/i,
    `CREATE TABLE ${quoteIdentifier(targetTableName)}`
  );

  if (!stripForeignKeys) {
    return renamed;
  }

  const lines = renamed.split('\n');
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    return !(trimmed.includes('FOREIGN KEY') || trimmed.startsWith('CONSTRAINT '));
  });

  return filtered
    .join('\n')
    .replace(/,\n\)/g, '\n)');
}

function extractForeignKeyClauses(createTableSql: string): string[] {
  return createTableSql
    .split('\n')
    .map((line) => trimTrailingComma(line.trim()))
    .filter((line) => line.includes('FOREIGN KEY') || line.startsWith('CONSTRAINT '));
}

export class BackupService {
  private static instance: BackupService;
  private logger = Logger.getInstance();
  private isBackupInProgress = false;

  private constructor() {}

  static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService();
    }
    return BackupService.instance;
  }

  async getBackupStatus(): Promise<BackupStatus> {
    try {
      const config = await mainPrisma.aPIConfig.findUnique({
        where: { id: BACKUP_STATUS_CONFIG_ID }
      });

      const defaultStatus: BackupStatus = {
        lastBackupTime: null,
        lastBackupSuccess: false,
        backupCount: 0,
        isAutoBackupEnabled: false,
        backupDatabaseConfigured: this.hasValidBackupDatabaseUrl()
      };

      if (!config) {
        return defaultStatus;
      }

      const status = JSON.parse(config.defaultGroups || '{}');
      return {
        ...defaultStatus,
        lastBackupTime: status.lastBackupTime ? new Date(status.lastBackupTime) : null,
        lastBackupSuccess: status.lastBackupSuccess === true,
        lastBackupError: status.lastBackupError,
        backupCount: status.backupCount || 0,
        isAutoBackupEnabled: this.hasValidBackupDatabaseUrl() && status.isAutoBackupEnabled === true,
        activeSnapshotId: status.activeSnapshotId,
        lastBackupDurationMs: status.lastBackupDurationMs,
        lastBackupTableCount: status.lastBackupTableCount,
        lastBackupRowCount: status.lastBackupRowCount,
        lastBackupFailedTables: status.lastBackupFailedTables || [],
        lastBackupResult: status.lastBackupResult
      };
    } catch (error) {
      this.logger.error('获取备份状态失败', error instanceof Error ? error : undefined, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw new DatabaseError('获取备份状态失败');
    }
  }

  private async updateBackupStatus(status: Partial<BackupStatus>): Promise<void> {
    const currentStatus = await this.getBackupStatus();
    const newStatus = {
      ...currentStatus,
      ...status,
      backupDatabaseConfigured: this.hasValidBackupDatabaseUrl()
    };

    await mainPrisma.aPIConfig.upsert({
      where: { id: BACKUP_STATUS_CONFIG_ID },
      update: {
        defaultGroups: safeJsonStringify(newStatus),
        updatedAt: new Date()
      },
      create: {
        id: BACKUP_STATUS_CONFIG_ID,
        isEnabled: true,
        defaultScope: 'backup',
        defaultGroups: safeJsonStringify(newStatus)
      }
    });

    if (status.lastBackupTime || status.lastBackupResult) {
      await this.recordBackupHistory(newStatus.lastBackupSuccess, newStatus.lastBackupError, newStatus.lastBackupResult);
    }
  }

  private async recordBackupHistory(
    success: boolean,
    error?: string,
    result?: BackupOperationResult
  ): Promise<void> {
    try {
      await mainPrisma.systemLog.create({
        data: {
          timestamp: new Date(),
          level: success ? LogLevel.INFO : LogLevel.ERROR,
          message: success ? '数据库备份成功' : '数据库备份失败',
          context: safeJsonStringify({
            type: 'backup_operation',
            success,
            error: error || null,
            result: result || null,
            timestamp: new Date().toISOString()
          }),
          error: null,
          userId: null,
          requestId: null,
          ip: null,
          userAgent: null,
          type: 'backup_operation'
        }
      });
    } catch (error) {
      this.logger.error('记录备份历史失败', error instanceof Error ? error : undefined, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async performBackup(options?: { operation?: BackupOperation; force?: boolean }): Promise<BackupOperationResult> {
    const startedAt = new Date();
    const operation = options?.operation || 'backup';

    if (this.isBackupInProgress) {
      return buildOperationResult({
        operation,
        status: 'skipped',
        startedAt,
        skippedReason: '备份正在进行中'
      });
    }

    this.isBackupInProgress = true;
    const snapshotId = createSnapshotId();
    const copiedTables: string[] = [];
    const failedTables: BackupTableResult[] = [];
    const warnings: string[] = [];
    const createdBackupTables: string[] = [];
    let totalRows = 0;
    let lockAcquired = false;

    try {
      this.assertBackupDatabaseUsable();
      await this.ensureBackupControlTables();
      lockAcquired = await this.acquireBackupLock(snapshotId, BACKUP_LOCK_TTL_MS);
      if (!lockAcquired) {
        return buildOperationResult({
          operation,
          status: 'skipped',
          startedAt,
          skippedReason: '已有备份任务正在运行'
        });
      }

      this.logger.info('开始数据库备份', { snapshotId, timestamp: startedAt });

      await this.createSnapshotRecord(snapshotId, startedAt);
      const tables = this.filterSnapshotTables(await this.getAllTables(mainPrisma));
      this.logger.debug(`发现 ${tables.length} 个表需要备份`, { tables, snapshotId });

      for (let index = 0; index < tables.length; index += 1) {
        const tableName = tables[index];
        const backupTableName = createBackupTableName(snapshotId, index);
        createdBackupTables.push(backupTableName);

        try {
          const result = await this.copyTableToBackupSnapshot(tableName, backupTableName, snapshotId);
          copiedTables.push(tableName);
          totalRows += result.rowCount;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          failedTables.push({
            tableName,
            backupTableName,
            rowCount: 0,
            success: false,
            error: errorMessage
          });
          this.logger.error(`备份表 ${tableName} 失败`, error instanceof Error ? error : undefined, {
            snapshotId,
            tableName,
            error: errorMessage
          });
        }
      }

      if (failedTables.length > 0) {
        throw new DatabaseError('部分表备份失败，未切换 active snapshot', { failedTables });
      }

      await this.markSnapshotCompleted(snapshotId, copiedTables.length, totalRows, {
        copiedTables,
        totalRows
      });
      await this.activateSnapshot(snapshotId);
      await this.cleanupInactiveSnapshots(snapshotId, warnings);

      const result = buildOperationResult({
        operation,
        status: 'completed',
        startedAt,
        snapshotId,
        copiedTables,
        failedTables,
        warnings,
        totalRows
      });

      const currentStatus = await this.getBackupStatus();
      await this.updateBackupStatus({
        lastBackupTime: startedAt,
        lastBackupSuccess: true,
        lastBackupError: undefined,
        backupCount: currentStatus.backupCount + 1,
        activeSnapshotId: snapshotId,
        lastBackupDurationMs: result.durationMs,
        lastBackupTableCount: result.tableCount,
        lastBackupRowCount: result.totalRows,
        lastBackupFailedTables: [],
        lastBackupResult: result
      });

      this.logger.info('数据库备份完成', {
        snapshotId,
        duration: `${result.durationMs}ms`,
        tableCount: result.tableCount,
        totalRows
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      warnings.push(...await this.cleanupCreatedBackupTables(createdBackupTables));
      await this.markSnapshotFailed(snapshotId, errorMessage, {
        copiedTables,
        failedTables,
        warnings
      }).catch((markError) => {
        this.logger.warn('标记备份快照失败状态时出错', {
          snapshotId,
          error: markError instanceof Error ? markError.message : String(markError)
        });
      });

      const result = buildOperationResult({
        operation,
        status: 'failed',
        startedAt,
        snapshotId,
        copiedTables,
        failedTables,
        warnings,
        totalRows,
        error: errorMessage
      });

      this.logger.error('数据库备份失败', error instanceof Error ? error : undefined, {
        snapshotId,
        error: errorMessage,
        failedTables
      });

      await this.updateBackupStatus({
        lastBackupTime: startedAt,
        lastBackupSuccess: false,
        lastBackupError: errorMessage,
        lastBackupDurationMs: result.durationMs,
        lastBackupTableCount: result.tableCount,
        lastBackupRowCount: result.totalRows,
        lastBackupFailedTables: failedTables,
        lastBackupResult: result
      }).catch((statusError) => {
        this.logger.error('更新备份失败状态失败', statusError instanceof Error ? statusError : undefined, {
          error: statusError instanceof Error ? statusError.message : String(statusError)
        });
      });

      return result;
    } finally {
      if (lockAcquired) {
        await this.releaseBackupLock(snapshotId).catch((error) => {
          this.logger.warn('释放备份锁失败', {
            snapshotId,
            error: error instanceof Error ? error.message : String(error)
          });
        });
      }
      this.isBackupInProgress = false;
    }
  }

  async restoreFromBackup(snapshotId?: string): Promise<BackupOperationResult> {
    const startedAt = new Date();
    const copiedTables: string[] = [];
    const failedTables: BackupTableResult[] = [];
    const warnings: string[] = [];
    const restoreTables: string[] = [];
    const oldTablesToDrop: string[] = [];
    let totalRows = 0;

    try {
      this.assertBackupDatabaseUsable();
      await this.ensureBackupControlTables();
      const snapshot = snapshotId
        ? await this.getSnapshot(snapshotId)
        : await this.getActiveSnapshot();

      if (!snapshot || snapshot.status !== 'completed') {
        throw new DatabaseError('没有可用于恢复的完整备份快照');
      }

      const snapshotTables = await this.getSnapshotTables(snapshot.id);
      if (snapshotTables.length === 0) {
        throw new DatabaseError('备份快照不包含任何表');
      }

      this.logger.info('开始从备份快照还原数据', {
        snapshotId: snapshot.id,
        tableCount: snapshotTables.length
      });

      const preservedBackupStatus = await mainPrisma.aPIConfig.findUnique({
        where: { id: BACKUP_STATUS_CONFIG_ID }
      }).catch(() => null);

      for (let index = 0; index < snapshotTables.length; index += 1) {
        const table = snapshotTables[index];
        const restoreTableName = createRestoreTableName(index);
        restoreTables.push(restoreTableName);

        try {
          await this.createRestoreTable(table, restoreTableName);
          const copiedRows = await this.copyBackupTableToMain(table.backupTableName, restoreTableName);
          copiedTables.push(table.sourceTableName);
          totalRows += copiedRows;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          failedTables.push({
            tableName: table.sourceTableName,
            backupTableName: table.backupTableName,
            rowCount: table.rowCount,
            success: false,
            error: errorMessage
          });
        }
      }

      if (failedTables.length > 0) {
        throw new DatabaseError('部分表还原准备失败，未切换主库表', { failedTables });
      }

      const snapshotTableNames = new Set(snapshotTables.map((table) => table.sourceTableName));
      const existingMainTables = this.filterSnapshotTables(await this.getAllTables(mainPrisma));
      const renamePairs: string[] = [];

      for (const tableName of existingMainTables) {
        if (!snapshotTableNames.has(tableName)) {
          const oldName = `${tableName}__old_${Date.now()}`;
          renamePairs.push(`${quoteIdentifier(tableName)} TO ${quoteIdentifier(oldName)}`);
          oldTablesToDrop.push(oldName);
        }
      }

      for (let index = 0; index < snapshotTables.length; index += 1) {
        const table = snapshotTables[index];
        const restoreTableName = restoreTables[index];
        if (existingMainTables.includes(table.sourceTableName)) {
          const oldName = `${table.sourceTableName}__old_${Date.now()}`;
          renamePairs.push(`${quoteIdentifier(table.sourceTableName)} TO ${quoteIdentifier(oldName)}`);
          oldTablesToDrop.push(oldName);
        }
        renamePairs.push(`${quoteIdentifier(restoreTableName)} TO ${quoteIdentifier(table.sourceTableName)}`);
      }

      if (renamePairs.length > 0) {
        await mainPrisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');
        try {
          await mainPrisma.$executeRawUnsafe(`RENAME TABLE ${renamePairs.join(', ')}`);
        } finally {
          await mainPrisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
        }
      }

      for (const oldTable of oldTablesToDrop) {
        try {
          await mainPrisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${quoteIdentifier(oldTable)};`);
        } catch (error) {
          warnings.push(`删除旧表 ${oldTable} 失败: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      for (const table of snapshotTables) {
        const foreignKeys = extractForeignKeyClauses(table.createTableSql);
        for (const foreignKey of foreignKeys) {
          try {
            await mainPrisma.$executeRawUnsafe(
              `ALTER TABLE ${quoteIdentifier(table.sourceTableName)} ADD ${foreignKey}`
            );
          } catch (error) {
            warnings.push(`恢复外键 ${table.sourceTableName} 失败: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }

      if (preservedBackupStatus) {
        await mainPrisma.aPIConfig.upsert({
          where: { id: BACKUP_STATUS_CONFIG_ID },
          update: {
            isEnabled: preservedBackupStatus.isEnabled,
            defaultScope: preservedBackupStatus.defaultScope,
            defaultGroups: preservedBackupStatus.defaultGroups,
            allowedParameters: preservedBackupStatus.allowedParameters,
            enableDirectResponse: preservedBackupStatus.enableDirectResponse,
            apiKeyEnabled: preservedBackupStatus.apiKeyEnabled,
            apiKey: preservedBackupStatus.apiKey,
            updatedAt: new Date()
          },
          create: {
            id: BACKUP_STATUS_CONFIG_ID,
            isEnabled: preservedBackupStatus.isEnabled ?? true,
            defaultScope: preservedBackupStatus.defaultScope ?? 'backup',
            defaultGroups: preservedBackupStatus.defaultGroups ?? null,
            allowedParameters: preservedBackupStatus.allowedParameters ?? null,
            enableDirectResponse: preservedBackupStatus.enableDirectResponse ?? false,
            apiKeyEnabled: preservedBackupStatus.apiKeyEnabled ?? false,
            apiKey: preservedBackupStatus.apiKey ?? null
          }
        });
      }

      const result = buildOperationResult({
        operation: 'restore',
        status: 'completed',
        startedAt,
        snapshotId: snapshot.id,
        copiedTables,
        failedTables,
        warnings,
        totalRows
      });

      this.logger.info('数据库还原完成', {
        snapshotId: snapshot.id,
        duration: `${result.durationMs}ms`,
        warnings
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      warnings.push(...await this.cleanupMainTables(restoreTables));
      const result = buildOperationResult({
        operation: 'restore',
        status: 'failed',
        startedAt,
        snapshotId,
        copiedTables,
        failedTables,
        warnings,
        totalRows,
        error: errorMessage
      });

      this.logger.error('数据库还原失败', error instanceof Error ? error : undefined, {
        error: errorMessage,
        result
      });
      return result;
    }
  }

  async checkDatabaseHealth(): Promise<boolean> {
    try {
      await mainPrisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('主数据库健康检查失败', error instanceof Error ? error : undefined, {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  async checkBackupDatabaseHealth(): Promise<boolean> {
    if (!backupPrisma) {
      return false;
    }
    try {
      await backupPrisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('备份数据库健康检查失败', error instanceof Error ? error : undefined, {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  async setAutoBackupEnabled(enabled: boolean): Promise<void> {
    if (enabled) {
      this.assertBackupDatabaseUsable();
    }
    await this.updateBackupStatus({ isAutoBackupEnabled: enabled });
  }

  async initializeBackupDatabase(): Promise<BackupOperationResult> {
    const startedAt = new Date();
    try {
      this.assertBackupDatabaseUsable();
      await this.getBackupPrisma().$connect();
      await mainPrisma.$connect();
      await this.ensureBackupControlTables();
      const result = buildOperationResult({
        operation: 'initialize',
        status: 'completed',
        startedAt,
        copiedTables: [],
        totalRows: 0
      });
      this.logger.info('备份数据库初始化完成', { duration: `${result.durationMs}ms` });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('初始化备份数据库失败', error instanceof Error ? error : undefined, {
        error: errorMessage
      });
      return buildOperationResult({
        operation: 'initialize',
        status: 'failed',
        startedAt,
        error: errorMessage
      });
    }
  }

  private getBackupPrisma(): PrismaClient {
    if (!backupPrisma) {
      throw new ConfigurationError('未配置备份数据库连接 BACKUP_DATABASE_URL');
    }
    return backupPrisma;
  }

  private hasValidBackupDatabaseUrl(): boolean {
    return !!BACKUP_DATABASE_URL
      && !!DATABASE_URL
      && getDatabaseIdentity(BACKUP_DATABASE_URL) !== getDatabaseIdentity(DATABASE_URL);
  }

  private assertBackupDatabaseUsable(): void {
    if (!BACKUP_DATABASE_URL) {
      throw new ConfigurationError('未配置备份数据库连接 BACKUP_DATABASE_URL');
    }
    if (!DATABASE_URL) {
      throw new ConfigurationError('未配置主数据库连接 DATABASE_URL');
    }
    if (getDatabaseIdentity(BACKUP_DATABASE_URL) === getDatabaseIdentity(DATABASE_URL)) {
      throw new ConfigurationError('BACKUP_DATABASE_URL 不能与 DATABASE_URL 指向同一个数据库');
    }
  }

  private async getAllTables(client: PrismaClient): Promise<string[]> {
    try {
      const result = await client.$queryRaw<Array<{ TABLE_NAME: string }>>`
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_NAME
      `;
      return result.map(row => row.TABLE_NAME);
    } catch (error) {
      throw new DatabaseError(`获取表列表失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private filterSnapshotTables(tables: string[]): string[] {
    return tables.filter((tableName) => !isBackupInternalTable(tableName));
  }

  private async ensureBackupControlTables(): Promise<void> {
    const backup = this.getBackupPrisma();
    await backup.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ${quoteIdentifier(SNAPSHOT_TABLE)} (
        id VARCHAR(64) NOT NULL,
        status VARCHAR(32) NOT NULL,
        isActive BOOLEAN NOT NULL DEFAULT false,
        startedAt DATETIME(3) NOT NULL,
        completedAt DATETIME(3) NULL,
        tableCount INT NOT NULL DEFAULT 0,
        totalRows BIGINT NOT NULL DEFAULT 0,
        error LONGTEXT NULL,
        metadata LONGTEXT NULL,
        PRIMARY KEY (id),
        INDEX ${quoteIdentifier(`${SNAPSHOT_TABLE}_status_idx`)} (status),
        INDEX ${quoteIdentifier(`${SNAPSHOT_TABLE}_active_idx`)} (isActive)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);

    await backup.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ${quoteIdentifier(SNAPSHOT_TABLES_TABLE)} (
        snapshotId VARCHAR(64) NOT NULL,
        sourceTableName VARCHAR(191) NOT NULL,
        backupTableName VARCHAR(191) NOT NULL,
        rowCount BIGINT NOT NULL DEFAULT 0,
        schemaHash VARCHAR(64) NOT NULL,
        createTableSql LONGTEXT NOT NULL,
        status VARCHAR(32) NOT NULL,
        error LONGTEXT NULL,
        PRIMARY KEY (snapshotId, sourceTableName),
        INDEX ${quoteIdentifier(`${SNAPSHOT_TABLES_TABLE}_snapshot_idx`)} (snapshotId),
        INDEX ${quoteIdentifier(`${SNAPSHOT_TABLES_TABLE}_backup_table_idx`)} (backupTableName)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);

    await backup.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ${quoteIdentifier(LOCK_TABLE)} (
        name VARCHAR(64) NOT NULL,
        owner VARCHAR(128) NOT NULL,
        expiresAt DATETIME(3) NOT NULL,
        updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (name),
        INDEX ${quoteIdentifier(`${LOCK_TABLE}_expires_idx`)} (expiresAt)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);
  }

  private async acquireBackupLock(owner: string, ttlMs: number): Promise<boolean> {
    const backup = this.getBackupPrisma();
    const expiresAt = new Date(Date.now() + ttlMs);
    await backup.$executeRaw(
      Prisma.sql`
        INSERT INTO ${Prisma.raw(quoteIdentifier(LOCK_TABLE))}
          (name, owner, expiresAt)
        VALUES
          (${'backup'}, ${owner}, ${expiresAt})
        ON DUPLICATE KEY UPDATE
          owner = IF(expiresAt < NOW(3), VALUES(owner), owner),
          expiresAt = IF(expiresAt < NOW(3), VALUES(expiresAt), expiresAt)
      `
    );

    const rows = await backup.$queryRaw(
      Prisma.sql`
        SELECT owner, expiresAt
        FROM ${Prisma.raw(quoteIdentifier(LOCK_TABLE))}
        WHERE name = ${'backup'}
        LIMIT 1
      `
    ) as Array<{ owner: string; expiresAt: Date }>;

    return rows[0]?.owner === owner;
  }

  private async releaseBackupLock(owner: string): Promise<void> {
    await this.getBackupPrisma().$executeRaw(
      Prisma.sql`
        DELETE FROM ${Prisma.raw(quoteIdentifier(LOCK_TABLE))}
        WHERE name = ${'backup'} AND owner = ${owner}
      `
    );
  }

  private async createSnapshotRecord(snapshotId: string, startedAt: Date): Promise<void> {
    await this.getBackupPrisma().$executeRaw(
      Prisma.sql`
        INSERT INTO ${Prisma.raw(quoteIdentifier(SNAPSHOT_TABLE))}
          (id, status, isActive, startedAt, tableCount, totalRows)
        VALUES
          (${snapshotId}, ${'pending'}, ${false}, ${startedAt}, ${0}, ${0})
      `
    );
  }

  private async markSnapshotCompleted(
    snapshotId: string,
    tableCount: number,
    totalRows: number,
    metadata: unknown
  ): Promise<void> {
    await this.getBackupPrisma().$executeRaw(
      Prisma.sql`
        UPDATE ${Prisma.raw(quoteIdentifier(SNAPSHOT_TABLE))}
        SET status = ${'completed'},
            completedAt = ${new Date()},
            tableCount = ${tableCount},
            totalRows = ${totalRows},
            error = NULL,
            metadata = ${safeJsonStringify(metadata)}
        WHERE id = ${snapshotId}
      `
    );
  }

  private async markSnapshotFailed(snapshotId: string, error: string, metadata: unknown): Promise<void> {
    await this.getBackupPrisma().$executeRaw(
      Prisma.sql`
        UPDATE ${Prisma.raw(quoteIdentifier(SNAPSHOT_TABLE))}
        SET status = ${'failed'},
            completedAt = ${new Date()},
            error = ${error},
            metadata = ${safeJsonStringify(metadata)}
        WHERE id = ${snapshotId}
      `
    );
  }

  private async activateSnapshot(snapshotId: string): Promise<void> {
    const backup = this.getBackupPrisma();
    await backup.$transaction([
      backup.$executeRaw(
        Prisma.sql`UPDATE ${Prisma.raw(quoteIdentifier(SNAPSHOT_TABLE))} SET isActive = ${false}`
      ),
      backup.$executeRaw(
        Prisma.sql`
          UPDATE ${Prisma.raw(quoteIdentifier(SNAPSHOT_TABLE))}
          SET isActive = ${true}
          WHERE id = ${snapshotId} AND status = ${'completed'}
        `
      )
    ]);
  }

  private async getCreateTableSql(client: PrismaClient, tableName: string): Promise<string> {
    const result = await client.$queryRawUnsafe(
      `SHOW CREATE TABLE ${quoteIdentifier(tableName)}`
    ) as Array<{ 'Create Table': string }>;
    const createTableSql = result[0]?.['Create Table'];
    if (!createTableSql) {
      throw new DatabaseError(`无法读取表结构: ${tableName}`);
    }
    return createTableSql;
  }

  private async getTableRowCount(client: PrismaClient, tableName: string): Promise<number> {
    const result = await client.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM ${quoteIdentifier(tableName)}`
    ) as Array<{ count: number | bigint }>;
    return Number(result[0]?.count || 0);
  }

  private async copyTableToBackupSnapshot(
    tableName: string,
    backupTableName: string,
    snapshotId: string
  ): Promise<BackupTableResult> {
    const backup = this.getBackupPrisma();
    const createTableSql = await this.getCreateTableSql(mainPrisma, tableName);
    const schemaHash = hashText(createTableSql);
    const rowCount = await this.getTableRowCount(mainPrisma, tableName);
    const backupCreateSql = transformCreateTableSql(createTableSql, backupTableName, {
      stripForeignKeys: true
    });

    await backup.$executeRawUnsafe(`DROP TABLE IF EXISTS ${quoteIdentifier(backupTableName)};`);
    await backup.$executeRawUnsafe(backupCreateSql);

    let copiedRows = 0;
    for (let offset = 0; offset < rowCount; offset += BATCH_SIZE) {
      const rows = await mainPrisma.$queryRawUnsafe(
        `SELECT * FROM ${quoteIdentifier(tableName)} LIMIT ${BATCH_SIZE} OFFSET ${offset}`
      ) as Array<Record<string, unknown>>;
      copiedRows += await this.insertRows(backup, backupTableName, rows);
    }

    const backupRowCount = await this.getTableRowCount(backup, backupTableName);
    if (backupRowCount !== rowCount) {
      throw new DatabaseError(`表 ${tableName} 行数校验失败: source=${rowCount}, backup=${backupRowCount}`);
    }

    await backup.$executeRaw(
      Prisma.sql`
        INSERT INTO ${Prisma.raw(quoteIdentifier(SNAPSHOT_TABLES_TABLE))}
          (snapshotId, sourceTableName, backupTableName, rowCount, schemaHash, createTableSql, status, error)
        VALUES
          (${snapshotId}, ${tableName}, ${backupTableName}, ${rowCount}, ${schemaHash}, ${createTableSql}, ${'completed'}, NULL)
      `
    );

    this.logger.debug(`表 ${tableName} 快照复制完成`, {
      snapshotId,
      backupTableName,
      rowCount,
      copiedRows
    });

    return {
      tableName,
      backupTableName,
      rowCount,
      schemaHash,
      success: true
    };
  }

  private async insertRows(
    client: PrismaClient,
    tableName: string,
    rows: Array<Record<string, unknown>>
  ): Promise<number> {
    if (rows.length === 0) {
      return 0;
    }
    const columns = Object.keys(rows[0]);
    const columnsSql = Prisma.join(columns.map((col) => Prisma.raw(quoteIdentifier(col))));
    const valuesTuples = rows.map((row) => (
      Prisma.sql`(${Prisma.join(columns.map((col) => Prisma.sql`${row[col]}`))})`
    ));

    await client.$executeRaw(
      Prisma.sql`INSERT INTO ${Prisma.raw(quoteIdentifier(tableName))} (${columnsSql}) VALUES ${Prisma.join(valuesTuples)}`
    );
    return rows.length;
  }

  private async getActiveSnapshot(): Promise<SnapshotRecord | null> {
    const rows = await this.getBackupPrisma().$queryRawUnsafe(
      `SELECT * FROM ${quoteIdentifier(SNAPSHOT_TABLE)} WHERE isActive = true AND status = 'completed' ORDER BY completedAt DESC LIMIT 1`
    ) as SnapshotRecord[];
    return rows[0] || null;
  }

  private async getSnapshot(snapshotId: string): Promise<SnapshotRecord | null> {
    const rows = await this.getBackupPrisma().$queryRaw(
      Prisma.sql`SELECT * FROM ${Prisma.raw(quoteIdentifier(SNAPSHOT_TABLE))} WHERE id = ${snapshotId} LIMIT 1`
    ) as SnapshotRecord[];
    return rows[0] || null;
  }

  private async getSnapshotTables(snapshotId: string): Promise<SnapshotTableRecord[]> {
    const rows = await this.getBackupPrisma().$queryRaw(
      Prisma.sql`
        SELECT *
        FROM ${Prisma.raw(quoteIdentifier(SNAPSHOT_TABLES_TABLE))}
        WHERE snapshotId = ${snapshotId} AND status = ${'completed'}
        ORDER BY sourceTableName
      `
    ) as SnapshotTableRecord[];
    return rows.map((row) => ({
      ...row,
      rowCount: Number(row.rowCount)
    }));
  }

  private async cleanupCreatedBackupTables(tableNames: string[]): Promise<string[]> {
    const warnings: string[] = [];
    if (!backupPrisma) return warnings;

    for (const tableName of tableNames) {
      try {
        await backupPrisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${quoteIdentifier(tableName)};`);
      } catch (error) {
        warnings.push(`清理备份临时表 ${tableName} 失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return warnings;
  }

  private async cleanupInactiveSnapshots(activeSnapshotId: string, warnings: string[]): Promise<void> {
    const backup = this.getBackupPrisma();
    const inactiveSnapshots = await backup.$queryRaw(
      Prisma.sql`
        SELECT id
        FROM ${Prisma.raw(quoteIdentifier(SNAPSHOT_TABLE))}
        WHERE id <> ${activeSnapshotId} AND isActive = false
      `
    ) as Array<{ id: string }>;

    for (const snapshot of inactiveSnapshots) {
      const tables = await this.getSnapshotTables(snapshot.id);
      for (const table of tables) {
        try {
          await backup.$executeRawUnsafe(`DROP TABLE IF EXISTS ${quoteIdentifier(table.backupTableName)};`);
        } catch (error) {
          warnings.push(`清理旧快照表 ${table.backupTableName} 失败: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      await backup.$executeRaw(
        Prisma.sql`DELETE FROM ${Prisma.raw(quoteIdentifier(SNAPSHOT_TABLES_TABLE))} WHERE snapshotId = ${snapshot.id}`
      );
      await backup.$executeRaw(
        Prisma.sql`DELETE FROM ${Prisma.raw(quoteIdentifier(SNAPSHOT_TABLE))} WHERE id = ${snapshot.id}`
      );
    }
  }

  private async createRestoreTable(table: SnapshotTableRecord, restoreTableName: string): Promise<void> {
    const createSql = transformCreateTableSql(table.createTableSql, restoreTableName, {
      stripForeignKeys: true
    });
    await mainPrisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${quoteIdentifier(restoreTableName)};`);
    await mainPrisma.$executeRawUnsafe(createSql);
  }

  private async copyBackupTableToMain(backupTableName: string, restoreTableName: string): Promise<number> {
    const backup = this.getBackupPrisma();
    const rowCount = await this.getTableRowCount(backup, backupTableName);
    let copiedRows = 0;

    for (let offset = 0; offset < rowCount; offset += BATCH_SIZE) {
      const rows = await backup.$queryRawUnsafe(
        `SELECT * FROM ${quoteIdentifier(backupTableName)} LIMIT ${BATCH_SIZE} OFFSET ${offset}`
      ) as Array<Record<string, unknown>>;
      copiedRows += await this.insertRows(mainPrisma, restoreTableName, rows);
    }
    return copiedRows;
  }

  private async cleanupMainTables(tableNames: string[]): Promise<string[]> {
    const warnings: string[] = [];
    for (const tableName of tableNames) {
      try {
        await mainPrisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${quoteIdentifier(tableName)};`);
      } catch (error) {
        warnings.push(`清理主库临时表 ${tableName} 失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return warnings;
  }

  async disconnect(): Promise<void> {
    await mainPrisma.$disconnect();
    await backupPrisma?.$disconnect();
  }
}

export default BackupService;
