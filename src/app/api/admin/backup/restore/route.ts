/**
 * 从备份数据库还原数据 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { BackupService } from '@/lib/backup';
import { Logger } from '@/lib/logger';
import { handleApiError } from '@/lib/error-handler';

const logger = Logger.getInstance();
const backupService = BackupService.getInstance();

export async function POST(request: NextRequest) {
  try {
    logger.info('API POST /api/admin/backup/restore', {
      type: 'api_request',
      method: 'POST',
      path: '/api/admin/backup/restore',
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    });

    // 获取请求体
    const body = await request.json();
    const { confirm } = body;

    if (!confirm) {
      return NextResponse.json({
        success: false,
        message: '请确认要执行还原操作'
      }, { status: 400 });
    }

    // 执行还原
    const success = await backupService.restoreFromBackup();

    if (success) {
      logger.info('数据库还原成功', {
        type: 'backup_operation',
        operation: 'restore',
        success: true
      });

      return NextResponse.json({
        success: true,
        message: '数据库还原成功'
      });
    } else {
      logger.warn('数据库还原失败', {
        type: 'backup_operation',
        operation: 'restore',
        success: false
      });

      return NextResponse.json({
        success: false,
        message: '数据库还原失败，请查看日志获取详细信息'
      }, { status: 500 });
    }
  } catch (error) {
    return handleApiError(error, '还原数据失败');
  }
}
