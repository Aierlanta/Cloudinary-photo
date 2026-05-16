import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth';
import { withSecurity } from '@/lib/security';
import { withErrorHandler } from '@/lib/error-handler';
import { databaseService } from '@/lib/database';
import { BackupService } from '@/lib/backup';
import { getRealtimeStats } from '@/lib/access-tracking';
import { APIResponse } from '@/types/api';
import { attachPerfHeadersToResponse, createRequestMetrics } from '@/lib/perf';

export const dynamic = 'force-dynamic';

interface AdminSummaryResponse {
  groups: Awaited<ReturnType<typeof databaseService.getGroups>>;
  stats: {
    totalImages: number;
    totalGroups: number;
    recentUploads: number;
    backup: {
      lastBackupTime: string | null;
      lastBackupSuccess: boolean;
      backupCount: number;
      isAutoBackupEnabled: boolean;
      isDatabaseHealthy: boolean;
    };
    access: {
      lastHour: number;
      last24Hours: number;
      total: number;
    };
  };
}

async function getAdminSummary(_request: NextRequest): Promise<Response> {
  const metrics = createRequestMetrics('/api/admin/summary');
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const backupService = BackupService.getInstance();

  const [groups, stats, recentUploads, accessStats, backupStatus, isDatabaseHealthy] = await Promise.all([
    metrics.time('db.groups', async () => databaseService.getGroups()),
    metrics.time('db.base_stats', async () => databaseService.getStats(metrics)),
    metrics.time('db.recent_uploads', async () => databaseService.countImages({ dateFrom: sevenDaysAgo }, metrics)),
    metrics.time('db.access_stats', async () => getRealtimeStats(metrics)),
    metrics.time('backup.status', async () => backupService.getBackupStatus()),
    metrics.time('backup.health', async () => backupService.checkDatabaseHealth())
  ]);

  metrics.setMeta('mode', 'admin_summary');

  const response: APIResponse<AdminSummaryResponse> = {
    success: true,
    data: {
      groups,
      stats: {
        totalImages: stats.totalImages,
        totalGroups: stats.totalGroups,
        recentUploads,
        backup: {
          lastBackupTime: backupStatus.lastBackupTime
            ? backupStatus.lastBackupTime.toLocaleString('zh-CN', {
                timeZone: 'Asia/Shanghai',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
              })
            : null,
          lastBackupSuccess: backupStatus.lastBackupSuccess,
          backupCount: backupStatus.backupCount,
          isAutoBackupEnabled: backupStatus.isAutoBackupEnabled,
          isDatabaseHealthy
        },
        access: accessStats
      }
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
  })(withAdminAuth(getAdminSummary))
);
