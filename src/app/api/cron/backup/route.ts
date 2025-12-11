/**
 * Vercel Cron Job: 数据库自动备份
 * 配置: 每6小时执行一次
 * 
 * 需要在 vercel.json 中配置:
 * {
 *   "crons": [{
 *     "path": "/api/cron/backup",
 *     "schedule": "0 *\\/6 * * *" // 注意：块注释里不要出现“星号+斜杠”这个结束符组合
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { BackupService } from '@/lib/backup';
import { Logger } from '@/lib/logger';

// Vercel Cron Job 使用的密钥验证
const CRON_SECRET = process.env.CRON_SECRET;

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5分钟超时（Vercel Pro 限制）

export async function GET(request: NextRequest) {
  const logger = Logger.getInstance();
  
  // 验证请求来源
  // Vercel Cron Jobs 会在请求头中携带 Authorization: Bearer <CRON_SECRET>
  const authHeader = request.headers.get('authorization');
  
  if (CRON_SECRET) {
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      logger.warn('Cron 备份任务: 未授权的访问尝试', {
        type: 'cron_backup',
        ip: request.headers.get('x-forwarded-for') || 'unknown'
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    logger.info('Cron 备份任务开始执行', { type: 'cron_backup' });

    const backupService = BackupService.getInstance();
    
    // 检查是否启用了自动备份
    const status = await backupService.getBackupStatus();
    
    if (!status.isAutoBackupEnabled) {
      logger.info('自动备份已禁用，跳过此次 Cron 备份', { type: 'cron_backup' });
      return NextResponse.json({
        success: true,
        message: '自动备份已禁用，跳过执行',
        skipped: true
      });
    }

    // 检查距离上次备份的时间
    const BACKUP_INTERVAL = 6 * 60 * 60 * 1000; // 6小时
    if (status.lastBackupTime) {
      const timeSinceLastBackup = Date.now() - new Date(status.lastBackupTime).getTime();
      if (timeSinceLastBackup < BACKUP_INTERVAL * 0.9) { // 允许10%的误差
        logger.info('距离上次备份时间不足，跳过此次 Cron 备份', {
          type: 'cron_backup',
          lastBackupTime: status.lastBackupTime,
          timeSinceLastBackup: `${Math.round(timeSinceLastBackup / 1000 / 60)}分钟`
        });
        return NextResponse.json({
          success: true,
          message: '距离上次备份时间不足，跳过执行',
          skipped: true,
          lastBackupTime: status.lastBackupTime
        });
      }
    }

    // 执行备份
    const success = await backupService.performBackup();

    if (success) {
      logger.info('Cron 备份任务执行成功', { type: 'cron_backup' });
      return NextResponse.json({
        success: true,
        message: '备份成功',
        timestamp: new Date().toISOString()
      });
    } else {
      logger.error('Cron 备份任务执行失败', undefined, { type: 'cron_backup' });
      return NextResponse.json({
        success: false,
        message: '备份失败'
      }, { status: 500 });
    }
  } catch (error) {
    logger.error('Cron 备份任务发生错误', error instanceof Error ? error : undefined, {
      type: 'cron_backup',
      error: error instanceof Error ? error.message : String(error)
    });
    
    return NextResponse.json({
      success: false,
      message: '备份任务发生错误',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

