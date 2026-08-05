/**
 * 核心数据模型类型定义
 * 定义系统中使用的主要数据结构
 */

// 图片模型
export interface Image {
  id: string;
  publicId: string;
  url: string;
  width?: number;
  height?: number;
  orientation?: 'landscape' | 'portrait' | 'square' | 'unknown';
  title?: string;
  description?: string;
  tags?: string[];
  groupId?: string;
  uploadedAt: Date;
  primaryProvider?: string; // 新增：主要图床提供商
  backupProvider?: string;  // 新增：备用图床提供商
  ownerNodeId?: string;
  previewUrl?: string;
  // Telegram 相关字段
  telegramFileId?: string;
  telegramThumbnailFileId?: string;
  telegramFilePath?: string;
  telegramThumbnailPath?: string;
  telegramBotToken?: string;
  storageMetadata?: string;
}

// 分组模型
export interface Group {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  imageCount: number;
}

// API参数配置
export interface APIParameter {
  name: string; // 参数名，如 'group', 'category'
  type: 'group' | 'custom' | 'provider';
  allowedValues: string[]; // 允许的参数值
  mappedGroups: string[]; // 该参数值对应的分组（type=provider 时通常为空数组）
  mappedProviders?: string[]; // 映射到图床服务（type=provider 时使用）
  isEnabled: boolean;
}

export type ManagedResponseFormat = 'jpeg' | 'webp';

export interface ResponseParamsConfig {
  format: {
    enabled: boolean;
    allowedValues: ManagedResponseFormat[];
  };
  quality: {
    enabled: boolean;
  };
  defaultWebpDelivery: {
    random: boolean;
    response: boolean;
  };
}

export interface SelectionParamsConfig {
  timeWeighting: {
    enabled: boolean;
  };
}

export type UploadStrategy = 'manual' | 'round-robin' | 'random' | 'available-first';
export type ProviderDeliveryMode = 'owner-node' | 'existing-chain';
export type SwarmProvider = 'cloudinary' | 'tgstate' | 'telegram' | 'custom';

/** 节点 × 图床可用性：缺省/缺项视为启用，仅显式 false 表示禁用出图 */
export type NodeProviderAvailability = Record<string, Record<SwarmProvider, boolean>>;

// API配置模型
export interface APIConfig {
  id: string;
  isEnabled: boolean;
  defaultScope: 'all' | 'groups';
  defaultGroups: string[];
  allowedParameters: APIParameter[];
  responseParams?: ResponseParamsConfig;
  selectionParams?: SelectionParamsConfig;
  /** 按蜂群节点控制公开 API 可出图的图床范围 */
  nodeProviderAvailability?: NodeProviderAvailability;
  // 新增：响应模式配置
  enableDirectResponse: boolean; // 是否启用直接响应模式（/api/response端点）
  // 新增：API Key 鉴权
  apiKeyEnabled: boolean; // 是否启用 API Key 鉴权
  apiKey?: string; // API Key
  updatedAt: Date;
}

export interface ProviderDeliveryPolicyItem {
  mode: ProviderDeliveryMode;
  warnOnDisable?: boolean;
}

export type ProviderDeliveryPolicy = Record<SwarmProvider, ProviderDeliveryPolicyItem>;

export interface SwarmConfig {
  id: string;
  uploadStrategy: UploadStrategy;
  providerDeliveryPolicy: ProviderDeliveryPolicy;
  previewDeliveryEnabled: boolean;
  cloudinaryNodeDeliveryRequired: boolean;
  updatedAt: Date;
}

export interface SecurityConfig {
  id: string;
  guardEnabled: boolean;
  guardAutoEnabled: boolean;
  guardTriggerWindowMinutes: number;
  guardTriggerUniqueIpThreshold: number;
  whitelistOnlyEnabled: boolean;
  guardTriggeredAt?: Date | null;
  guardTriggeredReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPWhitelistEntry {
  id: string;
  cidr: string;
  note?: string | null;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 分页选项
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string; // 搜索关键词
  dateFrom?: Date;
  dateTo?: Date;
  groupId?: string;
  provider?: string; // 新增：图床筛选
  ownerNodeId?: string;
}

// 分页结果
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// 上传选项
export interface UploadOptions {
  folder?: string;
  tags?: string[];
  transformation?: any;
  groupId?: string;
}

// Cloudinary响应
export interface CloudinaryResponse {
  public_id: string;
  version: number;
  signature: string;
  width: number;
  height: number;
  format: string;
  resource_type: string;
  created_at: string;
  tags: string[];
  bytes: number;
  type: string;
  etag: string;
  placeholder: boolean;
  url: string;
  secure_url: string;
  asset_id: string;
  display_name: string;
}

// 图片转换参数
export interface Transformation {
  width?: number;
  height?: number;
  crop?: string;
  quality?: string | number;
  format?: string;
  fetch_format?: string;
}
