/**
 * 图床服务工厂
 * 负责创建和配置不同的图床服务实例
 */

import {
  ImageStorageService,
  StorageProvider,
  StorageServiceFactory,
  StorageError,
  MultiStorageConfig,
  FailoverStrategy
} from './base';
import { CloudinaryService, CloudinaryConfig } from './cloudinary';
import { TgStateService, TgStateConfig } from './tgstate';
import { TelegramService, TelegramConfig } from './telegram';
import { getEnabledProviders } from './config';

export class DefaultStorageServiceFactory implements StorageServiceFactory {
  /**
   * 创建图床服务实例
   */
  createService(provider: StorageProvider, config: Record<string, any>): ImageStorageService {
    switch (provider) {
      case StorageProvider.CLOUDINARY:
        return this.createCloudinaryService(config as CloudinaryConfig);

      case StorageProvider.TGSTATE:
        return this.createTgStateService(config as TgStateConfig);

      case StorageProvider.TELEGRAM:
        return this.createTelegramService(config as TelegramConfig);

      default:
        throw new StorageError(
          `不支持的图床服务提供商: ${provider}`,
          provider,
          'UNSUPPORTED_PROVIDER'
        );
    }
  }

  /**
   * 获取支持的提供商列表（使用统一配置模块）
   */
  getSupportedProviders(): StorageProvider[] {
    return getEnabledProviders();
  }

  /**
   * 创建 Cloudinary 服务
   */
  private createCloudinaryService(config: CloudinaryConfig): CloudinaryService {
    this.validateCloudinaryConfig(config);
    return new CloudinaryService(config);
  }

  /**
   * 创建 tgState 服务
   */
  private createTgStateService(config: TgStateConfig): TgStateService {
    this.validateTgStateConfig(config);
    return new TgStateService(config);
  }

  /**
   * 创建 Telegram 服务
   */
  private createTelegramService(config: TelegramConfig): TelegramService {
    this.validateTelegramConfig(config);
    return new TelegramService(config);
  }

  /**
   * 验证 Cloudinary 配置
   */
  private validateCloudinaryConfig(config: CloudinaryConfig): void {
    const required = ['cloudName', 'apiKey', 'apiSecret'];
    const missing = required.filter(key => !config[key as keyof CloudinaryConfig]);
    
    if (missing.length > 0) {
      throw new StorageError(
        `Cloudinary 配置缺失必需字段: ${missing.join(', ')}`,
        StorageProvider.CLOUDINARY,
        'CONFIG_VALIDATION_FAILED',
        { missing, provided: Object.keys(config) }
      );
    }
  }

  /**
   * 验证 tgState 配置
   */
  private validateTgStateConfig(config: TgStateConfig): void {
    if (!config.baseUrl) {
      throw new StorageError(
        'tgState 配置缺失必需字段: baseUrl',
        StorageProvider.TGSTATE,
        'CONFIG_VALIDATION_FAILED',
        { provided: Object.keys(config) }
      );
    }

    // 验证 URL 格式
    try {
      new URL(config.baseUrl);
    } catch {
      throw new StorageError(
        `tgState baseUrl 格式无效: ${config.baseUrl}`,
        StorageProvider.TGSTATE,
        'INVALID_URL',
        { baseUrl: config.baseUrl }
      );
    }
  }

  /**
   * 验证 Telegram 配置
   */
  private validateTelegramConfig(config: TelegramConfig): void {
    if (!config.botTokens || config.botTokens.length === 0) {
      throw new StorageError(
        'Telegram 配置缺失必需字段: botTokens (至少需要一个 Bot Token)',
        StorageProvider.TELEGRAM,
        'CONFIG_VALIDATION_FAILED',
        { provided: Object.keys(config) }
      );
    }

    // 验证 token 格式 (基本检查)
    const invalidTokens = config.botTokens.filter(token => !token || token.length < 20);
    if (invalidTokens.length > 0) {
      throw new StorageError(
        'Telegram Bot Token 格式无效',
        StorageProvider.TELEGRAM,
        'CONFIG_VALIDATION_FAILED',
        { invalidCount: invalidTokens.length }
      );
    }
  }
}

/**
 * 从环境变量创建图床服务配置
 */
export class EnvironmentConfigFactory {
  /**
   * 从环境变量创建 Cloudinary 配置
   */
  static createCloudinaryConfig(): CloudinaryConfig {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      throw new StorageError(
        'Cloudinary 环境变量配置缺失，请检查 CLOUDINARY_CLOUD_NAME、CLOUDINARY_API_KEY、CLOUDINARY_API_SECRET',
        StorageProvider.CLOUDINARY,
        'ENV_CONFIG_MISSING',
        {
          cloudName: !!cloudName,
          apiKey: !!apiKey,
          apiSecret: !!apiSecret
        }
      );
    }

    return {
      cloudName,
      apiKey,
      apiSecret,
      secure: true
    };
  }

  /**
   * 从环境变量创建 tgState 配置
   */
  static createTgStateConfig(): TgStateConfig {
    const baseUrl = process.env.TGSTATE_BASE_URL;
    const password = process.env.TGSTATE_PASSWORD;
    const timeout = process.env.TGSTATE_TIMEOUT;
    const proxyUrl = process.env.TGSTATE_PROXY_URL; // 读取代理URL配置

    if (!baseUrl) {
      throw new StorageError(
        'tgState 环境变量配置缺失，请检查 TGSTATE_BASE_URL',
        StorageProvider.TGSTATE,
        'ENV_CONFIG_MISSING',
        { baseUrl: !!baseUrl }
      );
    }

    return {
      baseUrl,
      password: password || undefined,
      timeout: timeout ? parseInt(timeout, 10) : undefined,
      proxyUrl: proxyUrl || undefined // 添加代理URL配置（可选）
    };
  }

  /**
   * 从环境变量创建 Telegram 配置
   */
  static createTelegramConfig(): TelegramConfig {
    const botTokensString = process.env.TELEGRAM_BOT_TOKENS || process.env.TELEGRAM_BOT_TOKEN;
    const timeout = process.env.TELEGRAM_TIMEOUT;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botTokensString) {
      throw new StorageError(
        'Telegram 环境变量配置缺失，请检查 TELEGRAM_BOT_TOKENS 或 TELEGRAM_BOT_TOKEN',
        StorageProvider.TELEGRAM,
        'ENV_CONFIG_MISSING',
        { hasTokens: false }
      );
    }

    // 支持逗号分隔的多个 token
    const botTokens = botTokensString.split(',').map(t => t.trim()).filter(t => t.length > 0);

    if (botTokens.length === 0) {
      throw new StorageError(
        'Telegram Bot Token 配置无效',
        StorageProvider.TELEGRAM,
        'ENV_CONFIG_INVALID',
        { tokenString: botTokensString }
      );
    }

    return {
      botTokens,
      timeout: timeout ? parseInt(timeout, 10) : undefined,
      chatId: chatId || undefined
    };
  }

  /**
   * 创建多图床管理配置
   */
  static createMultiStorageConfig(): MultiStorageConfig {
    const primaryProvider = (process.env.PRIMARY_STORAGE_PROVIDER as StorageProvider) || StorageProvider.CLOUDINARY;
    const backupProvider = process.env.BACKUP_STORAGE_PROVIDER as StorageProvider;
    const failoverStrategy = (process.env.FAILOVER_STRATEGY as FailoverStrategy) || FailoverStrategy.RETRY_THEN_FAILOVER;
    
    return {
      primaryProvider,
      backupProvider,
      failoverStrategy,
      retryAttempts: parseInt(process.env.STORAGE_RETRY_ATTEMPTS || '3', 10),
      retryDelay: parseInt(process.env.STORAGE_RETRY_DELAY || '1000', 10),
      healthCheckInterval: parseInt(process.env.STORAGE_HEALTH_CHECK_INTERVAL || '300', 10),
      enableBackupUpload: process.env.ENABLE_BACKUP_UPLOAD === 'true'
    };
  }
}

/**
 * 单例图床服务管理器
 */
export class StorageServiceManager {
  private static instance: StorageServiceManager;
  private factory: StorageServiceFactory;
  private services: Map<StorageProvider, ImageStorageService> = new Map();

  private constructor() {
    this.factory = new DefaultStorageServiceFactory();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): StorageServiceManager {
    if (!StorageServiceManager.instance) {
      StorageServiceManager.instance = new StorageServiceManager();
    }
    return StorageServiceManager.instance;
  }

  /**
   * 获取或创建图床服务
   */
  getService(provider: StorageProvider): ImageStorageService {
    if (!this.services.has(provider)) {
      const config = this.getProviderConfig(provider);
      const service = this.factory.createService(provider, config);
      this.services.set(provider, service);
    }
    
    return this.services.get(provider)!;
  }

  /**
   * 清除缓存的服务实例
   */
  clearCache(): void {
    this.services.clear();
  }

  /**
   * 获取提供商配置
   */
  private getProviderConfig(provider: StorageProvider): Record<string, any> {
    switch (provider) {
      case StorageProvider.CLOUDINARY:
        return EnvironmentConfigFactory.createCloudinaryConfig();

      case StorageProvider.TGSTATE:
        return EnvironmentConfigFactory.createTgStateConfig();

      case StorageProvider.TELEGRAM:
        return EnvironmentConfigFactory.createTelegramConfig();

      default:
        throw new StorageError(
          `不支持的图床服务提供商: ${provider}`,
          provider,
          'UNSUPPORTED_PROVIDER'
        );
    }
  }
}

// 导出默认实例
export const storageServiceManager = StorageServiceManager.getInstance();
