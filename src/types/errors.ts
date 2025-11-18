/**
 * 错误类型定义
 * 定义系统中使用的错误类型和错误处理相关接口
 */

// 错误类型枚举
export enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CLOUDINARY_ERROR = 'CLOUDINARY_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  UPLOAD_ERROR = 'UPLOAD_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  CONFIG_ERROR = 'CONFIG_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR'
}

// API错误接口
export interface APIError {
  type: ErrorType;
  message: string;
  details?: any;
  timestamp: Date;
  code?: string;
  statusCode?: number;
  requestId?: string;
  stack?: string;
  context?: any;
}

// 自定义错误类
export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly statusCode: number;
  public readonly details?: any;
  public readonly timestamp: Date;

  constructor(
    type: ErrorType,
    message: string,
    statusCode: number = 500,
    details?: any
  ) {
    super(message);
    this.type = type;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date();
    this.name = 'AppError';

    // 确保堆栈跟踪正确
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  toJSON(): APIError {
    return {
      type: this.type,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
      code: this.type,
      statusCode: this.statusCode
    };
  }
}

// 验证错误详情
export interface ValidationErrorDetail {
  field: string;
  message: string;
  value?: any;
}

// 验证错误类
export class ValidationError extends AppError {
  public readonly errors: ValidationErrorDetail[];

  constructor(message: string, errors: ValidationErrorDetail[]) {
    super(ErrorType.VALIDATION_ERROR, message, 400, { errors });
    this.errors = errors;
    this.name = 'ValidationError';
  }
}

// Cloudinary错误类
export class CloudinaryError extends AppError {
  constructor(message: string, details?: any) {
    super(ErrorType.CLOUDINARY_ERROR, message, 500, details);
    this.name = 'CloudinaryError';
  }
}

// 数据库错误类
export class DatabaseError extends AppError {
  constructor(message: string, details?: any) {
    super(ErrorType.DATABASE_ERROR, message, 500, details);
    this.name = 'DatabaseError';
  }
}

// 未找到错误类
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id 
      ? `${resource} with id '${id}' not found`
      : `${resource} not found`;
    super(ErrorType.NOT_FOUND, message, 404);
    this.name = 'NotFoundError';
  }
}

// 未授权错误类
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized access') {
    super(ErrorType.UNAUTHORIZED, message, 401);
    this.name = 'UnauthorizedError';
  }
}

// 禁止访问错误类
export class ForbiddenError extends AppError {
  constructor(message: string = 'Access forbidden') {
    super(ErrorType.FORBIDDEN, message, 403);
    this.name = 'ForbiddenError';
  }
}

// 配置错误类
export class ConfigurationError extends AppError {
  constructor(message: string, details?: any) {
    super(ErrorType.CONFIG_ERROR, message, 400, details);
    this.name = 'ConfigurationError';
  }
}