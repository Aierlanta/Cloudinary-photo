/**
 * 数据库服务层实现
 * 使用Prisma和MySQL进行数据存储和管理
 */

import { Image, Group, APIConfig, PaginationOptions, PaginatedResult } from '@/types/models';
import { DatabaseError, NotFoundError } from '@/types/errors';
import { LogLevel, LogEntry } from './logger';
import { prisma } from './prisma';

type OrientationFilter = 'landscape' | 'portrait' | 'square';

function normalizeOrientationValue(orientation?: string | null): Image['orientation'] {
  if (!orientation) return undefined;
  if (orientation === 'landscape' || orientation === 'portrait' || orientation === 'square') {
    return orientation;
  }
  return 'unknown';
}

export class DatabaseService {
  private static instance: DatabaseService;
  private isInitializing: boolean = false;
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    // 构造函数为空，使用全局Prisma实例
  }

  // 单例模式
  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * 初始化数据库
   * 创建必要的索引和默认配置
   * 使用锁机制防止并发初始化
   */
  async initialize(): Promise<void> {
    // 如果已经初始化完成，直接返回
    if (this.isInitialized) {
      return;
    }

    // 如果正在初始化，等待现有的初始化完成
    if (this.isInitializing && this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    // 开始初始化
    this.isInitializing = true;
    this.initializationPromise = this.performInitialization();

    try {
      await this.initializationPromise;
      this.isInitialized = true;
    } catch (error) {
      // 初始化失败，重置状态以允许重试
      this.isInitialized = false;
      throw error;
    } finally {
      this.isInitializing = false;
      this.initializationPromise = null;
    }
  }

  /**
   * 执行实际的初始化操作
   */
  private async performInitialization(): Promise<void> {
    try {
      // 初始化计数器 - 从现有数据的最大值开始
      await this.initializeCounters();

      // 初始化API配置
      const apiConfig = await this.getAPIConfig();
      if (!apiConfig) {
        const defaultConfig: APIConfig = {
          id: 'default',
          isEnabled: true,
          defaultScope: 'all',
          defaultGroups: [],
          allowedParameters: [],
          enableDirectResponse: false, // 默认关闭直接响应模式
          apiKeyEnabled: false, // 默认关闭 API Key 鉴权
          apiKey: undefined,
          updatedAt: new Date()
        };
        await this.updateAPIConfig(defaultConfig);
      }

      console.log('数据库初始化完成');

      // 记录数据库初始化日志
      try {
        const { logger } = await import('./logger');
        logger.info('数据库初始化完成', {
          type: 'database',
          operation: 'initialize',
          success: true
        });
      } catch (logError) {
        // 忽略日志记录错误，避免循环依赖
        console.warn('记录初始化日志失败:', logError);
      }
    } catch (error) {
      console.error('数据库初始化失败:', error);
      throw new DatabaseError('数据库初始化失败', error);
    }
  }

  // ==================== 内部工具方法 ====================

  /**
   * 初始化计数器，从现有数据的最大值开始
   */
  private async initializeCounters(): Promise<void> {
    try {
      // 获取现有图片中的最大数字ID
      const existingImages = await prisma.image.findMany({
        where: {
          id: {
            startsWith: 'img_'
          }
        },
        select: { id: true }
      });

      let maxImageId = 0;
      for (const image of existingImages) {
        const match = image.id.match(/^img_(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxImageId) {
            maxImageId = num;
          }
        }
      }

      // 获取现有分组中的最大数字ID
      const existingGroups = await prisma.group.findMany({
        where: {
          id: {
            startsWith: 'grp_'
          }
        },
        select: { id: true }
      });

      let maxGroupId = 0;
      for (const group of existingGroups) {
        const match = group.id.match(/^grp_(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxGroupId) {
            maxGroupId = num;
          }
        }
      }

      // 使用事务来避免并发冲突
      await prisma.$transaction(async (tx) => {
        // 先尝试查找现有计数器
        const existingImageCounter = await tx.counter.findUnique({
          where: { id: 'image_counter' }
        });

        const existingGroupCounter = await tx.counter.findUnique({
          where: { id: 'groupId' }
        });

        // 如果计数器不存在，则创建；如果存在，则更新
        if (!existingImageCounter) {
          await tx.counter.create({
            data: { id: 'image_counter', value: maxImageId }
          });
        } else {
          await tx.counter.update({
            where: { id: 'image_counter' },
            data: { value: Math.max(maxImageId, existingImageCounter.value) }
          });
        }

        if (!existingGroupCounter) {
          await tx.counter.create({
            data: { id: 'groupId', value: maxGroupId }
          });
        } else {
          await tx.counter.update({
            where: { id: 'groupId' },
            data: { value: Math.max(maxGroupId, existingGroupCounter.value) }
          });
        }
      });

      console.log(`计数器初始化完成 - 图片ID从 ${maxImageId + 1} 开始，分组ID从 ${maxGroupId + 1} 开始`);
    } catch (error) {
      console.error('初始化计数器失败:', error);
      // 如果是主键冲突错误，可能是并发初始化导致的，可以忽略
      if (error instanceof Error && error.message.includes('Unique constraint failed')) {
        console.log('计数器已存在，跳过初始化');
        return;
      }
      throw new DatabaseError('初始化计数器失败', error);
    }
  }

  /**
   * 生成新的图片ID
   */
  private async generateImageId(): Promise<string> {
    try {
      const counter = await prisma.counter.update({
        where: { id: 'image_counter' },
        data: { value: { increment: 1 } }
      });
      return `img_${counter.value.toString().padStart(6, '0')}`;
    } catch (error) {
      throw new DatabaseError('生成图片ID失败', error);
    }
  }

  /**
   * 生成新的分组ID
   */
  private async generateGroupId(): Promise<string> {
    try {
      const counter = await prisma.counter.update({
        where: { id: 'groupId' },
        data: { value: { increment: 1 } }
      });
      return `grp_${counter.value.toString().padStart(6, '0')}`;
    } catch (error) {
      throw new DatabaseError('生成分组ID失败', error);
    }
  }

  private determineOrientation(width?: number | null, height?: number | null): OrientationFilter | 'unknown' | null {
    if (!width || !height) return null;
    if (width === height) return 'square';
    return width > height ? 'landscape' : 'portrait';
  }

  // ==================== 图片相关操作 ====================

  /**
   * 保存图片信息
   */
  async saveImage(imageData: Omit<Image, 'id' | 'uploadedAt'>): Promise<Image> {
    try {
      const id = await this.generateImageId();
      const resolvedWidth = imageData.width ?? null;
      const resolvedHeight = imageData.height ?? null;
      const resolvedOrientation = this.determineOrientation(resolvedWidth, resolvedHeight);
      
      const image = await prisma.image.create({
        data: {
          id,
          url: imageData.url,
          publicId: imageData.publicId,
          width: resolvedWidth,
          height: resolvedHeight,
          orientation: resolvedOrientation,
          title: imageData.title,
          description: imageData.description,
          tags: imageData.tags ? JSON.stringify(imageData.tags) : null,
          groupId: imageData.groupId,
          primaryProvider: imageData.primaryProvider,
          backupProvider: imageData.backupProvider,
        },
        include: {
          group: true
        }
      });

      // 如果有分组，更新分组图片数量
      if (image.groupId) {
        await prisma.group.update({
          where: { id: image.groupId },
          data: { imageCount: { increment: 1 } }
        });
      }

      console.log(`图片已保存: ${id}`);
      
      // 转换为应用层的Image类型
      return {
        id: image.id,
        url: image.url,
        publicId: image.publicId,
        title: image.title || undefined,
        description: image.description || undefined,
        tags: image.tags ? JSON.parse(image.tags) : undefined,
        width: image.width || undefined,
        height: image.height || undefined,
        orientation: normalizeOrientationValue(image.orientation),
        groupId: image.groupId || undefined,
        uploadedAt: image.uploadedAt,
        storageMetadata: image.storageMetadata || undefined
      };
    } catch (error) {
      console.error('保存图片失败:', error);
      throw new DatabaseError('保存图片失败', error);
    }
  }

  /**
   * 获取图片信息
   */
  async getImage(id: string): Promise<Image | null> {
    try {
      const image = await prisma.image.findUnique({
        where: { id },
        include: { group: true }
      });

      if (!image) return null;

      return {
        id: image.id,
        url: image.url,
        publicId: image.publicId,
        title: image.title || undefined,
        description: image.description || undefined,
        tags: image.tags ? JSON.parse(image.tags) : undefined,
        width: image.width || undefined,
        height: image.height || undefined,
        orientation: normalizeOrientationValue(image.orientation),
        groupId: image.groupId || undefined,
        uploadedAt: image.uploadedAt,
        primaryProvider: (image as any).primaryProvider || 'cloudinary',
        backupProvider: (image as any).backupProvider || undefined,
        storageMetadata: (image as any).storageMetadata || undefined
      };
    } catch (error) {
      throw new DatabaseError('获取图片失败', error);
    }
  }

  /**
   * 获取图片列表（支持分页和筛选）
   */
  async getImages(options: PaginationOptions): Promise<PaginatedResult<Image>> {
    try {
      const { page = 1, limit = 20, sortBy = 'uploadedAt', sortOrder = 'desc', search, dateFrom, dateTo, groupId, provider } = options;

      // 构建查询条件
      const where: any = {};

      if (groupId) {
        if (groupId === 'unassigned') {
          // 查询未分组的图片（groupId 为 null）
          where.groupId = null;
        } else {
          // 查询指定分组的图片
          where.groupId = groupId;
        }
      }

      // 图床筛选
      if (provider) {
        where.primaryProvider = provider;
      }
      
      if (dateFrom || dateTo) {
        where.uploadedAt = {};
        if (dateFrom) where.uploadedAt.gte = dateFrom;
        if (dateTo) where.uploadedAt.lte = dateTo;
      }
      
      if (search) {
        const searchLower = search.toLowerCase();
        where.OR = [
          { title: { contains: searchLower, mode: 'insensitive' } },
          { description: { contains: searchLower, mode: 'insensitive' } },
          { tags: { contains: searchLower, mode: 'insensitive' } }
        ];
      }

      // 构建排序条件
      const orderBy: any = {};
      orderBy[sortBy] = sortOrder;

      const [total, images] = await Promise.all([
        prisma.image.count({ where }),
        prisma.image.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            url: true,
            publicId: true,
            title: true,
            description: true,
            tags: true,
            width: true,
            height: true,
            orientation: true,
            groupId: true,
            uploadedAt: true,
            // 图床相关字段
            // 这些字段用于列表展示/筛选
            // 保持选择而不 include 关联，避免不必要 JOIN
            // 并减少网络传输
            primaryProvider: true,
            backupProvider: true,
            // Telegram 相关
            telegramFileId: true,
            telegramThumbnailFileId: true,
            telegramFilePath: true,
            telegramThumbnailPath: true,
            telegramBotToken: true,
            storageMetadata: true
          }
        })
      ]);

      // 转换为应用层的Image类型
      const data: Image[] = images.map(image => ({
        id: image.id,
        url: image.url,
        publicId: image.publicId,
        title: image.title || undefined,
        description: image.description || undefined,
        tags: image.tags ? JSON.parse(image.tags) : undefined,
        width: image.width || undefined,
        height: image.height || undefined,
        orientation: normalizeOrientationValue(image.orientation),
        groupId: image.groupId || undefined,
        uploadedAt: image.uploadedAt,
        primaryProvider: image.primaryProvider || 'cloudinary', // 新增：图床信息
        backupProvider: image.backupProvider || undefined, // 新增：备用图床信息
        // Telegram 相关字段
        telegramFileId: image.telegramFileId || undefined,
        telegramThumbnailFileId: image.telegramThumbnailFileId || undefined,
        telegramFilePath: image.telegramFilePath || undefined,
        telegramThumbnailPath: image.telegramThumbnailPath || undefined,
        telegramBotToken: image.telegramBotToken || undefined,
        storageMetadata: image.storageMetadata || undefined
      }));

      const totalPages = Math.ceil(total / limit);

      return {
        data,
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      };
    } catch (error) {
      throw new DatabaseError('获取图片列表失败', error);
    }
  }

  /**
   * 更新图片信息
   */
  async updateImage(id: string, updates: Partial<Pick<Image, 'groupId' | 'tags'>>): Promise<Image> {
    try {
      const existingImage = await prisma.image.findUnique({ where: { id } });
      if (!existingImage) {
        throw new NotFoundError('图片不存在');
      }

      // 如果分组发生变化，更新分组图片数量
      if (updates.groupId !== undefined && updates.groupId !== existingImage.groupId) {
        // 从旧分组移除
        if (existingImage.groupId) {
          await prisma.group.update({
            where: { id: existingImage.groupId },
            data: { imageCount: { decrement: 1 } }
          });
        }

        // 添加到新分组
        if (updates.groupId) {
          await prisma.group.update({
            where: { id: updates.groupId },
            data: { imageCount: { increment: 1 } }
          });
        }
      }

      const image = await prisma.image.update({
        where: { id },
        data: {
          groupId: updates.groupId,
          tags: updates.tags ? JSON.stringify(updates.tags) : undefined
        },
        include: { group: true }
      });

      return {
        id: image.id,
        url: image.url,
        publicId: image.publicId,
        title: image.title || undefined,
        description: image.description || undefined,
        tags: image.tags ? JSON.parse(image.tags) : undefined,
        groupId: image.groupId || undefined,
        uploadedAt: image.uploadedAt
      };
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('更新图片失败', error);
    }
  }

  /**
   * 批量更新图片信息（优化版本）
   */
  async bulkUpdateImages(imageIds: string[], updates: Partial<Pick<Image, 'groupId' | 'tags'>>): Promise<{
    updatedIds: string[];
    failedIds: string[];
  }> {
    try {
      const updatedIds: string[] = [];
      const failedIds: string[] = [];

      // 如果需要更新分组，先获取所有图片的当前分组信息
      let groupChanges: { [imageId: string]: { oldGroupId: string | null; newGroupId: string | null } } = {};

      if (updates.groupId !== undefined) {
        const existingImages = await prisma.image.findMany({
          where: { id: { in: imageIds } },
          select: { id: true, groupId: true }
        });

        // 计算分组变化
        for (const image of existingImages) {
          if (image.groupId !== updates.groupId) {
            groupChanges[image.id] = {
              oldGroupId: image.groupId,
              newGroupId: updates.groupId
            };
          }
        }
      }

      // 使用事务批量更新，增加超时时间
      await prisma.$transaction(async (tx) => {
        // 使用 updateMany 进行真正的批量更新
        try {
          const updateData: any = {};
          if (updates.groupId !== undefined) {
            updateData.groupId = updates.groupId;
          }
          if (updates.tags !== undefined) {
            updateData.tags = updates.tags ? JSON.stringify(updates.tags) : null;
          }

          const result = await tx.image.updateMany({
            where: { id: { in: imageIds } },
            data: updateData
          });

          // 假设所有更新都成功（updateMany 不会返回具体的失败ID）
          updatedIds.push(...imageIds);
        } catch (error) {
          console.error('批量更新图片失败:', error);
          failedIds.push(...imageIds);
        }

        // 批量更新分组计数
        if (Object.keys(groupChanges).length > 0 && updatedIds.length > 0) {
          const groupCountChanges: { [groupId: string]: number } = {};

          // 计算每个分组的计数变化
          for (const imageId of updatedIds) {
            const change = groupChanges[imageId];
            if (change) {
              // 从旧分组减少
              if (change.oldGroupId) {
                groupCountChanges[change.oldGroupId] = (groupCountChanges[change.oldGroupId] || 0) - 1;
              }
              // 向新分组增加
              if (change.newGroupId) {
                groupCountChanges[change.newGroupId] = (groupCountChanges[change.newGroupId] || 0) + 1;
              }
            }
          }

          // 批量更新分组计数
          for (const [groupId, countChange] of Object.entries(groupCountChanges)) {
            if (countChange !== 0) {
              await tx.group.update({
                where: { id: groupId },
                data: { imageCount: { increment: countChange } }
              });
            }
          }
        }
      }, {
        timeout: 30000 // 增加超时时间到30秒
      });

      return { updatedIds, failedIds };
    } catch (error) {
      throw new DatabaseError('批量更新图片失败', error);
    }
  }

  /**
   * 删除图片
   */
  async deleteImage(id: string): Promise<void> {
    try {
      const image = await prisma.image.findUnique({ where: { id } });
      if (!image) {
        throw new NotFoundError('图片不存在');
      }

      // 如果有分组，更新分组图片数量
      if (image.groupId) {
        await prisma.group.update({
          where: { id: image.groupId },
          data: { imageCount: { decrement: 1 } }
        });
      }

      await prisma.image.delete({ where: { id } });
      console.log(`图片已删除: ${id}`);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('删除图片失败', error);
    }
  }

  /**
   * 获取随机图片
   * 注意: 此方法用于 /api/random 端点,会自动过滤掉 Telegram 直连图床的图片
   */
  async getRandomImages(count: number = 1, groupId?: string, options?: { orientation?: OrientationFilter }): Promise<Image[]> {
    try {
      const where: any = {};
      if (groupId) {
        if (groupId === 'unassigned') {
          // 查询未分组的图片（groupId 为 null）
          where.groupId = null;
        } else {
          // 查询指定分组的图片
          where.groupId = groupId;
        }
      }

      // 过滤掉 Telegram 直连图床的图片
      // 因为 Telegram 图床的 URL 包含敏感的 bot token,只能通过 /api/response 访问
      where.primaryProvider = {
        not: 'telegram'
      };

      if (options?.orientation) {
        where.orientation = options.orientation;
      }

      // 获取总数
      const total = await prisma.image.count({ where });
      if (total === 0) return [];

      // 生成随机偏移量
      const randomOffsets = Array.from({ length: Math.min(count, total) }, () =>
        Math.floor(Math.random() * total)
      );

      const images = await Promise.all(
        randomOffsets.map(offset =>
          prisma.image.findMany({
            where,
            skip: offset,
            take: 1,
            select: {
              id: true,
              url: true,
              publicId: true,
              title: true,
              description: true,
              tags: true,
              width: true,
              height: true,
              orientation: true,
              groupId: true,
              uploadedAt: true,
              primaryProvider: true,
              backupProvider: true,
              telegramFileId: true,
              telegramThumbnailFileId: true,
              telegramFilePath: true,
              telegramThumbnailPath: true,
              telegramBotToken: true
            }
          })
        )
      );

      return images
        .flat()
        .map(image => ({
          id: image.id,
        url: image.url,
        publicId: image.publicId,
        title: image.title || undefined,
        description: image.description || undefined,
        tags: image.tags ? JSON.parse(image.tags) : undefined,
        width: image.width || undefined,
        height: image.height || undefined,
        orientation: normalizeOrientationValue(image.orientation),
        groupId: image.groupId || undefined,
        uploadedAt: image.uploadedAt,
        primaryProvider: image.primaryProvider || 'cloudinary',
        backupProvider: image.backupProvider || undefined,
        telegramFileId: image.telegramFileId || undefined,
          telegramThumbnailFileId: image.telegramThumbnailFileId || undefined,
          telegramFilePath: image.telegramFilePath || undefined,
          telegramThumbnailPath: image.telegramThumbnailPath || undefined,
          telegramBotToken: image.telegramBotToken || undefined
        }));
    } catch (error) {
      throw new DatabaseError('获取随机图片失败', error);
    }
  }

  /**
   * 获取随机图片（包含 Telegram）
   * 用于 /api/response 端点：不排除 Telegram 直连图床
   */
  async getRandomImagesIncludingTelegram(count: number = 1, groupId?: string, options?: { orientation?: OrientationFilter }): Promise<Image[]> {
    try {
      const where: any = {};
      if (groupId) {
        if (groupId === 'unassigned') {
          where.groupId = null;
        } else {
          where.groupId = groupId;
        }
      }

      if (options?.orientation) {
        where.orientation = options.orientation;
      }

      // 不排除 Telegram

      // 获取总数
      const total = await prisma.image.count({ where });
      if (total === 0) return [];

      // 生成随机偏移量
      const randomOffsets = Array.from({ length: Math.min(count, total) }, () =>
        Math.floor(Math.random() * total)
      );

      const images = await Promise.all(
        randomOffsets.map(offset =>
          prisma.image.findMany({
            where,
            skip: offset,
            take: 1,
            select: {
              id: true,
              url: true,
              publicId: true,
              title: true,
              description: true,
              tags: true,
              width: true,
              height: true,
              orientation: true,
              groupId: true,
              uploadedAt: true,
              primaryProvider: true,
              backupProvider: true,
              telegramFileId: true,
              telegramThumbnailFileId: true,
              telegramFilePath: true,
              telegramThumbnailPath: true,
              telegramBotToken: true
            }
          })
        )
      );

      return images
        .flat()
        .map(image => ({
          id: image.id,
        url: image.url,
        publicId: image.publicId,
        title: image.title || undefined,
        description: image.description || undefined,
        tags: image.tags ? JSON.parse(image.tags) : undefined,
        width: image.width || undefined,
        height: image.height || undefined,
        orientation: normalizeOrientationValue(image.orientation),
        groupId: image.groupId || undefined,
        uploadedAt: image.uploadedAt,
        primaryProvider: image.primaryProvider || 'cloudinary',
        backupProvider: image.backupProvider || undefined,
        telegramFileId: image.telegramFileId || undefined,
          telegramThumbnailFileId: image.telegramThumbnailFileId || undefined,
          telegramFilePath: image.telegramFilePath || undefined,
          telegramThumbnailPath: image.telegramThumbnailPath || undefined,
          telegramBotToken: image.telegramBotToken || undefined
        }));
    } catch (error) {
      throw new DatabaseError('获取随机图片失败', error);
    }
  }

  // ==================== 分组相关操作 ====================

  /**
   * 保存分组信息
   */
  async saveGroup(groupData: Omit<Group, 'id' | 'createdAt' | 'imageCount'>): Promise<Group> {
    try {
      const id = await this.generateGroupId();

      const group = await prisma.group.create({
        data: {
          id,
          name: groupData.name,
          description: groupData.description,
          imageCount: 0
        }
      });

      console.log(`分组已保存: ${id}`);

      return {
        id: group.id,
        name: group.name,
        description: group.description || undefined,
        imageCount: group.imageCount,
        createdAt: group.createdAt
      };
    } catch (error) {
      throw new DatabaseError('保存分组失败', error);
    }
  }

  /**
   * 获取分组信息
   */
  async getGroup(id: string): Promise<Group | null> {
    try {
      const group = await prisma.group.findUnique({
        where: { id },
        include: { _count: { select: { images: true } } }
      });

      if (!group) return null;

      return {
        id: group.id,
        name: group.name,
        description: group.description || undefined,
        imageCount: group._count.images,
        createdAt: group.createdAt
      };
    } catch (error) {
      throw new DatabaseError('获取分组失败', error);
    }
  }

  /**
   * 获取所有分组
   */
  async getGroups(): Promise<Group[]> {
    try {
      const groups = await prisma.group.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          imageCount: true,
          createdAt: true
        }
      });

      return groups.map(group => ({
        id: group.id,
        name: group.name,
        description: group.description || undefined,
        imageCount: group.imageCount,
        createdAt: group.createdAt
      }));
    } catch (error) {
      throw new DatabaseError('获取分组列表失败', error);
    }
  }

  /**
   * 更新分组信息
   */
  async updateGroup(id: string, updates: Partial<Pick<Group, 'name' | 'description'>>): Promise<Group> {
    try {
      const group = await prisma.group.update({
        where: { id },
        data: {
          name: updates.name,
          description: updates.description
        },
        include: { _count: { select: { images: true } } }
      });

      return {
        id: group.id,
        name: group.name,
        description: group.description || undefined,
        imageCount: group._count.images,
        createdAt: group.createdAt
      };
    } catch (error) {
      throw new DatabaseError('更新分组失败', error);
    }
  }

  /**
   * 删除分组
   */
  async deleteGroup(id: string): Promise<void> {
    try {
      // 将分组下的图片移到未分组
      await prisma.image.updateMany({
        where: { groupId: id },
        data: { groupId: null }
      });

      await prisma.group.delete({ where: { id } });
      console.log(`分组已删除: ${id}`);
    } catch (error) {
      throw new DatabaseError('删除分组失败', error);
    }
  }

  // ==================== API配置相关操作 ====================

  /**
   * 获取API配置
   */
  async getAPIConfig(): Promise<APIConfig | null> {
    try {
      const config = await prisma.aPIConfig.findUnique({
        where: { id: 'default' }
      });

      if (!config) return null;

      return {
        id: config.id,
        isEnabled: config.isEnabled,
        defaultScope: config.defaultScope as 'all' | 'groups',
        defaultGroups: config.defaultGroups ? JSON.parse(config.defaultGroups) : [],
        allowedParameters: config.allowedParameters ? JSON.parse(config.allowedParameters) : [],
        enableDirectResponse: config.enableDirectResponse || false,
        apiKeyEnabled: config.apiKeyEnabled || false,
        apiKey: config.apiKey || undefined,
        updatedAt: config.updatedAt
      };
    } catch (error) {
      throw new DatabaseError('获取API配置失败', error);
    }
  }

  /**
   * 更新API配置
   */
  async updateAPIConfig(config: APIConfig): Promise<void> {
    try {
      await prisma.aPIConfig.upsert({
        where: { id: 'default' },
        update: {
          isEnabled: config.isEnabled,
          defaultScope: config.defaultScope,
          defaultGroups: JSON.stringify(config.defaultGroups),
          allowedParameters: JSON.stringify(config.allowedParameters),
          enableDirectResponse: config.enableDirectResponse,
          apiKeyEnabled: config.apiKeyEnabled,
          apiKey: config.apiKey,
          updatedAt: new Date()
        },
        create: {
          id: 'default',
          isEnabled: config.isEnabled,
          defaultScope: config.defaultScope,
          defaultGroups: JSON.stringify(config.defaultGroups),
          allowedParameters: JSON.stringify(config.allowedParameters),
          enableDirectResponse: config.enableDirectResponse,
          apiKeyEnabled: config.apiKeyEnabled || false,
          apiKey: config.apiKey,
          updatedAt: new Date()
        }
      });

      console.log('API配置已更新');
    } catch (error) {
      throw new DatabaseError('更新API配置失败', error);
    }
  }

  // ==================== 工具方法 ====================

  /**
   * 获取数据库统计信息
   */
  async getStats(): Promise<{ totalImages: number; totalGroups: number }> {
    try {
      const [totalImages, totalGroups] = await Promise.all([
        prisma.image.count(),
        prisma.group.count()
      ]);

      return { totalImages, totalGroups };
    } catch (error) {
      throw new DatabaseError('获取统计信息失败', error);
    }
  }

  /**
   * 清理数据库（仅用于测试）
   */
  async cleanup(): Promise<void> {
    try {
      await prisma.image.deleteMany();
      await prisma.group.deleteMany();
      await prisma.aPIConfig.deleteMany();
      await prisma.counter.deleteMany();
      console.log('数据库已清理');
    } catch (error) {
      throw new DatabaseError('清理数据库失败', error);
    }
  }

  /**
   * 检查数据库连接
   */
  async checkConnection(): Promise<boolean> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('数据库连接检查失败:', error);
      return false;
    }
  }

  /**
   * 获取数据库版本信息
   */
  async getDatabaseVersion(): Promise<string> {
    try {
      const result = await prisma.$queryRaw<Array<{ version: string }>>`SELECT VERSION() as version`;
      return result[0]?.version || 'Unknown';
    } catch (error) {
      console.error('获取数据库版本失败:', error);
      return 'Unknown';
    }
  }

  /**
   * 获取数据库连接池状态
   */
  async getConnectionPoolStatus(): Promise<{
    activeConnections: number;
    idleConnections: number;
    totalConnections: number;
  }> {
    try {
      // 这是一个简化的实现，实际的连接池状态可能需要更复杂的查询
      const result = await prisma.$queryRaw<Array<{
        active: number;
        idle: number;
        total: number;
      }>>`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN COMMAND != 'Sleep' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN COMMAND = 'Sleep' THEN 1 ELSE 0 END) as idle
        FROM INFORMATION_SCHEMA.PROCESSLIST
        WHERE DB = DATABASE()
      `;

      const stats = result[0];
      return {
        activeConnections: Number(stats?.active || 0),
        idleConnections: Number(stats?.idle || 0),
        totalConnections: Number(stats?.total || 0)
      };
    } catch (error) {
      console.error('获取连接池状态失败:', error);
      return {
        activeConnections: 0,
        idleConnections: 0,
        totalConnections: 0
      };
    }
  }

  /**
   * 关闭数据库连接
   */
  async disconnect(): Promise<void> {
    await prisma.$disconnect();
  }

  // ==================== 日志相关操作 ====================

  /**
   * 保存日志条目到数据库
   */
  async saveLog(logEntry: LogEntry): Promise<void> {
    try {
      await prisma.systemLog.create({
        data: {
          timestamp: logEntry.timestamp,
          level: logEntry.level,
          message: logEntry.message,
          context: logEntry.context ? JSON.stringify(logEntry.context) : null,
          error: logEntry.error ? JSON.stringify({
            name: logEntry.error.name,
            message: logEntry.error.message,
            stack: logEntry.error.stack
          }) : null,
          userId: logEntry.userId || null,
          requestId: logEntry.requestId || null,
          ip: logEntry.ip || null,
          userAgent: logEntry.userAgent || null,
          type: logEntry.context?.type || null
        }
      });
    } catch (error) {
      // 日志保存失败不应该影响主要业务逻辑，只在控制台输出错误
      console.error('保存日志失败:', error);
    }
  }

  /**
   * 获取日志列表（支持分页和筛选）
   */
  async getLogs(options: {
    page?: number;
    limit?: number;
    level?: LogLevel;
    search?: string;
    type?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<PaginatedResult<LogEntry>> {
    try {
      const {
        page = 1,
        limit = 100,
        level,
        search,
        type,
        dateFrom,
        dateTo
      } = options;

      const skip = (page - 1) * limit;

      // 构建查询条件
      const where: any = {};

      if (level !== undefined) {
        where.level = level;
      }

      if (search) {
        where.message = {
          contains: search
        };
      }

      if (type && type !== 'all') {
        where.type = type;
      }

      if (dateFrom || dateTo) {
        where.timestamp = {};
        if (dateFrom) where.timestamp.gte = new Date(dateFrom);
        if (dateTo) where.timestamp.lte = new Date(dateTo);
      }

      // 获取总数和数据
      const [total, logs] = await Promise.all([
        prisma.systemLog.count({ where }),
        prisma.systemLog.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          skip,
          take: limit
        })
      ]);

      // 转换数据格式
      const logEntries: LogEntry[] = logs.map(log => ({
        timestamp: log.timestamp,
        level: log.level as LogLevel,
        message: log.message,
        context: log.context ? JSON.parse(log.context) : undefined,
        error: log.error ? JSON.parse(log.error) : undefined,
        userId: log.userId || undefined,
        requestId: log.requestId || undefined,
        ip: log.ip || undefined,
        userAgent: log.userAgent || undefined
      }));

      const totalPages = Math.ceil(total / limit);

      return {
        data: logEntries,
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      };
    } catch (error) {
      throw new DatabaseError('获取日志失败', error);
    }
  }

  /**
   * 清理旧日志（保留指定天数的日志）
   */
  async cleanupOldLogs(retentionDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await prisma.systemLog.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate
          }
        }
      });

      return result.count;
    } catch (error) {
      throw new DatabaseError('清理旧日志失败', error);
    }
  }

  /**
   * 获取日志统计信息
   */
  async getLogStats(): Promise<{
    totalLogs: number;
    logsByLevel: Record<string, number>;
    logsByType: Record<string, number>;
    recentErrors: number;
  }> {
    try {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const [
        totalLogs,
        logsByLevel,
        logsByType,
        recentErrors
      ] = await Promise.all([
        prisma.systemLog.count(),
        prisma.systemLog.groupBy({
          by: ['level'],
          _count: { level: true }
        }),
        prisma.systemLog.groupBy({
          by: ['type'],
          _count: { type: true },
          where: { type: { not: null } }
        }),
        prisma.systemLog.count({
          where: {
            level: LogLevel.ERROR,
            timestamp: { gte: oneDayAgo }
          }
        })
      ]);

      const levelStats: Record<string, number> = {};
      logsByLevel.forEach(item => {
        const levelName = LogLevel[item.level] || 'UNKNOWN';
        levelStats[levelName] = item._count.level;
      });

      const typeStats: Record<string, number> = {};
      logsByType.forEach(item => {
        if (item.type) {
          typeStats[item.type] = item._count.type;
        }
      });

      return {
        totalLogs,
        logsByLevel: levelStats,
        logsByType: typeStats,
        recentErrors
      };
    } catch (error) {
      throw new DatabaseError('获取日志统计失败', error);
    }
  }
}

// 导出单例实例
export const databaseService = DatabaseService.getInstance();
