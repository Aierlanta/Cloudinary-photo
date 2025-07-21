/**
 * 数据库自动备份调度器
 * 定期执行数据库备份任务
 */

import { BackupService } from './backup';
import { Logger } from './logger';

export class BackupScheduler {
  private static instance: BackupScheduler;
  private logger = Logger.getInstance();
  private backupService = BackupService.getInstance();
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  // 备份间隔（毫秒）- 默认每6小时备份一次
  private readonly BACKUP_INTERVAL = 6 * 60 * 60 * 1000; // 6小时

  private constructor() {}

  static getInstance(): BackupScheduler {
    if (!BackupScheduler.instance) {
      BackupScheduler.instance = new BackupScheduler();
    }
    return BackupScheduler.instance;
  }

  /**
   * 启动自动备份调度器
   */
  start(): void {
    if (this.isRunning) {
      this.logger.warn('备份调度器已在运行中');
      return;
    }

    this.logger.info('启动自动备份调度器', {
      interval: `${this.BACKUP_INTERVAL / 1000 / 60 / 60}小时`
    });

    // 立即执行一次备份检查
    this.performScheduledBackup();

    // 设置定时器
    this.intervalId = setInterval(() => {
      this.performScheduledBackup();
    }, this.BACKUP_INTERVAL);

    this.isRunning = true;
  }

  /**
   * 停止自动备份调度器
   */
  stop(): void {
    if (!this.isRunning) {
      this.logger.warn('备份调度器未在运行');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    this.logger.info('自动备份调度器已停止');
  }

  /**
   * 执行计划备份
   */
  private async performScheduledBackup(): Promise<void> {
    try {
      // 检查是否启用了自动备份
      const status = await this.backupService.getBackupStatus();
      
      if (!status.isAutoBackupEnabled) {
        this.logger.debug('自动备份已禁用，跳过此次备份');
        return;
      }

      // 检查是否需要备份
      if (this.shouldPerformBackup(status.lastBackupTime)) {
        this.logger.info('开始执行计划备份');
        
        const success = await this.backupService.performBackup();
        
        if (success) {
          this.logger.info('计划备份执行成功');
        } else {
          this.logger.error('计划备份执行失败');
        }
      } else {
        this.logger.debug('距离上次备份时间不足，跳过此次备份');
      }
    } catch (error) {
      this.logger.error('执行计划备份时发生错误', { error: error.message });
    }
  }

  /**
   * 判断是否应该执行备份
   */
  private shouldPerformBackup(lastBackupTime: Date | null): boolean {
    if (!lastBackupTime) {
      // 从未备份过，应该执行备份
      return true;
    }

    const now = new Date();
    const timeSinceLastBackup = now.getTime() - lastBackupTime.getTime();
    
    // 如果距离上次备份超过了备份间隔，则执行备份
    return timeSinceLastBackup >= this.BACKUP_INTERVAL;
  }

  /**
   * 获取调度器状态
   */
  getStatus(): { isRunning: boolean; interval: number } {
    return {
      isRunning: this.isRunning,
      interval: this.BACKUP_INTERVAL
    };
  }
}

export default BackupScheduler;
