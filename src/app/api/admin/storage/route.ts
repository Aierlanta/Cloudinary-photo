/**
 * 存储配置管理API端点
 * GET /api/admin/storage - 获取存储配置和状态
 * PUT /api/admin/storage - 更新存储配置
 * POST /api/admin/storage/health-check - 手动健康检查
 * POST /api/admin/storage/failover - 手动故障转移
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth';
import { withSecurity } from '@/lib/security';
import { withErrorHandler } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import { AppError, ErrorType } from '@/types/errors';
import { 
  getDefaultStorageManager, 
  StorageProvider, 
  MultiStorageConfig,
  FailoverStrategy 
} from '@/lib/storage';
import { storageDatabaseService } from '@/lib/database/storage';
import { APIResponse } from '@/types/api';

// 强制动态渲染
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/storage
 * 获取存储配置和状态信息
 */
async function getStorageInfo(request: NextRequest): Promise<Response> {
  try {
    const storageManager = getDefaultStorageManager();

    // 获取配置
    const config = await storageDatabaseService.getStorageConfig();
    
    // 获取健康状态
    const healthStatus = await storageManager.getAllHealthStatus();
    
    // 获取统计信息
    const [managerStats, dbStats] = await Promise.all([
      storageManager.getAllStats(),
      storageDatabaseService.getStorageStats()
    ]);

    const response: APIResponse<any> = {
      success: true,
      data: {
        config: config || {
          primaryProvider: StorageProvider.CLOUDINARY,
          backupProvider: StorageProvider.TGSTATE,
          failoverStrategy: FailoverStrategy.RETRY_THEN_FAILOVER,
          retryAttempts: 3,
          retryDelay: 1000,
          healthCheckInterval: 300,
          enableBackupUpload: false
        },
        healthStatus: Object.fromEntries(healthStatus),
        stats: {
          manager: Object.fromEntries(managerStats),
          database: dbStats
        },
        supportedProviders: [StorageProvider.CLOUDINARY, StorageProvider.TGSTATE]
      },
      timestamp: new Date()
    };

    return NextResponse.json(response);

  } catch (error) {
    logger.error('获取存储信息失败', { error });
    
    throw new AppError(
      `获取存储信息失败: ${error instanceof Error ? error.message : '未知错误'}`,
      ErrorType.INTERNAL_ERROR,
      { error }
    );
  }
}

/**
 * PUT /api/admin/storage
 * 更新存储配置
 */
async function updateStorageConfig(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json();
    
    // 验证配置数据
    const configUpdate: Partial<MultiStorageConfig> = {
      primaryProvider: body.primaryProvider,
      backupProvider: body.backupProvider,
      failoverStrategy: body.failoverStrategy,
      retryAttempts: body.retryAttempts,
      retryDelay: body.retryDelay,
      healthCheckInterval: body.healthCheckInterval,
      enableBackupUpload: body.enableBackupUpload
    };

    // 验证提供商
    const supportedProviders = [StorageProvider.CLOUDINARY, StorageProvider.TGSTATE];
    if (configUpdate.primaryProvider && !supportedProviders.includes(configUpdate.primaryProvider)) {
      throw new AppError(
        `不支持的主要存储提供商: ${configUpdate.primaryProvider}`,
        ErrorType.VALIDATION_ERROR,
        { supportedProviders }
      );
    }

    if (configUpdate.backupProvider && !supportedProviders.includes(configUpdate.backupProvider)) {
      throw new AppError(
        `不支持的备用存储提供商: ${configUpdate.backupProvider}`,
        ErrorType.VALIDATION_ERROR,
        { supportedProviders }
      );
    }

    // 更新数据库配置
    await storageDatabaseService.updateStorageConfig(configUpdate);

    // 更新管理器配置
    const storageManager = getDefaultStorageManager();
    storageManager.updateConfig(configUpdate);

    logger.info('存储配置已更新', { config: configUpdate });

    const response: APIResponse<any> = {
      success: true,
      data: {
        message: '存储配置更新成功',
        config: configUpdate
      },
      timestamp: new Date()
    };

    return NextResponse.json(response);

  } catch (error) {
    logger.error('更新存储配置失败', { error });
    
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError(
      `更新存储配置失败: ${error instanceof Error ? error.message : '未知错误'}`,
      ErrorType.INTERNAL_ERROR,
      { error }
    );
  }
}

// 应用安全中间件、认证和错误处理
export const GET = withErrorHandler(
  withSecurity({
    rateLimit: 'api',
    allowedMethods: ['GET']
  })(withAdminAuth(getStorageInfo))
);

export const PUT = withErrorHandler(
  withSecurity({
    rateLimit: 'api',
    allowedMethods: ['PUT'],
    allowedContentTypes: ['application/json']
  })(withAdminAuth(updateStorageConfig))
);
