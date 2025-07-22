/**
 * 多图床管理器
 * 协调多个图床服务，实现故障转移和负载均衡
 */

import {
  ImageStorageService,
  StorageProvider,
  StorageResult,
  UploadOptions,
  HealthStatus,
  StorageStats,
  StorageError,
  MultiStorageConfig,
  StorageOperationResult,
  FailoverStrategy,
  StorageServiceFactory
} from './base';
import { CloudinaryService } from './cloudinary';
import { TgStateService } from './tgstate';

export class MultiStorageManager {
  private services: Map<StorageProvider, ImageStorageService> = new Map();
  private config: MultiStorageConfig;
  private healthStatus: Map<StorageProvider, HealthStatus> = new Map();
  private lastHealthCheck: Date = new Date(0);

  constructor(config: MultiStorageConfig) {
    this.config = config;
  }

  /**
   * 注册图床服务
   */
  registerService(service: ImageStorageService): void {
    this.services.set(service.getProvider(), service);
    console.log(`已注册图床服务: ${service.getProvider()}`);
  }

  /**
   * 获取图床服务
   */
  getService(provider: StorageProvider): ImageStorageService | undefined {
    return this.services.get(provider);
  }

  /**
   * 上传图片（支持故障转移）
   */
  async uploadImage(file: File, options?: UploadOptions): Promise<StorageOperationResult> {
    const startTime = Date.now();
    let retryCount = 0;
    let failedOver = false;
    let primaryResult: StorageResult | undefined;
    let backupResult: StorageResult | undefined;
    let lastError: StorageError | undefined;

    // 更新健康状态
    await this.updateHealthStatus();

    // 确定上传策略
    const providers = this.getUploadProviders();
    
    for (const provider of providers) {
      const service = this.services.get(provider);
      if (!service) {
        console.warn(`图床服务 ${provider} 未注册`);
        continue;
      }

      // 检查服务健康状态
      const health = this.healthStatus.get(provider);
      if (health && !health.isHealthy) {
        console.warn(`跳过不健康的图床服务: ${provider}`);
        continue;
      }

      try {
        console.log(`尝试使用 ${provider} 上传图片: ${file.name}`);
        const result = await this.uploadWithRetry(service, file, options);
        
        if (provider === this.config.primaryProvider) {
          primaryResult = result;
        } else {
          backupResult = result;
          failedOver = true;
        }

        // 如果启用了备份上传且这是主要提供商，继续上传到备份
        if (provider === this.config.primaryProvider && 
            this.config.enableBackupUpload && 
            this.config.backupProvider) {
          
          const backupService = this.services.get(this.config.backupProvider);
          if (backupService) {
            try {
              console.log(`同时上传到备份图床: ${this.config.backupProvider}`);
              backupResult = await this.uploadWithRetry(backupService, file, options);
            } catch (backupError) {
              console.warn(`备份上传失败:`, backupError);
              // 备份失败不影响主要上传的成功
            }
          }
        }

        // 构建成功结果
        return {
          success: true,
          primaryResult,
          backupResult,
          provider,
          failedOver,
          metadata: {
            uploadTime: Date.now() - startTime,
            retryCount,
            healthStatus: Object.fromEntries(this.healthStatus) as Record<StorageProvider, HealthStatus>
          }
        };

      } catch (error) {
        lastError = error instanceof StorageError ? error : new StorageError(
          error instanceof Error ? error.message : '未知错误',
          provider,
          'UPLOAD_FAILED'
        );
        
        console.error(`${provider} 上传失败:`, lastError.message);
        
        // 如果是主要提供商失败，根据策略决定是否故障转移
        if (provider === this.config.primaryProvider) {
          if (this.config.failoverStrategy === FailoverStrategy.IMMEDIATE ||
              (this.config.failoverStrategy === FailoverStrategy.RETRY_THEN_FAILOVER && 
               retryCount >= this.config.retryAttempts)) {
            console.log('触发故障转移到备用图床');
            failedOver = true;
            continue; // 继续尝试备用提供商
          }
        }
        
        retryCount++;
      }
    }

    // 所有提供商都失败了
    return {
      success: false,
      provider: this.config.primaryProvider,
      failedOver,
      error: lastError || new StorageError(
        '所有图床服务都不可用',
        this.config.primaryProvider,
        'ALL_PROVIDERS_FAILED'
      ),
      metadata: {
        uploadTime: Date.now() - startTime,
        retryCount,
        healthStatus: Object.fromEntries(this.healthStatus) as Record<StorageProvider, HealthStatus>
      }
    };
  }

  /**
   * 删除图片
   */
  async deleteImage(identifier: string, provider?: StorageProvider): Promise<void> {
    if (provider) {
      const service = this.services.get(provider);
      if (service) {
        await service.deleteImage(identifier);
        return;
      }
      throw new StorageError(
        `图床服务 ${provider} 未注册`,
        provider,
        'SERVICE_NOT_REGISTERED'
      );
    }

    // 如果没有指定提供商，尝试从所有服务中删除
    const errors: StorageError[] = [];
    for (const [providerName, service] of Array.from(this.services)) {
      try {
        await service.deleteImage(identifier);
        console.log(`从 ${providerName} 删除图片成功: ${identifier}`);
      } catch (error) {
        const storageError = error instanceof StorageError ? error : new StorageError(
          error instanceof Error ? error.message : '未知错误',
          providerName,
          'DELETE_FAILED'
        );
        errors.push(storageError);
        console.warn(`从 ${providerName} 删除图片失败:`, storageError.message);
      }
    }

    if (errors.length === this.services.size) {
      throw new StorageError(
        '从所有图床服务删除图片都失败了',
        this.config.primaryProvider,
        'DELETE_ALL_FAILED',
        { errors }
      );
    }
  }

  /**
   * 获取图片URL
   */
  getImageUrl(identifier: string, provider: StorageProvider, transformations?: any[]): string {
    const service = this.services.get(provider);
    if (!service) {
      throw new StorageError(
        `图床服务 ${provider} 未注册`,
        provider,
        'SERVICE_NOT_REGISTERED'
      );
    }
    
    return service.getImageUrl(identifier, transformations);
  }

  /**
   * 获取所有服务的健康状态
   */
  async getAllHealthStatus(): Promise<Map<StorageProvider, HealthStatus>> {
    await this.updateHealthStatus();
    return new Map(this.healthStatus);
  }

  /**
   * 获取所有服务的统计信息
   */
  async getAllStats(): Promise<Map<StorageProvider, StorageStats>> {
    const stats = new Map<StorageProvider, StorageStats>();
    
    for (const [provider, service] of Array.from(this.services)) {
      try {
        const serviceStats = await service.getStats();
        stats.set(provider, serviceStats);
      } catch (error) {
        console.warn(`获取 ${provider} 统计信息失败:`, error);
      }
    }
    
    return stats;
  }

  /**
   * 手动触发故障转移
   */
  async triggerFailover(): Promise<void> {
    if (!this.config.backupProvider) {
      throw new Error('未配置备用图床服务');
    }

    // 交换主要和备用提供商
    const oldPrimary = this.config.primaryProvider;
    this.config.primaryProvider = this.config.backupProvider;
    this.config.backupProvider = oldPrimary;

    console.log(`手动故障转移: ${oldPrimary} -> ${this.config.primaryProvider}`);
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<MultiStorageConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('多图床配置已更新');
  }

  /**
   * 获取上传提供商列表（按优先级排序）
   */
  private getUploadProviders(): StorageProvider[] {
    const providers: StorageProvider[] = [this.config.primaryProvider];
    
    if (this.config.backupProvider && 
        this.config.failoverStrategy !== FailoverStrategy.MANUAL) {
      providers.push(this.config.backupProvider);
    }
    
    return providers;
  }

  /**
   * 带重试的上传
   */
  private async uploadWithRetry(
    service: ImageStorageService, 
    file: File, 
    options?: UploadOptions
  ): Promise<StorageResult> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
      try {
        return await service.uploadImage(file, options);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < this.config.retryAttempts) {
          console.warn(`上传重试 ${attempt + 1}/${this.config.retryAttempts}:`, lastError.message);
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * 更新健康状态
   */
  private async updateHealthStatus(): Promise<void> {
    const now = new Date();
    const timeSinceLastCheck = now.getTime() - this.lastHealthCheck.getTime();
    
    // 如果距离上次检查时间小于配置的间隔，跳过检查
    if (timeSinceLastCheck < this.config.healthCheckInterval * 1000) {
      return;
    }

    console.log('更新图床服务健康状态...');
    
    for (const [provider, service] of Array.from(this.services)) {
      try {
        const health = await service.healthCheck();
        this.healthStatus.set(provider, health);
        console.log(`${provider} 健康状态: ${health.isHealthy ? '健康' : '不健康'}`);
      } catch (error) {
        this.healthStatus.set(provider, {
          isHealthy: false,
          lastChecked: now,
          error: error instanceof Error ? error.message : '健康检查失败'
        });
        console.warn(`${provider} 健康检查失败:`, error);
      }
    }
    
    this.lastHealthCheck = now;
  }
}
