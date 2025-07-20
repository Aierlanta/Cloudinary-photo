/**
 * 管理员统计API端点
 * GET /api/admin/stats - 获取系统统计信息
 */

import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '@/lib/database';
import { withAdminAuth } from '@/lib/auth';
import { withSecurity } from '@/lib/security';
import { withErrorHandler } from '@/lib/error-handler';
import { APIResponse } from '@/types/api';

interface StatsResponse {
  totalImages: number;
  totalGroups: number;
  recentUploads: number; // 最近7天上传的图片数量
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
    dateFrom: sevenDaysAgo.toISOString()
  });
  
  const response: APIResponse<StatsResponse> = {
    success: true,
    data: {
      totalImages: stats.totalImages,
      totalGroups: stats.totalGroups,
      recentUploads: recentImages.total
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
