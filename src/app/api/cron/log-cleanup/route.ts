/**
 * Vercel Cron Job: 日志自动清理
 * 配置: 每24小时执行一次
 * 
 * 需要在 vercel.json 中配置:
 * {
 *   "crons": [{
 *     "path": "/api/cron/log-cleanup",
 *     "schedule": "0 3 * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '@/lib/database';
import { Logger } from '@/lib/logger';

// Vercel Cron Job 使用的密钥验证
const CRON_SECRET = process.env.CRON_SECRET;

// 日志保留天数
const RETENTION_DAYS = 30;

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 1分钟超时

export async function GET(request: NextRequest) {
  const logger = Logger.getInstance();
  
  // 验证请求来源
  const authHeader = request.headers.get('authorization');
  
  if (CRON_SECRET) {
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      logger.warn('Cron 日志清理任务: 未授权的访问尝试', {
        type: 'cron_log_cleanup',
        ip: request.headers.get('x-forwarded-for') || 'unknown'
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    logger.info('Cron 日志清理任务开始执行', {
      type: 'cron_log_cleanup',
      retentionDays: RETENTION_DAYS
    });

    const deletedCount = await databaseService.cleanupOldLogs(RETENTION_DAYS);

    if (deletedCount > 0) {
      logger.info('Cron 日志清理任务执行成功', {
        type: 'cron_log_cleanup',
        deletedCount,
        retentionDays: RETENTION_DAYS
      });
    } else {
      logger.info('没有需要清理的旧日志', {
        type: 'cron_log_cleanup',
        retentionDays: RETENTION_DAYS
      });
    }

    return NextResponse.json({
      success: true,
      message: deletedCount > 0 ? `成功清理 ${deletedCount} 条旧日志` : '没有需要清理的日志',
      deletedCount,
      retentionDays: RETENTION_DAYS,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Cron 日志清理任务发生错误', error instanceof Error ? error : undefined, {
      type: 'cron_log_cleanup',
      error: error instanceof Error ? error.message : String(error)
    });
    
    return NextResponse.json({
      success: false,
      message: '日志清理任务发生错误',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

