import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminAuth } from '@/lib/auth';
import { withSecurity } from '@/lib/security';
import { withErrorHandler } from '@/lib/error-handler';
import { APIResponse } from '@/types/api';
import { AppError, ErrorType } from '@/types/errors';
import {
  createIPWhitelistEntry,
  deleteIPWhitelistEntry,
  getRiskControlSnapshot,
  updateIPWhitelistEntry,
  updateSecurityConfig
} from '@/lib/risk-control';
import type { IPWhitelistEntry, SecurityConfig } from '@/types/models';

export const dynamic = 'force-dynamic';

const SecurityConfigUpdateSchema = z.object({
  guardEnabled: z.boolean().optional(),
  guardAutoEnabled: z.boolean().optional(),
  guardTriggerWindowMinutes: z.number().int().min(1).max(1440).optional(),
  guardTriggerUniqueIpThreshold: z.number().int().min(1).max(100000).optional(),
  whitelistOnlyEnabled: z.boolean().optional()
}).refine((data) => Object.keys(data).length > 0, {
  message: '至少需要提供一个风控配置字段'
});

const WhitelistCreateSchema = z.object({
  cidr: z.string().min(1),
  note: z.string().optional().nullable(),
  isEnabled: z.boolean().optional()
});

const WhitelistUpdateSchema = z.object({
  id: z.string().min(1),
  cidr: z.string().min(1).optional(),
  note: z.string().optional().nullable(),
  isEnabled: z.boolean().optional()
}).refine((data) => ['cidr', 'note', 'isEnabled'].some((key) => key in data), {
  message: '至少需要提供一个白名单更新字段'
});

const WhitelistDeleteSchema = z.object({
  id: z.string().min(1)
});

function parseRequestBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (result.success) {
    return result.data;
  }

  const message = result.error.issues
    .map((issue) => issue.message)
    .filter(Boolean)
    .join('; ') || '请求参数无效';
  throw new AppError(
    ErrorType.VALIDATION_ERROR,
    message,
    400,
    { issues: result.error.issues }
  );
}

async function getRiskControl(_request: NextRequest): Promise<Response> {
  const snapshot = await getRiskControlSnapshot(true);
  const response: APIResponse<{
    config: SecurityConfig;
    whitelist: IPWhitelistEntry[];
  }> = {
    success: true,
    data: snapshot,
    timestamp: new Date()
  };
  return NextResponse.json(response);
}

async function putRiskControl(request: NextRequest): Promise<Response> {
  const body = await request.json();
  const data = parseRequestBody(SecurityConfigUpdateSchema, body);
  const config = await updateSecurityConfig(data);
  const response: APIResponse<{ config: SecurityConfig }> = {
    success: true,
    data: { config },
    timestamp: new Date()
  };
  return NextResponse.json(response);
}

async function postWhitelistEntry(request: NextRequest): Promise<Response> {
  const body = await request.json();
  const data = parseRequestBody(WhitelistCreateSchema, body);
  const entry = await createIPWhitelistEntry(data);
  const response: APIResponse<{ entry: IPWhitelistEntry }> = {
    success: true,
    data: { entry },
    timestamp: new Date()
  };
  return NextResponse.json(response, { status: 201 });
}

async function patchWhitelistEntry(request: NextRequest): Promise<Response> {
  const body = await request.json();
  const data = parseRequestBody(WhitelistUpdateSchema, body);
  const entry = await updateIPWhitelistEntry(data);
  const response: APIResponse<{ entry: IPWhitelistEntry }> = {
    success: true,
    data: { entry },
    timestamp: new Date()
  };
  return NextResponse.json(response);
}

async function deleteWhitelistEntry(request: NextRequest): Promise<Response> {
  const body = await request.json();
  const data = parseRequestBody(WhitelistDeleteSchema, body);
  await deleteIPWhitelistEntry(data.id);
  const response: APIResponse<{ id: string }> = {
    success: true,
    data: { id: data.id },
    timestamp: new Date()
  };
  return NextResponse.json(response);
}

export const GET = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['GET'],
    enableAccessLog: false
  })(withAdminAuth(getRiskControl))
);

export const PUT = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['PUT'],
    allowedContentTypes: ['application/json'],
    maxRequestSize: 1024 * 1024,
    enableAccessLog: false
  })(withAdminAuth(putRiskControl))
);

export const POST = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['POST'],
    allowedContentTypes: ['application/json'],
    maxRequestSize: 1024 * 1024,
    enableAccessLog: false
  })(withAdminAuth(postWhitelistEntry))
);

export const PATCH = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['PATCH'],
    allowedContentTypes: ['application/json'],
    maxRequestSize: 1024 * 1024,
    enableAccessLog: false
  })(withAdminAuth(patchWhitelistEntry))
);

export const DELETE = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['DELETE'],
    allowedContentTypes: ['application/json'],
    maxRequestSize: 1024 * 1024,
    enableAccessLog: false
  })(withAdminAuth(deleteWhitelistEntry))
);
