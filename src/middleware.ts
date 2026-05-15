/**
 * Next.js 中间件
 * 处理全局安全头和请求预处理
 */

import { NextRequest, NextResponse } from 'next/server';
import { setSecurityHeaders } from '@/lib/security';

function resolveAllowedOrigin(request: NextRequest): string {
  const origin = request.headers.get('origin');
  const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (!origin) {
    return '*';
  }
  if (configuredOrigins.includes('*') || configuredOrigins.includes(origin)) {
    return origin;
  }
  return configuredOrigins.length === 0 ? origin : configuredOrigins[0];
}

export function middleware(request: NextRequest) {
  // 创建响应
  const response = NextResponse.next();
  
  // 设置安全头
  const secureResponse = setSecurityHeaders(response);
  
  // 添加CORS头（仅对API路由）
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const allowedOrigin = resolveAllowedOrigin(request);
    secureResponse.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    secureResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    secureResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    secureResponse.headers.set('Access-Control-Max-Age', '86400');
    secureResponse.headers.set('Vary', 'Origin');
    
    // 处理预检请求
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 200, headers: secureResponse.headers });
    }
  }
  
  // 添加请求ID用于日志追踪
  const requestId = crypto.randomUUID();
  secureResponse.headers.set('X-Request-ID', requestId);
  
  return secureResponse;
}

// 配置中间件匹配路径
export const config = {
  matcher: [
    /*
     * 匹配所有请求路径，除了:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};