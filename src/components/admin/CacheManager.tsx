"use client";

import { useState, useEffect } from 'react';
import { getCacheStats, cleanupCache, clearAllCache } from '@/hooks/useCachedImage';
import { cachePrewarmingService } from '@/lib/cache/prewarming';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/ui/Toast';
import { useLocale } from '@/hooks/useLocale';

interface CacheStats {
  totalItems: number;
  totalSize: number;
  hitRate: number;
  totalRequests: number;
  cacheHits: number;
}

/**
 * 缓存管理组件
 * 提供缓存状态查看和管理功能
 */
export default function CacheManager() {
  const { t } = useLocale();
  const [stats, setStats] = useState<CacheStats>({
    totalItems: 0,
    totalSize: 0,
    hitRate: 0,
    totalRequests: 0,
    cacheHits: 0
  });
  const [prewarmingStatus, setPrewarmingStatus] = useState({
    isPrewarming: false,
    queueLength: 0,
    prewarmedCount: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toasts, success, error: showError, removeToast } = useToast();

  // 更新统计信息
  const updateStats = () => {
    setStats(getCacheStats());
    setPrewarmingStatus(cachePrewarmingService.getPrewarmingStatus());
  };

  // 格式化文件大小
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 清理过期缓存
  const handleCleanup = async () => {
    setIsLoading(true);
    try {
      await cleanupCache();
      updateStats();
      success(t.adminCache.cleanupSuccess, t.adminCache.cleanupSuccessMessage);
    } catch (error) {
      console.error('清理缓存失败:', error);
      showError(t.adminCache.cleanupFailed, error instanceof Error ? error.message : t.adminCache.unknownError);
    } finally {
      setIsLoading(false);
    }
  };

  // 清空所有缓存
  const handleClearAll = async () => {
    if (!confirm(t.adminCache.confirmClearAll)) {
      return;
    }

    setIsLoading(true);
    try {
      await clearAllCache();
      cachePrewarmingService.clearPrewarmingHistory();
      updateStats();
      success(t.adminCache.clearAllSuccess, t.adminCache.clearAllSuccessMessage);
    } catch (error) {
      console.error('清空缓存失败:', error);
      showError(t.adminCache.clearAllFailed, error instanceof Error ? error.message : t.adminCache.unknownError);
    } finally {
      setIsLoading(false);
    }
  };

  // 停止预热
  const handleStopPrewarming = () => {
    cachePrewarmingService.stopPrewarming();
    updateStats();
  };

  useEffect(() => {
    updateStats();
    
    // 定期更新统计信息
    const interval = setInterval(updateStats, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {t.adminCache.title}
        </h2>
        <button
          onClick={updateStats}
          className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
        >
          {t.adminCache.refresh}
        </button>
      </div>

      {/* 缓存统计 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">{t.adminCache.cacheItems}</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats.totalItems}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">{t.adminCache.cacheSize}</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatSize(stats.totalSize)}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">{t.adminCache.hitRate}</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats.hitRate.toFixed(1)}%
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">{t.adminCache.totalRequests}</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats.totalRequests}
          </div>
        </div>
      </div>

      {/* 预热状态 */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
          {t.adminCache.prewarmingStatus}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{t.adminCache.prewarmingState}</div>
            <div className={`text-lg font-medium ${
              prewarmingStatus.isPrewarming 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-gray-900 dark:text-white'
            }`}>
              {prewarmingStatus.isPrewarming ? t.adminCache.statusInProgress : t.adminCache.statusIdle}
            </div>
          </div>
          
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{t.adminCache.queueLength}</div>
            <div className="text-lg font-medium text-gray-900 dark:text-white">
              {prewarmingStatus.queueLength}
            </div>
          </div>
          
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{t.adminCache.prewarmed}</div>
            <div className="text-lg font-medium text-gray-900 dark:text-white">
              {prewarmingStatus.prewarmedCount}
            </div>
          </div>
        </div>

        {prewarmingStatus.isPrewarming && (
          <button
            onClick={handleStopPrewarming}
            className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
          >
            {t.adminCache.stopPrewarming}
          </button>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleCleanup}
          disabled={isLoading}
          className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 text-white rounded-md transition-colors"
        >
          {isLoading ? t.adminCache.cleaning : t.adminCache.cleanupExpired}
        </button>

        <button
          onClick={handleClearAll}
          disabled={isLoading}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-md transition-colors"
        >
          {isLoading ? t.adminCache.clearing : t.adminCache.clearAll}
        </button>
      </div>

      {/* 缓存说明 */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
          {t.adminCache.cacheDescription}
        </h4>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>{t.adminCache.descriptionLine1}</li>
          <li>{t.adminCache.descriptionLine2}</li>
          <li>{t.adminCache.descriptionLine3}</li>
          <li>{t.adminCache.descriptionLine4}</li>
        </ul>
      </div>
    </div>
    <ToastContainer toasts={toasts.map((toast) => ({ ...toast, onClose: removeToast }))} />
    </>
  );
}
