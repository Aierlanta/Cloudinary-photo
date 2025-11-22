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
    const daysParam = searchParams.get('days');
    const hoursParam = searchParams.get('hours');
    const parsedDays = daysParam ? parseInt(daysParam, 10) : Number.NaN;
    const parsedHours = hoursParam ? parseInt(hoursParam, 10) : Number.NaN;
    const days = Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : undefined;
    const hours = Number.isFinite(parsedHours) && parsedHours > 0 ? parsedHours : undefined;

    const [stats, realtimeStats] = await Promise.all([
      getAccessStats({
        days,
        hours,
      }),
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
