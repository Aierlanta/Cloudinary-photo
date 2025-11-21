/**
 * /api/random/response
 * 根据指定 imageId 返回图片数据流（专供 /api/random?response=true 使用）
 */

import { NextRequest } from 'next/server';
import { withSecurity } from '@/lib/security';
import { withErrorHandler } from '@/lib/error-handler';
import { serveRandomResponse } from '@/app/api/random/response/service';

export const dynamic = 'force-dynamic';

async function handleRandomResponse(request: NextRequest): Promise<Response> {
  return serveRandomResponse(request);
}

export const GET = withErrorHandler(
  withSecurity({
    rateLimit: 'public',
    allowedMethods: ['GET'],
    enableAccessLog: true
  })(handleRandomResponse)
);

