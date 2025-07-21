/**
 * 安全中间件
 * 提供API限流、安全头设置和请求验证功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { AppError, ErrorType } from '@/types/errors';

// 限流存储 (内存存储，生产环境建议使用Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * 限流配置
 */
interface RateLimitConfig {
  windowMs: number; // 时间窗口（毫秒）
  maxRequests: number; // 最大请求数
  message?: string; // 限流消息
}

/**
 * 默认限流配置
 */
const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  // 公开API限流 - 每分钟60次请求
  public: {
    windowMs: 60 * 1000,
    maxRequests: 60,
    message: 'API请求过于频繁，请稍后再试'
  },
  // 管理API限流 - 每分钟120次请求
  admin: {
    windowMs: 60 * 1000,
    maxRequests: 120,
    message: '管理API请求过于频繁，请稍后再试'
  },
  // 上传API限流 - 每分钟20次请求（支持批量上传）
  upload: {
    windowMs: 60 * 1000,
    maxRequests: 20,
    message: '上传请求过于频繁，请稍后再试'
  }
};

/**
 * 获取客户端IP地址
 */
function getClientIP(request: NextRequest): string {
  // 检查各种可能的IP头
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  // 回退到默认值
  return 'unknown';
}

/**
 * 清理过期的限流记录
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now > data.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * API限流中间件
 */
export function rateLimit(config: RateLimitConfig) {
  return (request: NextRequest): { allowed: boolean; remaining: number; resetTime: number } => {
    const clientIP = getClientIP(request);
    const key = `${clientIP}:${request.nextUrl.pathname}`;
    const now = Date.now();
    
    // 清理过期记录
    cleanupExpiredEntries();
    
    const existing = rateLimitStore.get(key);
    
    if (!existing || now > existing.resetTime) {
      // 新的时间窗口
      const resetTime = now + config.windowMs;
      rateLimitStore.set(key, { count: 1, resetTime });
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime
      };
    }
    
    if (existing.count >= config.maxRequests) {
      // 超出限制
      return {
        allowed: false,
        remaining: 0,
        resetTime: existing.resetTime
      };
    }
    
    // 增加计数
    existing.count++;
    rateLimitStore.set(key, existing);
    
    return {
      allowed: true,
      remaining: config.maxRequests - existing.count,
      resetTime: existing.resetTime
    };
  };
}

/**
 * 创建限流响应
 */
export function createRateLimitResponse(
  message: string,
  resetTime: number,
  remaining: number = 0
): Response {
  const resetTimeSeconds = Math.ceil((resetTime - Date.now()) / 1000);
  
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        type: ErrorType.VALIDATION_ERROR,
        message,
        timestamp: new Date()
      }
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': resetTimeSeconds.toString(),
        'Retry-After': resetTimeSeconds.toString()
      }
    }
  );
}

/**
 * 设置安全响应头
 */
export function setSecurityHeaders(response: Response): Response {
  // 防止XSS攻击
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // 内容安全策略
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' https://res.cloudinary.com data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self' data:;"
  );
  
  // 严格传输安全
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }
  
  // 引用策略
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // 权限策略
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );
  
  return response;
}

/**
 * 验证请求内容类型
 */
export function validateContentType(
  request: NextRequest,
  allowedTypes: string[]
): void {
  const contentType = request.headers.get('content-type');
  
  if (!contentType) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      '缺少Content-Type头',
      400
    );
  }
  
  const isAllowed = allowedTypes.some(type => 
    contentType.toLowerCase().includes(type.toLowerCase())
  );
  
  if (!isAllowed) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      `不支持的Content-Type: ${contentType}`,
      400
    );
  }
}

/**
 * 验证请求方法
 */
export function validateMethod(
  request: NextRequest,
  allowedMethods: string[]
): void {
  if (!allowedMethods.includes(request.method)) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      `不支持的HTTP方法: ${request.method}`,
      400
    );
  }
}

/**
 * 验证请求大小
 */
export function validateRequestSize(
  request: NextRequest,
  maxSizeBytes: number
): void {
  const contentLength = request.headers.get('content-length');
  
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (size > maxSizeBytes) {
      throw new AppError(
        ErrorType.VALIDATION_ERROR,
        `请求体过大，最大允许 ${Math.round(maxSizeBytes / 1024 / 1024)}MB`,
        400
      );
    }
  }
}

/**
 * 安全中间件装饰器
 */
export function withSecurity(options: {
  rateLimit?: keyof typeof DEFAULT_RATE_LIMITS | RateLimitConfig;
  allowedMethods?: string[];
  allowedContentTypes?: string[];
  maxRequestSize?: number;
}) {
  return function<T extends any[]>(
    handler: (...args: T) => Promise<Response>
  ) {
    return async (...args: T): Promise<Response> => {
      try {
        const request = args[0] as NextRequest;
        
        // 验证HTTP方法
        if (options.allowedMethods) {
          validateMethod(request, options.allowedMethods);
        }
        
        // 验证Content-Type
        if (options.allowedContentTypes && request.method !== 'GET') {
          validateContentType(request, options.allowedContentTypes);
        }
        
        // 验证请求大小
        if (options.maxRequestSize) {
          validateRequestSize(request, options.maxRequestSize);
        }
        
        // 应用限流
        if (options.rateLimit) {
          const config = typeof options.rateLimit === 'string'
            ? DEFAULT_RATE_LIMITS[options.rateLimit]
            : options.rateLimit;

          const rateLimitResult = rateLimit(config)(request);

          if (!rateLimitResult.allowed) {
            return createRateLimitResponse(
              config.message || '请求过于频繁',
              rateLimitResult.resetTime,
              rateLimitResult.remaining
            );
          }

          // 添加限流头到响应
          const response = await handler(...args);
          response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
          response.headers.set('X-RateLimit-Reset', Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString());

          // 直接返回响应，不尝试解析为JSON
          return setSecurityHeaders(response);
        }
        
        // 执行处理器并设置安全头
        const response = await handler(...args);
        
        // 如果响应已经是NextResponse，直接设置安全头
        if (response instanceof NextResponse) {
          return setSecurityHeaders(response);
        }
        
        // 否则创建新的NextResponse
        try {
          const responseText = await response.text();
          const responseData = JSON.parse(responseText);
          return setSecurityHeaders(NextResponse.json(
            responseData,
            { status: response.status, headers: response.headers }
          ));
        } catch {
          // 如果不是JSON响应，直接返回
          return setSecurityHeaders(NextResponse.json(
            { success: false, error: { type: ErrorType.INTERNAL_ERROR, message: '响应格式错误' } },
            { status: 500 }
          ));
        }
        
      } catch (error) {
        // 检查是否是AppError
        if (error instanceof AppError) {
          const response = NextResponse.json(
            {
              success: false,
              error: {
                type: error.type,
                message: error.message,
                timestamp: new Date()
              }
            },
            { status: error.statusCode }
          );
          
          return setSecurityHeaders(response);
        }
        
        // 兼容测试环境的检查
        if (error && typeof error === 'object' && 'type' in error && 'message' in error) {
          const appError = error as AppError;
          const response = NextResponse.json(
            {
              success: false,
              error: {
                type: appError.type,
                message: appError.message,
                timestamp: new Date()
              }
            },
            { status: appError.type === ErrorType.UNAUTHORIZED ? 401 : 400 }
          );
          
          return setSecurityHeaders(response);
        }
        
        // 未知错误
        const response = NextResponse.json(
          {
            success: false,
            error: {
              type: ErrorType.INTERNAL_ERROR,
              message: '服务器内部错误',
              timestamp: new Date()
            }
          },
          { status: 500 }
        );
        
        return setSecurityHeaders(response);
      }
    };
  };
}

/**
 * 获取限流统计信息
 */
export function getRateLimitStats(): Array<{
  key: string;
  count: number;
  resetTime: number;
  remaining: number;
}> {
  const stats: Array<{
    key: string;
    count: number;
    resetTime: number;
    remaining: number;
  }> = [];
  
  for (const [key, data] of rateLimitStore.entries()) {
    const [ip, path] = key.split(':');
    stats.push({
      key: `${ip} -> ${path}`,
      count: data.count,
      resetTime: data.resetTime,
      remaining: Math.max(0, DEFAULT_RATE_LIMITS.public.maxRequests - data.count)
    });
  }
  
  return stats;
}

/**
 * 清除所有限流记录
 */
export function clearRateLimitStore(): void {
  rateLimitStore.clear();
}