import { NextRequest } from 'next/server';
import { withSecurity } from '@/lib/security';
import { withErrorHandler } from '@/lib/error-handler';
import { serveRandomResponse } from '@/app/api/random/response/service';
import { AppError, ErrorType } from '@/types/errors';

export const dynamic = 'force-dynamic';

async function handleImageRequest(
  request: NextRequest,
  context: { params: { filename?: string } }
): Promise<Response> {
  const filename = context.params.filename;

  if (!filename) {
    throw new AppError(ErrorType.VALIDATION_ERROR, '缺少图片标识', 400);
  }

  const match = filename.match(/^([^.]+)(?:\.(?:[a-zA-Z0-9]+))?$/);
  if (!match) {
    throw new AppError(ErrorType.VALIDATION_ERROR, '图片地址格式无效', 400);
  }

  const imageId = match[1];
  return serveRandomResponse(request, { imageId });
}

export const GET = withErrorHandler(
  withSecurity({
    rateLimit: 'public',
    allowedMethods: ['GET'],
    enableAccessLog: true
  })(handleImageRequest)
);

