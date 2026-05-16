import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth';
import { withSecurity } from '@/lib/security';
import { withErrorHandler } from '@/lib/error-handler';
import { APIResponse } from '@/types/api';
import { getServerInitializationStatus, initializeServer } from '@/lib/server-init';

export const dynamic = 'force-dynamic';

async function getRuntimeInitStatus(_request: NextRequest): Promise<Response> {
  const response: APIResponse<{ initialized: boolean }> = {
    success: true,
    data: getServerInitializationStatus(),
    timestamp: new Date()
  };

  return NextResponse.json(response);
}

async function initializeRuntimeServices(_request: NextRequest): Promise<Response> {
  initializeServer();

  const response: APIResponse<{ initialized: boolean; message: string }> = {
    success: true,
    data: {
      ...getServerInitializationStatus(),
      message: '运行时服务已按需初始化'
    },
    timestamp: new Date()
  };

  return NextResponse.json(response);
}

export const GET = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['GET'],
    enableAccessLog: false
  })(withAdminAuth(getRuntimeInitStatus))
);

export const POST = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['POST'],
    enableAccessLog: false
  })(withAdminAuth(initializeRuntimeServices))
);
