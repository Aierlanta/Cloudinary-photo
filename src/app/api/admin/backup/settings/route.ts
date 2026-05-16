/**
 * 备份设置 API
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

async function getBackupSettings(_request: NextRequest): Promise<Response> {
  const status = await backupService.getBackupStatus();
  
  return NextResponse.json({
    success: true,
    data: {
      isAutoBackupEnabled: status.isAutoBackupEnabled,
      backupDatabaseConfigured: status.backupDatabaseConfigured
    }
  });
}

async function updateBackupSettings(request: NextRequest): Promise<Response> {
  logger.info('API POST /api/admin/backup/settings', {
    type: 'api_request',
    method: 'POST',
    path: '/api/admin/backup/settings',
    ip: request.headers.get('x-forwarded-for') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown'
  });

  const body = await request.json();
  const { isAutoBackupEnabled } = body;

  if (typeof isAutoBackupEnabled !== 'boolean') {
    return NextResponse.json({
      success: false,
      message: '无效的设置参数'
    }, { status: 400 });
  }

  await backupService.setAutoBackupEnabled(isAutoBackupEnabled);

  logger.info('备份设置更新成功', {
    type: 'backup_operation',
    operation: 'settings_update',
    isAutoBackupEnabled
  });

  return NextResponse.json({
    success: true,
    message: '备份设置更新成功',
    data: {
      isAutoBackupEnabled
    }
  });
}

export const GET = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['GET'],
    enableAccessLog: false
  })(withAdminAuth(getBackupSettings))
);

export const POST = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['POST'],
    allowedContentTypes: ['application/json'],
    maxRequestSize: 1024 * 1024,
    enableAccessLog: false
  })(withAdminAuth(updateBackupSettings))
);
