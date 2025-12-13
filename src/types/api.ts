/**
 * API响应类型定义
 * 定义API端点的请求和响应类型
 */

import { Image, Group, APIConfig, PaginatedResult } from './models';
import { APIError } from './errors';

// 基础API响应
export interface BaseAPIResponse {
  success: boolean;
  timestamp: Date;
}

// 成功响应
export interface SuccessResponse<T = any> extends BaseAPIResponse {
  success: true;
  data: T;
  message?: string;
}

// 错误响应
export interface ErrorResponse extends BaseAPIResponse {
  success: false;
  error: APIError;
}

// API响应联合类型
export type APIResponse<T = any> = SuccessResponse<T> | ErrorResponse;

// 图片相关API类型
export interface ImageUploadRequest {
  file: File;
  groupId?: string;
  tags?: string[];
}

export interface ImageUploadResponse {
  image: Image;
  message: string;
}

export interface ImageListRequest {
  page?: number;
  limit?: number;
  groupId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ImageListResponse {
  images: PaginatedResult<Image>;
}

export interface ImageDeleteResponse {
  message: string;
  deletedId: string;
}

// 分组相关API类型
export interface GroupCreateRequest {
  name: string;
  description: string;
}

export interface GroupUpdateRequest {
  name?: string;
  description?: string;
}

export interface GroupResponse {
  group: Group;
}

export interface GroupListResponse {
  groups: Group[];
}

export interface GroupDeleteResponse {
  message: string;
  deletedId: string;
  affectedImages: number;
}

// API配置相关类型
export interface APIConfigResponse {
  config: APIConfig;
}

export interface APIConfigUpdateRequest {
  isEnabled?: boolean;
  defaultScope?: 'all' | 'groups';
  defaultGroups?: string[];
  allowedParameters?: Array<{
    name: string;
    type: 'group' | 'custom' | 'provider';
    allowedValues: string[];
    mappedGroups: string[];
    mappedProviders?: string[];
    isEnabled: boolean;
  }>;
  // 新增：响应模式配置
  enableDirectResponse?: boolean;
  // 新增：API Key 鉴权
  apiKeyEnabled?: boolean;
  apiKey?: string;
}

// 随机图片API请求参数
export interface RandomImageRequest {
  [key: string]: string | string[] | undefined;
}

// 管理员认证相关
export interface AdminLoginRequest {
  password: string;
}

export interface AdminLoginResponse {
  success: boolean;
  token?: string;
  message: string;
}

// 系统状态相关
export interface SystemStatusResponse {
  status: 'healthy' | 'degraded' | 'down';
  version: string;
  uptime: number;
  database: {
    connected: boolean;
    responseTime?: number;
  };
  cloudinary: {
    connected: boolean;
    responseTime?: number;
  };
  stats: {
    totalImages: number;
    totalGroups: number;
    storageUsed: number;
  };
}

// 批量操作类型
export interface BulkDeleteRequest {
  imageIds: string[];
}

export interface BulkDeleteResponse {
  deletedCount: number;
  failedIds: string[];
  message: string;
}

export interface BulkUpdateRequest {
  imageIds: string[];
  updates: {
    groupId?: string;
    tags?: string[];
  };
}

export interface BulkUpdateResponse {
  updatedCount: number;
  failedIds: string[];
  message: string;
}

// 批量URL导入
export interface ImageUrlImportItem {
  url: string;
  title?: string;
  description?: string;
  tags?: string[];
}

export interface ImageUrlImportRequest {
  provider: 'custom';
  groupId?: string;
  mode: 'txt' | 'json' | 'items';
  content?: string;
  items?: ImageUrlImportItem[];
}

export interface ImageUrlImportResponse {
  total: number;
  success: number;
  failed: number;
  errors: Array<{
    index: number;
    url: string;
    reason: string;
  }>;
}
