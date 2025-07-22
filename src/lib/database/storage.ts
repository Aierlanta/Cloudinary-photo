/**
 * 多图床数据库服务
 * 处理图片存储记录和配置的数据库操作
 */

import { PrismaClient } from '@prisma/client';
import { StorageProvider, StorageResult, MultiStorageConfig } from '../storage/base';

const prisma = new PrismaClient();

export interface ImageWithStorage {
  id: string;
  url: string;
  publicId: string;
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
    
    // 构建存储元数据
    const storageMetadata = {
      uploadTime: new Date().toISOString(),
      providers: data.storageResults.map(sr => sr.provider),
      primaryUrl: data.url,
      backupUrls: data.storageResults
        .filter(sr => sr.provider !== data.primaryProvider)
        .map(sr => sr.result.url)
    };

    const result = await prisma.$transaction(async (tx) => {
      // 创建图片记录
      const image = await tx.image.create({
        data: {
          id: imageId,
          url: data.url,
          publicId: data.publicId,
          title: data.title,
          description: data.description,
          groupId: data.groupId,
          tags: data.tags ? JSON.stringify(data.tags) : null,
          primaryProvider: data.primaryProvider,
          backupProvider: data.backupProvider,
          storageMetadata: JSON.stringify(storageMetadata)
        }
      });

      // 创建存储记录
      const storageRecords = await Promise.all(
        data.storageResults.map(({ provider, result }) =>
          tx.imageStorageRecord.create({
            data: {
              imageId: imageId,
              provider: provider,
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

      // 更新分组图片计数
      if (data.groupId) {
        await tx.group.update({
          where: { id: data.groupId },
          data: {
            imageCount: {
              increment: 1
            }
          }
        });
      }

      return {
        ...image,
        storageRecords
      };
    });

    console.log(`保存图片成功: ${imageId}, 存储提供商: ${data.storageResults.map(sr => sr.provider).join(', ')}`);
    return result;
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

    return image;
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
      images,
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
    return record;
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
}

// 导出单例实例
export const storageDatabaseService = new StorageDatabaseService();
