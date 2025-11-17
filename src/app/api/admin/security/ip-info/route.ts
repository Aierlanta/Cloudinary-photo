/**
 * IP信息查询API端点
 * GET /api/admin/security/ip-info?ip=xxx - 获取特定IP的详细信息
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth';
import { withSecurity } from '@/lib/security';
import { withErrorHandler } from '@/lib/error-handler';
import { APIResponse } from '@/types/api';
import { getIPStats } from '@/lib/ip-management';
import { getIPAccessHistory } from '@/lib/access-tracking';

export const dynamic = 'force-dynamic';

async function getIPInfo(request: NextRequest): Promise<Response> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const ip = searchParams.get('ip');

    if (!ip) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: '请提供IP地址',
            timestamp: new Date(),
          },
        },
        { status: 400 }
      );
    }

    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const [stats, history] = await Promise.all([
      getIPStats(ip),
      getIPAccessHistory(ip, limit),
    ]);

    const response: APIResponse<{
      stats: typeof stats;
      history: typeof history;
    }> = {
      success: true,
      data: {
        stats,
        history,
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
    enableAccessLog: false,
  })(withAdminAuth(getIPInfo))
);

