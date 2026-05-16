/**
 * 手动创建数据库备份 API
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

async function createBackup(request: NextRequest): Promise<Response> {
  logger.info('API POST /api/admin/backup/create', {
    type: 'api_request',
    method: 'POST',
    path: '/api/admin/backup/create',
    ip: request.headers.get('x-forwarded-for') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown'
  });

  const result = await backupService.performBackup();

  if (result.success) {
    logger.info('手动备份成功', {
      type: 'backup_operation',
      operation: 'manual_backup',
      success: true,
      snapshotId: result.snapshotId,
      durationMs: result.durationMs
    });

    return NextResponse.json({
      success: true,
      message: '数据库备份成功',
      data: result
    });
  }

  logger.warn('手动备份失败', {
    type: 'backup_operation',
    operation: 'manual_backup',
    success: false,
    error: result.error,
    failedTables: result.failedTables
  });

  return NextResponse.json({
    success: false,
    message: result.error || result.skippedReason || '数据库备份失败，请查看日志获取详细信息',
    data: result
  }, { status: result.status === 'skipped' ? 409 : 500 });
}

export const POST = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['POST'],
    enableAccessLog: false
  })(withAdminAuth(createBackup))
);
