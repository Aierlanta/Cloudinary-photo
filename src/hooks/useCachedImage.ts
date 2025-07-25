"use client";

import { useState, useEffect, useCallback } from 'react';
import { imageCacheManager } from '@/lib/cache/imageCache';

interface UseCachedImageOptions {
  /**
   * 是否启用缓存
   */
  enableCache?: boolean;
  /**
   * 缓存失败时是否回退到原始URL
   */
  fallbackToOriginal?: boolean;
  /**
   * 请求超时时间（毫秒）
   */
  timeout?: number;
}

interface CachedImageState {
  /**
   * 实际使用的图片URL（可能是blob URL）
   */
  src: string;
  /**
   * 是否正在加载
   */
  loading: boolean;
  /**
   * 是否加载完成
   */
  loaded: boolean;
  /**
   * 是否有错误
   */
  error: boolean;
  /**
   * 是否来自缓存
   */
  fromCache: boolean;
  /**
   * 错误信息
   */
  errorMessage?: string;
}

/**
 * 带缓存功能的图片加载Hook
 * 自动管理图片的缓存和加载状态
 */
export function useCachedImage(
  originalUrl: string,
  options: UseCachedImageOptions = {}
): CachedImageState & {
  /**
   * 重新加载图片
   */
  reload: () => void;
  /**
   * 清除当前图片的缓存
   */
  clearCache: () => void;
} {
  const {
    enableCache = true,
    fallbackToOriginal = true,
    timeout = 10000
  } = options;

  const [state, setState] = useState<CachedImageState>({
    src: originalUrl,
    loading: false,
    loaded: false,
    error: false,
    fromCache: false
  });

  /**
   * 从网络加载图片并缓存
   */
  const loadFromNetwork = useCallback(async (url: string): Promise<string> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: 'default'
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();

      // 缓存图片
      if (enableCache && imageCacheManager) {
        try {
          await imageCacheManager.set(url, blob);
        } catch (cacheError) {
          console.warn('Failed to cache image:', cacheError);
        }
      }

      // 创建blob URL
      return URL.createObjectURL(blob);

    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }, [enableCache, timeout]);

  /**
   * 加载图片
   */
  const loadImage = useCallback(async (url: string) => {
    if (!url) return;

    setState(prev => ({
      ...prev,
      loading: true,
      error: false,
      errorMessage: undefined
    }));

    try {
      let imageSrc = url;
      let fromCache = false;

      // 尝试从缓存加载
      if (enableCache && imageCacheManager) {
        const cachedBlob = await imageCacheManager.get(url);
        if (cachedBlob) {
          imageSrc = URL.createObjectURL(cachedBlob);
          fromCache = true;
        }
      }

      // 如果没有缓存，从网络加载
      if (!fromCache) {
        imageSrc = await loadFromNetwork(url);
      }

      setState(prev => ({
        ...prev,
        src: imageSrc,
        loading: false,
        loaded: true,
        error: false,
        fromCache
      }));

    } catch (error) {
      console.error('Failed to load image:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: true,
        errorMessage,
        src: fallbackToOriginal ? originalUrl : prev.src,
        fromCache: false
      }));
    }
  }, [enableCache, loadFromNetwork, fallbackToOriginal, originalUrl]);

  /**
   * 重新加载图片
   */
  const reload = useCallback(() => {
    loadImage(originalUrl);
  }, [loadImage, originalUrl]);

  /**
   * 清除当前图片的缓存
   */
  const clearCache = useCallback(async () => {
    if (enableCache && imageCacheManager) {
      await imageCacheManager.delete(originalUrl);
    }
  }, [enableCache, originalUrl]);

  // 当URL改变时加载图片
  useEffect(() => {
    if (originalUrl) {
      loadImage(originalUrl);
    } else {
      setState({
        src: '',
        loading: false,
        loaded: false,
        error: false,
        fromCache: false
      });
    }

    // 清理blob URL
    return () => {
      if (state.src && state.src.startsWith('blob:')) {
        URL.revokeObjectURL(state.src);
      }
    };
  }, [originalUrl, loadImage]);

  // 组件卸载时清理blob URL
  useEffect(() => {
    return () => {
      if (state.src && state.src.startsWith('blob:')) {
        URL.revokeObjectURL(state.src);
      }
    };
  }, [state.src]);

  return {
    ...state,
    reload,
    clearCache
  };
}

/**
 * 批量预加载图片到缓存
 */
export async function preloadImagesToCache(urls: string[]): Promise<void> {
  if (!imageCacheManager) return;

  const promises = urls.map(async (url) => {
    try {
      // 检查是否已缓存
      const cached = await imageCacheManager.get(url);
      if (cached) return;

      // 加载并缓存
      const response = await fetch(url);
      if (response.ok) {
        const blob = await response.blob();
        await imageCacheManager.set(url, blob);
      }
    } catch (error) {
      console.warn(`Failed to preload image: ${url}`, error);
    }
  });

  await Promise.allSettled(promises);
}

/**
 * 获取缓存统计信息
 */
export function getCacheStats() {
  return imageCacheManager ? imageCacheManager.getStats() : {
    totalItems: 0,
    totalSize: 0,
    hitRate: 0,
    totalRequests: 0,
    cacheHits: 0
  };
}

/**
 * 清理过期缓存
 */
export function cleanupCache() {
  return imageCacheManager ? imageCacheManager.cleanup() : Promise.resolve();
}

/**
 * 清空所有缓存
 */
export function clearAllCache() {
  return imageCacheManager ? imageCacheManager.clear() : Promise.resolve();
}
