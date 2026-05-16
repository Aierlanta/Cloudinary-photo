/**
 * 初始化备份数据库 API
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

async function initializeBackupDatabase(request: NextRequest): Promise<Response> {
  logger.info('API POST /api/admin/backup/init', {
    type: 'api_request',
    method: 'POST',
    path: '/api/admin/backup/init',
    ip: request.headers.get('x-forwarded-for') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown'
  });

  const result = await backupService.initializeBackupDatabase();

  if (result.success) {
    logger.info('备份数据库初始化成功', {
      type: 'backup_operation',
      operation: 'init_backup_db',
      success: true
    });

    return NextResponse.json({
      success: true,
      message: '备份数据库初始化成功',
      data: result
    });
  }

  logger.warn('备份数据库初始化失败', {
    type: 'backup_operation',
    operation: 'init_backup_db',
    success: false,
    error: result.error
  });

  return NextResponse.json({
    success: false,
    message: result.error || '备份数据库初始化失败，请查看日志获取详细信息',
    data: result
  }, { status: 500 });
}

export const POST = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['POST'],
    enableAccessLog: false
  })(withAdminAuth(initializeBackupDatabase))
);
