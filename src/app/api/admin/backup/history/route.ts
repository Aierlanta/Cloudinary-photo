/**
 * 备份历史记录 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '@/lib/database';
import { Logger } from '@/lib/logger';
import { withErrorHandler } from '@/lib/error-handler';
import { withAdminAuth } from '@/lib/auth';
import { withSecurity } from '@/lib/security';

// 强制动态渲染
export const dynamic = 'force-dynamic'

const logger = Logger.getInstance();

async function getBackupHistory(request: NextRequest): Promise<Response> {
  logger.info('API GET /api/admin/backup/history', {
    type: 'api_request',
    method: 'GET',
    path: '/api/admin/backup/history',
    ip: request.headers.get('x-forwarded-for') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown'
  });

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20');
  const page = parseInt(searchParams.get('page') || '1');

  const logs = await databaseService.getLogs({
    page,
    limit,
    level: undefined,
    search: 'backup_operation'
  });

  const backupHistory = logs.data
    .filter(log => {
      try {
        const metadata = typeof log.context === 'string'
          ? JSON.parse(log.context)
          : log.context;
        return metadata?.type === 'backup_operation';
      } catch {
        return false;
      }
    })
    .map((log, index) => {
      const metadata = typeof log.context === 'string'
        ? JSON.parse(log.context)
        : log.context;
      const result = metadata?.result || null;

      return {
        id: `backup-${index}`,
        timestamp: log.timestamp,
        success: metadata?.success || false,
        message: log.message,
        error: metadata?.error || null,
        level: log.level,
        result,
        snapshotId: result?.snapshotId,
        durationMs: result?.durationMs,
        failedTables: result?.failedTables || [],
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
}

export const GET = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['GET'],
    enableAccessLog: false
  })(withAdminAuth(getBackupHistory))
);
