/**
 * 存储故障转移API端点
 * POST /api/admin/storage/failover - 手动触发故障转移
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth';
import { withSecurity } from '@/lib/security';
import { withErrorHandler } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import { AppError, ErrorType } from '@/types/errors';
import { getDefaultStorageManager, StorageProvider } from '@/lib/storage';
import { storageDatabaseService } from '@/lib/database/storage';
import { APIResponse } from '@/types/api';

// 强制动态渲染
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/storage/failover
 * 手动触发故障转移
 */
async function triggerFailover(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json();
    const targetProvider = body.targetProvider as StorageProvider;
    const reason = body.reason as string || '手动触发';

    if (!targetProvider) {
      throw new AppError(
        '请指定目标存储提供商',
        ErrorType.VALIDATION_ERROR,
        { field: 'targetProvider' }
      );
    }

    const storageManager = getDefaultStorageManager();
    
    // 获取当前配置
    const currentConfig = await storageDatabaseService.getStorageConfig();
    if (!currentConfig) {
      throw new AppError(
        '未找到存储配置',
        ErrorType.INTERNAL_ERROR
      );
    }

    const oldPrimary = currentConfig.primaryProvider;
    const oldBackup = currentConfig.backupProvider;

    logger.info('开始手动故障转移', { 
      from: oldPrimary, 
      to: targetProvider, 
      reason 
    });

    // 验证目标提供商
    const targetService = storageManager.getService(targetProvider);
    if (!targetService) {
      throw new AppError(
        `目标存储服务 ${targetProvider} 未注册`,
        ErrorType.VALIDATION_ERROR,
        { provider: targetProvider }
      );
    }

    // 检查目标服务健康状态
    const targetHealth = await targetService.healthCheck();
    if (!targetHealth.isHealthy) {
      throw new AppError(
        `目标存储服务 ${targetProvider} 不健康，无法进行故障转移`,
        ErrorType.VALIDATION_ERROR,
        { 
          provider: targetProvider, 
          health: targetHealth 
        }
      );
    }

    // 执行故障转移
    let newPrimary: StorageProvider;
    let newBackup: StorageProvider | undefined;

    if (targetProvider === oldPrimary) {
      throw new AppError(
        `${targetProvider} 已经是主要存储提供商`,
        ErrorType.VALIDATION_ERROR,
        { currentPrimary: oldPrimary }
      );
    }

    if (targetProvider === oldBackup) {
      // 备用变主要，主要变备用
      newPrimary = targetProvider;
      newBackup = oldPrimary;
    } else {
      // 切换到新的提供商
      newPrimary = targetProvider;
      newBackup = oldPrimary;
    }

    // 更新配置
    const updatedConfig = {
      ...currentConfig,
      primaryProvider: newPrimary,
      backupProvider: newBackup
    };

    await storageDatabaseService.updateStorageConfig(updatedConfig);
    storageManager.updateConfig(updatedConfig);

    // 记录故障转移事件
    logger.info('故障转移完成', {
      oldPrimary,
      oldBackup,
      newPrimary,
      newBackup,
      reason,
      timestamp: new Date().toISOString()
    });

    // 获取更新后的健康状态
    const healthStatus = await storageManager.getAllHealthStatus();

    const response: APIResponse<any> = {
      success: true,
      data: {
        message: '故障转移完成',
        failover: {
          from: {
            primary: oldPrimary,
            backup: oldBackup
          },
          to: {
            primary: newPrimary,
            backup: newBackup
          },
          reason,
          timestamp: new Date().toISOString()
        },
        config: updatedConfig,
        healthStatus: Object.fromEntries(healthStatus)
      },
      timestamp: new Date()
    };

    return NextResponse.json(response);

  } catch (error) {
    logger.error('故障转移失败', { error });
    
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError(
      `故障转移失败: ${error instanceof Error ? error.message : '未知错误'}`,
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
  })(withAdminAuth(triggerFailover))
);
