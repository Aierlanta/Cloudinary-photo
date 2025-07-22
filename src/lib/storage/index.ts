/**
 * 图床存储服务统一入口
 * 导出所有图床相关的类型、接口和服务
 */

// 基础类型和接口
export {
  ImageStorageService,
  StorageError
} from './base';

export type {
  StorageResult,
  UploadOptions,
  HealthStatus,
  StorageStats,
  MultiStorageConfig,
  StorageOperationResult,
  StorageServiceFactory
} from './base';

// 重新导出枚举
export { StorageProvider, FailoverStrategy } from './base';

// 具体实现
export { CloudinaryService } from './cloudinary';
export type { CloudinaryConfig } from './cloudinary';
export { TgStateService } from './tgstate';
export type { TgStateConfig } from './tgstate';
export { MultiStorageManager } from './manager';
export {
  DefaultStorageServiceFactory,
  EnvironmentConfigFactory,
  StorageServiceManager,
  storageServiceManager
} from './factory';

// 便捷函数
import { MultiStorageManager } from './manager';
import { EnvironmentConfigFactory, storageServiceManager } from './factory';
import { StorageProvider } from './base';

/**
 * 创建配置好的多图床管理器
 */
export function createMultiStorageManager(): MultiStorageManager {
  const config = EnvironmentConfigFactory.createMultiStorageConfig();
  const manager = new MultiStorageManager(config);

  // 注册主要图床服务
  const primaryService = storageServiceManager.getService(config.primaryProvider);
  manager.registerService(primaryService);

  // 注册备用图床服务（如果配置了）
  if (config.backupProvider) {
    const backupService = storageServiceManager.getService(config.backupProvider);
    manager.registerService(backupService);
  }

  return manager;
}

/**
 * 获取单个图床服务
 */
export function getStorageService(provider: StorageProvider) {
  return storageServiceManager.getService(provider);
}

/**
 * 默认的多图床管理器实例
 */
let defaultManager: MultiStorageManager | null = null;

/**
 * 获取默认的多图床管理器
 */
export function getDefaultStorageManager(): MultiStorageManager {
  if (!defaultManager) {
    defaultManager = createMultiStorageManager();
  }
  return defaultManager;
}

/**
 * 重置默认管理器（主要用于测试）
 */
export function resetDefaultStorageManager(): void {
  defaultManager = null;
  storageServiceManager.clearCache();
}
