/**
 * 单个分组管理API端点
 * PUT /api/admin/groups/[id] - 更新分组信息
 * DELETE /api/admin/groups/[id] - 删除分组
 */

import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '@/lib/database';
import { verifyAdminAuth } from '@/lib/auth';
import { withSecurity } from '@/lib/security';
import { AppError, ErrorType } from '@/types/errors';
import { IdSchema, GroupUpdateRequestSchema } from '@/types/schemas';
import {
  APIResponse,
  GroupResponse,
  GroupDeleteResponse
} from '@/types/api';

// 强制动态渲染
export const dynamic = 'force-dynamic'

/**
 * PUT /api/admin/groups/[id]
 * 更新分组信息
 */
async function updateGroupHandler(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  try {
    // 验证管理员权限
    verifyAdminAuth(request);
    
    // 验证分组ID
    const groupId = IdSchema.parse(params.id);
    
    // 解析请求体
    const body = await request.json();
    
    // 验证请求参数
    const validatedData = GroupUpdateRequestSchema.parse(body);
    
    // 检查分组是否存在
    const existingGroup = await databaseService.getGroup(groupId);
    if (!existingGroup) {
      throw new AppError(
        ErrorType.NOT_FOUND,
        `分组 ${groupId} 不存在`,
        404
      );
    }
    
    // 如果要更新名称，检查新名称是否已被其他分组使用
    if (validatedData.name) {
      const normalizedNewName = validatedData.name.trim().toLowerCase();
      const normalizedExistingName = existingGroup.name.trim().toLowerCase();
      if (normalizedNewName !== normalizedExistingName) {
      const allGroups = await databaseService.getGroups();
      const nameExists = allGroups.some(group =>
        group.id !== groupId &&
        group.name.trim().toLowerCase() === normalizedNewName
      );
      
      if (nameExists) {
        throw new AppError(
          ErrorType.VALIDATION_ERROR,
          `分组名称 "${validatedData.name}" 已存在`,
          400
        );
      }
      }
    }
    
    // 更新分组
    const updatedGroup = await databaseService.updateGroup(groupId, validatedData);
    
    const response: APIResponse<GroupResponse> = {
      success: true,
      data: { group: updatedGroup },
      message: '分组更新成功',
      timestamp: new Date()
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('更新分组失败:', error);
    
    if (error instanceof AppError) {
      const response: APIResponse = {
        success: false,
        error: {
          type: error.type,
          message: error.message,
          details: error.details,
          timestamp: new Date()
        },
        timestamp: new Date()
      };
      
      return NextResponse.json(response, { status: error.statusCode });
    }
    
    const response: APIResponse = {
      success: false,
      error: {
        type: ErrorType.INTERNAL_ERROR,
        message: '更新分组时发生内部错误',
        timestamp: new Date()
      },
      timestamp: new Date()
    };
    
    return NextResponse.json(response, { status: 500 });
  }
}

export const PUT = withSecurity({
  rateLimit: 'admin',
  allowedMethods: ['PUT'],
  allowedContentTypes: ['application/json'],
  maxRequestSize: 1024 * 1024 // 1MB
})(updateGroupHandler);

/**
 * DELETE /api/admin/groups/[id]
 * 删除分组
 */
async function deleteGroupHandler(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  try {
    // 验证管理员权限
    verifyAdminAuth(request);
    
    // 验证分组ID
    const groupId = IdSchema.parse(params.id);
    
    // 检查分组是否存在
    const existingGroup = await databaseService.getGroup(groupId);
    if (!existingGroup) {
      throw new AppError(
        ErrorType.NOT_FOUND,
        `分组 ${groupId} 不存在`,
        404
      );
    }
    
    // 获取分组中的图片数量
    const affectedImages = existingGroup.imageCount;
    
    // 删除分组（这会自动处理分组中的图片）
    await databaseService.deleteGroup(groupId);
    
    const response: APIResponse<GroupDeleteResponse> = {
      success: true,
      data: {
        message: '分组删除成功',
        deletedId: groupId,
        affectedImages
      },
      timestamp: new Date()
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('删除分组失败:', error);
    
    if (error instanceof AppError) {
      const response: APIResponse = {
        success: false,
        error: {
          type: error.type,
          message: error.message,
          details: error.details,
          timestamp: new Date()
        },
        timestamp: new Date()
      };
      
      return NextResponse.json(response, { status: error.statusCode });
    }
    
    const response: APIResponse = {
      success: false,
      error: {
        type: ErrorType.INTERNAL_ERROR,
        message: '删除分组时发生内部错误',
        timestamp: new Date()
      },
      timestamp: new Date()
    };
    
    return NextResponse.json(response, { status: 500 });
  }
}

export const DELETE = withSecurity({
  rateLimit: 'admin',
  allowedMethods: ['DELETE']
})(deleteGroupHandler);