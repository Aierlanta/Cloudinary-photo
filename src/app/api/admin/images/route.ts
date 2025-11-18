/**
 * 图片管理API端点
 * GET /api/admin/images - 获取图片列表（支持分页和日期筛选）
 * POST /api/admin/images - 上传新图片
 */

import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '@/lib/database';
import { CloudinaryService } from '@/lib/cloudinary';
import { withAdminAuth } from '@/lib/auth';
import { withSecurity } from '@/lib/security';
import { withErrorHandler } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import { AppError, ErrorType } from '@/types/errors';
import { StorageProvider } from '@/lib/storage/base';
import { storageServiceManager } from '@/lib/storage/factory';
import { StorageDatabaseService } from '@/lib/database/storage';
import { applyProxyToImageUrls, applyProxyToImageUrl } from '@/lib/image-utils';
import {
  ImageListRequestSchema,
  ImageUploadRequestSchema,
  FileValidationSchema,
  BulkDeleteRequestSchema,
  BulkUpdateRequestSchema
} from '@/types/schemas';
import {
  APIResponse,
  ImageListResponse,
  ImageUploadResponse
} from '@/types/api';
import {
  getEnabledProviders,
  isStorageEnabled,
  isProviderInEnabledList
} from '@/lib/storage';

// 强制动态渲染
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/images
 * 获取图片列表，支持分页和筛选
 */
async function getImages(request: NextRequest): Promise<Response> {
  // 解析查询参数
  const url = new URL(request.url);
  const searchParams = Object.fromEntries(url.searchParams.entries());

  // 验证请求参数
  const validatedParams = ImageListRequestSchema.parse(searchParams);

  // 获取图片列表
  const images = await databaseService.getImages({
    page: validatedParams.page,
    limit: validatedParams.limit,
    groupId: validatedParams.groupId,
    provider: validatedParams.provider, // 新增：图床筛选
    search: validatedParams.search,
    dateFrom: validatedParams.dateFrom,
    dateTo: validatedParams.dateTo,
    sortBy: validatedParams.sortBy,
    sortOrder: validatedParams.sortOrder
  });

  // 应用代理URL转换（如果配置了 tgState 代理）
  const imagesWithProxy = {
    ...images,
    data: applyProxyToImageUrls(images.data)
  };

  const response: APIResponse<ImageListResponse> = {
    success: true,
    data: { images: imagesWithProxy },
    timestamp: new Date()
  };

  return NextResponse.json(response);
}

// 应用安全中间件、认证和错误处理
export const GET = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['GET'],
    enableAccessLog: true
  })(withAdminAuth(getImages))
);

/**
 * POST /api/admin/images
 * 上传新图片（支持图床选择）
 */
async function uploadImage(request: NextRequest): Promise<Response> {
  // 解析表单数据
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const provider = formData.get('provider') as string | null; // 新增：图床选择
  const groupId = formData.get('groupId') as string | null;
  const title = formData.get('title') as string | null;
  const description = formData.get('description') as string | null;
  const tagsString = formData.get('tags') as string | null;

  // 验证文件
  if (!file) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      '请选择要上传的图片文件',
      400
    );
  }

  // 验证文件类型和大小
  const fileValidation = FileValidationSchema.parse({
    name: file.name,
    size: file.size,
    type: file.type
  });

  // 解析标签
  let tags: string[] = [];
  if (tagsString) {
    try {
      tags = JSON.parse(tagsString);
    } catch {
      tags = tagsString.split(',').map(tag => tag.trim()).filter(Boolean);
    }
  }

  // 验证上传参数
  const uploadParams = ImageUploadRequestSchema.parse({
    groupId: groupId || undefined,
    title: title || undefined,
    description: description || undefined,
    tags
  });

  // 如果指定了分组，验证分组是否存在
  if (uploadParams.groupId) {
    const group = await databaseService.getGroup(uploadParams.groupId);
    if (!group) {
      throw new AppError(
        ErrorType.VALIDATION_ERROR,
        `分组 ${uploadParams.groupId} 不存在`,
        400
      );
    }
  }

  // ✅ 修复问题 #3：提前检查空数组，避免越界访问
  const enabledProviders = getEnabledProviders();
  if (enabledProviders.length === 0) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      '未启用任何图床服务，请先在环境变量中开启',
      503
    );
  }

  // 按启用开关确定使用的图床服务
  const defaultProvider = enabledProviders[0];
  const defaultProviderString = defaultProvider ? defaultProvider.toString() : undefined;
  const selectedProviderString = (provider as string | undefined) ?? defaultProviderString;
  
  if (!selectedProviderString) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      '未启用任何图床服务，请先在环境变量中开启',
      503
    );
  }

  // 验证图床提供商（仅允许已启用的）
  if (!isProviderInEnabledList(selectedProviderString)) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      `图床服务 ${selectedProviderString} 未启用`,
      400
    );
  }

  let image;

  if (selectedProviderString === 'cloudinary') {
    // 使用原有的Cloudinary逻辑（向后兼容）
    const cloudinaryService = CloudinaryService.getInstance();
    const cloudinaryResult = await cloudinaryService.uploadImage(file, {
      folder: 'random-images',
      tags: uploadParams.tags
    });

    // 保存到数据库
    image = await databaseService.saveImage({
      publicId: cloudinaryResult.public_id,
      url: cloudinaryResult.url,
      title: uploadParams.title,
      description: uploadParams.description,
      groupId: uploadParams.groupId,
      tags: uploadParams.tags || []
    });
  } else {
    // 使用新的多图床架构
    const storageDatabaseService = new StorageDatabaseService();
    const storageService = storageServiceManager.getService(selectedProviderString as StorageProvider);

    let savedImage;

    try {
      console.log(`[上传] 开始上传到 ${selectedProviderString}, 文件: ${file.name}`);

      const uploadResult = await storageService.uploadImage(file, {
        folder: 'random-image-api',
        tags: uploadParams.tags,
        title: uploadParams.title,
        description: uploadParams.description,
        groupId: uploadParams.groupId
      });

      console.log(`[上传] ${selectedProviderString} 上传成功:`, {
        publicId: uploadResult.publicId,
        url: uploadResult.url?.substring(0, 100)
      });

      // 保存到数据库
      console.log(`[上传] 开始保存到数据库...`);

      savedImage = await storageDatabaseService.saveImageWithStorage({
        publicId: uploadResult.publicId,
        url: uploadResult.url,
        title: uploadParams.title,
        description: uploadParams.description,
        groupId: uploadParams.groupId,
        tags: uploadParams.tags,
        primaryProvider: selectedProviderString as StorageProvider,
        backupProvider: undefined,
        storageResults: [{
          provider: selectedProviderString as StorageProvider,
          result: uploadResult
        }]
      });

      console.log(`[上传] 数据库保存成功: ${savedImage.id}`);

    } catch (error) {
      console.error(`[上传错误] 文件: ${file.name}, Provider: ${selectedProviderString}`, error);
      throw error;
    }

    // 转换为兼容格式
    image = {
      id: savedImage.id,
      url: savedImage.url,
      publicId: savedImage.publicId,
      title: savedImage.title,
      description: savedImage.description,
      tags: savedImage.tags ? JSON.parse(savedImage.tags) : [],
      groupId: savedImage.groupId,
      uploadedAt: savedImage.uploadedAt
    };
    
    // 应用代理URL转换（如果配置了 tgState 代理）
    image = applyProxyToImageUrl(image);
  }

  const response: APIResponse<ImageUploadResponse> = {
    success: true,
    data: {
      image,
      message: `图片已成功上传到 ${selectedProviderString} 图床`
    },
    timestamp: new Date()
  };

  return NextResponse.json(response, { status: 201 });
}

// 应用安全中间件、认证和错误处理
export const POST = withErrorHandler(
  withSecurity({
    rateLimit: 'upload',
    allowedMethods: ['POST'],
    allowedContentTypes: ['multipart/form-data'],
    maxRequestSize: 10 * 1024 * 1024 // 10MB
  })(withAdminAuth(uploadImage))
);

/**
 * DELETE /api/admin/images
 * 批量删除图片
 */
async function bulkDeleteImages(request: NextRequest): Promise<Response> {
  const body = await request.json();

  // 验证请求参数
  const validatedParams = BulkDeleteRequestSchema.parse(body);

  const deletedIds: string[] = [];
  const failedIds: string[] = [];

  // 逐个删除图片
  for (const imageId of validatedParams.imageIds) {
    try {
      // 获取图片信息
      const image = await databaseService.getImage(imageId);
      if (!image) {
        failedIds.push(imageId);
        continue;
      }

      try {
        // 从Cloudinary删除图片（仅在启用且配置完成时尝试）
        if (isStorageEnabled(StorageProvider.CLOUDINARY)) {
          const cloudinaryService = CloudinaryService.getInstance();
          await cloudinaryService.deleteImage(image.publicId);
        }
      } catch (error) {
        console.warn(`从Cloudinary删除图片 ${imageId} 失败，继续删除数据库记录:`, error);
      }

      // 从数据库删除图片记录
      await databaseService.deleteImage(imageId);
      deletedIds.push(imageId);

    } catch (error) {
      console.error(`删除图片 ${imageId} 失败:`, error);
      failedIds.push(imageId);
    }
  }

  const response: APIResponse = {
    success: true,
    data: {
      message: `成功删除 ${deletedIds.length} 张图片${failedIds.length > 0 ? `，${failedIds.length} 张删除失败` : ''}`,
      deletedIds,
      failedIds,
      deletedCount: deletedIds.length,
      failedCount: failedIds.length
    },
    timestamp: new Date()
  };

  return NextResponse.json(response);
}

// 应用安全中间件、认证和错误处理
export const DELETE = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['DELETE']
  })(withAdminAuth(bulkDeleteImages))
);

/**
 * PATCH /api/admin/images
 * 批量更新图片信息
 */
async function bulkUpdateImages(request: NextRequest): Promise<Response> {
  const body = await request.json();

  // 验证请求参数
  const validatedParams = BulkUpdateRequestSchema.parse(body);
  const { imageIds, updates } = validatedParams;

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

  // 使用优化的批量更新方法
  const { updatedIds, failedIds } = await databaseService.bulkUpdateImages(imageIds, updates);

  const response: APIResponse = {
    success: true,
    data: {
      message: `成功更新 ${updatedIds.length} 张图片${failedIds.length > 0 ? `，${failedIds.length} 张更新失败` : ''}`,
      updatedIds,
      failedIds,
      updatedCount: updatedIds.length,
      failedCount: failedIds.length
    },
    timestamp: new Date()
  };

  return NextResponse.json(response);
}

// 应用安全中间件、认证和错误处理
export const PATCH = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['PATCH']
  })(withAdminAuth(bulkUpdateImages))
);