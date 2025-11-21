/**
 * 清空日志 API
 * POST /api/admin/logs/clear - 清空所有日志（仅开发环境）
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth';
import { withSecurity } from '@/lib/security';
import { withErrorHandler } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { APIResponse } from '@/types/api';

// 强制动态渲染
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/logs/clear
 * 清空日志（仅开发环境）
 */
async function clearLogs(request: NextRequest): Promise<Response> {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { success: false, error: { message: '此操作仅在开发环境中可用' } },
      { status: 403 }
    );
  }

  try {
    // 清空所有日志（完全删除，不保留）
    const result = await prisma.systemLog.deleteMany({});
    const deletedCount = result.count;

    logger.info('日志已清空', {
      type: 'admin_action',
      action: 'clear_logs',
      deletedCount
    });

    const response: APIResponse = {
      success: true,
      data: {
        message: `已清空 ${deletedCount} 条日志记录`,
        deletedCount
      },
      timestamp: new Date()
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('清空日志失败', error as Error, {
      type: 'api_error',
      endpoint: '/api/admin/logs/clear',
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json({
      success: false,
      error: {
        type: 'INTERNAL_ERROR',
        message: '清空日志失败',
        timestamp: new Date()
      }
    }, { status: 500 });
  }
}

// 应用安全中间件、认证和错误处理
export const POST = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['POST']
  })(withAdminAuth(clearLogs))
);

