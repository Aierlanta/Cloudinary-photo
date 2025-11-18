/**
 * 图床服务配置统一管理
 * 集中管理图床服务的启用状态和配置逻辑
 * 
 * @module storage/config
 */

import { StorageProvider } from './base';
import { StorageError } from './base';

/**
 * 检查指定图床服务是否启用
 * 默认策略：未设置环境变量时视为启用（向后兼容）
 * 
 * @param provider - 图床服务提供商
 * @returns 是否启用该服务
 * 
 * @example
 * ```typescript
 * // 检查 Cloudinary 是否启用
 * if (isStorageEnabled(StorageProvider.CLOUDINARY)) {
 *   // 使用 Cloudinary
 * }
 * ```
 */
export function isStorageEnabled(provider: StorageProvider): boolean {
  switch (provider) {
    case StorageProvider.CLOUDINARY:
      return process.env.CLOUDINARY_ENABLE !== 'false';
    case StorageProvider.TGSTATE:
      return process.env.TGSTATE_ENABLE !== 'false';
    case StorageProvider.TELEGRAM:
      return process.env.TELEGRAM_ENABLE !== 'false';
    default:
      return false;
  }
}

/**
 * 获取所有启用的图床服务（字符串形式）
 * 用于需要字符串表示的场景（如 API 响应、前端交互）
 * 
 * @returns 启用的服务列表（字符串数组）
 * 
 * @example
 * ```typescript
 * const providers = getEnabledProvidersAsStrings();
 * // ['cloudinary', 'tgstate'] 或 ['cloudinary'] 等
 * ```
 */
export function getEnabledProvidersAsStrings(): string[] {
  return [
    ...(isStorageEnabled(StorageProvider.CLOUDINARY) ? ['cloudinary'] : []),
    ...(isStorageEnabled(StorageProvider.TGSTATE) ? ['tgstate'] : []),
    ...(isStorageEnabled(StorageProvider.TELEGRAM) ? ['telegram'] : []),
  ];
}

/**
 * 获取所有启用的图床服务（枚举形式）
 * 用于需要强类型的场景（如服务注册、内部逻辑）
 * 
 * @returns 启用的服务列表（枚举数组）
 * 
 * @example
 * ```typescript
 * const providers = getEnabledProviders();
 * // [StorageProvider.CLOUDINARY, StorageProvider.TGSTATE]
 * ```
 */
export function getEnabledProviders(): StorageProvider[] {
  return [
    StorageProvider.CLOUDINARY,
    StorageProvider.TGSTATE,
    StorageProvider.TELEGRAM
  ].filter(isStorageEnabled);
}

/**
 * 验证是否至少有一个图床服务启用
 * 如果没有启用任何服务，抛出 StorageError
 * 
 * @throws {StorageError} 当所有服务都被禁用时
 * 
 * @example
 * ```typescript
 * try {
 *   validateAtLeastOneEnabled();
 *   // 继续执行需要图床服务的逻辑
 * } catch (error) {
 *   // 处理无可用服务的情况
 * }
 * ```
 */
export function validateAtLeastOneEnabled(): void {
  if (getEnabledProviders().length === 0) {
    throw new StorageError(
      '未启用任何图床服务，请在环境变量中至少启用一个（CLOUDINARY_ENABLE 或 TGSTATE_ENABLE）',
      StorageProvider.CLOUDINARY, // 占位符，因为没有明确的提供商上下文
      'NO_STORAGE_ENABLED',
      {
        hint: '请检查环境变量：CLOUDINARY_ENABLE、TGSTATE_ENABLE',
        defaultBehavior: '未设置时默认启用，设置为 "false" 时禁用'
      }
    );
  }
}

/**
 * 获取默认图床服务（第一个启用的服务）
 * 
 * @returns 第一个启用的服务，如果没有则返回 undefined
 * 
 * @example
 * ```typescript
 * const defaultProvider = getDefaultProvider();
 * if (defaultProvider) {
 *   console.log(`使用默认图床: ${defaultProvider}`);
 * }
 * ```
 */
export function getDefaultProvider(): StorageProvider | undefined {
  return getEnabledProviders()[0];
}

/**
 * 检查指定的提供商是否在启用列表中
 * 
 * @param provider - 要检查的提供商（字符串或枚举）
 * @returns 是否启用
 * 
 * @example
 * ```typescript
 * if (isProviderInEnabledList('cloudinary')) {
 *   // Cloudinary 已启用
 * }
 * ```
 */
export function isProviderInEnabledList(provider: string | StorageProvider): boolean {
  const enabledList = getEnabledProvidersAsStrings();
  const providerStr = typeof provider === 'string' ? provider : String(provider);
  return enabledList.includes(providerStr);
}

