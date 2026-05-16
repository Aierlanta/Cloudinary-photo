/**
 * 备份调度器管理 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { BackupScheduler } from '@/lib/backup-scheduler';
import { Logger } from '@/lib/logger';
import { withErrorHandler } from '@/lib/error-handler';
import { withAdminAuth } from '@/lib/auth';
import { withSecurity } from '@/lib/security';

// 强制动态渲染
export const dynamic = 'force-dynamic'

const logger = Logger.getInstance();

async function getSchedulerStatus(_request: NextRequest): Promise<Response> {
  const scheduler = BackupScheduler.getInstance();
  const status = scheduler.getStatus();
  
  return NextResponse.json({
    success: true,
    data: {
      isRunning: status.isRunning,
      intervalHours: status.interval / (1000 * 60 * 60),
      mode: process.env.NODE_ENV === 'production' ? 'external-http-cron' : 'in-process-dev',
      message: process.env.NODE_ENV === 'production'
        ? '生产环境建议使用外部 HTTP Cron 触发 /api/internal/backup/run'
        : '本地开发可使用进程内调度器'
    }
  });
}

async function updateScheduler(request: NextRequest): Promise<Response> {
  logger.info('API POST /api/admin/backup/scheduler', {
    type: 'api_request',
    method: 'POST',
    path: '/api/admin/backup/scheduler',
    ip: request.headers.get('x-forwarded-for') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown'
  });

  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({
      success: false,
      message: '生产环境不再使用进程内备份调度器，请使用外部 HTTP Cron 触发备份接口'
    }, { status: 400 });
  }

  const body = await request.json();
  const { action } = body;

  const scheduler = BackupScheduler.getInstance();

  if (action === 'start') {
    scheduler.start();
    logger.info('手动启动备份调度器', {
      type: 'backup_operation',
      operation: 'start_scheduler'
    });

    return NextResponse.json({
      success: true,
      message: '备份调度器已启动'
    });
  }

  if (action === 'stop') {
    scheduler.stop();
    logger.info('手动停止备份调度器', {
      type: 'backup_operation',
      operation: 'stop_scheduler'
    });

    return NextResponse.json({
      success: true,
      message: '备份调度器已停止'
    });
  }

  return NextResponse.json({
    success: false,
    message: '无效的操作'
  }, { status: 400 });
}

export const GET = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['GET'],
    enableAccessLog: false
  })(withAdminAuth(getSchedulerStatus))
);

export const POST = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['POST'],
    allowedContentTypes: ['application/json'],
    maxRequestSize: 1024 * 1024,
    enableAccessLog: false
  })(withAdminAuth(updateScheduler))
);
