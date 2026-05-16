/**
 * 管理员统计API端点
 * GET /api/admin/stats - 获取系统统计信息
 */

import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '@/lib/database';
import { BackupService } from '@/lib/backup';
import { withAdminAuth } from '@/lib/auth';
import { withSecurity } from '@/lib/security';
import { withErrorHandler } from '@/lib/error-handler';
import { APIResponse } from '@/types/api';
import { getRealtimeStats } from '@/lib/access-tracking';
import { attachPerfHeadersToResponse, createRequestMetrics } from '@/lib/perf';

// 强制动态渲染
export const dynamic = 'force-dynamic'

interface StatsResponse {
  totalImages: number;
  totalGroups: number;
  recentUploads: number; // 最近7天上传的图片数量
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
}

/**
 * GET /api/admin/stats
 * 获取系统统计信息
 */
async function getStats(_request: NextRequest): Promise<Response> {
  const metrics = createRequestMetrics('/api/admin/stats');

  // 获取基础统计
  const stats = await metrics.time('db.base_stats', async () => databaseService.getStats(metrics));

  // 获取最近7天的上传数量
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentUploads = await metrics.time('db.recent_uploads', async () => (
    databaseService.countImages({ dateFrom: sevenDaysAgo }, metrics)
  ));

  // 获取备份状态
  const backupService = BackupService.getInstance();
  const [backupStatus, isDatabaseHealthy] = await Promise.all([
    metrics.time('backup.status', async () => backupService.getBackupStatus()),
    metrics.time('backup.health', async () => backupService.checkDatabaseHealth())
  ]);

  // 获取访问统计
  const accessStats = await metrics.time('db.access_stats', async () => getRealtimeStats(metrics));

  metrics.setMeta('mode', 'admin_home');

  const response: APIResponse<StatsResponse> = {
    success: true,
    data: {
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
    },
    timestamp: new Date()
  };

  return attachPerfHeadersToResponse(NextResponse.json(response), metrics);
}

// 应用安全中间件、认证和错误处理
export const GET = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['GET'],
    enableAccessLog: false
  })(withAdminAuth(getStats))
);
