import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '@/lib/database';
import { CloudinaryService } from '@/lib/cloudinary';
import { withErrorHandler } from '@/lib/error-handler';
import { withSecurity } from '@/lib/security';
import { logger } from '@/lib/logger';
import { APIResponse } from '@/types/api';

const cloudinaryService = CloudinaryService.getInstance();

/**
 * GET /api/status
 * 公开API状态检查端点
 */
async function getAPIStatus(request: NextRequest): Promise<Response> {
  const startTime = performance.now();
  
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
    const overallStatus = dbStatus.healthy && cloudinaryStatus.healthy && apiConfigStatus.enabled
      ? 'healthy' 
      : 'degraded';
    
    const statusCode = overallStatus === 'healthy' ? 200 : 503;
    
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
        version: process.env.npm_package_version || '1.0.0',
        services: {
          database: dbStatus,
          cloudinary: cloudinaryStatus,
          api: apiConfigStatus
        },
        stats,
        responseTime: `${duration}ms`
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
}> {
  const startTime = performance.now();
  
  try {
    const isConnected = await databaseService.checkConnection();
    const responseTime = Math.round(performance.now() - startTime);
    
    return {
      healthy: isConnected,
      responseTime
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
}> {
  const startTime = performance.now();
  
  try {
    // 尝试检查Cloudinary连接
    const connectionResult = await cloudinaryService.checkConnection();
    const responseTime = Math.round(performance.now() - startTime);

    return {
      healthy: connectionResult.connected,
      responseTime
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
 * 检查API配置状态
 */
async function checkAPIConfigStatus(): Promise<{
  enabled: boolean;
  configured: boolean;
  parametersCount?: number;
  error?: string;
}> {
  try {
    const apiConfig = await databaseService.getAPIConfig();
    
    if (!apiConfig) {
      return {
        enabled: false,
        configured: false,
        error: 'API配置未找到'
      };
    }
    
    return {
      enabled: apiConfig.isEnabled,
      configured: true,
      parametersCount: apiConfig.allowedParameters?.length || 0
    };
  } catch (error) {
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
  memoryUsage?: NodeJS.MemoryUsage;
}> {
  try {
    const stats = await databaseService.getStats();
    
    return {
      totalImages: stats.totalImages,
      totalGroups: stats.totalGroups,
      memoryUsage: process.memoryUsage()
    };
  } catch (error) {
    return {
      totalImages: 0,
      totalGroups: 0,
      memoryUsage: process.memoryUsage()
    };
  }
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
