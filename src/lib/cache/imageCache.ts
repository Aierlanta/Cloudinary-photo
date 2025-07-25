"use client";

interface CacheItem {
  url: string;
  blob: Blob;
  timestamp: number;
  size: number;
  accessCount: number;
  lastAccessed: number;
}

interface CacheStats {
  totalItems: number;
  totalSize: number;
  hitRate: number;
  totalRequests: number;
  cacheHits: number;
}

/**
 * 客户端图片缓存管理器
 * 使用IndexedDB存储图片数据，提供高效的缓存机制
 */
export class ImageCacheManager {
  private dbName = 'ImageCache';
  private dbVersion = 1;
  private storeName = 'images';
  private db: IDBDatabase | null = null;
  private maxCacheSize = 100 * 1024 * 1024; // 100MB
  private maxCacheAge = 7 * 24 * 60 * 60 * 1000; // 7天
  private stats: CacheStats = {
    totalItems: 0,
    totalSize: 0,
    hitRate: 0,
    totalRequests: 0,
    cacheHits: 0
  };

  constructor() {
    // 只在客户端环境初始化
    if (typeof window !== 'undefined') {
      this.initDB();
    }
  }

  /**
   * 初始化IndexedDB
   */
  private async initDB(): Promise<void> {
    // 检查是否在客户端环境
    if (typeof window === 'undefined' || !window.indexedDB) {
      console.warn('IndexedDB not available, cache will be disabled');
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.loadStats();
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'url' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
        }
      };
    });
  }

  /**
   * 获取缓存的图片
   */
  async get(url: string): Promise<Blob | null> {
    // 检查是否在客户端环境
    if (typeof window === 'undefined') {
      return null;
    }

    if (!this.db) await this.initDB();

    this.stats.totalRequests++;

    return new Promise((resolve) => {
      if (!this.db) {
        resolve(null);
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(url);

      request.onsuccess = () => {
        const item: CacheItem = request.result;
        
        if (!item) {
          resolve(null);
          return;
        }

        // 检查是否过期
        if (Date.now() - item.timestamp > this.maxCacheAge) {
          this.delete(url);
          resolve(null);
          return;
        }

        // 更新访问统计
        item.accessCount++;
        item.lastAccessed = Date.now();
        store.put(item);

        this.stats.cacheHits++;
        this.updateHitRate();
        
        resolve(item.blob);
      };

      request.onerror = () => {
        console.error('Failed to get cached image:', request.error);
        resolve(null);
      };
    });
  }

  /**
   * 缓存图片
   */
  async set(url: string, blob: Blob): Promise<void> {
    // 检查是否在客户端环境
    if (typeof window === 'undefined') {
      return;
    }

    if (!this.db) await this.initDB();

    // 检查缓存大小限制
    await this.ensureCacheSize(blob.size);

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const item: CacheItem = {
        url,
        blob,
        timestamp: Date.now(),
        size: blob.size,
        accessCount: 1,
        lastAccessed: Date.now()
      };

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(item);

      request.onsuccess = () => {
        this.stats.totalItems++;
        this.stats.totalSize += blob.size;
        this.saveStats();
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to cache image:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 删除缓存项
   */
  async delete(url: string): Promise<void> {
    if (typeof window === 'undefined' || !this.db) return;

    return new Promise((resolve) => {
      if (!this.db) {
        resolve();
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      // 先获取项目信息以更新统计
      const getRequest = store.get(url);
      getRequest.onsuccess = () => {
        const item: CacheItem = getRequest.result;
        if (item) {
          this.stats.totalItems--;
          this.stats.totalSize -= item.size;
        }

        const deleteRequest = store.delete(url);
        deleteRequest.onsuccess = () => {
          this.saveStats();
          resolve();
        };
        deleteRequest.onerror = () => resolve();
      };
      getRequest.onerror = () => resolve();
    });
  }

  /**
   * 确保缓存大小不超过限制
   */
  private async ensureCacheSize(newItemSize: number): Promise<void> {
    if (!this.db) return;

    if (this.stats.totalSize + newItemSize <= this.maxCacheSize) {
      return;
    }

    // 获取所有缓存项，按最后访问时间排序
    const items = await this.getAllItems();
    items.sort((a, b) => a.lastAccessed - b.lastAccessed);

    // 删除最旧的项目直到有足够空间
    let freedSpace = 0;
    for (const item of items) {
      if (this.stats.totalSize - freedSpace + newItemSize <= this.maxCacheSize) {
        break;
      }
      
      await this.delete(item.url);
      freedSpace += item.size;
    }
  }

  /**
   * 获取所有缓存项
   */
  private async getAllItems(): Promise<CacheItem[]> {
    if (!this.db) return [];

    return new Promise((resolve) => {
      if (!this.db) {
        resolve([]);
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        resolve([]);
      };
    });
  }

  /**
   * 清理过期缓存
   */
  async cleanup(): Promise<void> {
    const items = await this.getAllItems();
    const now = Date.now();

    for (const item of items) {
      if (now - item.timestamp > this.maxCacheAge) {
        await this.delete(item.url);
      }
    }
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      if (!this.db) {
        resolve();
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => {
        this.stats = {
          totalItems: 0,
          totalSize: 0,
          hitRate: 0,
          totalRequests: 0,
          cacheHits: 0
        };
        this.saveStats();
        resolve();
      };

      request.onerror = () => resolve();
    });
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    this.stats.hitRate = this.stats.totalRequests > 0 
      ? (this.stats.cacheHits / this.stats.totalRequests) * 100 
      : 0;
  }

  /**
   * 保存统计信息到localStorage
   */
  private saveStats(): void {
    try {
      localStorage.setItem('imageCacheStats', JSON.stringify(this.stats));
    } catch (error) {
      console.warn('Failed to save cache stats:', error);
    }
  }

  /**
   * 从localStorage加载统计信息
   */
  private loadStats(): void {
    try {
      const saved = localStorage.getItem('imageCacheStats');
      if (saved) {
        this.stats = { ...this.stats, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.warn('Failed to load cache stats:', error);
    }
  }
}

// 单例实例 - 只在客户端创建
export const imageCacheManager = typeof window !== 'undefined'
  ? new ImageCacheManager()
  : null as any;
