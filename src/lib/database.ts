/**
 * 数据库服务层实现
 * 使用Replit Database进行数据存储和管理
 */

import Database from '@replit/database';
import { Image, Group, APIConfig, PaginationOptions, PaginatedResult } from '@/types/models';
import { DatabaseError, NotFoundError } from '@/types/errors';

// 数据库键命名约定
const DB_KEYS = {
  IMAGES: 'images',
  GROUPS: 'groups', 
  API_CONFIG: 'api_config',
  IMAGE_INDEX: 'image_index',
  GROUP_IMAGES: 'group_images',
  COUNTERS: 'counters'
} as const;

// 计数器类型
interface Counters {
  imageId: number;
  groupId: number;
}

export class DatabaseService {
  private db: Database;
  private static instance: DatabaseService;

  constructor() {
    this.db = new Database();
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
      const counters = await this.getCounters();
      if (!counters) {
        await this.db.set(DB_KEYS.COUNTERS, { imageId: 0, groupId: 0 });
      }

      // 初始化图片索引
      const imageIndex = await this.db.get(DB_KEYS.IMAGE_INDEX);
      if (!imageIndex) {
        await this.db.set(DB_KEYS.IMAGE_INDEX, []);
      }

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

  /**
   * 获取计数器
   */
  private async getCounters(): Promise<Counters | null> {
    try {
      return (await this.db.get(DB_KEYS.COUNTERS)) as Counters | null;
    } catch (error) {
      throw new DatabaseError('获取计数器失败', error);
    }
  }

  /**
   * 更新计数器
   */
  private async updateCounters(counters: Counters): Promise<void> {
    try {
      await this.db.set(DB_KEYS.COUNTERS, counters);
    } catch (error) {
      throw new DatabaseError('更新计数器失败', error);
    }
  }

  /**
   * 生成新的图片ID
   */
  private async generateImageId(): Promise<string> {
    const counters = await this.getCounters();
    if (!counters) {
      throw new DatabaseError('计数器未初始化');
    }
    
    counters.imageId += 1;
    await this.updateCounters(counters);
    return `img_${counters.imageId.toString().padStart(6, '0')}`;
  }

  /**
   * 生成新的分组ID
   */
  private async generateGroupId(): Promise<string> {
    const counters = await this.getCounters();
    if (!counters) {
      throw new DatabaseError('计数器未初始化');
    }
    
    counters.groupId += 1;
    await this.updateCounters(counters);
    return `grp_${counters.groupId.toString().padStart(6, '0')}`;
  }

  // ==================== 图片相关操作 ====================

  /**
   * 保存图片信息
   */
  async saveImage(imageData: Omit<Image, 'id' | 'uploadedAt'>): Promise<Image> {
    try {
      const id = await this.generateImageId();
      const image: Image = {
        ...imageData,
        id,
        uploadedAt: new Date()
      };

      // 保存图片信息
      await this.db.set(`${DB_KEYS.IMAGES}:${id}`, image);

      // 更新图片索引
      await this.addToImageIndex(id);

      // 如果有分组，更新分组图片列表
      if (image.groupId) {
        await this.addImageToGroup(image.groupId, id);
        await this.updateGroupImageCount(image.groupId, 1);
      }

      console.log(`图片已保存: ${id}`);
      return image;
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
      const image = (await this.db.get(`${DB_KEYS.IMAGES}:${id}`)) as Image | null;
      return image ? { ...image, uploadedAt: new Date(image.uploadedAt) } : null;
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

      // 获取图片ID列表
      let imageIds: string[];

      if (groupId) {
        // 获取特定分组的图片
        imageIds = await this.getGroupImages(groupId);
      } else {
        // 获取所有图片
        imageIds = (await this.db.get(DB_KEYS.IMAGE_INDEX)) as string[] || [];
      }

      // 获取图片详细信息
      const images: Image[] = [];
      for (const id of imageIds) {
        const image = await this.getImage(id);
        if (image) {
          // 日期筛选
          if (dateFrom && image.uploadedAt < dateFrom) continue;
          if (dateTo && image.uploadedAt > dateTo) continue;

          // 搜索筛选
          if (search) {
            const searchLower = search.toLowerCase();
            const matchesFilename = image.filename.toLowerCase().includes(searchLower);
            const matchesTags = image.tags.some(tag => tag.toLowerCase().includes(searchLower));

            if (!matchesFilename && !matchesTags) continue;
          }

          images.push(image);
        }
      }

      // 排序
      images.sort((a, b) => {
        let aValue: any, bValue: any;
        
        switch (sortBy) {
          case 'filename':
            aValue = a.filename;
            bValue = b.filename;
            break;
          case 'bytes':
            aValue = a.bytes;
            bValue = b.bytes;
            break;
          case 'uploadedAt':
          default:
            aValue = a.uploadedAt;
            bValue = b.uploadedAt;
            break;
        }

        if (sortOrder === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });

      // 分页
      const total = images.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const data = images.slice(startIndex, endIndex);

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
      const image = await this.getImage(id);
      if (!image) {
        throw new NotFoundError('图片', id);
      }

      const oldGroupId = image.groupId;
      const updatedImage: Image = {
        ...image,
        ...updates
      };

      // 保存更新后的图片信息
      await this.db.set(`${DB_KEYS.IMAGES}:${id}`, updatedImage);

      // 处理分组变更
      if (oldGroupId !== updates.groupId) {
        // 从旧分组中移除
        if (oldGroupId) {
          await this.removeImageFromGroup(oldGroupId, id);
          await this.updateGroupImageCount(oldGroupId, -1);
        }

        // 添加到新分组
        if (updates.groupId) {
          await this.addImageToGroup(updates.groupId, id);
          await this.updateGroupImageCount(updates.groupId, 1);
        }
      }

      console.log(`图片已更新: ${id}`);
      return updatedImage;
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
      const image = await this.getImage(id);
      if (!image) {
        throw new NotFoundError('图片', id);
      }

      // 删除图片信息
      await this.db.delete(`${DB_KEYS.IMAGES}:${id}`);

      // 从图片索引中移除
      await this.removeFromImageIndex(id);

      // 如果有分组，从分组中移除
      if (image.groupId) {
        await this.removeImageFromGroup(image.groupId, id);
        await this.updateGroupImageCount(image.groupId, -1);
      }

      console.log(`图片已删除: ${id}`);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('删除图片失败', error);
    }
  }

  /**
   * 获取随机图片
   */
  async getRandomImage(groupId?: string): Promise<Image | null> {
    try {
      let imageIds: string[];

      if (groupId) {
        // 获取特定分组的图片
        imageIds = await this.getGroupImages(groupId);
      } else {
        // 获取所有图片
        imageIds = (await this.db.get(DB_KEYS.IMAGE_INDEX)) as string[] || [];
      }

      if (imageIds.length === 0) {
        return null;
      }

      // 随机选择一个图片ID
      const randomIndex = Math.floor(Math.random() * imageIds.length);
      const randomId = imageIds[randomIndex];

      return await this.getImage(randomId);
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
      const group: Group = {
        ...groupData,
        id,
        createdAt: new Date(),
        imageCount: 0
      };

      await this.db.set(`${DB_KEYS.GROUPS}:${id}`, group);
      
      // 初始化分组图片列表
      await this.db.set(`${DB_KEYS.GROUP_IMAGES}:${id}`, []);

      console.log(`分组已保存: ${id}`);
      return group;
    } catch (error) {
      throw new DatabaseError('保存分组失败', error);
    }
  }

  /**
   * 获取分组信息
   */
  async getGroup(id: string): Promise<Group | null> {
    try {
      const group = (await this.db.get(`${DB_KEYS.GROUPS}:${id}`)) as Group | null;
      return group ? { ...group, createdAt: new Date(group.createdAt) } : null;
    } catch (error) {
      throw new DatabaseError('获取分组失败', error);
    }
  }

  /**
   * 获取所有分组
   */
  async getGroups(): Promise<Group[]> {
    try {
      const keys = await this.db.list(`${DB_KEYS.GROUPS}:`);
      const groups: Group[] = [];

      for (const key of keys) {
        const group = (await this.db.get(key)) as Group;
        if (group) {
          groups.push({ ...group, createdAt: new Date(group.createdAt) });
        }
      }

      // 按创建时间排序
      groups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return groups;
    } catch (error) {
      throw new DatabaseError('获取分组列表失败', error);
    }
  }

  /**
   * 更新分组信息
   */
  async updateGroup(id: string, updates: Partial<Pick<Group, 'name' | 'description'>>): Promise<Group> {
    try {
      const group = await this.getGroup(id);
      if (!group) {
        throw new NotFoundError('分组', id);
      }

      const updatedGroup = { ...group, ...updates };
      await this.db.set(`${DB_KEYS.GROUPS}:${id}`, updatedGroup);

      console.log(`分组已更新: ${id}`);
      return updatedGroup;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('更新分组失败', error);
    }
  }

  /**
   * 删除分组
   */
  async deleteGroup(id: string): Promise<void> {
    try {
      const group = await this.getGroup(id);
      if (!group) {
        throw new NotFoundError('分组', id);
      }

      // 获取分组中的图片
      const imageIds = await this.getGroupImages(id);
      
      // 将分组中的图片的groupId设为undefined
      for (const imageId of imageIds) {
        const image = await this.getImage(imageId);
        if (image) {
          const updatedImage = { ...image, groupId: undefined };
          await this.db.set(`${DB_KEYS.IMAGES}:${imageId}`, updatedImage);
        }
      }

      // 删除分组信息
      await this.db.delete(`${DB_KEYS.GROUPS}:${id}`);
      
      // 删除分组图片列表
      await this.db.delete(`${DB_KEYS.GROUP_IMAGES}:${id}`);

      console.log(`分组已删除: ${id}, 影响图片数量: ${imageIds.length}`);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('删除分组失败', error);
    }
  }

  // ==================== API配置相关操作 ====================

  /**
   * 获取API配置
   */
  async getAPIConfig(): Promise<APIConfig | null> {
    try {
      const config = (await this.db.get(DB_KEYS.API_CONFIG)) as APIConfig | null;
      return config ? { ...config, updatedAt: new Date(config.updatedAt) } : null;
    } catch (error) {
      throw new DatabaseError('获取API配置失败', error);
    }
  }

  /**
   * 更新API配置
   */
  async updateAPIConfig(config: APIConfig): Promise<void> {
    try {
      const configWithTimestamp = {
        ...config,
        updatedAt: new Date()
      };
      
      await this.db.set(DB_KEYS.API_CONFIG, configWithTimestamp);
      console.log('API配置已更新');
    } catch (error) {
      throw new DatabaseError('更新API配置失败', error);
    }
  }

  // ==================== 索引管理相关操作 ====================

  /**
   * 添加图片到索引
   */
  private async addToImageIndex(imageId: string): Promise<void> {
    try {
      const index: string[] = (await this.db.get(DB_KEYS.IMAGE_INDEX)) as string[] || [];
      if (!index.includes(imageId)) {
        index.push(imageId);
        await this.db.set(DB_KEYS.IMAGE_INDEX, index);
      }
    } catch (error) {
      throw new DatabaseError('添加图片索引失败', error);
    }
  }

  /**
   * 从索引中移除图片
   */
  private async removeFromImageIndex(imageId: string): Promise<void> {
    try {
      const index: string[] = (await this.db.get(DB_KEYS.IMAGE_INDEX)) as string[] || [];
      const newIndex = index.filter(id => id !== imageId);
      await this.db.set(DB_KEYS.IMAGE_INDEX, newIndex);
    } catch (error) {
      throw new DatabaseError('移除图片索引失败', error);
    }
  }

  /**
   * 添加图片到分组
   */
  private async addImageToGroup(groupId: string, imageId: string): Promise<void> {
    try {
      const groupImages: string[] = (await this.db.get(`${DB_KEYS.GROUP_IMAGES}:${groupId}`)) as string[] || [];
      if (!groupImages.includes(imageId)) {
        groupImages.push(imageId);
        await this.db.set(`${DB_KEYS.GROUP_IMAGES}:${groupId}`, groupImages);
      }
    } catch (error) {
      throw new DatabaseError('添加图片到分组失败', error);
    }
  }

  /**
   * 从分组中移除图片
   */
  private async removeImageFromGroup(groupId: string, imageId: string): Promise<void> {
    try {
      const groupImages: string[] = (await this.db.get(`${DB_KEYS.GROUP_IMAGES}:${groupId}`)) as string[] || [];
      const newGroupImages = groupImages.filter(id => id !== imageId);
      await this.db.set(`${DB_KEYS.GROUP_IMAGES}:${groupId}`, newGroupImages);
    } catch (error) {
      throw new DatabaseError('从分组移除图片失败', error);
    }
  }

  /**
   * 获取分组中的图片列表
   */
  private async getGroupImages(groupId: string): Promise<string[]> {
    try {
      return (await this.db.get(`${DB_KEYS.GROUP_IMAGES}:${groupId}`)) as string[] || [];
    } catch (error) {
      throw new DatabaseError('获取分组图片列表失败', error);
    }
  }

  /**
   * 更新分组图片数量
   */
  private async updateGroupImageCount(groupId: string, delta: number): Promise<void> {
    try {
      const group = await this.getGroup(groupId);
      if (group) {
        group.imageCount = Math.max(0, group.imageCount + delta);
        await this.db.set(`${DB_KEYS.GROUPS}:${groupId}`, group);
      }
    } catch (error) {
      throw new DatabaseError('更新分组图片数量失败', error);
    }
  }

  // ==================== 工具方法 ====================

  /**
   * 获取数据库统计信息
   */
  async getStats(): Promise<{ totalImages: number; totalGroups: number }> {
    try {
      const imageIndex: string[] = (await this.db.get(DB_KEYS.IMAGE_INDEX)) as string[] || [];
      const groups = await this.getGroups();
      
      return {
        totalImages: imageIndex.length,
        totalGroups: groups.length
      };
    } catch (error) {
      throw new DatabaseError('获取统计信息失败', error);
    }
  }

  /**
   * 清理数据库（仅用于测试）
   */
  async cleanup(): Promise<void> {
    try {
      const keys = await this.db.list();
      for (const key of keys) {
        await this.db.delete(key);
      }
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
      await this.db.get('health_check');
      return true;
    } catch (error) {
      console.error('数据库连接检查失败:', error);
      return false;
    }
  }
}

// 导出单例实例
export const databaseService = DatabaseService.getInstance();