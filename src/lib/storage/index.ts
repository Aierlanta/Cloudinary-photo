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

// 导出配置管理工具
export {
  isStorageEnabled,
  getEnabledProviders,
  getEnabledProvidersAsStrings,
  validateAtLeastOneEnabled,
  getDefaultProvider,
  isProviderInEnabledList
} from './config';

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
import { StorageProvider, StorageError } from './base';
import { getEnabledProviders, validateAtLeastOneEnabled, isStorageEnabled } from './config';

/**
 * 创建配置好的多图床管理器
 */
export function createMultiStorageManager(): MultiStorageManager {
  const config = EnvironmentConfigFactory.createMultiStorageConfig();

  // ✅ 修复问题 #1：前置验证，确保至少有一个服务启用
  validateAtLeastOneEnabled();

  // 计算已启用的提供商（使用统一配置模块）
  const availableProviders = getEnabledProviders();

  // 根据开关矫正 Primary/Backup
  // 注意：此时 availableProviders 至少有一个元素（已通过 validateAtLeastOneEnabled 验证）
  const effectivePrimary = isStorageEnabled(config.primaryProvider)
    ? config.primaryProvider
    : availableProviders[0]; // 安全：availableProviders 不为空

  let effectiveBackup = (config.backupProvider && isStorageEnabled(config.backupProvider))
    ? config.backupProvider
    : undefined;

  if (!effectiveBackup && availableProviders.length > 1) {
    // 若未显式设置备份且存在第二个已启用的提供商，则选择其为备份（与主不同）
    const candidate = availableProviders.find(p => p !== effectivePrimary);
    if (candidate) effectiveBackup = candidate;
  }

  const manager = new MultiStorageManager({
    ...config,
    primaryProvider: effectivePrimary,
    backupProvider: effectiveBackup && effectiveBackup !== effectivePrimary ? effectiveBackup : undefined,
  });

  // 注册已启用的服务（此时确保至少有一个服务会被注册）
  const primaryService = storageServiceManager.getService(effectivePrimary);
  manager.registerService(primaryService);

  if (effectiveBackup && effectiveBackup !== effectivePrimary) {
    const backupService = storageServiceManager.getService(effectiveBackup);
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
