/**
 * 管理员认证中间件
 * 提供简单的密码认证功能
 */

import { NextRequest } from 'next/server';
import { AppError, ErrorType } from '@/types/errors';
import { createHmac, timingSafeEqual } from 'crypto';

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
 * 验证session token
 */
export function validateSessionToken(token: string): boolean {
  // 使用 HMAC-SHA256 校验签名并校验过期时间（默认24小时）
  try {
    if (!token) return false;

    const parts = token.split('.');
    if (parts.length !== 2) return false;

    const [issuedAtMsStr, signature] = parts;
    const issuedAtMs = Number(issuedAtMsStr);
    if (!Number.isFinite(issuedAtMs)) return false;

    // 过期时间：24小时
    const now = Date.now();
    const maxAgeMs = 24 * 60 * 60 * 1000;
    if (issuedAtMs > now + 5 * 60 * 1000) return false; // 防止未来时间漂移超过5分钟
    if (now - issuedAtMs > maxAgeMs) return false;

    const secret = getSessionSecret();
    const expected = createHmac('sha256', secret).update(issuedAtMsStr).digest('hex');

    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;

    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * 生成会话 token（HMAC 签名）
 * 格式：`${issuedAtMs}.${signature}`
 */
export function generateSessionToken(): string {
  const issuedAtMs = Date.now().toString();
  const secret = getSessionSecret();
  const signature = createHmac('sha256', secret).update(issuedAtMs).digest('hex');
  return `${issuedAtMs}.${signature}`;
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!secret) {
    throw new AppError(
      ErrorType.INTERNAL_ERROR,
      '服务器配置错误：未设置 SESSION_SECRET 或 ADMIN_PASSWORD',
      500
    );
  }
  return secret;
}

/**
 * 从请求头中提取认证信息
 */
export function extractAuthFromRequest(request: NextRequest): string | null {
  // 支持多种认证方式

  // 1. Cookie中的session token
  const sessionCookie = request.cookies.get('admin-session');
  if (sessionCookie) {
    return sessionCookie.value;
  }

  // 2. Authorization Bearer token
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
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
  const authValue = extractAuthFromRequest(request);

  if (!authValue) {
    throw new AppError(
      ErrorType.UNAUTHORIZED,
      '需要管理员认证',
      401
    );
  }

  // 检查是否是session token（从cookie获取）
  const sessionCookie = request.cookies.get('admin-session');
  if (sessionCookie && authValue === sessionCookie.value) {
    // 验证session token
    if (!validateSessionToken(authValue)) {
      throw new AppError(
        ErrorType.UNAUTHORIZED,
        'Session已过期',
        401
      );
    }
    return; // session token验证通过
  }

  // 否则验证为直接密码
  if (!validateAdminPassword(authValue)) {
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