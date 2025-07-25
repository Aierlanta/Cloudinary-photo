"use client";

import { useEffect, useRef } from 'react';
import { cachePrewarmingService } from '@/lib/cache/prewarming';
import { generateThumbnailUrl } from '@/lib/image-utils';

interface ImageData {
  id: string;
  url: string;
  publicId: string;
  title?: string;
}

interface UseImageCachePrewarmingOptions {
  /**
   * 是否启用预热
   */
  enabled?: boolean;
  /**
   * 最大预热图片数量
   */
  maxImages?: number;
  /**
   * 预热延迟（毫秒）
   */
  delay?: number;
  /**
   * 是否在空闲时预热
   */
  onIdle?: boolean;
  /**
   * 缩略图尺寸
   */
  thumbnailSize?: number;
}

/**
 * 图片缓存预热Hook
 * 在图片列表加载时自动预热缓存
 */
export function useImageCachePrewarming(
  images: ImageData[],
  options: UseImageCachePrewarmingOptions = {}
) {
  const {
    enabled = true,
    maxImages = 20,
    delay = 2000, // 延迟2秒开始预热
    onIdle = true,
    thumbnailSize = 300
  } = options;

  const hasPrewarmed = useRef(false);
  const prewarmTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!enabled || images.length === 0 || hasPrewarmed.current) {
      return;
    }

    // 清除之前的定时器
    if (prewarmTimeoutRef.current) {
      clearTimeout(prewarmTimeoutRef.current);
    }

    // 延迟开始预热，避免影响页面初始加载
    prewarmTimeoutRef.current = setTimeout(async () => {
      try {
        console.log('Starting image cache prewarming...');
        
        if (cachePrewarmingService) {
          await cachePrewarmingService.startPrewarming(images.slice(0, maxImages));
        }
        hasPrewarmed.current = true;
        
        console.log('Image cache prewarming completed');
      } catch (error) {
        console.error('Image cache prewarming failed:', error);
      }
    }, delay);

    return () => {
      if (prewarmTimeoutRef.current) {
        clearTimeout(prewarmTimeoutRef.current);
      }
    };
  }, [images, enabled, maxImages, delay, onIdle, thumbnailSize]);

  // 组件卸载时停止预热
  useEffect(() => {
    return () => {
      if (cachePrewarmingService) {
        cachePrewarmingService.stopPrewarming();
      }
    };
  }, []);

  return {
    /**
     * 手动触发预热
     */
    triggerPrewarming: async () => {
      if (images.length > 0 && cachePrewarmingService) {
        await cachePrewarmingService.startPrewarming(images.slice(0, maxImages));
        hasPrewarmed.current = true;
      }
    },
    
    /**
     * 获取预热状态
     */
    getPrewarmingStatus: () => cachePrewarmingService ? cachePrewarmingService.getPrewarmingStatus() : {
      isPrewarming: false,
      queueLength: 0,
      prewarmedCount: 0
    },
    
    /**
     * 重置预热状态
     */
    resetPrewarming: () => {
      hasPrewarmed.current = false;
      if (cachePrewarmingService) {
        cachePrewarmingService.clearPrewarmingHistory();
      }
    }
  };
}

/**
 * 页面级别的缓存预热Hook
 * 适用于整个应用的图片预热策略
 */
export function useGlobalImagePrewarming(
  getImages: () => Promise<ImageData[]>,
  options: UseImageCachePrewarmingOptions = {}
) {
  const {
    enabled = true,
    delay = 3000, // 全局预热延迟更长
    maxImages = 15
  } = options;

  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!enabled || hasInitialized.current) {
      return;
    }

    hasInitialized.current = true;

    const initPrewarming = async () => {
      try {
        // 等待页面完全加载
        if (document.readyState !== 'complete') {
          await new Promise(resolve => {
            window.addEventListener('load', resolve, { once: true });
          });
        }

        // 额外延迟确保页面稳定
        await new Promise(resolve => setTimeout(resolve, delay));

        const images = await getImages();
        if (images.length > 0) {
          console.log('Starting global image cache prewarming...');
          if (cachePrewarmingService) {
            await cachePrewarmingService.startPrewarming(images.slice(0, maxImages));
          }
          console.log('Global image cache prewarming completed');
        }
      } catch (error) {
        console.error('Global image cache prewarming failed:', error);
      }
    };

    initPrewarming();
  }, [enabled, delay, maxImages, getImages]);

  return {
    /**
     * 手动触发全局预热
     */
    triggerGlobalPrewarming: async () => {
      try {
        const images = await getImages();
        if (images.length > 0 && cachePrewarmingService) {
          await cachePrewarmingService.startPrewarming(images.slice(0, maxImages));
        }
      } catch (error) {
        console.error('Manual global prewarming failed:', error);
      }
    }
  };
}

/**
 * 智能预热Hook
 * 根据用户行为动态调整预热策略
 */
export function useSmartImagePrewarming(
  images: ImageData[],
  currentIndex: number,
  options: UseImageCachePrewarmingOptions = {}
) {
  const {
    enabled = true,
    maxImages = 5, // 智能预热数量较少
    thumbnailSize = 300
  } = options;

  const lastIndex = useRef(currentIndex);

  useEffect(() => {
    if (!enabled || images.length === 0) {
      return;
    }

    // 检测用户滚动方向
    const isScrollingDown = currentIndex > lastIndex.current;
    const isScrollingUp = currentIndex < lastIndex.current;
    lastIndex.current = currentIndex;

    // 根据滚动方向预热图片
    const imagesToPrewarm: ImageData[] = [];
    
    if (isScrollingDown) {
      // 向下滚动，预热后面的图片
      for (let i = 1; i <= maxImages; i++) {
        const nextIndex = currentIndex + i;
        if (nextIndex < images.length) {
          imagesToPrewarm.push(images[nextIndex]);
        }
      }
    } else if (isScrollingUp) {
      // 向上滚动，预热前面的图片
      for (let i = 1; i <= maxImages; i++) {
        const prevIndex = currentIndex - i;
        if (prevIndex >= 0) {
          imagesToPrewarm.push(images[prevIndex]);
        }
      }
    }

    if (imagesToPrewarm.length > 0) {
      // 使用低优先级预热
      setTimeout(() => {
        if (cachePrewarmingService) {
          cachePrewarmingService.startPrewarming(imagesToPrewarm);
        }
      }, 100);
    }
  }, [currentIndex, images, enabled, maxImages, thumbnailSize]);

  return {
    /**
     * 预热指定范围的图片
     */
    prewarmRange: async (startIndex: number, endIndex: number) => {
      const rangeImages = images.slice(startIndex, endIndex + 1);
      if (rangeImages.length > 0 && cachePrewarmingService) {
        await cachePrewarmingService.startPrewarming(rangeImages);
      }
    }
  };
}
