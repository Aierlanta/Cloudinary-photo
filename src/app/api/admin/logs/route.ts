import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth';
import { withSecurity } from '@/lib/security';
import { withErrorHandler } from '@/lib/error-handler';
import { logger, LogLevel } from '@/lib/logger';
import { databaseService } from '@/lib/database';
import { APIResponse } from '@/types/api';

// 强制动态渲染
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/logs
 * 获取系统日志
 */
async function getLogs(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);

  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '100');
  const levelParam = searchParams.get('level');
  const search = searchParams.get('search');
  const type = searchParams.get('type');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');

  // 解析日志级别
  let level: LogLevel | undefined;
  if (levelParam && levelParam !== 'all') {
    level = parseInt(levelParam) as LogLevel;
  }

  try {
    // 从数据库获取真实日志
    const result = await databaseService.getLogs({
      page,
      limit,
      level,
      search: search || undefined,
      type: type || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined
    });

    const response: APIResponse = {
      success: true,
      data: {
        logs: result.data,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        filters: {
          level: levelParam,
          search,
          type,
          dateFrom,
          dateTo
        }
      },
      timestamp: new Date()
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('获取日志失败', error as Error, {
      type: 'api_error',
      endpoint: '/api/admin/logs'
    });

    return NextResponse.json({
      success: false,
      error: {
        type: 'INTERNAL_ERROR',
        message: '获取日志失败',
        timestamp: new Date()
      }
    }, { status: 500 });
  }
}

/**
 * GET /api/admin/logs/stats
 * 获取日志统计信息
 */
async function getLogStats(request: NextRequest): Promise<Response> {
  try {
    const stats = await databaseService.getLogStats();

    const response: APIResponse = {
      success: true,
      data: stats,
      timestamp: new Date()
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('获取日志统计失败', error as Error, {
      type: 'api_error',
      endpoint: '/api/admin/logs/stats'
    });

    return NextResponse.json({
      success: false,
      error: {
        type: 'INTERNAL_ERROR',
        message: '获取日志统计失败',
        timestamp: new Date()
      }
    }, { status: 500 });
  }
}

/**
 * POST /api/admin/logs/export
 * 导出日志
 */
async function exportLogs(request: NextRequest): Promise<Response> {
  const body = await request.json();
  const { format = 'json', dateFrom, dateTo, level, type } = body;

  try {
    // 从数据库获取日志用于导出
    const result = await databaseService.getLogs({
      page: 1,
      limit: 10000, // 导出时获取更多数据
      level: level !== undefined && level !== 'all' ? parseInt(level) : undefined,
      type: type || undefined,
      dateFrom,
      dateTo
    });

    const logs = result.data;

  let content: string;
  let contentType: string;
  let filename: string;

  switch (format) {
    case 'csv':
      content = convertLogsToCSV(logs);
      contentType = 'text/csv';
      filename = `logs_${new Date().toISOString().split('T')[0]}.csv`;
      break;
    case 'txt':
      content = convertLogsToText(logs);
      contentType = 'text/plain';
      filename = `logs_${new Date().toISOString().split('T')[0]}.txt`;
      break;
    default:
      content = JSON.stringify(logs, null, 2);
      contentType = 'application/json';
      filename = `logs_${new Date().toISOString().split('T')[0]}.json`;
  }

    return new Response(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });
  } catch (error) {
    logger.error('导出日志失败', error as Error, {
      type: 'api_error',
      endpoint: '/api/admin/logs/export'
    });

    return NextResponse.json({
      success: false,
      error: {
        type: 'INTERNAL_ERROR',
        message: '导出日志失败',
        timestamp: new Date()
      }
    }, { status: 500 });
  }
}

function convertLogsToCSV(logs: any[]): string {
  const headers = ['Timestamp', 'Level', 'Message', 'Type', 'RequestId'];
  const rows = logs.map(log => [
    log.timestamp.toISOString(),
    LogLevel[log.level],
    log.message.replace(/"/g, '""'),
    log.context?.type || '',
    log.requestId || ''
  ]);

  return [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
}

function convertLogsToText(logs: any[]): string {
  return logs.map(log => {
    const timestamp = log.timestamp.toISOString();
    const level = LogLevel[log.level];
    const context = log.context ? ` [${JSON.stringify(log.context)}]` : '';
    return `[${timestamp}] [${level}] ${log.message}${context}`;
  }).join('\n');
}

// 应用安全中间件、认证和错误处理
export const GET = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['GET']
  })(withAdminAuth(getLogs))
);

export const POST = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['POST']
  })(withAdminAuth(async (request: NextRequest) => {
    const { pathname } = new URL(request.url);

    if (pathname.endsWith('/export')) {
      return exportLogs(request);
    } else if (pathname.endsWith('/stats')) {
      return getLogStats(request);
    } else {
      return NextResponse.json(
        { success: false, error: { message: '不支持的操作' } },
        { status: 400 }
      );
    }
  }))
);
