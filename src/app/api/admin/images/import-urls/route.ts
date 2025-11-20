/**
 * 批量URL导入API端点
 * POST /api/admin/images/import-urls - 批量导入外部图片URL（自定义图床）
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth';
import { withSecurity } from '@/lib/security';
import { withErrorHandler } from '@/lib/error-handler';
import { AppError, ErrorType } from '@/types/errors';
import { databaseService } from '@/lib/database';
import { StorageProvider } from '@/lib/storage/base';
import { StorageDatabaseService } from '@/lib/database/storage';
import { logger } from '@/lib/logger';
import {
  ImageUrlImportRequestSchema,
  ImportUrlItemSchema,
} from '@/types/schemas';
import {
  APIResponse,
  ImageUrlImportResponse,
} from '@/types/api';

const storageDatabaseService = new StorageDatabaseService();

interface ParsedImportItem {
  url: string;
  title?: string;
  description?: string;
  tags?: string[];
}

function parseTxtContent(content: string): ParsedImportItem[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((url) => ({ url }));
}

function parseJsonContent(content: string): ParsedImportItem[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      `JSON解析失败: ${error instanceof Error ? error.message : '未知错误'}`,
      400,
    );
  }

  // 兼容 { items: [...] } 和直接数组两种格式
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const maybeItems = (parsed as any).items;
    if (Array.isArray(maybeItems)) {
      parsed = maybeItems;
    }
  }

  if (!Array.isArray(parsed)) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      'JSON内容必须是URL字符串数组或包含url字段的对象数组',
      400,
    );
  }

  const items: ParsedImportItem[] = [];

  for (const entry of parsed) {
    if (typeof entry === 'string') {
      items.push({ url: entry });
    } else if (entry && typeof entry === 'object') {
      const { url, title, description, tags } = entry as any;
      items.push({ url, title, description, tags });
    }
  }

  return items;
}

function deriveFilenameAndFormat(url: string): { filename: string; format: string } {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname || '';
    const segments = pathname.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1] || urlObj.hostname || 'image';

    const dotIndex = lastSegment.lastIndexOf('.');
    if (dotIndex > 0 && dotIndex < lastSegment.length - 1) {
      const filename = lastSegment;
      const format = lastSegment.substring(dotIndex + 1).toLowerCase();
      return { filename, format };
    }

    return { filename: lastSegment, format: 'unknown' };
  } catch {
    return { filename: 'image', format: 'unknown' };
  }
}

async function importUrls(request: NextRequest): Promise<Response> {
  const body = await request.json();

  const parsedRequest = ImageUrlImportRequestSchema.parse(body);

  // 仅允许自定义图床
  if (parsedRequest.provider !== StorageProvider.CUSTOM) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      '当前端点仅支持 provider = "custom"',
      400,
    );
  }

  // 如果指定了分组，验证分组是否存在
  if (parsedRequest.groupId) {
    const group = await databaseService.getGroup(parsedRequest.groupId);
    if (!group) {
      throw new AppError(
        ErrorType.VALIDATION_ERROR,
        `分组 ${parsedRequest.groupId} 不存在`,
        400,
      );
    }
  }

  let rawItems: ParsedImportItem[] = [];

  if (parsedRequest.mode === 'items') {
    rawItems = parsedRequest.items || [];
  } else if (parsedRequest.mode === 'txt') {
    rawItems = parseTxtContent(parsedRequest.content || '');
  } else if (parsedRequest.mode === 'json') {
    rawItems = parseJsonContent(parsedRequest.content || '');
  }

  if (!rawItems.length) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      '未解析到任何有效的URL',
      400,
    );
  }

  const errors: ImageUrlImportResponse['errors'] = [];
  let successCount = 0;

  for (let index = 0; index < rawItems.length; index++) {
    const rawItem = rawItems[index];

    const validationResult = ImportUrlItemSchema.safeParse(rawItem);
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      errors.push({
        index,
        url: rawItem?.url || '',
        reason: firstError?.message || '数据验证失败',
      });
      continue;
    }

    const item = validationResult.data;

    try {
      const { filename, format } = deriveFilenameAndFormat(item.url);

      const publicId = item.url;

      await storageDatabaseService.saveImageWithStorage({
        publicId,
        url: item.url,
        title: item.title,
        description: item.description,
        groupId: parsedRequest.groupId || undefined,
        tags: item.tags,
        primaryProvider: StorageProvider.CUSTOM,
        backupProvider: undefined,
        storageResults: [
          {
            provider: StorageProvider.CUSTOM,
            result: {
              id: publicId,
              publicId,
              url: item.url,
              secureUrl: item.url,
              filename,
              format,
              width: undefined,
              height: undefined,
              bytes: 0,
              metadata: {
                source: 'external-url',
              },
            },
          },
        ],
      });

      successCount += 1;
    } catch (error) {
      logger.error(
        '导入URL失败',
        error instanceof Error ? error : new Error(String(error)),
        { url: item.url },
      );

      errors.push({
        index,
        url: item.url,
        reason: error instanceof Error ? error.message : '未知错误',
      });
    }
  }

  const response: APIResponse<ImageUrlImportResponse> = {
    success: true,
    data: {
      total: rawItems.length,
      success: successCount,
      failed: errors.length,
      errors: errors.slice(0, 50),
    },
    timestamp: new Date(),
  };

  return NextResponse.json(response);
}

export const POST = withErrorHandler(
  withSecurity({
    rateLimit: 'upload',
    allowedMethods: ['POST'],
    allowedContentTypes: ['application/json'],
    maxRequestSize: 1024 * 1024, // 1MB 文本足够
  })(withAdminAuth(importUrls)),
);

