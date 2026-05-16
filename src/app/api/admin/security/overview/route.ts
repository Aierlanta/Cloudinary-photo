import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth';
import { withSecurity } from '@/lib/security';
import { withErrorHandler } from '@/lib/error-handler';
import { getAccessStats, getRealtimeStats } from '@/lib/access-tracking';
import { getAllIPRateLimits, getBannedIPs } from '@/lib/ip-management';
import { APIResponse } from '@/types/api';
import { attachPerfHeadersToResponse, createRequestMetrics } from '@/lib/perf';

export const dynamic = 'force-dynamic';

async function getSecurityOverview(_request: NextRequest): Promise<Response> {
  const metrics = createRequestMetrics('/api/admin/security/overview');

  const [stats, realtime, bannedIPs, rateLimits] = await Promise.all([
    metrics.time('db.access_stats', async () => getAccessStats({ days: 7 }, metrics)),
    metrics.time('db.realtime_stats', async () => getRealtimeStats(metrics)),
    metrics.time('db.banned_ips', async () => getBannedIPs()),
    metrics.time('db.rate_limits', async () => getAllIPRateLimits())
  ]);

  metrics.setMeta('mode', 'security_overview');

  const response: APIResponse<{
    stats: typeof stats;
    realtime: typeof realtime;
    bannedIPs: typeof bannedIPs;
    rateLimits: typeof rateLimits;
  }> = {
    success: true,
    data: {
      stats,
      realtime,
      bannedIPs,
      rateLimits
    },
    timestamp: new Date()
  };

  return attachPerfHeadersToResponse(NextResponse.json(response), metrics);
}

export const GET = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['GET'],
    enableAccessLog: false
  })(withAdminAuth(getSecurityOverview))
);
