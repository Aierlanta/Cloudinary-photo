/**
 * 多图床图片管理API端点
 * POST /api/admin/images/multi-storage - 使用多图床上传图片
 * GET /api/admin/images/multi-storage - 获取多图床图片列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth';
import { withSecurity } from '@/lib/security';
import { withErrorHandler } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import { AppError, ErrorType } from '@/types/errors';
import { StorageProvider } from '@/lib/storage/base';
import { getDefaultStorageManager, validateAtLeastOneEnabled } from '@/lib/storage';
import { storageDatabaseService } from '@/lib/database/storage';
import { applyProxyToImageUrl } from '@/lib/image-utils';
import {
  ImageUploadRequestSchema,
  FileValidationSchema
} from '@/types/schemas';
import {
  APIResponse,
  ImageUploadResponse
} from '@/types/api';

// 强制动态渲染
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/images/multi-storage
 * 使用多图床上传图片
 */
async function uploadImageMultiStorage(request: NextRequest): Promise<Response> {
  try {
    // 解析表单数据
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const groupId = formData.get('groupId') as string;
    const tags = formData.get('tags') as string;

    // 验证文件
    if (!file) {
      throw new AppError(
        ErrorType.VALIDATION_ERROR,
        '请选择要上传的文件',
        400,
        { field: 'file' }
      );
    }

    // 验证文件格式和大小
    FileValidationSchema.parse({
      name: file.name,
      size: file.size,
      type: file.type
    });

    // 验证上传参数
    const uploadParams = ImageUploadRequestSchema.parse({
      title: title || undefined,
      description: description || undefined,
      groupId: groupId || undefined,
      tags: tags ? tags.split(',').map(tag => tag.trim()).filter(Boolean) : undefined
    });

    logger.info('开始多图床上传', {
      filename: file.name,
      size: file.size,
      type: file.type,
      params: uploadParams
    });

    // ✅ 修复问题 #1：使用统一配置模块验证
    // 注意：getDefaultStorageManager() 内部已有验证，此处为双重保险
    try {
      validateAtLeastOneEnabled();
    } catch (error) {
      throw new AppError(
        ErrorType.INTERNAL_ERROR,
        '未启用任何图床服务，请先在环境变量中开启',
        503,
        { originalError: error }
      );
    }

    // 获取多图床管理器
    const storageManager = getDefaultStorageManager();

    // 上传到多图床
    const uploadResult = await storageManager.uploadImage(file, {
      folder: 'random-image-api',
      tags: uploadParams.tags,
      title: uploadParams.title,
      description: uploadParams.description,
      groupId: uploadParams.groupId
    });

    if (!uploadResult.success) {
      throw new AppError(
        ErrorType.UPLOAD_ERROR,
        `多图床上传失败: ${uploadResult.error?.message || '未知错误'}`,
        500,
        {
          provider: uploadResult.provider,
          failedOver: uploadResult.failedOver,
          error: uploadResult.error
        }
      );
    }

    // 准备存储结果
    const storageResults: Array<{
      provider: StorageProvider;
      result: any;
    }> = [];

    if (uploadResult.primaryResult) {
      storageResults.push({
        provider: uploadResult.provider,
        result: uploadResult.primaryResult
      });
    }

    if (uploadResult.backupResult) {
      // 确定备用提供商
      const config = await storageDatabaseService.getStorageConfig();
      const backupProvider = config?.backupProvider || StorageProvider.TGSTATE;
      storageResults.push({
        provider: backupProvider,
        result: uploadResult.backupResult
      });
    }

    // 保存到数据库
    const savedImage = await storageDatabaseService.saveImageWithStorage({
      publicId: uploadResult.primaryResult?.publicId || uploadResult.backupResult?.publicId || '',
      url: uploadResult.primaryResult?.url || uploadResult.backupResult?.url || '',
      width: uploadResult.primaryResult?.width ?? uploadResult.backupResult?.width,
      height: uploadResult.primaryResult?.height ?? uploadResult.backupResult?.height,
      title: uploadParams.title,
      description: uploadParams.description,
      groupId: uploadParams.groupId,
      tags: uploadParams.tags,
      primaryProvider: uploadResult.provider,
      backupProvider: uploadResult.backupResult ?
        (await storageDatabaseService.getStorageConfig())?.backupProvider : undefined,
      storageResults
    });

    logger.info('多图床上传成功', {
      imageId: savedImage.id,
      provider: uploadResult.provider,
      failedOver: uploadResult.failedOver,
      hasBackup: !!uploadResult.backupResult,
      uploadTime: uploadResult.metadata?.uploadTime
    });

    // 应用代理URL转换（如果配置了 tgState 代理）
    const imageWithProxy = applyProxyToImageUrl({
      id: savedImage.id,
      url: savedImage.url,
      publicId: savedImage.publicId,
      title: savedImage.title,
      description: savedImage.description,
      tags: savedImage.tags ? JSON.parse(savedImage.tags) : [],
      groupId: savedImage.groupId,
      uploadedAt: savedImage.uploadedAt,
      // 多图床特有字段
      primaryProvider: savedImage.primaryProvider,
      backupProvider: savedImage.backupProvider
    });

    const response: APIResponse<ImageUploadResponse> = {
      success: true,
      data: {
        image: imageWithProxy,
        message: `图片上传成功${uploadResult.failedOver ? ' (已故障转移)' : ''}`
      },
      timestamp: new Date()
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    logger.error('多图床上传失败', error instanceof Error ? error : new Error(String(error)));

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      ErrorType.INTERNAL_ERROR,
      `上传过程中发生错误: ${error instanceof Error ? error.message : '未知错误'}`,
      500,
      { error }
    );
  }
}

/**
 * GET /api/admin/images/multi-storage
 * 获取多图床图片列表
 */
async function getImagesMultiStorage(request: NextRequest): Promise<Response> {
  try {
    // 解析查询参数
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const groupId = url.searchParams.get('groupId') || undefined;
    const provider = url.searchParams.get('provider') as StorageProvider || undefined;

    // 获取图片列表
    const result = await storageDatabaseService.getImagesWithStorage({
      page,
      limit,
      groupId,
      provider
    });

    // 获取存储统计信息
    const stats = await storageDatabaseService.getStorageStats();

    const response: APIResponse<any> = {
      success: true,
      data: {
        images: result.images.map(image => ({
          id: image.id,
          url: image.url,
        publicId: image.publicId,
        title: image.title,
        description: image.description,
        tags: image.tags ? JSON.parse(image.tags) : [],
        width: image.width || undefined,
        height: image.height || undefined,
        orientation: image.orientation || undefined,
        groupId: image.groupId,
        uploadedAt: image.uploadedAt,
        primaryProvider: image.primaryProvider,
        backupProvider: image.backupProvider,
        storageRecords: image.storageRecords.map(record => ({
            provider: record.provider,
            url: record.url,
            status: record.status,
            createdAt: record.createdAt
          }))
        })),
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / result.limit)
        },
        stats
      },
      timestamp: new Date()
    };

    return NextResponse.json(response);

  } catch (error) {
    logger.error('获取多图床图片列表失败', error instanceof Error ? error : new Error(String(error)));

    throw new AppError(
      ErrorType.INTERNAL_ERROR,
      `获取图片列表失败: ${error instanceof Error ? error.message : '未知错误'}`,
      500,
      { error }
    );
  }
}

// 应用安全中间件、认证和错误处理
export const POST = withErrorHandler(
  withSecurity({
    rateLimit: 'upload',
    allowedMethods: ['POST'],
    allowedContentTypes: ['multipart/form-data'],
    maxRequestSize: 10 * 1024 * 1024 // 10MB
  })(withAdminAuth(uploadImageMultiStorage))
);

export const GET = withErrorHandler(
  withSecurity({
    rateLimit: 'api',
    allowedMethods: ['GET']
  })(withAdminAuth(getImagesMultiStorage))
);
