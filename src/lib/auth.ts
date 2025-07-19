/**
 * 管理员认证中间件
 * 提供简单的密码认证功能
 */

import { NextRequest } from 'next/server';
import { AppError, ErrorType } from '@/types/errors';

/**
 * 验证管理员密码
 */
export function validateAdminPassword(password: string): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  
  if (!adminPassword) {
    throw new AppError(
      ErrorType.INTERNAL_ERROR,
      '管理员密码未配置',
      500
    );
  }
  
  return password === adminPassword;
}

/**
 * 从请求头中提取认证信息
 */
export function extractAuthFromRequest(request: NextRequest): string | null {
  // 支持多种认证方式
  
  // 1. Authorization Bearer token
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // 2. X-Admin-Password 头
  const passwordHeader = request.headers.get('x-admin-password');
  if (passwordHeader) {
    return passwordHeader;
  }
  
  // 3. 查询参数 (不推荐，仅用于测试)
  const url = new URL(request.url);
  const passwordParam = url.searchParams.get('admin_password');
  if (passwordParam) {
    return passwordParam;
  }
  
  return null;
}

/**
 * 验证管理员权限
 */
export function verifyAdminAuth(request: NextRequest): void {
  const password = extractAuthFromRequest(request);
  
  if (!password) {
    throw new AppError(
      ErrorType.UNAUTHORIZED,
      '需要管理员认证',
      401
    );
  }
  
  if (!validateAdminPassword(password)) {
    throw new AppError(
      ErrorType.UNAUTHORIZED,
      '管理员密码错误',
      401
    );
  }
}

/**
 * 创建认证响应
 */
export function createAuthResponse(message: string, status: number = 401) {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        type: ErrorType.UNAUTHORIZED,
        message,
        timestamp: new Date()
      }
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': 'Bearer realm="Admin Area"'
      }
    }
  );
}

/**
 * 管理员认证装饰器
 */
export function withAdminAuth<T extends any[]>(
  handler: (...args: T) => Promise<Response>
) {
  return async (...args: T): Promise<Response> => {
    try {
      const request = args[0] as NextRequest;
      verifyAdminAuth(request);
      return await handler(...args);
    } catch (error) {
      // 检查是否是AppError（兼容测试环境）
      if (error instanceof AppError && error.type === ErrorType.UNAUTHORIZED) {
        return createAuthResponse(error.message);
      }
      // 兼容测试环境的检查
      if (error && typeof error === 'object' && 'type' in error && error.type === ErrorType.UNAUTHORIZED) {
        const appError = error as AppError;
        return createAuthResponse(appError.message);
      }
      throw error;
    }
  };
}