/**
 * IP封禁管理API端点
 * GET /api/admin/security/banned-ips - 获取被封禁的IP列表
 * POST /api/admin/security/banned-ips - 封禁IP
 * DELETE /api/admin/security/banned-ips - 解封IP
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth';
import { withSecurity } from '@/lib/security';
import { withErrorHandler } from '@/lib/error-handler';
import { APIResponse } from '@/types/api';
import { getBannedIPs, banIP, unbanIP, banMultipleIPs } from '@/lib/ip-management';

export const dynamic = 'force-dynamic';

/**
 * 获取被封禁的IP列表
 */
async function getBannedIPList(request: NextRequest): Promise<Response> {
  try {
    const bannedIPs = await getBannedIPs();

    const response: APIResponse<{ bannedIPs: typeof bannedIPs }> = {
      success: true,
      data: { bannedIPs },
      timestamp: new Date(),
    };

    return NextResponse.json(response);
  } catch (error) {
    throw error;
  }
}

/**
 * 封禁IP
 */
async function banIPHandler(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json();
    const { ip, ips, reason, expiresAt } = body;

    if (!ip && (!ips || !Array.isArray(ips))) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: '请提供要封禁的IP地址',
            timestamp: new Date(),
          },
        },
        { status: 400 }
      );
    }

    // 批量封禁
    if (ips && Array.isArray(ips)) {
      const expiresDate = expiresAt ? new Date(expiresAt) : undefined;
      const result = await banMultipleIPs(ips, reason, 'admin', expiresDate);

      const response: APIResponse<{ result: typeof result }> = {
        success: true,
        data: { result },
        timestamp: new Date(),
      };

      return NextResponse.json(response);
    }

    // 单个封禁
    const expiresDate = expiresAt ? new Date(expiresAt) : undefined;
    await banIP(ip, reason, 'admin', expiresDate);

    const response: APIResponse<{ message: string }> = {
      success: true,
      data: { message: `IP ${ip} 已被封禁` },
      timestamp: new Date(),
    };

    return NextResponse.json(response);
  } catch (error) {
    throw error;
  }
}

/**
 * 解封IP
 */
async function unbanIPHandler(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json();
    const { ip } = body;

    if (!ip) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: '请提供要解封的IP地址',
            timestamp: new Date(),
          },
        },
        { status: 400 }
      );
    }

    await unbanIP(ip);

    const response: APIResponse<{ message: string }> = {
      success: true,
      data: { message: `IP ${ip} 已解封` },
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
  })(withAdminAuth(getBannedIPList))
);

export const POST = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['POST'],
    allowedContentTypes: ['application/json'],
    maxRequestSize: 1024 * 1024,
    enableAccessLog: false,
  })(withAdminAuth(banIPHandler))
);

export const DELETE = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['DELETE'],
    allowedContentTypes: ['application/json'],
    maxRequestSize: 1024 * 1024,
    enableAccessLog: false,
  })(withAdminAuth(unbanIPHandler))
);

