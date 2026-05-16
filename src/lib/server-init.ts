/**
 * 服务器初始化脚本
 * 启动各种后台服务和调度器
 */

import { BackupScheduler } from './backup-scheduler';
import { LogCleanupScheduler } from './log-cleanup-scheduler';

let isInitialized = false;

/**
 * 初始化服务器服务
 */
export function initializeServer(): void {
  if (isInitialized) {
    return;
  }

  try {
    console.log('开始初始化服务器服务');

    if (process.env.NODE_ENV !== 'production') {
      // 生产环境使用外部 HTTP Cron 触发备份，避免多实例重复 setInterval。
      const backupScheduler = BackupScheduler.getInstance();
      backupScheduler.start();
    }

    // 启动日志清理调度器
    const logCleanupScheduler = LogCleanupScheduler.getInstance();
    logCleanupScheduler.start();

    isInitialized = true;
    console.log('服务器服务初始化完成');
  } catch (error) {
    console.error('服务器服务初始化失败', error instanceof Error ? error.message : String(error));
  }
}

/**
 * 清理服务器服务
 */
export function cleanupServer(): void {
  if (!isInitialized) {
    return;
  }

  try {
    console.log('开始清理服务器服务');

    if (process.env.NODE_ENV !== 'production') {
      const backupScheduler = BackupScheduler.getInstance();
      backupScheduler.stop();
    }

    // 停止日志清理调度器
    const logCleanupScheduler = LogCleanupScheduler.getInstance();
    logCleanupScheduler.stop();

    isInitialized = false;
    console.log('服务器服务清理完成');
  } catch (error) {
    console.error('服务器服务清理失败', error instanceof Error ? error.message : String(error));
  }
}

export function getServerInitializationStatus(): { initialized: boolean } {
  return {
    initialized: isInitialized
  };
}

// 在进程退出时清理资源
if (typeof process !== 'undefined') {
  process.on('SIGINT', cleanupServer);
  process.on('SIGTERM', cleanupServer);
  process.on('exit', cleanupServer);
}
