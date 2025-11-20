/**
 * 图床服务抽象接口
 * 定义统一的图床操作接口，支持多种图床服务提供商
 */

export interface UploadOptions {
  folder?: string;
  tags?: string[];
  transformation?: any;
  title?: string;
  description?: string;
  groupId?: string;
}

export interface StorageResult {
  id: string;
  publicId: string;
  url: string;
  secureUrl?: string;
  filename: string;
  format: string;
  width?: number;
  height?: number;
  bytes: number;
  metadata?: Record<string, any>;
}

export interface HealthStatus {
  isHealthy: boolean;
  responseTime?: number;
  lastChecked: Date;
  error?: string;
}

export interface StorageStats {
  totalUploads: number;
  successRate: number;
  averageResponseTime: number;
  lastFailure?: Date;
}

/**
 * 图床服务提供商类型
 */
export enum StorageProvider {
  CLOUDINARY = 'cloudinary',
  TGSTATE = 'tgstate',
  TELEGRAM = 'telegram', // 直连 Telegram Bot API
  CUSTOM = 'custom' // 自定义外链图床，仅记录URL不上传
}

/**
 * 抽象图床服务接口
 */
export abstract class ImageStorageService {
  protected provider: StorageProvider;
  protected config: Record<string, any>;

  constructor(provider: StorageProvider, config: Record<string, any>) {
    this.provider = provider;
    this.config = config;
  }

  /**
   * 获取提供商名称
   */
  getProvider(): StorageProvider {
    return this.provider;
  }

  /**
   * 上传图片
   */
  abstract uploadImage(file: File, options?: UploadOptions): Promise<StorageResult>;

  /**
   * 删除图片
   */
  abstract deleteImage(identifier: string): Promise<void>;

  /**
   * 获取图片URL
   */
  abstract getImageUrl(identifier: string, transformations?: any[]): string;

  /**
   * 健康检查
   */
  abstract healthCheck(): Promise<HealthStatus>;

  /**
   * 获取服务统计信息
   */
  abstract getStats(): Promise<StorageStats>;

  /**
   * 验证配置
   */
  abstract validateConfig(): Promise<boolean>;
}

/**
 * 图床服务错误类
 */
export class StorageError extends Error {
  public provider: StorageProvider;
  public code: string;
  public details?: any;

  constructor(
    message: string,
    provider: StorageProvider,
    code: string = 'UNKNOWN_ERROR',
    details?: any
  ) {
    super(message);
    this.name = 'StorageError';
    this.provider = provider;
    this.code = code;
    this.details = details;
  }
}

/**
 * 故障转移策略
 */
export enum FailoverStrategy {
  IMMEDIATE = 'immediate',     // 立即切换
  RETRY_THEN_FAILOVER = 'retry_then_failover', // 重试后切换
  MANUAL = 'manual'           // 手动切换
}

/**
 * 多图床管理配置
 */
export interface MultiStorageConfig {
  primaryProvider: StorageProvider;
  backupProvider?: StorageProvider;
  failoverStrategy: FailoverStrategy;
  retryAttempts: number;
  retryDelay: number;
  healthCheckInterval: number;
  enableBackupUpload: boolean; // 是否同时上传到备用图床
}

/**
 * 图床操作结果
 */
export interface StorageOperationResult {
  success: boolean;
  primaryResult?: StorageResult;
  backupResult?: StorageResult;
  provider: StorageProvider;
  failedOver: boolean;
  error?: StorageError;
  metadata?: {
    uploadTime: number;
    retryCount: number;
    healthStatus: Record<StorageProvider, HealthStatus>;
  };
}

/**
 * 图床服务工厂接口
 */
export interface StorageServiceFactory {
  /**
   * 创建图床服务实例
   */
  createService(provider: StorageProvider, config: Record<string, any>): ImageStorageService;

  /**
   * 获取支持的提供商列表
   */
  getSupportedProviders(): StorageProvider[];
}


