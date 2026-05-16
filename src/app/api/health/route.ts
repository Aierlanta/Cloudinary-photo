/**
 * 简单的健康检查端点
 * 用于部署环境的快速健康检查
 */

import { NextResponse } from 'next/server';
import { readAppVersion } from '@/lib/app-version';

// 强制动态渲染
export const dynamic = 'force-dynamic'

/**
 * GET /api/health
 * 简单的健康检查端点，快速响应
 */
export async function GET() {
  try {
    const version = await readAppVersion();
    // 最基本的健康检查 - 只检查服务是否运行
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'random-image-api',
      version
    }, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Service check failed'
    }, { status: 503 });
  }
}
