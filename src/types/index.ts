/**
 * 类型定义入口文件
 * 导出所有类型定义，提供统一的导入接口
 */

// 导出所有类型定义
export * from './models';
export * from './errors';
export * from './api';
export * from './schemas';
export * from './validators';

// 重新导出常用类型以保持向后兼容
export type {
  Image,
  Group,
  APIConfig,
  APIParameter,
  PaginatedResult,
  PaginationOptions,
  UploadOptions,
  CloudinaryResponse,
  Transformation
} from './models';

export type {
  ErrorType,
  APIError,
  AppError,
  ValidationError,
  CloudinaryError,
  DatabaseError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationErrorDetail
} from './errors';

export type {
  APIResponse,
  SuccessResponse,
  ErrorResponse,
  ImageUploadRequest,
  ImageUploadResponse,
  ImageListRequest,
  ImageListResponse,
  GroupCreateRequest,
  GroupUpdateRequest,
  GroupResponse,
  GroupListResponse,
  APIConfigResponse,
  APIConfigUpdateRequest,
  RandomImageRequest,
  AdminLoginRequest,
  AdminLoginResponse,
  SystemStatusResponse
} from './api';

export {
  ImageSchema,
  GroupSchema,
  APIParameterSchema,
  APIConfigSchema,
  PaginationOptionsSchema,
  UploadOptionsSchema,
  ImageUploadRequestSchema,
  ImageListRequestSchema,
  GroupCreateRequestSchema,
  GroupUpdateRequestSchema,
  APIConfigUpdateRequestSchema,
  AdminLoginRequestSchema,
  BulkDeleteRequestSchema,
  BulkUpdateRequestSchema,
  RandomImageRequestSchema,
  FileValidationSchema,
  EnvSchema
} from './schemas';

export type {
  ImageUrlImportRequest,
  ImageUrlImportResponse
} from './api';

export {
  ImportUrlItemSchema,
  ImageUrlImportRequestSchema
} from './schemas';
