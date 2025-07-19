/**
 * Cloudinary集成服务
 * 提供图片上传、删除、获取URL等功能
 */

import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryError } from '@/types/errors';
import { CloudinaryResponse, UploadOptions, Transformation } from '@/types/models';

// 配置Cloudinary
const configureCloudinary = () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new CloudinaryError(
      'Cloudinary配置缺失，请检查环境变量CLOUDINARY_CLOUD_NAME、CLOUDINARY_API_KEY、CLOUDINARY_API_SECRET',
      { cloudName: !!cloudName, apiKey: !!apiKey, apiSecret: !!apiSecret }
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true
  });
};

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

// 重试函数
async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // 如果是最后一次尝试，直接抛出错误
      if (attempt === config.maxRetries) {
        break;
      }
      
      // 计算延迟时间（指数退避）
      const delay = Math.min(
        config.baseDelay * Math.pow(2, attempt),
        config.maxDelay
      );
      
      console.warn(`Cloudinary操作失败，${delay}ms后重试 (尝试 ${attempt + 1}/${config.maxRetries + 1}):`, error);
      
      // 在测试环境中减少延迟
      const actualDelay = process.env.NODE_ENV === 'test' ? Math.min(delay, 10) : delay;
      
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, actualDelay));
    }
  }
  
  throw new CloudinaryError(
    `Cloudinary操作在${config.maxRetries + 1}次尝试后失败: ${lastError?.message || '未知错误'}`,
    { originalError: lastError }
  );
}

export class CloudinaryService {
  private static instance: CloudinaryService;
  private isConfigured = false;

  private constructor() {
    this.ensureConfigured();
  }

  public static getInstance(): CloudinaryService {
    if (!CloudinaryService.instance) {
      CloudinaryService.instance = new CloudinaryService();
    }
    return CloudinaryService.instance;
  }

  private ensureConfigured(): void {
    if (!this.isConfigured) {
      try {
        configureCloudinary();
        this.isConfigured = true;
      } catch (error) {
        throw new CloudinaryError(
          'Cloudinary配置失败',
          { error: error instanceof Error ? error.message : error }
        );
      }
    }
  }

  /**
   * 上传图片到Cloudinary
   */
  async uploadImage(file: File, options: UploadOptions = {}): Promise<CloudinaryResponse> {
    this.ensureConfigured();

    try {
      // 将File转换为Buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // 构建上传选项
      const uploadOptions: any = {
        resource_type: 'image',
        folder: options.folder || 'random-image-api',
        tags: options.tags || [],
        transformation: options.transformation,
        use_filename: true,
        unique_filename: true,
        overwrite: false
      };

      // 使用重试机制上传
      const result = await withRetry(async () => {
        return new Promise<CloudinaryResponse>((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
              if (error) {
                reject(new CloudinaryError(
                  `图片上传失败: ${error.message}`,
                  { error, filename: file.name }
                ));
              } else if (result) {
                resolve({
                  ...result,
                  asset_id: result.asset_id || '',
                  display_name: result.display_name || result.public_id
                } as CloudinaryResponse);
              } else {
                reject(new CloudinaryError('上传结果为空'));
              }
            }
          ).end(buffer);
        });
      });

      console.log(`图片上传成功: ${result.public_id}`);
      return result;

    } catch (error) {
      if (error instanceof CloudinaryError) {
        throw error;
      }
      throw new CloudinaryError(
        `图片上传过程中发生错误: ${error instanceof Error ? error.message : '未知错误'}`,
        { error, filename: file.name }
      );
    }
  }

  /**
   * 删除Cloudinary中的图片
   */
  async deleteImage(publicId: string): Promise<void> {
    this.ensureConfigured();

    try {
      const result = await withRetry(async () => {
        return cloudinary.uploader.destroy(publicId);
      });

      if (result.result !== 'ok') {
        throw new CloudinaryError(
          `图片删除失败: ${result.result}`,
          { publicId, result }
        );
      }

      console.log(`图片删除成功: ${publicId}`);

    } catch (error) {
      if (error instanceof CloudinaryError) {
        throw error;
      }
      throw new CloudinaryError(
        `删除图片时发生错误: ${error instanceof Error ? error.message : '未知错误'}`,
        { error, publicId }
      );
    }
  }

  /**
   * 获取图片URL（支持转换参数）
   */
  getImageUrl(publicId: string, transformations: Transformation[] = []): string {
    this.ensureConfigured();

    try {
      return cloudinary.url(publicId, {
        secure: true,
        transformation: transformations
      });
    } catch (error) {
      throw new CloudinaryError(
        `获取图片URL失败: ${error instanceof Error ? error.message : '未知错误'}`,
        { error, publicId, transformations }
      );
    }
  }

  /**
   * 下载图片为Buffer
   */
  async downloadImage(publicId: string, transformations: Transformation[] = []): Promise<Buffer> {
    this.ensureConfigured();

    try {
      const url = this.getImageUrl(publicId, transformations);
      
      const result = await withRetry(async () => {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.arrayBuffer();
      });

      return Buffer.from(result);

    } catch (error) {
      throw new CloudinaryError(
        `下载图片失败: ${error instanceof Error ? error.message : '未知错误'}`,
        { error, publicId, transformations }
      );
    }
  }

  /**
   * 获取图片信息
   */
  async getImageInfo(publicId: string): Promise<any> {
    this.ensureConfigured();

    try {
      const result = await withRetry(async () => {
        return cloudinary.api.resource(publicId);
      });

      return result;

    } catch (error) {
      throw new CloudinaryError(
        `获取图片信息失败: ${error instanceof Error ? error.message : '未知错误'}`,
        { error, publicId }
      );
    }
  }

  /**
   * 批量删除图片
   */
  async deleteImages(publicIds: string[]): Promise<{ deleted: string[]; failed: string[] }> {
    this.ensureConfigured();

    const deleted: string[] = [];
    const failed: string[] = [];

    // 并发删除，但限制并发数量
    const concurrency = 5;
    const chunks = [];
    for (let i = 0; i < publicIds.length; i += concurrency) {
      chunks.push(publicIds.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      const promises = chunk.map(async (publicId) => {
        try {
          await this.deleteImage(publicId);
          deleted.push(publicId);
        } catch (error) {
          console.error(`删除图片失败 ${publicId}:`, error);
          failed.push(publicId);
        }
      });

      await Promise.all(promises);
    }

    return { deleted, failed };
  }

  /**
   * 检查Cloudinary连接状态
   */
  async checkConnection(): Promise<{ connected: boolean; responseTime?: number }> {
    this.ensureConfigured();

    const startTime = Date.now();
    
    try {
      await withRetry(async () => {
        return cloudinary.api.ping();
      }, { maxRetries: 1, baseDelay: 1000, maxDelay: 1000 });

      const responseTime = Date.now() - startTime;
      return { connected: true, responseTime };

    } catch (error) {
      console.error('Cloudinary连接检查失败:', error);
      return { connected: false };
    }
  }

  /**
   * 获取存储使用情况
   */
  async getUsageStats(): Promise<any> {
    this.ensureConfigured();

    try {
      const result = await withRetry(async () => {
        return cloudinary.api.usage();
      });

      return result;

    } catch (error) {
      throw new CloudinaryError(
        `获取使用统计失败: ${error instanceof Error ? error.message : '未知错误'}`,
        { error }
      );
    }
  }
}

// 导出单例实例的getter函数
export const cloudinaryService = () => CloudinaryService.getInstance();