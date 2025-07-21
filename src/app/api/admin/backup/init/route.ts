/**
 * 初始化备份数据库 API
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
    logger.info('API POST /api/admin/backup/init', {
      type: 'api_request',
      method: 'POST',
      path: '/api/admin/backup/init',
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    });

    // 初始化备份数据库
    const success = await backupService.initializeBackupDatabase();

    if (success) {
      logger.info('备份数据库初始化成功', {
        type: 'backup_operation',
        operation: 'init_backup_db',
        success: true
      });

      return NextResponse.json({
        success: true,
        message: '备份数据库初始化成功'
      });
    } else {
      logger.warn('备份数据库初始化失败', {
        type: 'backup_operation',
        operation: 'init_backup_db',
        success: false
      });

      return NextResponse.json({
        success: false,
        message: '备份数据库初始化失败，请查看日志获取详细信息'
      }, { status: 500 });
    }
  } catch (error) {
    return handleApiError(error, '初始化备份数据库失败');
  }
}
