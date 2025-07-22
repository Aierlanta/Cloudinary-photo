/**
 * 单个图片管理API端点
 * DELETE /api/admin/images/[id] - 删除指定图片
 */

import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '@/lib/database';
import { CloudinaryService } from '@/lib/cloudinary';
import { verifyAdminAuth } from '@/lib/auth';
import { AppError, ErrorType } from '@/types/errors';
import { IdSchema, BulkUpdateRequestSchema } from '@/types/schemas';
import { APIResponse, ImageDeleteResponse } from '@/types/api';

// 强制动态渲染
export const dynamic = 'force-dynamic'

const cloudinaryService = CloudinaryService.getInstance();

/**
 * DELETE /api/admin/images/[id]
 * 删除指定图片
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    // 验证管理员权限
    verifyAdminAuth(request);
    
    // 验证图片ID
    const imageId = IdSchema.parse(params.id);
    
    // 获取图片信息
    const image = await databaseService.getImage(imageId);
    if (!image) {
      throw new AppError(
        ErrorType.NOT_FOUND,
        `图片 ${imageId} 不存在`,
        404
      );
    }
    
    // 根据存储提供商删除图片
    if (image.primaryProvider === 'cloudinary') {
      try {
        // 从Cloudinary删除图片
        await cloudinaryService.deleteImage(image.publicId);
        console.log('图片删除成功:', image.publicId);
      } catch (error) {
        console.warn('从Cloudinary删除图片失败，继续删除数据库记录:', error);
        // 即使Cloudinary删除失败，也继续删除数据库记录
      }
    } else if (image.primaryProvider === 'tgstate') {
      // tgState 图片不需要主动删除，只删除数据库记录
      console.log('tgState 图片，仅删除数据库记录:', image.publicId);
    } else {
      console.warn('未知的存储提供商:', image.primaryProvider);
    }
    
    // 从数据库删除图片记录
    await databaseService.deleteImage(imageId);
    
    const response: APIResponse<ImageDeleteResponse> = {
      success: true,
      data: {
        message: '图片删除成功',
        deletedId: imageId
      },
      timestamp: new Date()
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('删除图片失败:', error);
    
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
      
      const status = error.type === ErrorType.UNAUTHORIZED ? 401 : 
                    error.type === ErrorType.NOT_FOUND ? 404 :
                    error.type === ErrorType.VALIDATION_ERROR ? 400 : 500;
      
      return NextResponse.json(response, { status });
    }
    
    const response: APIResponse = {
      success: false,
      error: {
        type: ErrorType.INTERNAL_ERROR,
        message: '删除图片时发生内部错误',
        timestamp: new Date()
      },
      timestamp: new Date()
    };
    
    return NextResponse.json(response, { status: 500 });
  }
}

/**
 * PATCH /api/admin/images/[id]
 * 更新指定图片的信息
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    // 验证管理员权限
    verifyAdminAuth(request);

    // 验证图片ID
    const imageId = IdSchema.parse(params.id);

    // 解析请求体
    const body = await request.json();
    const updates = {
      groupId: body.groupId,
      tags: body.tags
    };

    // 获取图片信息
    const image = await databaseService.getImage(imageId);
    if (!image) {
      throw new AppError(
        ErrorType.NOT_FOUND,
        `图片 ${imageId} 不存在`,
        404
      );
    }

    // 如果指定了分组，验证分组是否存在
    if (updates.groupId) {
      const group = await databaseService.getGroup(updates.groupId);
      if (!group) {
        throw new AppError(
          ErrorType.VALIDATION_ERROR,
          `分组 ${updates.groupId} 不存在`,
          400
        );
      }
    }

    // 更新图片信息
    const updatedImage = await databaseService.updateImage(imageId, updates);

    const response: APIResponse = {
      success: true,
      data: {
        image: updatedImage,
        message: '图片更新成功'
      },
      timestamp: new Date()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('更新图片失败:', error);

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

      const status = error.type === ErrorType.UNAUTHORIZED ? 401 :
                    error.type === ErrorType.NOT_FOUND ? 404 :
                    error.type === ErrorType.VALIDATION_ERROR ? 400 : 500;

      return NextResponse.json(response, { status });
    }

    const response: APIResponse = {
      success: false,
      error: {
        type: ErrorType.INTERNAL_ERROR,
        message: '更新图片时发生内部错误',
        timestamp: new Date()
      },
      timestamp: new Date()
    };

    return NextResponse.json(response, { status: 500 });
  }
}