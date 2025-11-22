/**
 * 多图床数据库服务
 * 处理图片存储记录和配置的数据库操作
 */

import { StorageProvider, StorageResult, MultiStorageConfig } from '../storage/base';
import { prisma } from '../prisma';

// 写冲突重试配置（避免硬编码散落）
const DEADLOCK_RETRY_ATTEMPTS = 5;
const DEADLOCK_RETRY_BASE_DELAY_MS = 30;

export interface ImageWithStorage {
  id: string;
  url: string;
  publicId: string;
  width?: number | null;
  height?: number | null;
  orientation?: string | null;
  title?: string;
  description?: string;
  tags?: string;
  groupId?: string;
  uploadedAt: Date;
  primaryProvider: string;
  backupProvider?: string;
  storageMetadata?: string;
  storageRecords: ImageStorageRecord[];
}

export interface ImageStorageRecord {
  id: string;
  imageId: string;
  provider: string;
  identifier: string;
  url: string;
  metadata?: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateImageData {
  publicId: string;
  url: string;
  width?: number | null;
  height?: number | null;
  orientation?: string | null;
  title?: string;
  description?: string;
  groupId?: string;
  tags?: string[];
  primaryProvider: StorageProvider;
  backupProvider?: StorageProvider;
  storageResults: {
    provider: StorageProvider;
    result: StorageResult;
  }[];
}

export class StorageDatabaseService {
  /**
   * 保存图片及其存储记录
   */
  async saveImageWithStorage(data: CreateImageData): Promise<ImageWithStorage> {
    const imageId = this.generateImageId();

    const telegramMetadata = data.storageResults.find(
      sr => sr.provider === StorageProvider.TELEGRAM
    )?.result.metadata;

    const storageMetadata: Record<string, any> = {
      uploadTime: new Date().toISOString(),
      providers: data.storageResults.map(sr => sr.provider),
      primaryUrl: data.url,
      backupUrls: data.storageResults
        .filter(sr => sr.provider !== data.primaryProvider)
        .map(sr => sr.result.url)
    };

    if (telegramMetadata?.telegramBotId) {
      storageMetadata.telegramBotId = telegramMetadata.telegramBotId;
    }

    const primaryResult = data.storageResults.find(
      sr => sr.provider === data.primaryProvider
    ) ?? data.storageResults[0];

    const resolvedWidth = data.width ?? primaryResult?.result.width ?? null;
    const resolvedHeight = data.height ?? primaryResult?.result.height ?? null;
    const resolvedOrientation = data.orientation ?? this.getOrientationFromSize(resolvedWidth, resolvedHeight);

    // 事务化写入 image 及其 storage records，防止部分成功 + 针对 P2034 的重试
    const { image, storageRecords } = await this.runWithDeadlockRetry(async () =>
      prisma.$transaction(async (tx) => {
        const createdImage = await tx.image.create({
          data: {
            id: imageId,
            url: data.url,
            publicId: data.publicId,
            width: resolvedWidth,
            height: resolvedHeight,
            orientation: resolvedOrientation,
            title: data.title,
            description: data.description,
            groupId: data.groupId,
            tags: data.tags ? JSON.stringify(data.tags) : null,
            primaryProvider: data.primaryProvider,
            backupProvider: data.backupProvider,
            storageMetadata: JSON.stringify(storageMetadata),

            telegramFileId: telegramMetadata?.telegramFileId,
            telegramThumbnailFileId: telegramMetadata?.telegramThumbnailFileId,
            telegramFilePath: telegramMetadata?.telegramFilePath,
            telegramThumbnailPath: telegramMetadata?.telegramThumbnailPath,
            telegramBotToken: telegramMetadata?.telegramBotToken
          }
        });

        const createdStorageRecords = await Promise.all(
          data.storageResults.map(({ provider, result }) =>
            tx.imageStorageRecord.create({
              data: {
                imageId: imageId,
                provider,
                identifier: result.publicId,
                url: result.url,
                metadata: JSON.stringify({
                  originalResult: result,
                  uploadTime: new Date().toISOString()
                }),
                status: 'active'
              }
            })
          )
        );

        return {
          image: createdImage,
          storageRecords: createdStorageRecords
        };
      }, {
        maxWait: 15000,
        timeout: 30000
      })
    );

    // group.update 独立执行 + 自动重试（彻底避免死锁）
    if (data.groupId) {
      await this.incrementGroupCountSafe(data.groupId);
    }

    return {
      ...image,
      title: image.title || undefined,
      description: image.description || undefined,
      width: image.width || undefined,
      height: image.height || undefined,
      orientation: image.orientation || undefined,
      tags: image.tags || undefined,
      groupId: image.groupId || undefined,
      backupProvider: image.backupProvider || undefined,
      storageMetadata: image.storageMetadata || undefined,
      storageRecords: storageRecords.map(r => ({
        ...r,
        metadata: r.metadata || undefined
      }))
    };
  }

  // ⭐ 加入安全自动重试（强烈推荐）
  private async incrementGroupCountSafe(groupId: string) {
    for (let i = 0; i < DEADLOCK_RETRY_ATTEMPTS; i++) {
      try {
        await prisma.group.update({
          where: { id: groupId },
          data: { imageCount: { increment: 1 } }
        });
        return;
      } catch (err: any) {
        if (err.code === "P2034") {   // 死锁写冲突
          await this.sleep(DEADLOCK_RETRY_BASE_DELAY_MS * (i + 1));
          continue;
        }
        throw err;
      }
    }
    throw new Error("Group update failed after retry");
  }

  /**
   * 获取图片及其存储记录
   */
  async getImageWithStorage(imageId: string): Promise<ImageWithStorage | null> {
    const image = await prisma.image.findUnique({
      where: { id: imageId },
      include: {
        storageRecords: {
          where: { status: 'active' },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!image) return null;

    return {
      ...image,
      title: image.title || undefined,
      description: image.description || undefined,
      tags: image.tags || undefined,
      groupId: image.groupId || undefined,
      backupProvider: image.backupProvider || undefined,
      storageMetadata: image.storageMetadata || undefined,
      storageRecords: image.storageRecords.map(record => ({
        ...record,
        metadata: record.metadata || undefined
      }))
    };
  }

  /**
   * 获取图片列表及存储信息
   */
  async getImagesWithStorage(options: {
    page?: number;
    limit?: number;
    groupId?: string;
    provider?: StorageProvider;
  } = {}): Promise<{
    images: ImageWithStorage[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, groupId, provider } = options;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (groupId) {
      where.groupId = groupId;
    }
    if (provider) {
      where.primaryProvider = provider;
    }

    const [images, total] = await Promise.all([
      prisma.image.findMany({
        where,
        include: {
          storageRecords: {
            where: { status: 'active' },
            orderBy: { createdAt: 'desc' }
          }
        },
        orderBy: { uploadedAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.image.count({ where })
    ]);

    return {
      images: images.map(image => ({
        ...image,
        title: image.title || undefined,
        description: image.description || undefined,
        tags: image.tags || undefined,
        groupId: image.groupId || undefined,
        backupProvider: image.backupProvider || undefined,
        orientation: image.orientation || undefined,
        storageMetadata: image.storageMetadata || undefined,
        storageRecords: image.storageRecords.map(record => ({
          ...record,
          metadata: record.metadata || undefined
        }))
      })),
      total,
      page,
      limit
    };
  }

  /**
   * 更新存储记录状态
   */
  async updateStorageRecordStatus(
    imageId: string,
    provider: StorageProvider,
    status: 'active' | 'failed' | 'deleted'
  ): Promise<void> {
    await prisma.imageStorageRecord.updateMany({
      where: {
        imageId,
        provider
      },
      data: {
        status,
        updatedAt: new Date()
      }
    });

    console.log(`更新存储记录状态: ${imageId} @ ${provider} -> ${status}`);
  }

  /**
   * 添加新的存储记录
   */
  async addStorageRecord(
    imageId: string,
    provider: StorageProvider,
    result: StorageResult
  ): Promise<ImageStorageRecord> {
    const record = await prisma.imageStorageRecord.create({
      data: {
        imageId,
        provider,
        identifier: result.publicId,
        url: result.url,
        metadata: JSON.stringify({
          originalResult: result,
          uploadTime: new Date().toISOString()
        }),
        status: 'active'
      }
    });

    console.log(`添加存储记录: ${imageId} @ ${provider}`);
    return {
      ...record,
      metadata: record.metadata || undefined
    };
  }

  /**
   * 删除图片及其所有存储记录
   */
  async deleteImageWithStorage(imageId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // 获取图片信息
      const image = await tx.image.findUnique({
        where: { id: imageId },
        select: { groupId: true }
      });

      // 删除存储记录
      await tx.imageStorageRecord.deleteMany({
        where: { imageId }
      });

      // 删除图片记录
      await tx.image.delete({
        where: { id: imageId }
      });

      // 更新分组图片计数
      if (image?.groupId) {
        await tx.group.update({
          where: { id: image.groupId },
          data: {
            imageCount: {
              decrement: 1
            }
          }
        });
      }
    });

    console.log(`删除图片及存储记录: ${imageId}`);
  }

  /**
   * 获取存储配置
   */
  async getStorageConfig(): Promise<MultiStorageConfig | null> {
    const config = await prisma.storageConfig.findUnique({
      where: { id: 'default' }
    });

    if (!config) {
      return null;
    }

    return {
      primaryProvider: config.primaryProvider as StorageProvider,
      backupProvider: config.backupProvider as StorageProvider | undefined,
      failoverStrategy: config.failoverEnabled ? 'retry_then_failover' : 'manual' as any,
      retryAttempts: config.retryAttempts,
      retryDelay: config.retryDelay,
      healthCheckInterval: config.healthCheckInterval,
      enableBackupUpload: config.enableBackupUpload
    };
  }

  /**
   * 更新存储配置
   */
  async updateStorageConfig(config: Partial<MultiStorageConfig>): Promise<void> {
    await prisma.storageConfig.upsert({
      where: { id: 'default' },
      update: {
        primaryProvider: config.primaryProvider,
        backupProvider: config.backupProvider,
        failoverEnabled: config.failoverStrategy !== 'manual',
        retryAttempts: config.retryAttempts,
        retryDelay: config.retryDelay,
        healthCheckInterval: config.healthCheckInterval,
        enableBackupUpload: config.enableBackupUpload,
        updatedAt: new Date()
      },
      create: {
        id: 'default',
        primaryProvider: config.primaryProvider || 'cloudinary',
        backupProvider: config.backupProvider,
        failoverEnabled: config.failoverStrategy !== 'manual',
        retryAttempts: config.retryAttempts || 3,
        retryDelay: config.retryDelay || 1000,
        healthCheckInterval: config.healthCheckInterval || 300,
        enableBackupUpload: config.enableBackupUpload || false
      }
    });

    console.log('存储配置已更新');
  }

  /**
   * 获取存储统计信息
   */
  async getStorageStats(): Promise<{
    totalImages: number;
    providerStats: Record<string, {
      count: number;
      activeRecords: number;
      failedRecords: number;
    }>;
  }> {
    const [totalImages, providerCounts, recordStats] = await Promise.all([
      prisma.image.count(),
      prisma.image.groupBy({
        by: ['primaryProvider'],
        _count: { id: true }
      }),
      prisma.imageStorageRecord.groupBy({
        by: ['provider', 'status'],
        _count: { id: true }
      })
    ]);

    const providerStats: Record<string, any> = {};
    
    // 统计主要提供商
    providerCounts.forEach(({ primaryProvider, _count }) => {
      providerStats[primaryProvider] = {
        count: _count.id,
        activeRecords: 0,
        failedRecords: 0
      };
    });

    // 统计存储记录状态
    recordStats.forEach(({ provider, status, _count }) => {
      if (!providerStats[provider]) {
        providerStats[provider] = { count: 0, activeRecords: 0, failedRecords: 0 };
      }
      
      if (status === 'active') {
        providerStats[provider].activeRecords = _count.id;
      } else if (status === 'failed') {
        providerStats[provider].failedRecords = _count.id;
      }
    });

    return {
      totalImages,
      providerStats
    };
  }

  /**
   * 生成图片ID
   */
  private generateImageId(): string {
    return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async runWithDeadlockRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: any;
    for (let i = 0; i < DEADLOCK_RETRY_ATTEMPTS; i++) {
      try {
        return await fn();
      } catch (err: any) {
        if (err?.code === 'P2034') {
          lastError = err;
          await this.sleep(DEADLOCK_RETRY_BASE_DELAY_MS * (i + 1));
          continue;
        }
        throw err;
      }
    }
    throw lastError || new Error('Transaction failed after retry');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getOrientationFromSize(width?: number | null, height?: number | null): string | null {
    if (!width || !height) return null;
    if (width === height) return 'square';
    return width > height ? 'landscape' : 'portrait';
  }
}

// 导出单例实例
export const storageDatabaseService = new StorageDatabaseService();
