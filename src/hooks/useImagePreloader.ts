"use client";

import { useEffect, useRef, useCallback } from 'react';

interface PreloadOptions {
  /**
   * 预加载的图片数量
   */
  preloadCount?: number;
  /**
   * 触发预加载的距离阈值（像素）
   */
  threshold?: number;
  /**
   * 是否启用预加载
   */
  enabled?: boolean;
}

interface ImageItem {
  url: string;
  id: string;
}

/**
 * 图片预加载Hook
 * 在用户滚动时预加载即将显示的图片，提升用户体验
 */
export function useImagePreloader(
  images: ImageItem[],
  currentIndex: number,
  options: PreloadOptions = {}
) {
  const {
    preloadCount = 3,
    threshold = 500,
    enabled = true
  } = options;

  const preloadedImages = useRef<Set<string>>(new Set());
  const preloadQueue = useRef<string[]>([]);
  const isPreloading = useRef(false);

  /**
   * 预加载单个图片
   */
  const preloadImage = useCallback((url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (preloadedImages.current.has(url)) {
        resolve();
        return;
      }

      const img = new window.Image();
      
      img.onload = () => {
        preloadedImages.current.add(url);
        resolve();
      };
      
      img.onerror = () => {
        console.warn(`图片预加载失败: ${url}`);
        reject(new Error(`Failed to preload image: ${url}`));
      };
      
      img.src = url;
    });
  }, []);

  /**
   * 批量预加载图片
   */
  const preloadBatch = useCallback(async (urls: string[]) => {
    if (isPreloading.current || !enabled) return;
    
    isPreloading.current = true;
    
    try {
      // 并发预加载，但限制并发数量
      const batchSize = 2;
      for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        await Promise.allSettled(
          batch.map(url => preloadImage(url))
        );
      }
    } catch (error) {
      console.warn('批量预加载失败:', error);
    } finally {
      isPreloading.current = false;
    }
  }, [preloadImage, enabled]);

  /**
   * 获取需要预加载的图片URL列表
   */
  const getPreloadUrls = useCallback((index: number): string[] => {
    const urls: string[] = [];
    
    // 预加载当前位置之后的图片
    for (let i = 1; i <= preloadCount; i++) {
      const nextIndex = index + i;
      if (nextIndex < images.length) {
        urls.push(images[nextIndex].url);
      }
    }
    
    // 预加载当前位置之前的图片（向上滚动时有用）
    for (let i = 1; i <= Math.min(preloadCount, 2); i++) {
      const prevIndex = index - i;
      if (prevIndex >= 0) {
        urls.push(images[prevIndex].url);
      }
    }
    
    return urls.filter(url => !preloadedImages.current.has(url));
  }, [images, preloadCount]);

  /**
   * 触发预加载
   */
  const triggerPreload = useCallback((index: number) => {
    if (!enabled) return;
    
    const urlsToPreload = getPreloadUrls(index);
    if (urlsToPreload.length > 0) {
      preloadBatch(urlsToPreload);
    }
  }, [enabled, getPreloadUrls, preloadBatch]);

  /**
   * 清理预加载缓存
   */
  const clearPreloadCache = useCallback(() => {
    preloadedImages.current.clear();
    preloadQueue.current = [];
  }, []);

  /**
   * 检查图片是否已预加载
   */
  const isImagePreloaded = useCallback((url: string): boolean => {
    return preloadedImages.current.has(url);
  }, []);

  // 监听当前索引变化，触发预加载
  useEffect(() => {
    if (enabled && currentIndex >= 0 && currentIndex < images.length) {
      triggerPreload(currentIndex);
    }
  }, [currentIndex, enabled, images.length, triggerPreload]);

  // 初始预加载
  useEffect(() => {
    if (enabled && images.length > 0) {
      const initialUrls = getPreloadUrls(0);
      if (initialUrls.length > 0) {
        preloadBatch(initialUrls);
      }
    }
  }, [enabled, images.length, getPreloadUrls, preloadBatch]);

  return {
    triggerPreload,
    clearPreloadCache,
    isImagePreloaded,
    preloadedCount: preloadedImages.current.size
  };
}

/**
 * 简化版的图片预加载Hook
 * 用于单个图片的预加载
 */
export function useImagePreload(url: string, enabled: boolean = true) {
  const preloaded = useRef(false);

  useEffect(() => {
    if (!enabled || !url || preloaded.current) return;

    const img = new window.Image();
    img.onload = () => {
      preloaded.current = true;
    };
    img.onerror = () => {
      console.warn(`图片预加载失败: ${url}`);
    };
    img.src = url;
  }, [url, enabled]);

  return preloaded.current;
}
