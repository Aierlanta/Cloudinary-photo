/**
 * 数据库服务单元测试
 */

import { DatabaseService } from '../database';
import { Image, Group, APIConfig } from '@/types/models';
import { DatabaseError, NotFoundError } from '@/types/errors';

// Mock Prisma Client
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    image: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
    },
    group: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
    },
    aPIConfig: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    systemLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn()
    },
    counter: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn(),
  };

  mockPrisma.$transaction.mockImplementation(async (handler) =>
    handler({
      counter: {
        findUnique: mockPrisma.counter.findUnique,
        create: mockPrisma.counter.create,
        update: mockPrisma.counter.update,
      },
    })
  );

  return {
    PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
  };
});

// 获取mock实例
const { PrismaClient } = require('@prisma/client');
const mockPrisma = new PrismaClient();

describe('DatabaseService', () => {
  let databaseService: DatabaseService;

  beforeEach(() => {
    // 重置所有mock
    jest.clearAllMocks();

    // 创建新的数据库服务实例
    databaseService = new DatabaseService();

    mockPrisma.systemLog.create.mockResolvedValue({});
  });

  describe('初始化', () => {
    it('应该正确初始化数据库', async () => {
      mockPrisma.image.findMany.mockResolvedValue([]);
      mockPrisma.group.findMany.mockResolvedValue([]);
      mockPrisma.counter.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockPrisma.counter.create
        .mockResolvedValueOnce({ id: 'imageId', value: 0 })
        .mockResolvedValueOnce({ id: 'groupId', value: 0 });

      // 模拟API配置不存在
      mockPrisma.aPIConfig.findUnique.mockResolvedValue(null);
      mockPrisma.aPIConfig.upsert.mockResolvedValue({
        id: 'default',
        isEnabled: true,
        defaultScope: 'all',
        defaultGroups: '[]',
        allowedParameters: '[]',
        enableDirectResponse: false,
        apiKeyEnabled: false,
        apiKey: null,
        updatedAt: new Date()
      });

      await databaseService.initialize();

      expect(mockPrisma.counter.findUnique).toHaveBeenNthCalledWith(1, {
        where: { id: 'imageId' }
      });
      expect(mockPrisma.counter.findUnique).toHaveBeenNthCalledWith(2, {
        where: { id: 'groupId' }
      });

      expect(mockPrisma.counter.create).toHaveBeenNthCalledWith(1, {
        data: { id: 'imageId', value: 0 }
      });
      expect(mockPrisma.counter.create).toHaveBeenNthCalledWith(2, {
        data: { id: 'groupId', value: 0 }
      });

      expect(mockPrisma.aPIConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            enableDirectResponse: false,
            apiKeyEnabled: false,
            apiKey: undefined
          }),
          create: expect.objectContaining({
            enableDirectResponse: false,
            apiKeyEnabled: false,
            apiKey: undefined
          })
        })
      );
    });
  });

  describe('图片操作', () => {
    it('应该正确保存图片', async () => {
      const imageData = {
        url: 'https://example.com/image.jpg',
        publicId: 'test_image',
        title: '测试图片',
        description: '这是一个测试图片',
        tags: ['test', 'image'],
        groupId: 'grp_000001',
        primaryProvider: 'cloudinary',
        backupProvider: 'tgstate'
      };

      // 模拟计数器更新
      mockPrisma.counter.update.mockResolvedValue({ id: 'image_counter', value: 1 });

      // 模拟图片创建
      const mockImage = {
        id: 'img_000001',
        url: imageData.url,
        publicId: imageData.publicId,
        title: imageData.title,
        description: imageData.description,
        tags: JSON.stringify(imageData.tags),
        groupId: imageData.groupId,
        primaryProvider: imageData.primaryProvider,
        backupProvider: imageData.backupProvider,
        uploadedAt: new Date(),
        group: { id: 'grp_000001', name: '测试分组' }
      };
      mockPrisma.image.create.mockResolvedValue(mockImage);

      // 模拟分组更新
      mockPrisma.group.update.mockResolvedValue({});

      const result = await databaseService.saveImage(imageData);

      expect(mockPrisma.counter.update).toHaveBeenCalledWith({
        where: { id: 'image_counter' },
        data: { value: { increment: 1 } }
      });

      expect(mockPrisma.image.create).toHaveBeenCalledWith({
        data: {
          id: 'img_000001',
          url: imageData.url,
          publicId: imageData.publicId,
          title: imageData.title,
          description: imageData.description,
          tags: JSON.stringify(imageData.tags),
          groupId: imageData.groupId,
          primaryProvider: imageData.primaryProvider,
          backupProvider: imageData.backupProvider
        },
        include: { group: true }
      });

      expect(mockPrisma.group.update).toHaveBeenCalledWith({
        where: { id: imageData.groupId },
        data: { imageCount: { increment: 1 } }
      });

      expect(result).toEqual({
        id: 'img_000001',
        url: imageData.url,
        publicId: imageData.publicId,
        title: imageData.title,
        description: imageData.description,
        tags: imageData.tags,
        groupId: imageData.groupId,
        uploadedAt: expect.any(Date)
      });
    });

    it('应该正确获取图片', async () => {
      const mockImage = {
        id: 'img_000001',
        url: 'https://example.com/image.jpg',
        publicId: 'test_image',
        title: '测试图片',
        description: '这是一个测试图片',
        tags: '["test","image"]',
        groupId: 'grp_000001',
        uploadedAt: new Date(),
        primaryProvider: 'cloudinary',
        backupProvider: 'tgstate',
        group: { id: 'grp_000001', name: '测试分组' }
      };

      mockPrisma.image.findUnique.mockResolvedValue(mockImage);

      const result = await databaseService.getImage('img_000001');

      expect(mockPrisma.image.findUnique).toHaveBeenCalledWith({
        where: { id: 'img_000001' },
        include: { group: true }
      });

      expect(result).toEqual({
        id: 'img_000001',
        url: 'https://example.com/image.jpg',
        publicId: 'test_image',
        title: '测试图片',
        description: '这是一个测试图片',
        tags: ['test', 'image'],
        groupId: 'grp_000001',
        uploadedAt: expect.any(Date),
        primaryProvider: 'cloudinary',
        backupProvider: 'tgstate'
      });
    });

    it('应该在图片不存在时返回null', async () => {
      mockPrisma.image.findUnique.mockResolvedValue(null);

      const result = await databaseService.getImage('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('分组操作', () => {
    it('应该正确保存分组', async () => {
      const groupData = {
        name: '测试分组',
        description: '这是一个测试分组'
      };

      // 模拟计数器更新
      mockPrisma.counter.update.mockResolvedValue({ id: 'groupId', value: 1 });

      // 模拟分组创建
      const mockGroup = {
        id: 'grp_000001',
        name: groupData.name,
        description: groupData.description,
        imageCount: 0,
        createdAt: new Date()
      };
      mockPrisma.group.create.mockResolvedValue(mockGroup);

      const result = await databaseService.saveGroup(groupData);

      expect(mockPrisma.counter.update).toHaveBeenCalledWith({
        where: { id: 'groupId' },
        data: { value: { increment: 1 } }
      });

      expect(mockPrisma.group.create).toHaveBeenCalledWith({
        data: {
          id: 'grp_000001',
          name: groupData.name,
          description: groupData.description,
          imageCount: 0
        }
      });

      expect(result).toEqual({
        id: 'grp_000001',
        name: groupData.name,
        description: groupData.description,
        imageCount: 0,
        createdAt: expect.any(Date)
      });
    });
  });

  describe('API配置操作', () => {
    it('应该正确获取API配置', async () => {
      const mockConfig = {
        id: 'default',
        isEnabled: true,
        defaultScope: 'all',
        defaultGroups: '["grp_000001"]',
        allowedParameters: JSON.stringify([
          {
            name: 'category',
            type: 'group',
            allowedValues: ['grp_000001'],
            mappedGroups: ['grp_000001'],
            isEnabled: true
          }
        ]),
        enableDirectResponse: true,
        apiKeyEnabled: true,
        apiKey: 'secret',
        updatedAt: new Date()
      };

      mockPrisma.aPIConfig.findUnique.mockResolvedValue(mockConfig);

      const result = await databaseService.getAPIConfig();

      expect(mockPrisma.aPIConfig.findUnique).toHaveBeenCalledWith({
        where: { id: 'default' }
      });

      expect(result).toEqual({
        id: 'default',
        isEnabled: true,
        defaultScope: 'all',
        defaultGroups: ['grp_000001'],
        allowedParameters: [
          {
            name: 'category',
            type: 'group',
            allowedValues: ['grp_000001'],
            mappedGroups: ['grp_000001'],
            isEnabled: true
          }
        ],
        enableDirectResponse: true,
        apiKeyEnabled: true,
        apiKey: 'secret',
        updatedAt: expect.any(Date)
      });
    });

    it('应该在配置不存在时返回null', async () => {
      mockPrisma.aPIConfig.findUnique.mockResolvedValue(null);

      const result = await databaseService.getAPIConfig();

      expect(result).toBeNull();
    });
  });

  describe('工具方法', () => {
    it('应该正确检查数据库连接', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);

      const result = await databaseService.checkConnection();

      expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(expect.anything());
      expect(result).toBe(true);
    });

    it('应该在连接失败时返回false', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection failed'));

      const result = await databaseService.checkConnection();

      expect(result).toBe(false);
    });

    it('应该正确获取统计信息', async () => {
      mockPrisma.image.count.mockResolvedValue(10);
      mockPrisma.group.count.mockResolvedValue(3);

      const result = await databaseService.getStats();

      expect(result).toEqual({
        totalImages: 10,
        totalGroups: 3
      });
    });
  });
});
