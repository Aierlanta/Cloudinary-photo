/**
 * 获取数据库备份状态 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { BackupService } from '@/lib/backup';
import { Logger } from '@/lib/logger';
import { withErrorHandler } from '@/lib/error-handler';
import { withAdminAuth } from '@/lib/auth';
import { withSecurity } from '@/lib/security';

// 强制动态渲染
export const dynamic = 'force-dynamic'

const logger = Logger.getInstance();
const backupService = BackupService.getInstance();

async function getBackupStatus(request: NextRequest): Promise<Response> {
  logger.info('API GET /api/admin/backup/status', {
    type: 'api_request',
    method: 'GET',
    path: '/api/admin/backup/status',
    ip: request.headers.get('x-forwarded-for') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown'
  });

  const [status, isHealthy, isBackupHealthy] = await Promise.all([
    backupService.getBackupStatus(),
    backupService.checkDatabaseHealth(),
    backupService.checkBackupDatabaseHealth()
  ]);

  const response = {
    success: true,
    data: {
      ...status,
      isDatabaseHealthy: isHealthy,
      isBackupDatabaseHealthy: isBackupHealthy,
      lastBackupTimeFormatted: status.lastBackupTime
        ? status.lastBackupTime.toLocaleString('zh-CN', {
            timeZone: 'Asia/Shanghai',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          })
        : '从未备份'
    }
  };

  logger.info('备份状态查询成功', {
    type: 'api_response',
    method: 'GET',
    path: '/api/admin/backup/status',
    lastBackupTime: status.lastBackupTime,
    backupCount: status.backupCount,
    isHealthy,
    isBackupHealthy
  });

  return NextResponse.json(response);
}

export const GET = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['GET'],
    enableAccessLog: false
  })(withAdminAuth(getBackupStatus))
);
