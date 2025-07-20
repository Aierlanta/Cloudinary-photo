/**
 * 数据库服务层实现
 * 使用Prisma和MySQL进行数据存储和管理
 */

import { PrismaClient } from '@prisma/client';
import { Image, Group, APIConfig, PaginationOptions, PaginatedResult } from '@/types/models';
import { DatabaseError, NotFoundError } from '@/types/errors';

// Prisma客户端全局实例
declare global {
  var prisma: PrismaClient | undefined;
}

const prisma = globalThis.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

export class DatabaseService {
  private static instance: DatabaseService;

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
   */
  async initialize(): Promise<void> {
    try {
      // 初始化计数器
      await prisma.counter.upsert({
        where: { id: 'imageId' },
        update: {},
        create: { id: 'imageId', value: 0 }
      });

      await prisma.counter.upsert({
        where: { id: 'groupId' },
        update: {},
        create: { id: 'groupId', value: 0 }
      });

      // 初始化API配置
      const apiConfig = await this.getAPIConfig();
      if (!apiConfig) {
        const defaultConfig: APIConfig = {
          id: 'default',
          isEnabled: true,
          defaultScope: 'all',
          defaultGroups: [],
          allowedParameters: [],
          updatedAt: new Date()
        };
        await this.updateAPIConfig(defaultConfig);
      }

      console.log('数据库初始化完成');
    } catch (error) {
      console.error('数据库初始化失败:', error);
      throw new DatabaseError('数据库初始化失败', error);
    }
  }

  // ==================== 内部工具方法 ====================

  /**
   * 生成新的图片ID
   */
  private async generateImageId(): Promise<string> {
    try {
      const counter = await prisma.counter.update({
        where: { id: 'imageId' },
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

  // ==================== 图片相关操作 ====================

  /**
   * 保存图片信息
   */
  async saveImage(imageData: Omit<Image, 'id' | 'uploadedAt'>): Promise<Image> {
    try {
      const id = await this.generateImageId();
      
      const image = await prisma.image.create({
        data: {
          id,
          url: imageData.url,
          publicId: imageData.publicId,
          title: imageData.title,
          description: imageData.description,
          tags: imageData.tags ? JSON.stringify(imageData.tags) : null,
          groupId: imageData.groupId,
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
        groupId: image.groupId || undefined,
        uploadedAt: image.uploadedAt
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
        groupId: image.groupId || undefined,
        uploadedAt: image.uploadedAt
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
      const { page = 1, limit = 20, sortBy = 'uploadedAt', sortOrder = 'desc', search, dateFrom, dateTo, groupId } = options;

      // 构建查询条件
      const where: any = {};
      
      if (groupId) {
        where.groupId = groupId;
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

      // 获取总数
      const total = await prisma.image.count({ where });

      // 获取分页数据
      const images = await prisma.image.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: { group: true }
      });

      // 转换为应用层的Image类型
      const data: Image[] = images.map(image => ({
        id: image.id,
        url: image.url,
        publicId: image.publicId,
        title: image.title || undefined,
        description: image.description || undefined,
        tags: image.tags ? JSON.parse(image.tags) : undefined,
        groupId: image.groupId || undefined,
        uploadedAt: image.uploadedAt
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
   */
  async getRandomImages(count: number = 1, groupId?: string): Promise<Image[]> {
    try {
      const where: any = {};
      if (groupId) {
        where.groupId = groupId;
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
            include: { group: true }
          })
        )
      );

      return images.flat().map(image => ({
        id: image.id,
        url: image.url,
        publicId: image.publicId,
        title: image.title || undefined,
        description: image.description || undefined,
        tags: image.tags ? JSON.parse(image.tags) : undefined,
        groupId: image.groupId || undefined,
        uploadedAt: image.uploadedAt
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
        include: { _count: { select: { images: true } } },
        orderBy: { createdAt: 'desc' }
      });

      return groups.map(group => ({
        id: group.id,
        name: group.name,
        description: group.description || undefined,
        imageCount: group._count.images,
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
          updatedAt: new Date()
        },
        create: {
          id: 'default',
          isEnabled: config.isEnabled,
          defaultScope: config.defaultScope,
          defaultGroups: JSON.stringify(config.defaultGroups),
          allowedParameters: JSON.stringify(config.allowedParameters),
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
   * 关闭数据库连接
   */
  async disconnect(): Promise<void> {
    await prisma.$disconnect();
  }
}

// 导出单例实例
export const databaseService = DatabaseService.getInstance();
