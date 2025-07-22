/**
 * 存储健康检查API端点
 * POST /api/admin/storage/health-check - 手动触发健康检查
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth';
import { withSecurity } from '@/lib/security';
import { withErrorHandler } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import { AppError, ErrorType } from '@/types/errors';
import { getDefaultStorageManager, StorageProvider } from '@/lib/storage';
import { APIResponse } from '@/types/api';

// 强制动态渲染
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/storage/health-check
 * 手动触发所有存储服务的健康检查
 */
async function performHealthCheck(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json();
    const targetProvider = body.provider as StorageProvider | undefined;

    const storageManager = getDefaultStorageManager();
    
    logger.info('开始手动健康检查', { targetProvider });

    let healthResults: Record<string, any> = {};

    if (targetProvider) {
      // 检查特定提供商
      const service = storageManager.getService(targetProvider);
      if (!service) {
        throw new AppError(
          `存储服务 ${targetProvider} 未注册`,
          ErrorType.VALIDATION_ERROR,
          { provider: targetProvider }
        );
      }

      const health = await service.healthCheck();
      healthResults[targetProvider] = health;
      
      logger.info(`${targetProvider} 健康检查完成`, { 
        isHealthy: health.isHealthy,
        responseTime: health.responseTime 
      });

    } else {
      // 检查所有提供商
      const allHealth = await storageManager.getAllHealthStatus();
      healthResults = Object.fromEntries(allHealth);
      
      logger.info('所有存储服务健康检查完成', { 
        results: Object.fromEntries(
          Object.entries(healthResults).map(([provider, health]) => [
            provider, 
            { isHealthy: health.isHealthy, responseTime: health.responseTime }
          ])
        )
      });
    }

    // 分析健康状态
    const healthSummary = {
      totalServices: Object.keys(healthResults).length,
      healthyServices: Object.values(healthResults).filter((h: any) => h.isHealthy).length,
      unhealthyServices: Object.values(healthResults).filter((h: any) => !h.isHealthy).length,
      averageResponseTime: Object.values(healthResults)
        .filter((h: any) => h.responseTime)
        .reduce((sum: number, h: any) => sum + h.responseTime, 0) / 
        Object.values(healthResults).filter((h: any) => h.responseTime).length || 0
    };

    const response: APIResponse<any> = {
      success: true,
      data: {
        message: '健康检查完成',
        results: healthResults,
        summary: healthSummary,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date()
    };

    return NextResponse.json(response);

  } catch (error) {
    logger.error('健康检查失败', { error });
    
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError(
      `健康检查失败: ${error instanceof Error ? error.message : '未知错误'}`,
      ErrorType.INTERNAL_ERROR,
      { error }
    );
  }
}

// 应用安全中间件、认证和错误处理
export const POST = withErrorHandler(
  withSecurity({
    rateLimit: 'api',
    allowedMethods: ['POST'],
    allowedContentTypes: ['application/json']
  })(withAdminAuth(performHealthCheck))
);
