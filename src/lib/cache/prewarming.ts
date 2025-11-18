"use client";

import { imageCacheManager } from './imageCache';
import { generateThumbnailUrl, isTelegramImage } from '@/lib/image-utils';

interface PrewarmConfig {
  /**
   * 最大预热图片数量
   */
  maxImages?: number;
  /**
   * 预热的图片尺寸
   */
  thumbnailSize?: number;
  /**
   * 并发预热数量
   */
  concurrency?: number;
  /**
   * 预热延迟（毫秒）
   */
  delay?: number;
  /**
   * 是否在空闲时预热
   */
  onIdle?: boolean;
}

interface ImageData {
  id: string;
  url: string;
  publicId: string;
  title?: string;
}

/**
 * 缓存预热管理器
 * 负责在页面加载时预热常用图片缓存
 */
export class CachePrewarmingService {
  private config: Required<PrewarmConfig>;
  private isPrewarming = false;
  private prewarmQueue: string[] = [];
  private prewarmedUrls = new Set<string>();

  constructor(config: PrewarmConfig = {}) {
    this.config = {
      maxImages: config.maxImages || 20,
      thumbnailSize: config.thumbnailSize || 300,
      concurrency: config.concurrency || 3,
      delay: config.delay || 100,
      onIdle: config.onIdle !== false
    };
  }

  /**
   * 开始预热缓存
   */
  async startPrewarming(images: ImageData[]): Promise<void> {
    // 检查是否在客户端环境
    if (typeof window === 'undefined') {
      return;
    }

    if (this.isPrewarming) {
      console.log('Cache prewarming already in progress');
      return;
    }

    this.isPrewarming = true;
    console.log(`Starting cache prewarming for ${Math.min(images.length, this.config.maxImages)} images`);

    try {
      // 选择要预热的图片
      const imagesToPrewarm = this.selectImagesForPrewarming(images);
      
      // 生成缩略图URL，并跳过 Telegram 直链（避免浏览器端 CORS 报错）
      const thumbnailUrls = imagesToPrewarm
        .map(image => generateThumbnailUrl(image.url, this.config.thumbnailSize))
        .filter(url => !isTelegramImage(url));

      // 过滤已缓存的图片
      const uncachedUrls = await this.filterUncachedUrls(thumbnailUrls);
      
      if (uncachedUrls.length === 0) {
        console.log('All selected images are already cached');
        return;
      }

      console.log(`Prewarming ${uncachedUrls.length} uncached images`);

      // 根据配置选择预热策略
      if (this.config.onIdle) {
        this.prewarmOnIdle(uncachedUrls);
      } else {
        await this.prewarmImmediately(uncachedUrls);
      }

    } catch (error) {
      console.error('Cache prewarming failed:', error);
    } finally {
      this.isPrewarming = false;
    }
  }

  /**
   * 选择要预热的图片
   */
  private selectImagesForPrewarming(images: ImageData[]): ImageData[] {
    // 简单策略：选择前N张图片
    // 可以根据需要实现更复杂的策略（如访问频率、最近上传等）
    return images.slice(0, this.config.maxImages);
  }

  /**
   * 过滤未缓存的URL
   */
  private async filterUncachedUrls(urls: string[]): Promise<string[]> {
    const uncachedUrls: string[] = [];
    
    for (const url of urls) {
      if (this.prewarmedUrls.has(url)) {
        continue;
      }

      const cached = await imageCacheManager.get(url);
      if (!cached) {
        uncachedUrls.push(url);
      }
    }

    return uncachedUrls;
  }

  /**
   * 立即预热
   */
  private async prewarmImmediately(urls: string[]): Promise<void> {
    const batches = this.createBatches(urls, this.config.concurrency);
    
    for (const batch of batches) {
      await Promise.allSettled(
        batch.map(url => this.prewarmSingleImage(url))
      );
      
      // 批次间延迟
      if (this.config.delay > 0) {
        await this.sleep(this.config.delay);
      }
    }
  }

  /**
   * 在空闲时预热
   */
  private prewarmOnIdle(urls: string[]): void {
    if (typeof window === 'undefined') return;

    this.prewarmQueue = [...urls];
    this.scheduleIdlePrewarming();
  }

  /**
   * 调度空闲预热
   */
  private scheduleIdlePrewarming(): void {
    if (this.prewarmQueue.length === 0) {
      return;
    }

    if ('requestIdleCallback' in window) {
      requestIdleCallback((deadline) => {
        this.processIdlePrewarming(deadline);
      });
    } else {
      // 降级到setTimeout
      setTimeout(() => {
        this.processIdlePrewarming({ timeRemaining: () => 50 } as IdleDeadline);
      }, 100);
    }
  }

  /**
   * 处理空闲预热
   */
  private processIdlePrewarming(deadline: IdleDeadline): void {
    while (deadline.timeRemaining() > 10 && this.prewarmQueue.length > 0) {
      const url = this.prewarmQueue.shift();
      if (url) {
        this.prewarmSingleImage(url).catch(error => {
          console.warn(`Failed to prewarm image: ${url}`, error);
        });
      }
    }

    // 如果还有图片需要预热，继续调度
    if (this.prewarmQueue.length > 0) {
      this.scheduleIdlePrewarming();
    }
  }

  /**
   * 预热单个图片
   */
  private async prewarmSingleImage(url: string): Promise<void> {
    try {
      const response = await fetch(url, {
        cache: 'default',
        priority: 'low'
      } as RequestInit);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      await imageCacheManager.set(url, blob);
      
      this.prewarmedUrls.add(url);
      console.log(`Prewarmed image: ${url}`);

    } catch (error) {
      console.warn(`Failed to prewarm image: ${url}`, error);
    }
  }

  /**
   * 创建批次
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 停止预热
   */
  stopPrewarming(): void {
    this.isPrewarming = false;
    this.prewarmQueue = [];
  }

  /**
   * 获取预热状态
   */
  getPrewarmingStatus(): {
    isPrewarming: boolean;
    queueLength: number;
    prewarmedCount: number;
  } {
    return {
      isPrewarming: this.isPrewarming,
      queueLength: this.prewarmQueue.length,
      prewarmedCount: this.prewarmedUrls.size
    };
  }

  /**
   * 清除预热记录
   */
  clearPrewarmingHistory(): void {
    this.prewarmedUrls.clear();
  }
}

// 单例实例 - 只在客户端创建
export const cachePrewarmingService = typeof window !== 'undefined'
  ? new CachePrewarmingService()
  : null as any;

/**
 * 预热图片缓存的便捷函数
 */
export async function prewarmImageCache(
  images: ImageData[],
  config?: PrewarmConfig
): Promise<void> {
  const service = config ? new CachePrewarmingService(config) : cachePrewarmingService;
  await service.startPrewarming(images);
}

/**
 * 在页面加载时自动预热缓存
 */
export function setupAutoPrewarming(
  getImages: () => Promise<ImageData[]>,
  config?: PrewarmConfig
): void {
  if (typeof window === 'undefined') return;

  const prewarm = async () => {
    try {
      const images = await getImages();
      await prewarmImageCache(images, config);
    } catch (error) {
      console.error('Auto prewarming failed:', error);
    }
  };

  // 页面加载完成后预热
  if (document.readyState === 'complete') {
    setTimeout(prewarm, 1000); // 延迟1秒开始预热
  } else {
    window.addEventListener('load', () => {
      setTimeout(prewarm, 1000);
    });
  }
}
