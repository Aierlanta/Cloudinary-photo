/**
 * IP速率限制管理API端点
 * GET /api/admin/security/rate-limits - 获取所有自定义速率限制
 * POST /api/admin/security/rate-limits - 设置IP速率限制
 * DELETE /api/admin/security/rate-limits - 删除IP速率限制
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth';
import { withSecurity } from '@/lib/security';
import { withErrorHandler } from '@/lib/error-handler';
import { APIResponse } from '@/types/api';
import {
  getAllIPRateLimits,
  setIPRateLimit,
  removeIPRateLimit,
} from '@/lib/ip-management';

export const dynamic = 'force-dynamic';

/**
 * 获取所有自定义速率限制
 */
async function getRateLimits(request: NextRequest): Promise<Response> {
  try {
    const rateLimits = await getAllIPRateLimits();

    const response: APIResponse<{ rateLimits: typeof rateLimits }> = {
      success: true,
      data: { rateLimits },
      timestamp: new Date(),
    };

    return NextResponse.json(response);
  } catch (error) {
    throw error;
  }
}

/**
 * 设置IP速率限制
 */
async function setRateLimit(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json();
    const { ip, maxRequests, windowMs, maxTotal } = body;

    if (!ip || !maxRequests || !windowMs) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: '请提供IP地址、最大请求数和时间窗口',
            timestamp: new Date(),
          },
        },
        { status: 400 }
      );
    }

    await setIPRateLimit(ip, maxRequests, windowMs, maxTotal);

    const response: APIResponse<{ message: string }> = {
      success: true,
      data: { message: `已为 IP ${ip} 设置速率限制` },
      timestamp: new Date(),
    };

    return NextResponse.json(response);
  } catch (error) {
    throw error;
  }
}

/**
 * 删除IP速率限制
 */
async function deleteRateLimit(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json();
    const { ip } = body;

    if (!ip) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: '请提供要删除限制的IP地址',
            timestamp: new Date(),
          },
        },
        { status: 400 }
      );
    }

    await removeIPRateLimit(ip);

    const response: APIResponse<{ message: string }> = {
      success: true,
      data: { message: `已删除 IP ${ip} 的速率限制` },
      timestamp: new Date(),
    };

    return NextResponse.json(response);
  } catch (error) {
    throw error;
  }
}

export const GET = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['GET'],
    enableAccessLog: false,
  })(withAdminAuth(getRateLimits))
);

export const POST = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['POST'],
    allowedContentTypes: ['application/json'],
    maxRequestSize: 1024 * 1024,
    enableAccessLog: false,
  })(withAdminAuth(setRateLimit))
);

export const DELETE = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['DELETE'],
    allowedContentTypes: ['application/json'],
    maxRequestSize: 1024 * 1024,
    enableAccessLog: false,
  })(withAdminAuth(deleteRateLimit))
);

