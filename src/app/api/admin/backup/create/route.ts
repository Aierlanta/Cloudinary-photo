/**
 * 手动创建数据库备份 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { BackupService } from '@/lib/backup';
import { Logger } from '@/lib/logger';
import { handleApiError } from '@/lib/error-handler';

// 强制动态渲染
export const dynamic = 'force-dynamic'

const logger = Logger.getInstance();
const backupService = BackupService.getInstance();

export async function POST(request: NextRequest) {
  try {
    logger.info('API POST /api/admin/backup/create', {
      type: 'api_request',
      method: 'POST',
      path: '/api/admin/backup/create',
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    });

    // 执行备份
    const success = await backupService.performBackup();

    if (success) {
      const status = await backupService.getBackupStatus();
      
      logger.info('手动备份成功', {
        type: 'backup_operation',
        operation: 'manual_backup',
        success: true,
        backupTime: status.lastBackupTime
      });

      return NextResponse.json({
        success: true,
        message: '数据库备份成功',
        data: {
          backupTime: status.lastBackupTime,
          backupCount: status.backupCount
        }
      });
    } else {
      // 获取备份状态以获取错误信息
      const status = await backupService.getBackupStatus();

      logger.warn('手动备份失败', {
        type: 'backup_operation',
        operation: 'manual_backup',
        success: false,
        error: status.lastBackupError
      });

      return NextResponse.json({
        success: false,
        message: status.lastBackupError || '数据库备份失败，请查看日志获取详细信息'
      }, { status: 500 });
    }
  } catch (error) {
    return handleApiError(error, '创建备份失败');
  }
}
