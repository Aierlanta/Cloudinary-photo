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
}

/**
 * GET /api/admin/stats
 * 获取系统统计信息
 */
async function getStats(request: NextRequest): Promise<Response> {
  // 获取基础统计
  const stats = await databaseService.getStats();

  // 获取最近7天的上传数量
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentImages = await databaseService.getImages({
    page: 1,
    limit: 1000, // 足够大的数量来获取所有最近图片
    dateFrom: sevenDaysAgo
  });

  // 获取备份状态
  const backupService = BackupService.getInstance();
  const backupStatus = await backupService.getBackupStatus();
  const isDatabaseHealthy = await backupService.checkDatabaseHealth();

  const response: APIResponse<StatsResponse> = {
    success: true,
    data: {
      totalImages: stats.totalImages,
      totalGroups: stats.totalGroups,
      recentUploads: recentImages.total,
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
      }
    },
    timestamp: new Date()
  };

  return NextResponse.json(response);
}

// 应用安全中间件、认证和错误处理
export const GET = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['GET']
  })(withAdminAuth(getStats))
);
