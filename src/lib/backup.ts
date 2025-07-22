/**
 * 数据库备份和还原服务
 * 支持自动备份到 bak 数据库和手动还原功能
 */

import { PrismaClient } from '@prisma/client';
import { DatabaseError } from '@/types/errors';
import { LogLevel, Logger } from './logger';

// 主数据库连接
const mainPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

// 备份数据库连接
const backupPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.BACKUP_DATABASE_URL || process.env.DATABASE_URL?.replace('/test', '/bak')
    }
  }
});

export interface BackupStatus {
  lastBackupTime: Date | null;
  lastBackupSuccess: boolean;
  lastBackupError?: string;
  backupCount: number;
  isAutoBackupEnabled: boolean;
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

  /**
   * 获取备份状态
   */
  async getBackupStatus(): Promise<BackupStatus> {
    try {
      // 从系统配置中获取备份状态
      const config = await mainPrisma.aPIConfig.findUnique({
        where: { id: 'backup_status' }
      });

      if (!config) {
        return {
          lastBackupTime: null,
          lastBackupSuccess: false,
          backupCount: 0,
          isAutoBackupEnabled: true
        };
      }

      const status = JSON.parse(config.defaultGroups || '{}');
      return {
        lastBackupTime: status.lastBackupTime ? new Date(status.lastBackupTime) : null,
        lastBackupSuccess: status.lastBackupSuccess || false,
        lastBackupError: status.lastBackupError,
        backupCount: status.backupCount || 0,
        isAutoBackupEnabled: status.isAutoBackupEnabled !== false
      };
    } catch (error) {
      this.logger.error('获取备份状态失败', error instanceof Error ? error : undefined, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw new DatabaseError('获取备份状态失败');
    }
  }

  /**
   * 更新备份状态
   */
  private async updateBackupStatus(status: Partial<BackupStatus>): Promise<void> {
    try {
      const currentStatus = await this.getBackupStatus();
      const newStatus = { ...currentStatus, ...status };

      await mainPrisma.aPIConfig.upsert({
        where: { id: 'backup_status' },
        update: {
          defaultGroups: JSON.stringify(newStatus),
          updatedAt: new Date()
        },
        create: {
          id: 'backup_status',
          isEnabled: true,
          defaultScope: 'backup',
          defaultGroups: JSON.stringify(newStatus)
        }
      });

      // 记录备份历史
      if (status.lastBackupTime) {
        await this.recordBackupHistory(status.lastBackupSuccess || false, status.lastBackupError);
      }
    } catch (error) {
      this.logger.error('更新备份状态失败', error instanceof Error ? error : undefined, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 记录备份历史
   */
  private async recordBackupHistory(success: boolean, error?: string): Promise<void> {
    try {
      await mainPrisma.systemLog.create({
        data: {
          timestamp: new Date(),
          level: success ? LogLevel.INFO : LogLevel.ERROR,
          message: success ? '数据库备份成功' : '数据库备份失败',
          context: JSON.stringify({
            type: 'backup_operation',
            success,
            error: error || null,
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

  /**
   * 执行数据库备份
   */
  async performBackup(): Promise<boolean> {
    if (this.isBackupInProgress) {
      this.logger.warn('备份正在进行中，跳过此次备份');
      return false;
    }

    this.isBackupInProgress = true;
    const startTime = new Date();

    try {
      this.logger.info('开始数据库备份', { timestamp: startTime });

      // 1. 获取主数据库的所有表
      const tables = await this.getAllTables();
      this.logger.debug(`发现 ${tables.length} 个表需要备份`, { tables });

      // 2. 清空备份数据库的所有表
      await this.clearAllBackupTables(tables);

      // 3. 复制表结构和数据
      await this.copyAllTables(tables);

      // 3. 更新备份状态
      const currentStatus = await this.getBackupStatus();
      await this.updateBackupStatus({
        lastBackupTime: startTime,
        lastBackupSuccess: true,
        lastBackupError: undefined,
        backupCount: currentStatus.backupCount + 1
      });

      const duration = Date.now() - startTime.getTime();
      this.logger.info('数据库备份完成', { 
        duration: `${duration}ms`,
        timestamp: startTime 
      });

      return true;
    } catch (error) {
      this.logger.error('数据库备份失败', error instanceof Error ? error : undefined, {
        error: error instanceof Error ? error.message : String(error),
        timestamp: startTime
      });

      await this.updateBackupStatus({
        lastBackupTime: startTime,
        lastBackupSuccess: false,
        lastBackupError: error instanceof Error ? error.message : String(error)
      });

      return false;
    } finally {
      this.isBackupInProgress = false;
    }
  }

  /**
   * 清空备份数据库
   */
  private async clearBackupDatabase(): Promise<void> {
    try {
      // 使用原始 SQL 清空表，按照外键依赖顺序
      const tableNames = [
        'system_logs',
        'images',
        'groups',
        'api_configs',
        'counters'
      ];

      for (const tableName of tableNames) {
        try {
          await backupPrisma.$executeRawUnsafe(`DELETE FROM \`${tableName}\`;`);
          this.logger.info(`清空表 ${tableName} 成功`);
        } catch (error) {
          // 如果表不存在，记录警告但继续执行
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('does not exist') || errorMessage.includes("doesn't exist")) {
            this.logger.warn(`表 ${tableName} 不存在，跳过清空操作`);
          } else {
            // 其他错误则抛出
            throw error;
          }
        }
      }
    } catch (error) {
      throw new DatabaseError(`清空备份数据库失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 备份图片数据
   */
  private async backupImages(): Promise<void> {
    try {
      const images = await mainPrisma.image.findMany();
      if (images.length > 0) {
        await backupPrisma.image.createMany({
          data: images
        });
      }
      this.logger.debug(`备份了 ${images.length} 条图片记录`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('does not exist')) {
        this.logger.warn('Image 表不存在，跳过图片备份');
      } else {
        throw error;
      }
    }
  }

  /**
   * 备份分组数据
   */
  private async backupGroups(): Promise<void> {
    try {
      const groups = await mainPrisma.group.findMany();
      if (groups.length > 0) {
        await backupPrisma.group.createMany({
          data: groups
        });
      }
      this.logger.debug(`备份了 ${groups.length} 条分组记录`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('does not exist')) {
        this.logger.warn('Group 表不存在，跳过分组备份');
      } else {
        throw error;
      }
    }
  }

  /**
   * 备份API配置数据
   */
  private async backupAPIConfigs(): Promise<void> {
    try {
      const configs = await mainPrisma.aPIConfig.findMany();
      if (configs.length > 0) {
        await backupPrisma.aPIConfig.createMany({
          data: configs
        });
      }
      this.logger.debug(`备份了 ${configs.length} 条API配置记录`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('does not exist')) {
        this.logger.warn('APIConfig 表不存在，跳过API配置备份');
      } else {
        throw error;
      }
    }
  }

  /**
   * 备份计数器数据
   */
  private async backupCounters(): Promise<void> {
    try {
      const counters = await mainPrisma.counter.findMany();
      if (counters.length > 0) {
        // Counter 模型只有 id 和 value 字段，不需要额外处理
        await backupPrisma.counter.createMany({
          data: counters
        });
      }
      this.logger.debug(`备份了 ${counters.length} 条计数器记录`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('does not exist')) {
        this.logger.warn('Counter 表不存在，跳过计数器备份');
      } else {
        throw error;
      }
    }
  }

  /**
   * 备份系统日志数据（只备份最近7天的日志）
   */
  private async backupSystemLogs(): Promise<void> {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const logs = await mainPrisma.systemLog.findMany({
        where: {
          timestamp: {
            gte: sevenDaysAgo
          }
        }
      });

      if (logs.length > 0) {
        await backupPrisma.systemLog.createMany({
          data: logs
        });
      }
      this.logger.debug(`备份了 ${logs.length} 条系统日志记录`);
    } catch (error) {
      // 如果 SystemLog 表不存在，记录警告但不中断备份过程
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('does not exist')) {
        this.logger.warn('SystemLog 表不存在，跳过日志备份');
      } else {
        // 其他错误则抛出
        throw error;
      }
    }
  }

  /**
   * 从备份数据库还原数据
   */
  async restoreFromBackup(): Promise<boolean> {
    try {
      this.logger.info('开始从备份数据库还原数据');

      // 1. 清空主数据库
      await this.clearMainDatabase();

      // 2. 从备份数据库还原数据（按照外键依赖顺序：先还原被引用的表）
      await this.restoreGroups();
      await this.restoreAPIConfigs();
      await this.restoreCounters();
      await this.restoreImages();
      await this.restoreSystemLogs();

      this.logger.info('数据库还原完成');
      return true;
    } catch (error) {
      this.logger.error('数据库还原失败', error instanceof Error ? error : undefined, {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * 清空主数据库
   */
  private async clearMainDatabase(): Promise<void> {
    try {
      // 按照外键依赖顺序删除
      await mainPrisma.systemLog.deleteMany();
      await mainPrisma.image.deleteMany();
      await mainPrisma.group.deleteMany();
      // 保留API配置中的备份状态
      await mainPrisma.aPIConfig.deleteMany({
        where: {
          id: { not: 'backup_status' }
        }
      });
      await mainPrisma.counter.deleteMany();
    } catch (error) {
      throw new DatabaseError(`清空主数据库失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 还原图片数据
   */
  private async restoreImages(): Promise<void> {
    const images = await backupPrisma.image.findMany();
    if (images.length > 0) {
      await mainPrisma.image.createMany({
        data: images
      });
    }
    this.logger.debug(`还原了 ${images.length} 条图片记录`);
  }

  /**
   * 还原分组数据
   */
  private async restoreGroups(): Promise<void> {
    const groups = await backupPrisma.group.findMany();
    if (groups.length > 0) {
      await mainPrisma.group.createMany({
        data: groups
      });
    }
    this.logger.debug(`还原了 ${groups.length} 条分组记录`);
  }

  /**
   * 还原API配置数据
   */
  private async restoreAPIConfigs(): Promise<void> {
    const configs = await backupPrisma.aPIConfig.findMany({
      where: {
        id: { not: 'backup_status' }
      }
    });
    if (configs.length > 0) {
      await mainPrisma.aPIConfig.createMany({
        data: configs
      });
    }
    this.logger.debug(`还原了 ${configs.length} 条API配置记录`);
  }

  /**
   * 还原计数器数据
   */
  private async restoreCounters(): Promise<void> {
    const counters = await backupPrisma.counter.findMany();
    if (counters.length > 0) {
      await mainPrisma.counter.createMany({
        data: counters
      });
    }
    this.logger.debug(`还原了 ${counters.length} 条计数器记录`);
  }

  /**
   * 还原系统日志数据
   */
  private async restoreSystemLogs(): Promise<void> {
    const logs = await backupPrisma.systemLog.findMany();
    if (logs.length > 0) {
      await mainPrisma.systemLog.createMany({
        data: logs
      });
    }
    this.logger.debug(`还原了 ${logs.length} 条系统日志记录`);
  }

  /**
   * 检查主数据库健康状态
   */
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

  /**
   * 检查备份数据库健康状态
   */
  async checkBackupDatabaseHealth(): Promise<boolean> {
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

  /**
   * 设置自动备份状态
   */
  async setAutoBackupEnabled(enabled: boolean): Promise<void> {
    await this.updateBackupStatus({ isAutoBackupEnabled: enabled });
  }

  /**
   * 初始化备份数据库表结构
   */
  async initializeBackupDatabase(): Promise<boolean> {
    try {
      this.logger.info('开始初始化备份数据库表结构');

      // 检查备份数据库连接
      await backupPrisma.$connect();

      // 先删除可能存在的错误表结构
      await this.dropExistingTables();

      // 创建正确的表结构
      this.logger.info('开始创建备份数据库表结构...');
      await this.createBackupTables();

      this.logger.info('备份数据库表结构创建完成');
      return true;
    } catch (error) {
      this.logger.error('初始化备份数据库失败', error instanceof Error ? error : undefined, {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * 删除现有的表结构
   */
  private async dropExistingTables(): Promise<void> {
    const tablesToDrop = [
      'SystemLog', 'system_logs',
      'Image', 'images',
      'Group', 'groups',
      'APIConfig', 'api_configs',
      'Counter', 'counters'
    ];

    for (const tableName of tablesToDrop) {
      try {
        await backupPrisma.$executeRawUnsafe(`DROP TABLE IF EXISTS \`${tableName}\`;`);
        this.logger.debug(`删除表 ${tableName}`);
      } catch (error) {
        // 忽略删除失败的错误
        this.logger.debug(`删除表 ${tableName} 失败，可能不存在: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * 创建备份数据库表结构
   */
  private async createBackupTables(): Promise<void> {
    // 创建表的 SQL 语句（使用与主数据库相同的 snake_case 命名）
    const createTablesSQL = [
      // groups 表
      `CREATE TABLE IF NOT EXISTS \`groups\` (
        \`id\` VARCHAR(191) NOT NULL,
        \`name\` VARCHAR(191) NOT NULL,
        \`description\` TEXT NULL,
        \`imageCount\` INT NOT NULL DEFAULT 0,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`groups_name_key\` (\`name\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

      // images 表
      `CREATE TABLE IF NOT EXISTS \`images\` (
        \`id\` VARCHAR(191) NOT NULL,
        \`url\` VARCHAR(191) NOT NULL,
        \`publicId\` VARCHAR(191) NOT NULL,
        \`title\` VARCHAR(191) NULL,
        \`description\` TEXT NULL,
        \`tags\` VARCHAR(191) NULL,
        \`groupId\` VARCHAR(191) NULL,
        \`uploadedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`images_publicId_key\` (\`publicId\`),
        INDEX \`images_groupId_fkey\` (\`groupId\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

      // api_configs 表
      `CREATE TABLE IF NOT EXISTS \`api_configs\` (
        \`id\` VARCHAR(191) NOT NULL,
        \`isEnabled\` BOOLEAN NOT NULL DEFAULT true,
        \`defaultScope\` VARCHAR(191) NOT NULL DEFAULT 'all',
        \`defaultGroups\` TEXT NULL,
        \`allowedParameters\` TEXT NULL,
        \`enableDirectResponse\` BOOLEAN NOT NULL DEFAULT false,
        \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

      // counters 表
      `CREATE TABLE IF NOT EXISTS \`counters\` (
        \`id\` VARCHAR(191) NOT NULL,
        \`value\` INT NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

      // system_logs 表
      `CREATE TABLE IF NOT EXISTS \`system_logs\` (
        \`id\` VARCHAR(191) NOT NULL,
        \`timestamp\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`level\` INT NOT NULL,
        \`message\` TEXT NOT NULL,
        \`context\` TEXT NULL,
        \`error\` TEXT NULL,
        \`userId\` VARCHAR(191) NULL,
        \`requestId\` VARCHAR(191) NULL,
        \`ip\` VARCHAR(191) NULL,
        \`userAgent\` TEXT NULL,
        \`type\` VARCHAR(191) NULL,
        PRIMARY KEY (\`id\`),
        INDEX \`system_logs_timestamp_idx\` (\`timestamp\`),
        INDEX \`system_logs_level_idx\` (\`level\`),
        INDEX \`system_logs_type_idx\` (\`type\`),
        INDEX \`system_logs_userId_idx\` (\`userId\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    ];

    // 执行创建表的 SQL
    for (const sql of createTablesSQL) {
      await backupPrisma.$executeRawUnsafe(sql);
    }

    // 添加外键约束
    try {
      await backupPrisma.$executeRawUnsafe(`
        ALTER TABLE \`images\`
        ADD CONSTRAINT \`images_groupId_fkey\`
        FOREIGN KEY (\`groupId\`) REFERENCES \`groups\`(\`id\`)
        ON DELETE SET NULL ON UPDATE CASCADE;
      `);
    } catch (error) {
      // 外键可能已存在，忽略错误
      this.logger.debug('外键约束可能已存在', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 获取主数据库的所有表
   */
  private async getAllTables(): Promise<string[]> {
    try {
      const result = await mainPrisma.$queryRaw<Array<{ TABLE_NAME: string }>>`
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

  /**
   * 清空备份数据库的所有表
   */
  private async clearAllBackupTables(tables: string[]): Promise<void> {
    try {
      // 禁用外键检查
      await backupPrisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');

      for (const tableName of tables) {
        try {
          await backupPrisma.$executeRawUnsafe(`DELETE FROM \`${tableName}\`;`);
          this.logger.debug(`清空备份表 ${tableName} 成功`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('does not exist') || errorMessage.includes("doesn't exist")) {
            this.logger.debug(`备份表 ${tableName} 不存在，跳过清空操作`);
          } else {
            this.logger.warn(`清空备份表 ${tableName} 失败: ${errorMessage}`);
          }
        }
      }

      // 重新启用外键检查
      await backupPrisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
    } catch (error) {
      throw new DatabaseError(`清空备份数据库失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 复制所有表的结构和数据
   */
  private async copyAllTables(tables: string[]): Promise<void> {
    try {
      // 禁用外键检查
      await backupPrisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');

      for (const tableName of tables) {
        try {
          // 1. 复制表结构（如果不存在）
          await this.copyTableStructure(tableName);

          // 2. 复制表数据
          await this.copyTableData(tableName);

          this.logger.debug(`表 ${tableName} 备份完成`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.warn(`备份表 ${tableName} 失败: ${errorMessage}`);
        }
      }

      // 重新启用外键检查
      await backupPrisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
    } catch (error) {
      throw new DatabaseError(`复制表失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 复制表结构
   */
  private async copyTableStructure(tableName: string): Promise<void> {
    try {
      // 获取主数据库的表结构
      const createTableResult = await mainPrisma.$queryRawUnsafe(`SHOW CREATE TABLE \`${tableName}\``) as Array<{ 'Create Table': string }>;

      if (createTableResult.length > 0) {
        const createTableSQL = createTableResult[0]['Create Table'];

        // 删除备份数据库中的同名表（如果存在）
        await backupPrisma.$executeRawUnsafe(`DROP TABLE IF EXISTS \`${tableName}\`;`);

        // 在备份数据库中创建表
        await backupPrisma.$executeRawUnsafe(createTableSQL);

        this.logger.debug(`表结构 ${tableName} 复制完成`);
      }
    } catch (error) {
      throw new DatabaseError(`复制表结构 ${tableName} 失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 复制表数据
   */
  private async copyTableData(tableName: string): Promise<void> {
    try {
      // 获取表的行数
      const countResult = await mainPrisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM \`${tableName}\``) as Array<{ count: number }>;

      const rowCount = countResult[0]?.count || 0;

      if (rowCount > 0) {
        // 直接使用逐行复制方案（适用于跨数据库）
        await this.copyTableDataRowByRow(tableName);
        this.logger.debug(`表数据 ${tableName} 复制完成 (${rowCount} 行)`);
      } else {
        this.logger.debug(`表 ${tableName} 无数据，跳过复制`);
      }
    } catch (error) {
      throw new DatabaseError(`复制表数据 ${tableName} 失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 逐行复制表数据（备用方案）
   */
  private async copyTableDataRowByRow(tableName: string): Promise<void> {
    try {
      // 获取所有数据
      const data = await mainPrisma.$queryRawUnsafe(`SELECT * FROM \`${tableName}\``);

      if (Array.isArray(data) && data.length > 0) {
        // 获取列名
        const columns = Object.keys(data[0]);
        const columnList = columns.map(col => `\`${col}\``).join(', ');

        // 批量插入数据
        const batchSize = 100;
        for (let i = 0; i < data.length; i += batchSize) {
          const batch = data.slice(i, i + batchSize);
          const values = batch.map(row => {
            const valueList = columns.map(col => {
              const value = row[col];
              if (value === null) return 'NULL';
              if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
              if (value instanceof Date) return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
              return String(value);
            }).join(', ');
            return `(${valueList})`;
          }).join(', ');

          await backupPrisma.$executeRawUnsafe(`
            INSERT INTO \`${tableName}\` (${columnList}) VALUES ${values}
          `);
        }

        this.logger.debug(`表数据 ${tableName} 逐行复制完成 (${data.length} 行)`);
      }
    } catch (error) {
      throw new DatabaseError(`逐行复制表数据 ${tableName} 失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 断开数据库连接
   */
  async disconnect(): Promise<void> {
    await mainPrisma.$disconnect();
    await backupPrisma.$disconnect();
  }
}

export default BackupService;
