/**
 * 获取数据库备份状态 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { BackupService } from '@/lib/backup';
import { Logger } from '@/lib/logger';
import { handleApiError } from '@/lib/error-handler';

const logger = Logger.getInstance();
const backupService = BackupService.getInstance();

export async function GET(request: NextRequest) {
  try {
    logger.info('API GET /api/admin/backup/status', {
      type: 'api_request',
      method: 'GET',
      path: '/api/admin/backup/status',
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    });

    // 获取备份状态
    const status = await backupService.getBackupStatus();
    
    // 检查数据库健康状态
    const isHealthy = await backupService.checkDatabaseHealth();

    const response = {
      success: true,
      data: {
        ...status,
        isDatabaseHealthy: isHealthy,
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
      isHealthy
    });

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error, '获取备份状态失败');
  }
}
