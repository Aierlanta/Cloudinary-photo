/**
 * 分组管理API端点
 * GET /api/admin/groups - 获取分组列表
 * POST /api/admin/groups - 创建新分组
 */

import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '@/lib/database';
import { withAdminAuth } from '@/lib/auth';
import { withSecurity } from '@/lib/security';
import { AppError, ErrorType } from '@/types/errors';
import { GroupCreateRequestSchema } from '@/types/schemas';
import {
  APIResponse,
  GroupListResponse,
  GroupResponse
} from '@/types/api';

// 强制动态渲染
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/groups
 * 获取所有分组列表
 */
async function getGroups(request: NextRequest): Promise<Response> {
  // 获取分组列表
  const groups = await databaseService.getGroups();
  
  const response: APIResponse<GroupListResponse> = {
    success: true,
    data: { groups },
    timestamp: new Date()
  };
  
  return NextResponse.json(response);
}

// 应用安全中间件和认证
export const GET = withSecurity({
  rateLimit: 'admin',
  allowedMethods: ['GET'],
  enableAccessLog: false
})(withAdminAuth(getGroups));

/**
 * POST /api/admin/groups
 * 创建新分组
 */
async function createGroup(request: NextRequest): Promise<Response> {
  // 解析请求体
  const body = await request.json();
  
  // 验证请求参数
  const validatedData = GroupCreateRequestSchema.parse(body);
  
  // 检查分组名称是否已存在
  const existingGroups = await databaseService.getGroups();
  const nameExists = existingGroups.some(group => 
    group.name.toLowerCase() === validatedData.name.toLowerCase()
  );
  
  if (nameExists) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      `分组名称 "${validatedData.name}" 已存在`,
      400
    );
  }
  
  // 创建分组
  const group = await databaseService.saveGroup({
    name: validatedData.name,
    description: validatedData.description || ''
  });
  
  const response: APIResponse<GroupResponse> = {
    success: true,
    data: { group },
    message: '分组创建成功',
    timestamp: new Date()
  };
  
  return NextResponse.json(response, { status: 201 });
}

// 应用安全中间件和认证
export const POST = withSecurity({
  rateLimit: 'admin',
  allowedMethods: ['POST'],
  allowedContentTypes: ['application/json'],
  maxRequestSize: 1024 * 1024 // 1MB
})(withAdminAuth(createGroup));