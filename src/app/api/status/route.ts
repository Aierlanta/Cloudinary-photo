import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '@/lib/database';
import { CloudinaryService } from '@/lib/cloudinary';
import { withErrorHandler } from '@/lib/error-handler';
import { withSecurity } from '@/lib/security';
import { logger } from '@/lib/logger';
import { APIResponse } from '@/types/api';
import { readFileSync } from 'fs';
import { join } from 'path';

const cloudinaryService = CloudinaryService.getInstance();

/**
 * 读取版本号
 */
function getVersion(): string {
  try {
    const versionPath = join(process.cwd(), '.version');
    const version = readFileSync(versionPath, 'utf-8').trim();
    return version || '1.0.0';
  } catch (error) {
    logger.warn('无法读取版本文件，使用默认版本', { error: error instanceof Error ? error.message : 'Unknown error' });
    return process.env.npm_package_version || '1.0.0';
  }
}

/**
 * GET /api/status
 * 公开API状态检查端点
 */
async function getAPIStatus(request: NextRequest): Promise<Response> {
  const startTime = performance.now();

  // 记录状态检查开始
  logger.info('开始系统状态检查', {
    type: 'api_status',
    ip: getClientIP(request),
    userAgent: request.headers.get('user-agent')
  });

  try {
    // 检查数据库连接
    const dbStatus = await checkDatabaseStatus();
    
    // 检查Cloudinary连接
    const cloudinaryStatus = await checkCloudinaryStatus();
    
    // 获取API配置状态
    const apiConfigStatus = await checkAPIConfigStatus();
    
    // 获取系统统计
    const stats = await getSystemStats();
    
    const duration = Math.round(performance.now() - startTime);

    // 确定整体状态
    let overallStatus: 'healthy' | 'degraded' | 'down';
    let statusCode: number;

    // 核心服务检查
    const coreServicesHealthy = dbStatus.healthy && apiConfigStatus.enabled;
    const allServicesHealthy = coreServicesHealthy && cloudinaryStatus.healthy;

    if (allServicesHealthy) {
      overallStatus = 'healthy';
      statusCode = 200;
    } else if (coreServicesHealthy) {
      // 核心服务正常，但Cloudinary可能有问题
      overallStatus = 'degraded';
      statusCode = 200; // 仍然可以提供基本服务
    } else {
      // 核心服务有问题
      overallStatus = 'down';
      statusCode = 503;
    }
    
    // 记录状态检查
    logger.info('API状态检查完成', {
      type: 'api_status',
      status: overallStatus,
      duration,
      ip: getClientIP(request)
    });
    
    const response: APIResponse = {
      success: true,
      data: {
        status: overallStatus,
        timestamp: new Date(),
        uptime: process.uptime(),
        version: getVersion(),
        environment: process.env.NODE_ENV || 'development',
        services: {
          database: dbStatus,
          cloudinary: cloudinaryStatus,
          api: apiConfigStatus
        },
        stats,
        performance: {
          responseTime: `${duration}ms`,
          memoryUsage: {
            used: Math.round(stats.memoryUsage.used / 1024 / 1024), // MB
            total: Math.round(stats.memoryUsage.rss / 1024 / 1024), // MB
            heap: Math.round(stats.memoryUsage.heapUsed / 1024 / 1024), // MB
            external: Math.round(stats.memoryUsage.external / 1024 / 1024) // MB
          },
          cpuUsage: stats.cpuUsage
        },
        health: {
          score: calculateHealthScore(dbStatus, cloudinaryStatus, apiConfigStatus),
          issues: getHealthIssues(dbStatus, cloudinaryStatus, apiConfigStatus)
        }
      },
      timestamp: new Date()
    };
    
    return NextResponse.json(response, { status: statusCode });
    
  } catch (error) {
    logger.error('API状态检查失败', error as Error, {
      type: 'api_status',
      duration: Math.round(performance.now() - startTime)
    });
    
    throw error;
  }
}

/**
 * 检查数据库状态
 */
async function checkDatabaseStatus(): Promise<{
  healthy: boolean;
  responseTime?: number;
  error?: string;
  details?: {
    connectionPool?: string;
    activeConnections?: number;
    version?: string;
  };
}> {
  const startTime = performance.now();

  try {
    // 基本连接检查
    const isConnected = await databaseService.checkConnection();
    const responseTime = Math.round(performance.now() - startTime);

    if (!isConnected) {
      logger.warn('数据库连接检查失败', {
        type: 'database',
        responseTime,
        operation: 'connection_check'
      });
      return {
        healthy: false,
        responseTime,
        error: '数据库连接失败'
      };
    }

    logger.debug('数据库连接检查成功', {
      type: 'database',
      responseTime,
      operation: 'connection_check'
    });

    // 获取详细信息
    let details: any = {};
    try {
      // 尝试获取数据库版本信息
      const versionResult = await databaseService.getDatabaseVersion();
      details.version = versionResult;
      details.connectionPool = 'active';
    } catch (detailError) {
      // 详细信息获取失败不影响健康状态
      details.connectionPool = 'limited';
    }

    return {
      healthy: true,
      responseTime,
      details
    };
  } catch (error) {
    const responseTime = Math.round(performance.now() - startTime);

    return {
      healthy: false,
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 检查Cloudinary状态
 */
async function checkCloudinaryStatus(): Promise<{
  healthy: boolean;
  responseTime?: number;
  error?: string;
  details?: {
    configured: boolean;
    usageStats?: any;
    cloudName?: string;
  };
}> {
  const startTime = performance.now();

  try {
    // 检查配置
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    const isConfigured = !!(cloudName && apiKey && apiSecret);

    if (!isConfigured) {
      logger.warn('Cloudinary配置检查失败', {
        type: 'cloudinary',
        error: 'Cloudinary配置缺失',
        configured: false
      });
      return {
        healthy: false,
        responseTime: Math.round(performance.now() - startTime),
        error: 'Cloudinary配置缺失',
        details: {
          configured: false,
          cloudName: cloudName ? '已配置' : '未配置'
        }
      };
    }

    // 尝试检查Cloudinary连接
    const connectionResult = await cloudinaryService.checkConnection();
    const responseTime = Math.round(performance.now() - startTime);

    if (!connectionResult.connected) {
      return {
        healthy: false,
        responseTime,
        error: 'Cloudinary连接失败',
        details: {
          configured: true,
          cloudName: cloudName
        }
      };
    }

    // 尝试获取使用统计（可选）
    let usageStats;
    try {
      usageStats = await cloudinaryService.getUsageStats();
    } catch (usageError) {
      // 使用统计获取失败不影响健康状态
      usageStats = null;
    }

    return {
      healthy: true,
      responseTime,
      details: {
        configured: true,
        cloudName: cloudName,
        usageStats: usageStats ? {
          credits: usageStats.credits,
          storage: usageStats.storage,
          bandwidth: usageStats.bandwidth
        } : undefined
      }
    };
  } catch (error) {
    const responseTime = Math.round(performance.now() - startTime);

    return {
      healthy: false,
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: {
        configured: false
      }
    };
  }
}

/**
 * 检查API配置状态
 */
async function checkAPIConfigStatus(): Promise<{
  enabled: boolean;
  configured: boolean;
  parametersCount?: number;
  error?: string;
  details?: {
    defaultScope?: string;
    defaultGroups?: string[];
    allowedParameters?: string[];
    lastUpdated?: Date;
  };
}> {
  try {
    let apiConfig = await databaseService.getAPIConfig();

    if (!apiConfig) {
      // 如果API配置不存在，尝试初始化数据库
      logger.info('API配置未找到，正在初始化数据库...', { type: 'api_config' });
      await databaseService.initialize();

      // 重新获取配置
      apiConfig = await databaseService.getAPIConfig();

      if (!apiConfig) {
        logger.error('API配置未找到', new Error('API配置初始化失败'), { type: 'api_config' });
        return {
          enabled: false,
          configured: false,
          error: 'API配置初始化失败'
        };
      }
    }

    return {
      enabled: apiConfig.isEnabled,
      configured: true,
      parametersCount: apiConfig.allowedParameters?.length || 0,
      details: {
        defaultScope: apiConfig.defaultScope,
        defaultGroups: apiConfig.defaultGroups || [],
        allowedParameters: apiConfig.allowedParameters || [],
        lastUpdated: apiConfig.updatedAt
      }
    };
  } catch (error) {
    logger.error('检查API配置状态失败', error as Error, { type: 'api_config' });
    return {
      enabled: false,
      configured: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 获取系统统计信息
 */
async function getSystemStats(): Promise<{
  totalImages: number;
  totalGroups: number;
  memoryUsage: NodeJS.MemoryUsage;
  diskUsage?: {
    total: number;
    used: number;
    free: number;
  };
  cpuUsage?: {
    user: number;
    system: number;
  };
  logStats?: {
    totalLogs: number;
    recentErrors: number;
  };
}> {
  try {
    const [stats, logStats] = await Promise.all([
      databaseService.getStats(),
      databaseService.getLogStats().catch(() => null)
    ]);

    // 获取CPU使用情况
    const cpuUsage = process.cpuUsage();

    return {
      totalImages: stats.totalImages,
      totalGroups: stats.totalGroups,
      memoryUsage: process.memoryUsage(),
      cpuUsage: {
        user: cpuUsage.user / 1000000, // 转换为毫秒
        system: cpuUsage.system / 1000000
      },
      logStats: logStats ? {
        totalLogs: logStats.totalLogs,
        recentErrors: logStats.recentErrors
      } : undefined
    };
  } catch (error) {
    return {
      totalImages: 0,
      totalGroups: 0,
      memoryUsage: process.memoryUsage(),
      cpuUsage: {
        user: 0,
        system: 0
      }
    };
  }
}

/**
 * 计算系统健康评分 (0-100)
 */
function calculateHealthScore(
  dbStatus: any,
  cloudinaryStatus: any,
  apiConfigStatus: any
): number {
  let score = 0;

  // 数据库状态 (40分)
  if (dbStatus.healthy) {
    score += 40;
    // 响应时间加分
    if (dbStatus.responseTime && dbStatus.responseTime < 100) {
      score += 5;
    }
  }

  // API配置状态 (30分)
  if (apiConfigStatus.enabled && apiConfigStatus.configured) {
    score += 30;
  }

  // Cloudinary状态 (25分)
  if (cloudinaryStatus.healthy) {
    score += 25;
    // 响应时间加分
    if (cloudinaryStatus.responseTime && cloudinaryStatus.responseTime < 1000) {
      score += 5;
    }
  }

  return Math.min(score, 100);
}

/**
 * 获取健康问题列表
 */
function getHealthIssues(
  dbStatus: any,
  cloudinaryStatus: any,
  apiConfigStatus: any
): string[] {
  const issues: string[] = [];

  if (!dbStatus.healthy) {
    issues.push(`数据库连接失败: ${dbStatus.error || '未知错误'}`);
  } else if (dbStatus.responseTime && dbStatus.responseTime > 1000) {
    issues.push(`数据库响应缓慢: ${dbStatus.responseTime}ms`);
  }

  if (!cloudinaryStatus.healthy) {
    issues.push(`Cloudinary连接失败: ${cloudinaryStatus.error || '未知错误'}`);
  } else if (cloudinaryStatus.responseTime && cloudinaryStatus.responseTime > 3000) {
    issues.push(`Cloudinary响应缓慢: ${cloudinaryStatus.responseTime}ms`);
  }

  if (!apiConfigStatus.enabled) {
    issues.push('API服务已禁用');
  }

  if (!apiConfigStatus.configured) {
    issues.push(`API配置错误: ${apiConfigStatus.error || '未知错误'}`);
  }

  return issues;
}

/**
 * 获取客户端IP地址
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  return realIP || 'unknown';
}

// 应用安全中间件和错误处理
export const GET = withErrorHandler(
  withSecurity({
    rateLimit: 'public',
    allowedMethods: ['GET']
  })(getAPIStatus)
);
