/**
 * 指定图床上传API端点
 * POST /api/admin/images/upload-to-provider - 上传图片到指定的图床服务
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth';
import { withSecurity } from '@/lib/security';
import { withErrorHandler } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import { AppError, ErrorType } from '@/types/errors';
import {
  ImageUploadRequestSchema,
  FileValidationSchema
} from '@/types/schemas';
import {
  APIResponse,
  ImageUploadResponse
} from '@/types/api';
import { StorageProvider } from '@/lib/storage/base';
import { storageServiceManager } from '@/lib/storage/factory';
import { StorageDatabaseService } from '@/lib/database/storage';
import { getEnabledProviders, isProviderInEnabledList } from '@/lib/storage';

const storageDatabaseService = new StorageDatabaseService();


/**
 * POST /api/admin/images/upload-to-provider
 * 上传图片到指定的图床服务
 */
async function uploadToProvider(request: NextRequest): Promise<Response> {
  // 解析表单数据
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const provider = formData.get('provider') as string;
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

  // 验证图床提供商
  if (!provider) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      '请选择图床服务提供商',
      400
    );
  }

  // ✅ 修复问题 #2 & #4：使用统一配置模块验证提供商
  const supportedProviders = getEnabledProviders();

  if (supportedProviders.length === 0) {
    throw new AppError(
      ErrorType.INTERNAL_ERROR,
      '未启用任何图床服务，请先在环境变量中开启',
      503
    );
  }

  if (!isProviderInEnabledList(provider)) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      `图床服务 ${provider} 未启用或不受支持`,
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

  logger.info('开始上传到指定图床', {
    filename: file.name,
    size: file.size,
    type: file.type,
    provider,
    params: uploadParams
  });

  try {
    // 获取指定的图床服务
    const storageService = storageServiceManager.getService(provider as StorageProvider);

    // 上传到指定图床
    const uploadResult = await storageService.uploadImage(file, {
      folder: 'random-image-api',
      tags: uploadParams.tags,
      title: uploadParams.title,
      description: uploadParams.description,
      groupId: uploadParams.groupId
    });

    // 保存到数据库
    const savedImage = await storageDatabaseService.saveImageWithStorage({
      publicId: uploadResult.publicId,
      url: uploadResult.url,
      title: uploadParams.title,
      description: uploadParams.description,
      groupId: uploadParams.groupId,
      tags: uploadParams.tags,
      primaryProvider: provider as StorageProvider,
      backupProvider: undefined, // 单一图床上传不设置备用
      storageResults: [{
        provider: provider as StorageProvider,
        result: uploadResult
      }]
    });

    logger.info('指定图床上传成功', {
      imageId: savedImage.id,
      provider,
      url: uploadResult.url
    });

    const response: APIResponse<ImageUploadResponse> = {
      success: true,
      data: {
        image: {
          id: savedImage.id,
          url: savedImage.url,
          publicId: savedImage.publicId,
          title: savedImage.title,
          description: savedImage.description,
          tags: savedImage.tags ? JSON.parse(savedImage.tags) : [],
          groupId: savedImage.groupId,
          uploadedAt: savedImage.uploadedAt,
          primaryProvider: savedImage.primaryProvider,
          backupProvider: savedImage.backupProvider
        },
        message: `图片已成功上传到 ${provider} 图床`
      },
      timestamp: new Date()
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    logger.error('指定图床上传失败', error instanceof Error ? error : new Error(String(error)), {
      provider,
      filename: file.name
    });

    throw new AppError(
      ErrorType.UPLOAD_ERROR,
      `上传到 ${provider} 图床失败: ${error instanceof Error ? error.message : '未知错误'}`,
      500,
      { provider, filename: file.name }
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
  })(withAdminAuth(uploadToProvider))
);
