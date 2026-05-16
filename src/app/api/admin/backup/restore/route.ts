/**
 * 从备份数据库还原数据 API
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

async function restoreBackup(request: NextRequest): Promise<Response> {
  logger.info('API POST /api/admin/backup/restore', {
    type: 'api_request',
    method: 'POST',
    path: '/api/admin/backup/restore',
    ip: request.headers.get('x-forwarded-for') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown'
  });

  const body = await request.json();
  const { confirm, snapshotId } = body;

  if (!confirm) {
    return NextResponse.json({
      success: false,
      message: '请确认要执行还原操作'
    }, { status: 400 });
  }

  const result = await backupService.restoreFromBackup(snapshotId);

  if (result.success) {
    logger.info('数据库还原成功', {
      type: 'backup_operation',
      operation: 'restore',
      success: true,
      snapshotId: result.snapshotId,
      durationMs: result.durationMs
    });

    return NextResponse.json({
      success: true,
      message: '数据库还原成功',
      data: result
    });
  }

  logger.warn('数据库还原失败', {
    type: 'backup_operation',
    operation: 'restore',
    success: false,
    error: result.error,
    failedTables: result.failedTables
  });

  return NextResponse.json({
    success: false,
    message: result.error || '数据库还原失败，请查看日志获取详细信息',
    data: result
  }, { status: 500 });
}

export const POST = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['POST'],
    allowedContentTypes: ['application/json'],
    maxRequestSize: 1024 * 1024,
    enableAccessLog: false
  })(withAdminAuth(restoreBackup))
);
