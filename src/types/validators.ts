/**
 * 类型验证工具函数
 * 提供数据验证、转换和类型守卫功能
 */

import { z } from 'zod';
import {
  ImageSchema,
  GroupSchema,
  APIConfigSchema,
  PaginationOptionsSchema,
  ImageUploadRequestSchema,
  ImageListRequestSchema,
  GroupCreateRequestSchema,
  GroupUpdateRequestSchema,
  APIConfigUpdateRequestSchema,
  AdminLoginRequestSchema,
  FileValidationSchema,
  EnvSchema
} from './schemas';
import { ValidationError, ValidationErrorDetail } from './errors';

/**
 * 通用验证函数
 * @param schema Zod验证模式
 * @param data 要验证的数据
 * @returns 验证后的数据
 * @throws ValidationError 验证失败时抛出
 */
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationErrors: ValidationErrorDetail[] = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        value: err.code === 'invalid_type' ? undefined : (err as any).received
      }));
      
      throw new ValidationError('数据验证失败', validationErrors);
    }
    throw error;
  }
}

/**
 * 安全验证函数，返回结果而不抛出异常
 * @param schema Zod验证模式
 * @param data 要验证的数据
 * @returns 验证结果
 */
export function safeValidateData<T>(
  schema: z.ZodSchema<T>, 
  data: unknown
): { success: true; data: T } | { success: false; errors: ValidationErrorDetail[] } {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationErrors: ValidationErrorDetail[] = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        value: err.code === 'invalid_type' ? undefined : (err as any).received
      }));
      
      return { success: false, errors: validationErrors };
    }
    return { 
      success: false, 
      errors: [{ field: 'unknown', message: '未知验证错误' }] 
    };
  }
}

// 具体的验证函数

export const validateImage = (data: unknown) => validateData(ImageSchema, data);
export const validateGroup = (data: unknown) => validateData(GroupSchema, data);
export const validateAPIConfig = (data: unknown) => validateData(APIConfigSchema, data);
export const validatePaginationOptions = (data: unknown) => validateData(PaginationOptionsSchema, data);
export const validateImageUploadRequest = (data: unknown) => validateData(ImageUploadRequestSchema, data);
export const validateImageListRequest = (data: unknown) => validateData(ImageListRequestSchema, data);
export const validateGroupCreateRequest = (data: unknown) => validateData(GroupCreateRequestSchema, data);
export const validateGroupUpdateRequest = (data: unknown) => validateData(GroupUpdateRequestSchema, data);
export const validateAPIConfigUpdateRequest = (data: unknown) => validateData(APIConfigUpdateRequestSchema, data);
export const validateAdminLoginRequest = (data: unknown) => validateData(AdminLoginRequestSchema, data);
export const validateFileUpload = (data: unknown) => validateData(FileValidationSchema, data);
export const validateEnv = (data: unknown) => validateData(EnvSchema, data);

// 安全验证函数

export const safeValidateImage = (data: unknown) => safeValidateData(ImageSchema, data);
export const safeValidateGroup = (data: unknown) => safeValidateData(GroupSchema, data);
export const safeValidateAPIConfig = (data: unknown) => safeValidateData(APIConfigSchema, data);
export const safeValidatePaginationOptions = (data: unknown) => safeValidateData(PaginationOptionsSchema, data);
export const safeValidateImageUploadRequest = (data: unknown) => safeValidateData(ImageUploadRequestSchema, data);
export const safeValidateImageListRequest = (data: unknown) => safeValidateData(ImageListRequestSchema, data);
export const safeValidateGroupCreateRequest = (data: unknown) => safeValidateData(GroupCreateRequestSchema, data);
export const safeValidateGroupUpdateRequest = (data: unknown) => safeValidateData(GroupUpdateRequestSchema, data);
export const safeValidateAPIConfigUpdateRequest = (data: unknown) => safeValidateData(APIConfigUpdateRequestSchema, data);
export const safeValidateAdminLoginRequest = (data: unknown) => safeValidateData(AdminLoginRequestSchema, data);
export const safeValidateFileUpload = (data: unknown) => safeValidateData(FileValidationSchema, data);
export const safeValidateEnv = (data: unknown) => safeValidateData(EnvSchema, data);

/**
 * 类型守卫函数
 */

export function isImage(obj: any): obj is z.infer<typeof ImageSchema> {
  return safeValidateImage(obj).success;
}

export function isGroup(obj: any): obj is z.infer<typeof GroupSchema> {
  return safeValidateGroup(obj).success;
}

export function isAPIConfig(obj: any): obj is z.infer<typeof APIConfigSchema> {
  return safeValidateAPIConfig(obj).success;
}

/**
 * 数据转换工具函数
 */

/**
 * 将字符串日期转换为Date对象
 */
export function parseDate(dateStr: string | Date): Date {
  if (dateStr instanceof Date) {
    return dateStr;
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new ValidationError('无效的日期格式', [
      { field: 'date', message: '日期格式不正确', value: dateStr }
    ]);
  }
  return date;
}

/**
 * 将查询参数转换为分页选项
 */
export function parseQueryToPagination(query: Record<string, any>) {
  const parsed = {
    page: query.page ? parseInt(query.page, 10) : 1,
    limit: query.limit ? parseInt(query.limit, 10) : 20,
    sortBy: query.sortBy || 'uploadedAt',
    sortOrder: query.sortOrder || 'desc',
    dateFrom: query.dateFrom ? parseDate(query.dateFrom) : undefined,
    dateTo: query.dateTo ? parseDate(query.dateTo) : undefined,
    groupId: query.groupId || undefined
  };

  return validatePaginationOptions(parsed);
}

/**
 * 清理和标准化标签数组
 */
export function normalizeTags(tags: string[] | string | undefined): string[] {
  if (!tags) return [];
  
  const tagArray = Array.isArray(tags) ? tags : [tags];
  
  return tagArray
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0)
    .filter((tag, index, arr) => arr.indexOf(tag) === index) // 去重
    .slice(0, 20); // 限制数量
}

/**
 * 生成唯一ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 检查文件类型是否为图片
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}