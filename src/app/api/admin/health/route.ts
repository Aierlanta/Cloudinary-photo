/**
 * 数据库健康检查 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { BackupService } from '@/lib/backup';
import { databaseService } from '@/lib/database';
import { Logger } from '@/lib/logger';
import { handleApiError } from '@/lib/error-handler';

// 强制动态渲染
export const dynamic = 'force-dynamic'

const logger = Logger.getInstance();

export async function GET(request: NextRequest) {
  try {
    logger.info('API GET /api/admin/health', {
      type: 'api_request',
      method: 'GET',
      path: '/api/admin/health',
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    });

    const backupService = BackupService.getInstance();
    
    // 检查主数据库健康状态
    const mainDbHealthy = await backupService.checkDatabaseHealth();

    // 检查备份数据库健康状态
    const backupDbHealthy = await backupService.checkBackupDatabaseHealth();

    // 获取数据库统计信息
    let stats = null;
    try {
      stats = await databaseService.getStats();
    } catch (error) {
      logger.warn('获取数据库统计失败', { error: error instanceof Error ? error.message : String(error) });
    }

    const healthData = {
      mainDatabase: {
        healthy: mainDbHealthy,
        status: mainDbHealthy ? 'healthy' : 'unhealthy'
      },
      backupDatabase: {
        healthy: backupDbHealthy,
        status: backupDbHealthy ? 'healthy' : 'unhealthy'
      },
      overall: {
        healthy: mainDbHealthy && backupDbHealthy,
        status: mainDbHealthy && backupDbHealthy ? 'healthy' : 
                mainDbHealthy ? 'degraded' : 'unhealthy'
      },
      stats: stats ? {
        totalImages: stats.totalImages,
        totalGroups: stats.totalGroups,
        lastCheck: new Date().toISOString()
      } : null
    };

    logger.info('数据库健康检查完成', {
      type: 'health_check',
      mainDbHealthy,
      backupDbHealthy,
      overallHealthy: healthData.overall.healthy
    });

    return NextResponse.json({
      success: true,
      data: healthData
    });
  } catch (error) {
    return handleApiError(error, '健康检查失败');
  }
}
