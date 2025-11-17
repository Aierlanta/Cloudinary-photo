/**
 * 访问统计API端点
 * GET /api/admin/security/stats - 获取访问统计信息
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth';
import { withSecurity } from '@/lib/security';
import { withErrorHandler } from '@/lib/error-handler';
import { APIResponse } from '@/types/api';
import { getAccessStats, getRealtimeStats } from '@/lib/access-tracking';

export const dynamic = 'force-dynamic';

async function getStats(request: NextRequest): Promise<Response> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '7', 10);

    const [stats, realtimeStats] = await Promise.all([
      getAccessStats(days),
      getRealtimeStats(),
    ]);

    const response: APIResponse<{
      stats: typeof stats;
      realtime: typeof realtimeStats;
    }> = {
      success: true,
      data: {
        stats,
        realtime: realtimeStats,
      },
      timestamp: new Date(),
    };

    return NextResponse.json(response);
  } catch (error) {
    throw error;
  }
}

export const GET = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['GET'],
    enableAccessLog: false, // 统计API不记录访问日志
  })(withAdminAuth(getStats))
);

