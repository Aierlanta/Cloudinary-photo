/**
 * 服务器初始化脚本
 * 启动各种后台服务和调度器
 * 
 * 注意: 在 Vercel 环境中，后台调度器不会启动
 * 定时任务改为通过 Vercel Cron Jobs 实现
 * - /api/cron/backup - 每6小时执行数据库备份
 * - /api/cron/log-cleanup - 每天凌晨3点清理旧日志
 */

import { BackupScheduler } from './backup-scheduler';
import { LogCleanupScheduler } from './log-cleanup-scheduler';

let isInitialized = false;

/**
 * 检测是否在 Vercel 环境中运行
 */
function isVercelEnvironment(): boolean {
  return process.env.VERCEL === '1' || !!process.env.VERCEL_ENV;
}

/**
 * 初始化服务器服务
 */
export function initializeServer(): void {
  if (isInitialized) {
    return;
  }

  try {
    console.log('开始初始化服务器服务');

    // 在 Vercel 环境中，跳过基于 setInterval 的调度器
    // 定时任务由 Vercel Cron Jobs 处理
    if (isVercelEnvironment()) {
      console.log('检测到 Vercel 环境，跳过后台调度器初始化');
      console.log('定时任务将由 Vercel Cron Jobs 处理:');
      console.log('  - /api/cron/backup (每6小时)');
      console.log('  - /api/cron/log-cleanup (每天凌晨3点)');
      isInitialized = true;
      console.log('服务器服务初始化完成 (Vercel 模式)');
      return;
    }

    // 非 Vercel 环境：启动备份调度器
    const backupScheduler = BackupScheduler.getInstance();
    backupScheduler.start();

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

    // 停止备份调度器
    const backupScheduler = BackupScheduler.getInstance();
    backupScheduler.stop();

    // 停止日志清理调度器
    const logCleanupScheduler = LogCleanupScheduler.getInstance();
    logCleanupScheduler.stop();

    isInitialized = false;
    console.log('服务器服务清理完成');
  } catch (error) {
    console.error('服务器服务清理失败', error instanceof Error ? error.message : String(error));
  }
}

// 在进程退出时清理资源
if (typeof process !== 'undefined') {
  process.on('SIGINT', cleanupServer);
  process.on('SIGTERM', cleanupServer);
  process.on('exit', cleanupServer);
}
