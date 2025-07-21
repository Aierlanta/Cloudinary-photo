/**
 * 备份历史记录 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '@/lib/database';
import { Logger } from '@/lib/logger';
import { handleApiError } from '@/lib/error-handler';

const logger = Logger.getInstance();

export async function GET(request: NextRequest) {
  try {
    logger.info('API GET /api/admin/backup/history', {
      type: 'api_request',
      method: 'GET',
      path: '/api/admin/backup/history',
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    });

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = parseInt(searchParams.get('page') || '1');

    // 获取备份相关的系统日志
    const logs = await databaseService.getSystemLogs({
      page,
      limit,
      level: undefined, // 获取所有级别
      search: 'backup_operation'
    });

    // 过滤和格式化备份历史记录
    const backupHistory = logs.logs
      .filter(log => {
        try {
          const metadata = typeof log.metadata === 'string' 
            ? JSON.parse(log.metadata) 
            : log.metadata;
          return metadata?.type === 'backup_operation';
        } catch {
          return false;
        }
      })
      .map(log => {
        const metadata = typeof log.metadata === 'string' 
          ? JSON.parse(log.metadata) 
          : log.metadata;
        
        return {
          id: log.id,
          timestamp: log.timestamp,
          success: metadata?.success || false,
          message: log.message,
          error: metadata?.error || null,
          level: log.level,
          formattedTime: log.timestamp.toLocaleString('zh-CN', {
            timeZone: 'Asia/Shanghai',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          })
        };
      });

    const response = {
      success: true,
      data: {
        history: backupHistory,
        pagination: {
          page,
          limit,
          total: backupHistory.length,
          totalPages: Math.ceil(backupHistory.length / limit)
        }
      }
    };

    logger.info('备份历史查询成功', {
      type: 'api_response',
      method: 'GET',
      path: '/api/admin/backup/history',
      recordCount: backupHistory.length
    });

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error, '获取备份历史失败');
  }
}
