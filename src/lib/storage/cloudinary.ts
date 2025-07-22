/**
 * Cloudinary 图床服务适配器
 * 基于 Cloudinary CDN 的图片存储服务
 */

import { v2 as cloudinary } from 'cloudinary';
import {
  ImageStorageService,
  StorageProvider,
  StorageResult,
  UploadOptions,
  HealthStatus,
  StorageStats,
  StorageError
} from './base';

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  secure?: boolean;
}

// 重试配置
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000
};

export class CloudinaryService extends ImageStorageService {
  private isConfigured: boolean = false;
  private stats: {
    totalUploads: number;
    successCount: number;
    totalResponseTime: number;
    lastFailure?: Date;
  };

  constructor(config: CloudinaryConfig) {
    super(StorageProvider.CLOUDINARY, config);
    this.configureCloudinary(config);
    this.stats = {
      totalUploads: 0,
      successCount: 0,
      totalResponseTime: 0
    };
  }

  /**
   * 配置 Cloudinary
   */
  private configureCloudinary(config: CloudinaryConfig): void {
    if (!config.cloudName || !config.apiKey || !config.apiSecret) {
      throw new StorageError(
        'Cloudinary配置缺失，请检查cloudName、apiKey、apiSecret',
        StorageProvider.CLOUDINARY,
        'CONFIG_MISSING',
        { 
          cloudName: !!config.cloudName, 
          apiKey: !!config.apiKey, 
          apiSecret: !!config.apiSecret 
        }
      );
    }

    cloudinary.config({
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      secure: config.secure !== false
    });

    this.isConfigured = true;
  }

  /**
   * 上传图片到 Cloudinary
   */
  async uploadImage(file: File, options?: UploadOptions): Promise<StorageResult> {
    this.ensureConfigured();
    const startTime = Date.now();
    this.stats.totalUploads++;

    try {
      // 将File转换为Buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // 构建上传选项
      const uploadOptions: any = {
        resource_type: 'image',
        folder: options?.folder || 'random-image-api',
        tags: options?.tags || [],
        transformation: options?.transformation,
        use_filename: true,
        unique_filename: true,
        overwrite: false
      };

      // 使用重试机制上传
      const result = await this.withRetry(async () => {
        return new Promise<any>((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
              if (error) {
                reject(new StorageError(
                  `Cloudinary 上传失败: ${error.message}`,
                  StorageProvider.CLOUDINARY,
                  'UPLOAD_FAILED',
                  { error, filename: file.name }
                ));
              } else if (result) {
                resolve(result);
              } else {
                reject(new StorageError(
                  'Cloudinary 上传结果为空',
                  StorageProvider.CLOUDINARY,
                  'EMPTY_RESULT'
                ));
              }
            }
          ).end(buffer);
        });
      });

      // 记录成功统计
      const responseTime = Date.now() - startTime;
      this.stats.successCount++;
      this.stats.totalResponseTime += responseTime;

      // 构建返回结果
      const storageResult: StorageResult = {
        id: result.asset_id || result.public_id,
        publicId: result.public_id,
        url: result.url,
        secureUrl: result.secure_url,
        filename: file.name,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        metadata: {
          provider: StorageProvider.CLOUDINARY,
          uploadTime: new Date().toISOString(),
          responseTime,
          cloudinaryResult: result
        }
      };

      console.log(`Cloudinary 上传成功: ${storageResult.publicId}`);
      return storageResult;

    } catch (error) {
      this.stats.lastFailure = new Date();
      
      if (error instanceof StorageError) {
        throw error;
      }
      
      throw new StorageError(
        `Cloudinary 上传过程中发生错误: ${error instanceof Error ? error.message : '未知错误'}`,
        StorageProvider.CLOUDINARY,
        'UPLOAD_ERROR',
        { error, filename: file.name }
      );
    }
  }

  /**
   * 删除 Cloudinary 中的图片
   */
  async deleteImage(identifier: string): Promise<void> {
    this.ensureConfigured();

    try {
      const result = await this.withRetry(async () => {
        return cloudinary.uploader.destroy(identifier);
      });

      if (result.result !== 'ok') {
        throw new StorageError(
          `Cloudinary 删除失败: ${result.result}`,
          StorageProvider.CLOUDINARY,
          'DELETE_FAILED',
          { publicId: identifier, result }
        );
      }

      console.log(`Cloudinary 删除成功: ${identifier}`);

    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      
      throw new StorageError(
        `Cloudinary 删除图片时发生错误: ${error instanceof Error ? error.message : '未知错误'}`,
        StorageProvider.CLOUDINARY,
        'DELETE_ERROR',
        { error, publicId: identifier }
      );
    }
  }

  /**
   * 获取图片URL（支持转换参数）
   */
  getImageUrl(identifier: string, transformations: any[] = []): string {
    this.ensureConfigured();

    try {
      return cloudinary.url(identifier, {
        secure: true,
        transformation: transformations
      });
    } catch (error) {
      throw new StorageError(
        `Cloudinary 获取图片URL失败: ${error instanceof Error ? error.message : '未知错误'}`,
        StorageProvider.CLOUDINARY,
        'URL_GENERATION_FAILED',
        { error, publicId: identifier, transformations }
      );
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      this.ensureConfigured();
      
      // 使用 Cloudinary Admin API 检查连接
      const result = await cloudinary.api.ping();
      const responseTime = Date.now() - startTime;
      
      return {
        isHealthy: result.status === 'ok',
        responseTime,
        lastChecked: new Date(),
        error: result.status !== 'ok' ? `Cloudinary ping failed: ${result.status}` : undefined
      };

    } catch (error) {
      return {
        isHealthy: false,
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 获取服务统计信息
   */
  async getStats(): Promise<StorageStats> {
    const successRate = this.stats.totalUploads > 0 
      ? (this.stats.successCount / this.stats.totalUploads) * 100 
      : 0;
    
    const averageResponseTime = this.stats.successCount > 0
      ? this.stats.totalResponseTime / this.stats.successCount
      : 0;

    return {
      totalUploads: this.stats.totalUploads,
      successRate,
      averageResponseTime,
      lastFailure: this.stats.lastFailure
    };
  }

  /**
   * 验证配置
   */
  async validateConfig(): Promise<boolean> {
    try {
      const health = await this.healthCheck();
      return health.isHealthy;
    } catch {
      return false;
    }
  }

  /**
   * 获取缩略图URL
   */
  getThumbnailUrl(publicId: string, size: number = 300): string {
    return this.getImageUrl(publicId, [
      {
        width: size,
        height: size,
        crop: 'fill',
        quality: 'auto',
        format: 'webp'
      }
    ]);
  }

  /**
   * 确保已配置
   */
  private ensureConfigured(): void {
    if (!this.isConfigured) {
      throw new StorageError(
        'Cloudinary 未配置，请先调用配置方法',
        StorageProvider.CLOUDINARY,
        'NOT_CONFIGURED'
      );
    }
  }

  /**
   * 重试函数
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig = DEFAULT_RETRY_CONFIG
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === config.maxRetries) {
          break;
        }
        
        // 计算延迟时间（指数退避）
        const delay = Math.min(
          config.baseDelay * Math.pow(2, attempt),
          config.maxDelay
        );
        
        console.warn(`Cloudinary 操作失败，${delay}ms 后重试 (${attempt + 1}/${config.maxRetries}):`, lastError.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }
}
