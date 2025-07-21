/**
 * 日志清理调度器
 * 定期清理超过指定天数的旧日志
 */

import { databaseService } from './database';
import { Logger } from './logger';

export class LogCleanupScheduler {
  private static instance: LogCleanupScheduler;
  private logger = Logger.getInstance();
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  // 清理间隔（毫秒）- 默认每24小时清理一次
  private readonly CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24小时
  
  // 日志保留天数 - 默认保留30天（1个月）
  private readonly RETENTION_DAYS = 30;

  private constructor() {}

  static getInstance(): LogCleanupScheduler {
    if (!LogCleanupScheduler.instance) {
      LogCleanupScheduler.instance = new LogCleanupScheduler();
    }
    return LogCleanupScheduler.instance;
  }

  /**
   * 启动日志清理调度器
   */
  start(): void {
    if (this.isRunning) {
      this.logger.warn('日志清理调度器已在运行中');
      return;
    }

    this.logger.info('启动日志清理调度器', {
      type: 'log_cleanup',
      interval: `${this.CLEANUP_INTERVAL / 1000 / 60 / 60}小时`,
      retentionDays: this.RETENTION_DAYS
    });

    // 立即执行一次清理检查
    this.performScheduledCleanup();

    // 设置定时器
    this.intervalId = setInterval(() => {
      this.performScheduledCleanup();
    }, this.CLEANUP_INTERVAL);

    this.isRunning = true;
  }

  /**
   * 停止日志清理调度器
   */
  stop(): void {
    if (!this.isRunning) {
      this.logger.warn('日志清理调度器未在运行');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    this.logger.info('日志清理调度器已停止');
  }

  /**
   * 执行计划的日志清理
   */
  private async performScheduledCleanup(): Promise<void> {
    try {
      this.logger.info('开始执行计划日志清理', {
        type: 'log_cleanup',
        operation: 'scheduled_cleanup',
        retentionDays: this.RETENTION_DAYS
      });

      const deletedCount = await databaseService.cleanupOldLogs(this.RETENTION_DAYS);

      if (deletedCount > 0) {
        this.logger.info('计划日志清理执行成功', {
          type: 'log_cleanup',
          operation: 'scheduled_cleanup',
          deletedCount,
          retentionDays: this.RETENTION_DAYS
        });
      } else {
        this.logger.debug('没有需要清理的旧日志', {
          type: 'log_cleanup',
          operation: 'scheduled_cleanup',
          retentionDays: this.RETENTION_DAYS
        });
      }
    } catch (error) {
      this.logger.error('执行计划日志清理时发生错误', {
        type: 'log_cleanup',
        operation: 'scheduled_cleanup',
        error: error.message,
        retentionDays: this.RETENTION_DAYS
      });
    }
  }

  /**
   * 手动执行日志清理
   */
  async performManualCleanup(retentionDays?: number): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
    try {
      const days = retentionDays || this.RETENTION_DAYS;
      
      this.logger.info('开始执行手动日志清理', {
        type: 'log_cleanup',
        operation: 'manual_cleanup',
        retentionDays: days
      });

      const deletedCount = await databaseService.cleanupOldLogs(days);

      this.logger.info('手动日志清理执行成功', {
        type: 'log_cleanup',
        operation: 'manual_cleanup',
        deletedCount,
        retentionDays: days
      });

      return {
        success: true,
        deletedCount
      };
    } catch (error) {
      this.logger.error('手动日志清理执行失败', {
        type: 'log_cleanup',
        operation: 'manual_cleanup',
        error: error.message,
        retentionDays: retentionDays || this.RETENTION_DAYS
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取调度器状态
   */
  getStatus(): { 
    isRunning: boolean; 
    interval: number; 
    retentionDays: number;
    intervalHours: number;
  } {
    return {
      isRunning: this.isRunning,
      interval: this.CLEANUP_INTERVAL,
      retentionDays: this.RETENTION_DAYS,
      intervalHours: this.CLEANUP_INTERVAL / (1000 * 60 * 60)
    };
  }

  /**
   * 获取下次清理时间（估算）
   */
  getNextCleanupTime(): Date | null {
    if (!this.isRunning) {
      return null;
    }

    const now = new Date();
    return new Date(now.getTime() + this.CLEANUP_INTERVAL);
  }
}

export default LogCleanupScheduler;
