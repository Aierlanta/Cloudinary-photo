/**
 * tgState 图床服务适配器
 * 基于 Telegram 的文件存储服务
 */

import {
  ImageStorageService,
  StorageProvider,
  StorageResult,
  UploadOptions,
  HealthStatus,
  StorageStats,
  StorageError
} from './base';

export interface TgStateConfig {
  baseUrl: string;
  password?: string;
  timeout?: number;
}

export interface TgStateResponse {
  code: number;
  message: string;
  url?: string;
}

export class TgStateService extends ImageStorageService {
  private baseUrl: string;
  private password?: string;
  private timeout: number;
  private stats: {
    totalUploads: number;
    successCount: number;
    totalResponseTime: number;
    lastFailure?: Date;
  };

  constructor(config: TgStateConfig) {
    super(StorageProvider.TGSTATE, config);
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // 移除末尾斜杠
    this.password = config.password;
    this.timeout = config.timeout || 30000; // 30秒超时
    this.stats = {
      totalUploads: 0,
      successCount: 0,
      totalResponseTime: 0
    };
  }

  /**
   * 上传图片到 tgState
   */
  async uploadImage(file: File, options?: UploadOptions): Promise<StorageResult> {
    const startTime = Date.now();
    this.stats.totalUploads++;

    try {
      // 构建上传 URL
      const uploadUrl = this.buildUploadUrl();
      
      // 创建表单数据
      const formData = new FormData();
      formData.append('image', file);

      // 发送上传请求
      const response = await this.makeRequest(uploadUrl, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(this.timeout)
      });

      const result: TgStateResponse = await response.json();

      if (result.code !== 1) {
        throw new StorageError(
          `tgState 上传失败: ${result.message}`,
          StorageProvider.TGSTATE,
          'UPLOAD_FAILED',
          result
        );
      }

      // 记录成功统计
      const responseTime = Date.now() - startTime;
      this.stats.successCount++;
      this.stats.totalResponseTime += responseTime;

      // 构建返回结果
      const storageResult: StorageResult = {
        id: this.extractFileId(result.message),
        publicId: result.message,
        url: this.buildFileUrl(result.message), // tgState 返回的 url 和 message 都是相对路径
        filename: file.name,
        format: this.extractFormat(file.name),
        bytes: file.size,
        metadata: {
          provider: StorageProvider.TGSTATE,
          uploadTime: new Date().toISOString(),
          responseTime,
          originalResponse: result
        }
      };

      console.log(`tgState 上传成功: ${storageResult.publicId}`);
      return storageResult;

    } catch (error) {
      this.stats.lastFailure = new Date();
      
      if (error instanceof StorageError) {
        throw error;
      }

      throw new StorageError(
        `tgState 上传过程中发生错误: ${error instanceof Error ? error.message : '未知错误'}`,
        StorageProvider.TGSTATE,
        'UPLOAD_ERROR',
        { error, filename: file.name }
      );
    }
  }

  /**
   * 删除图片（tgState 不支持删除，返回警告）
   */
  async deleteImage(identifier: string): Promise<void> {
    console.warn(`tgState 不支持删除操作，图片 ${identifier} 将保留在 Telegram 中`);
    // tgState 基于 Telegram，不支持程序化删除
    // 这里可以记录删除请求，但实际文件会保留
  }

  /**
   * 获取图片URL
   */
  getImageUrl(identifier: string, transformations?: any[]): string {
    // tgState 不支持图片变换，忽略 transformations 参数
    if (transformations && transformations.length > 0) {
      console.warn('tgState 不支持图片变换，将返回原始图片URL');
    }
    
    return this.buildFileUrl(identifier);
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      // 尝试访问 tgState 主页
      const response = await this.makeRequest(this.baseUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5秒超时
      });

      const responseTime = Date.now() - startTime;
      const isHealthy = response.ok;

      return {
        isHealthy,
        responseTime,
        lastChecked: new Date(),
        error: isHealthy ? undefined : `HTTP ${response.status}: ${response.statusText}`
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
   * 构建上传URL
   */
  private buildUploadUrl(): string {
    // 由于 tgState 密码鉴权存在已知 bug，暂时使用无密码模式
    const url = new URL('/api', this.baseUrl);
    // 注释掉密码参数，使用无密码模式
    // if (this.password) {
    //   url.searchParams.set('pass', this.password);
    // }
    return url.toString();
  }

  /**
   * 构建文件访问URL
   */
  private buildFileUrl(path: string): string {
    // 如果 path 已经是完整 URL，直接返回
    if (path.startsWith('http')) {
      return path;
    }

    // tgState 返回的 path 格式为 "/d/xxx"，需要拼接域名
    // 确保 path 以 / 开头
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}${normalizedPath}`;
  }

  /**
   * 从响应消息中提取文件ID
   */
  private extractFileId(message: string): string {
    // tgState 返回的 message 通常是 "/d/xxx" 格式
    return message.replace(/^\/d\//, '') || message;
  }

  /**
   * 从文件名提取格式
   */
  private extractFormat(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'unknown';
  }

  /**
   * 发送HTTP请求
   */
  private async makeRequest(url: string, options: RequestInit): Promise<Response> {
    const response = await fetch(url, {
      ...options,
      headers: {
        'User-Agent': 'CloudinaryPhotoApp/1.0',
        ...options.headers
      }
    });

    if (!response.ok && response.status >= 500) {
      throw new StorageError(
        `tgState 服务器错误: ${response.status} ${response.statusText}`,
        StorageProvider.TGSTATE,
        'SERVER_ERROR',
        { status: response.status, statusText: response.statusText }
      );
    }

    return response;
  }
}
