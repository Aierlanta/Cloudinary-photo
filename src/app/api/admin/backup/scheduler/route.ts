/**
 * 备份调度器管理 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { BackupScheduler } from '@/lib/backup-scheduler';
import { Logger } from '@/lib/logger';
import { handleApiError } from '@/lib/error-handler';

// 强制动态渲染
export const dynamic = 'force-dynamic'

const logger = Logger.getInstance();

export async function GET(request: NextRequest) {
  try {
    const scheduler = BackupScheduler.getInstance();
    const status = scheduler.getStatus();
    
    return NextResponse.json({
      success: true,
      data: {
        isRunning: status.isRunning,
        intervalHours: status.interval / (1000 * 60 * 60)
      }
    });
  } catch (error) {
    return handleApiError(error, '获取调度器状态失败');
  }
}

export async function POST(request: NextRequest) {
  try {
    logger.info('API POST /api/admin/backup/scheduler', {
      type: 'api_request',
      method: 'POST',
      path: '/api/admin/backup/scheduler',
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    });

    const body = await request.json();
    const { action } = body;

    const scheduler = BackupScheduler.getInstance();

    if (action === 'start') {
      scheduler.start();
      logger.info('手动启动备份调度器', {
        type: 'backup_operation',
        operation: 'start_scheduler'
      });

      return NextResponse.json({
        success: true,
        message: '备份调度器已启动'
      });
    } else if (action === 'stop') {
      scheduler.stop();
      logger.info('手动停止备份调度器', {
        type: 'backup_operation',
        operation: 'stop_scheduler'
      });

      return NextResponse.json({
        success: true,
        message: '备份调度器已停止'
      });
    } else {
      return NextResponse.json({
        success: false,
        message: '无效的操作'
      }, { status: 400 });
    }
  } catch (error) {
    return handleApiError(error, '调度器操作失败');
  }
}
