import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth';
import { withSecurity } from '@/lib/security';
import { withErrorHandler } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import { LogCleanupScheduler } from '@/lib/log-cleanup-scheduler';
import { APIResponse } from '@/types/api';

// 强制动态渲染
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/logs/cleanup
 * 获取日志清理调度器状态
 */
async function getCleanupStatus(request: NextRequest): Promise<Response> {
  try {
    const scheduler = LogCleanupScheduler.getInstance();
    const status = scheduler.getStatus();
    const nextCleanupTime = scheduler.getNextCleanupTime();

    const response: APIResponse = {
      success: true,
      data: {
        isRunning: status.isRunning,
        intervalHours: status.intervalHours,
        retentionDays: status.retentionDays,
        nextCleanupTime: nextCleanupTime?.toISOString() || null
      },
      timestamp: new Date()
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('获取日志清理状态失败', error instanceof Error ? error : undefined, {
      type: 'api_error',
      endpoint: '/api/admin/logs/cleanup',
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json({
      success: false,
      error: {
        type: 'INTERNAL_ERROR',
        message: '获取日志清理状态失败',
        timestamp: new Date()
      }
    }, { status: 500 });
  }
}

/**
 * POST /api/admin/logs/cleanup
 * 管理日志清理调度器和执行清理操作
 */
async function manageCleanup(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json();
    const { action, retentionDays } = body;

    const scheduler = LogCleanupScheduler.getInstance();

    switch (action) {
      case 'start':
        scheduler.start();
        logger.info('手动启动日志清理调度器', {
          type: 'log_cleanup',
          operation: 'start_scheduler'
        });

        return NextResponse.json({
          success: true,
          data: {
            message: '日志清理调度器已启动'
          },
          timestamp: new Date()
        });

      case 'stop':
        scheduler.stop();
        logger.info('手动停止日志清理调度器', {
          type: 'log_cleanup',
          operation: 'stop_scheduler'
        });

        return NextResponse.json({
          success: true,
          data: {
            message: '日志清理调度器已停止'
          },
          timestamp: new Date()
        });

      case 'cleanup':
        const result = await scheduler.performManualCleanup(retentionDays);
        
        if (result.success) {
          return NextResponse.json({
            success: true,
            data: {
              message: `手动日志清理完成，删除了 ${result.deletedCount} 条日志记录`,
              deletedCount: result.deletedCount
            },
            timestamp: new Date()
          });
        } else {
          return NextResponse.json({
            success: false,
            error: {
              type: 'CLEANUP_ERROR',
              message: `日志清理失败: ${result.error}`,
              timestamp: new Date()
            }
          }, { status: 500 });
        }

      default:
        return NextResponse.json({
          success: false,
          error: {
            type: 'INVALID_ACTION',
            message: '无效的操作。支持的操作: start, stop, cleanup',
            timestamp: new Date()
          }
        }, { status: 400 });
    }
  } catch (error) {
    logger.error('日志清理操作失败', error instanceof Error ? error : undefined, {
      type: 'api_error',
      endpoint: '/api/admin/logs/cleanup',
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json({
      success: false,
      error: {
        type: 'INTERNAL_ERROR',
        message: '日志清理操作失败',
        timestamp: new Date()
      }
    }, { status: 500 });
  }
}

// 应用安全中间件、认证和错误处理
export const GET = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['GET']
  })(withAdminAuth(getCleanupStatus))
);

export const POST = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['POST']
  })(withAdminAuth(manageCleanup))
);
