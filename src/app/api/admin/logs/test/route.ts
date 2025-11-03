import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth';
import { withSecurity } from '@/lib/security';
import { withErrorHandler } from '@/lib/error-handler';
import { logger, LogLevel } from '@/lib/logger';
import { APIResponse } from '@/types/api';

// 强制动态渲染
export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/logs/test
 * 生成测试日志数据（仅开发环境）
 */
async function generateTestLogs(request: NextRequest): Promise<Response> {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { success: false, error: { message: '此操作仅在开发环境中可用' } },
      { status: 403 }
    );
  }

  try {
    // 生成各种类型的测试日志
    const testLogs = [
      {
        level: LogLevel.INFO,
        message: '用户登录成功',
        context: { type: 'user_action', action: 'login', userId: 'admin', ip: '192.168.1.100' }
      },
      {
        level: LogLevel.ERROR,
        message: '数据库连接失败',
        context: { type: 'database', operation: 'connect', error: 'Connection timeout' }
      },
      {
        level: LogLevel.WARN,
        message: '用户尝试访问未授权资源',
        context: { type: 'security', userId: 'user123', resource: '/admin/config' }
      },
      {
        level: LogLevel.DEBUG,
        message: '缓存命中',
        context: { type: 'cache', key: 'user_session_abc123', hit: true }
      },
      {
        level: LogLevel.INFO,
        message: 'API请求成功',
        context: { type: 'api_request', method: 'GET', path: '/api/admin/images', status: 200 }
      },
      {
        level: LogLevel.ERROR,
        message: '图片上传失败',
        context: { type: 'api_response', method: 'POST', path: '/api/admin/images', status: 500, error: 'Cloudinary upload failed' }
      },
      {
        level: LogLevel.WARN,
        message: 'API请求频率过高',
        context: { type: 'security', event: 'rate_limit', ip: '203.0.113.1', requests: 150 }
      },
      {
        level: LogLevel.INFO,
        message: '分组创建成功',
        context: { type: 'user_action', action: 'create_group', groupName: '风景照片', userId: 'admin' }
      },
      {
        level: LogLevel.DEBUG,
        message: '系统状态检查完成',
        context: { type: 'api_status', status: 'healthy', duration: 45 }
      },
      {
        level: LogLevel.INFO,
        message: '配置更新成功',
        context: { type: 'admin_action', action: 'update_config', userId: 'admin' }
      }
    ];

    // 记录测试日志
    for (const testLog of testLogs) {
      switch (testLog.level) {
        case LogLevel.DEBUG:
          logger.debug(testLog.message, testLog.context);
          break;
        case LogLevel.INFO:
          logger.info(testLog.message, testLog.context);
          break;
        case LogLevel.WARN:
          logger.warn(testLog.message, testLog.context);
          break;
        case LogLevel.ERROR:
          logger.error(testLog.message, new Error('测试错误'), testLog.context);
          break;
      }
      
      // 添加小延迟以确保时间戳不同
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    logger.info('测试日志生成完成', {
      type: 'admin_action',
      action: 'generate_test_logs',
      count: testLogs.length
    });

    const response: APIResponse = {
      success: true,
      data: {
        message: `已生成 ${testLogs.length} 条测试日志`,
        count: testLogs.length
      },
      timestamp: new Date()
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('生成测试日志失败', error as Error, {
      type: 'api_error',
      endpoint: '/api/admin/logs/test'
    });

    return NextResponse.json({
      success: false,
      error: {
        type: 'INTERNAL_ERROR',
        message: '生成测试日志失败',
        timestamp: new Date()
      }
    }, { status: 500 });
  }
}

// 应用安全中间件、认证和错误处理
export const POST = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['POST']
  })(withAdminAuth(generateTestLogs))
);
