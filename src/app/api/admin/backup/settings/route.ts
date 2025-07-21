/**
 * 备份设置 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { BackupService } from '@/lib/backup';
import { Logger } from '@/lib/logger';
import { handleApiError } from '@/lib/error-handler';

// 强制动态渲染
export const dynamic = 'force-dynamic'

const logger = Logger.getInstance();
const backupService = BackupService.getInstance();

export async function GET(request: NextRequest) {
  try {
    const status = await backupService.getBackupStatus();
    
    return NextResponse.json({
      success: true,
      data: {
        isAutoBackupEnabled: status.isAutoBackupEnabled
      }
    });
  } catch (error) {
    return handleApiError(error, '获取备份设置失败');
  }
}

export async function POST(request: NextRequest) {
  try {
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
  } catch (error) {
    return handleApiError(error, '更新备份设置失败');
  }
}
