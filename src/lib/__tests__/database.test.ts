/**
 * 数据库服务单元测试
 */

import { DatabaseService } from '../database';
import { Image, Group, APIConfig } from '@/types/models';
import { DatabaseError, NotFoundError } from '@/types/errors';

// Mock Replit Database
jest.mock('@replit/database', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    list: jest.fn()
  }));
});

describe('DatabaseService', () => {
  let databaseService: DatabaseService;
  let mockDb: any;

  beforeEach(() => {
    // 重置所有mock
    jest.clearAllMocks();
    
    // 创建新的数据库服务实例
    databaseService = new DatabaseService();
    
    // 获取mock的数据库实例
    mockDb = (databaseService as any).db;
    
    // 设置默认的mock返回值
    mockDb.get.mockResolvedValue(null);
    mockDb.set.mockResolvedValue(undefined);
    mockDb.delete.mockResolvedValue(undefined);
    mockDb.list.mockResolvedValue([]);
  });

  describe('初始化', () => {
    it('应该正确初始化数据库', async () => {
      // 模拟初始化时的数据库状态
      mockDb.get
        .mockResolvedValueOnce(null) // counters
        .mockResolvedValueOnce(null) // image_index
        .mockResolvedValueOnce(null); // api_config

      await databaseService.initialize();

      // 验证初始化调用
      expect(mockDb.set).toHaveBeenCalledWith('counters', { imageId: 0, groupId: 0 });
      expect(mockDb.set).toHaveBeenCalledWith('image_index', []);
      expect(mockDb.set).toHaveBeenCalledWith('api_config', expect.objectContaining({
        id: 'default',
        isEnabled: true,
        defaultScope: 'all'
      }));
    });

    it('应该跳过已存在的初始化数据', async () => {
      // 模拟已存在的数据
      mockDb.get
        .mockResolvedValueOnce({ imageId: 5, groupId: 2 }) // counters
        .mockResolvedValueOnce(['img_000001']) // image_index
        .mockResolvedValueOnce({ id: 'default', isEnabled: true }); // api_config

      await databaseService.initialize();

      // 验证不会重复设置已存在的数据
      expect(mockDb.set).not.toHaveBeenCalledWith('counters', expect.anything());
      expect(mockDb.set).not.toHaveBeenCalledWith('image_index', expect.anything());
    });
  });

  describe('图片操作', () => {
    beforeEach(async () => {
      // 设置初始化状态
      mockDb.get
        .mockResolvedValueOnce({ imageId: 0, groupId: 0 })
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(null);
      
      await databaseService.initialize();
      jest.clearAllMocks();
    });

    it('应该正确保存图片', async () => {
      const imageData = {
        cloudinaryId: 'test_cloudinary_id',
        publicId: 'test_public_id',
        url: 'https://example.com/image.jpg',
        secureUrl: 'https://example.com/image.jpg',
        filename: 'test.jpg',
        format: 'jpg',
        width: 800,
        height: 600,
        bytes: 50000,
        tags: ['test']
      };

      // Mock计数器获取和更新
      mockDb.get
        .mockResolvedValueOnce({ imageId: 0, groupId: 0 }) // getCounters
        .mockResolvedValueOnce([]); // getImageIndex

      const savedImage = await databaseService.saveImage(imageData);

      expect(savedImage.id).toBe('img_000001');
      expect(savedImage.filename).toBe('test.jpg');
      expect(mockDb.set).toHaveBeenCalledWith('images:img_000001', expect.objectContaining({
        id: 'img_000001',
        filename: 'test.jpg'
      }));
    });

    it('应该正确获取图片', async () => {
      const mockImage = {
        id: 'img_000001',
        filename: 'test.jpg',
        uploadedAt: '2024-01-01T00:00:00.000Z'
      };

      mockDb.get.mockResolvedValue(mockImage);

      const image = await databaseService.getImage('img_000001');

      expect(image).toBeTruthy();
      expect(image!.id).toBe('img_000001');
      expect(image!.uploadedAt).toBeInstanceOf(Date);
      expect(mockDb.get).toHaveBeenCalledWith('images:img_000001');
    });

    it('应该返回null当图片不存在时', async () => {
      mockDb.get.mockResolvedValue(null);

      const image = await databaseService.getImage('nonexistent');

      expect(image).toBeNull();
    });

    it('应该正确删除图片', async () => {
      const mockImage = {
        id: 'img_000001',
        filename: 'test.jpg',
        uploadedAt: new Date()
      };

      mockDb.get
        .mockResolvedValueOnce(mockImage) // getImage
        .mockResolvedValueOnce(['img_000001', 'img_000002']); // getImageIndex

      await databaseService.deleteImage('img_000001');

      expect(mockDb.delete).toHaveBeenCalledWith('images:img_000001');
      expect(mockDb.set).toHaveBeenCalledWith('image_index', ['img_000002']);
    });

    it('应该抛出错误当删除不存在的图片时', async () => {
      mockDb.get.mockResolvedValue(null);

      await expect(databaseService.deleteImage('nonexistent'))
        .rejects.toThrow(NotFoundError);
    });

    it('应该正确获取随机图片', async () => {
      const mockImage = {
        id: 'img_000001',
        filename: 'test.jpg',
        uploadedAt: '2024-01-01T00:00:00.000Z'
      };

      mockDb.get
        .mockResolvedValueOnce(['img_000001', 'img_000002']) // getImageIndex
        .mockResolvedValueOnce(mockImage); // getImage

      // Mock Math.random to return 0 (first image)
      jest.spyOn(Math, 'random').mockReturnValue(0);

      const randomImage = await databaseService.getRandomImage();

      expect(randomImage).toBeTruthy();
      expect(randomImage!.id).toBe('img_000001');

      // 恢复Math.random
      (Math.random as jest.Mock).mockRestore();
    });

    it('应该返回null当没有图片时', async () => {
      mockDb.get.mockResolvedValue([]); // 空的图片索引

      const randomImage = await databaseService.getRandomImage();

      expect(randomImage).toBeNull();
    });

    it('应该正确获取图片列表', async () => {
      const mockImages = [
        { id: 'img_000001', filename: 'test1.jpg', uploadedAt: '2024-01-01T00:00:00.000Z' },
        { id: 'img_000002', filename: 'test2.jpg', uploadedAt: '2024-01-02T00:00:00.000Z' }
      ];

      mockDb.get
        .mockResolvedValueOnce(['img_000001', 'img_000002']) // getImageIndex
        .mockResolvedValueOnce(mockImages[0]) // getImage for img_000001
        .mockResolvedValueOnce(mockImages[1]); // getImage for img_000002

      const result = await databaseService.getImages({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.hasNext).toBe(false);
      expect(result.hasPrev).toBe(false);
    });
  });

  describe('分组操作', () => {
    beforeEach(async () => {
      // 设置初始化状态
      mockDb.get
        .mockResolvedValueOnce({ imageId: 0, groupId: 0 })
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(null);
      
      await databaseService.initialize();
      jest.clearAllMocks();
    });

    it('应该正确保存分组', async () => {
      const groupData = {
        name: '测试分组',
        description: '这是一个测试分组'
      };

      // Mock计数器获取和更新
      mockDb.get.mockResolvedValueOnce({ imageId: 0, groupId: 0 });

      const savedGroup = await databaseService.saveGroup(groupData);

      expect(savedGroup.id).toBe('grp_000001');
      expect(savedGroup.name).toBe('测试分组');
      expect(savedGroup.imageCount).toBe(0);
      expect(mockDb.set).toHaveBeenCalledWith('groups:grp_000001', expect.objectContaining({
        id: 'grp_000001',
        name: '测试分组'
      }));
    });

    it('应该正确获取分组', async () => {
      const mockGroup = {
        id: 'grp_000001',
        name: '测试分组',
        createdAt: '2024-01-01T00:00:00.000Z'
      };

      mockDb.get.mockResolvedValue(mockGroup);

      const group = await databaseService.getGroup('grp_000001');

      expect(group).toBeTruthy();
      expect(group!.id).toBe('grp_000001');
      expect(group!.createdAt).toBeInstanceOf(Date);
    });

    it('应该正确获取所有分组', async () => {
      const mockGroups = [
        { id: 'grp_000001', name: '分组1', createdAt: '2024-01-01T00:00:00.000Z' },
        { id: 'grp_000002', name: '分组2', createdAt: '2024-01-02T00:00:00.000Z' }
      ];

      mockDb.list.mockResolvedValue(['groups:grp_000001', 'groups:grp_000002']);
      mockDb.get
        .mockResolvedValueOnce(mockGroups[0])
        .mockResolvedValueOnce(mockGroups[1]);

      const groups = await databaseService.getGroups();

      expect(groups).toHaveLength(2);
      expect(groups[0].name).toBe('分组2'); // 应该按创建时间倒序排列
      expect(groups[1].name).toBe('分组1');
    });

    it('应该正确更新分组', async () => {
      const mockGroup = {
        id: 'grp_000001',
        name: '原始名称',
        description: '原始描述',
        createdAt: new Date(),
        imageCount: 0
      };

      mockDb.get.mockResolvedValue(mockGroup);

      const updatedGroup = await databaseService.updateGroup('grp_000001', {
        name: '新名称'
      });

      expect(updatedGroup.name).toBe('新名称');
      expect(mockDb.set).toHaveBeenCalledWith('groups:grp_000001', expect.objectContaining({
        name: '新名称'
      }));
    });

    it('应该正确删除分组', async () => {
      const mockGroup = {
        id: 'grp_000001',
        name: '测试分组',
        createdAt: new Date(),
        imageCount: 1
      };

      const mockImage = {
        id: 'img_000001',
        groupId: 'grp_000001',
        filename: 'test.jpg'
      };

      mockDb.get
        .mockResolvedValueOnce(mockGroup) // getGroup
        .mockResolvedValueOnce(['img_000001']) // getGroupImages
        .mockResolvedValueOnce(mockImage); // getImage

      await databaseService.deleteGroup('grp_000001');

      expect(mockDb.delete).toHaveBeenCalledWith('groups:grp_000001');
      expect(mockDb.delete).toHaveBeenCalledWith('group_images:grp_000001');
      expect(mockDb.set).toHaveBeenCalledWith('images:img_000001', expect.objectContaining({
        groupId: undefined
      }));
    });
  });

  describe('API配置操作', () => {
    it('应该正确获取API配置', async () => {
      const mockConfig = {
        id: 'default',
        isEnabled: true,
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      mockDb.get.mockResolvedValue(mockConfig);

      const config = await databaseService.getAPIConfig();

      expect(config).toBeTruthy();
      expect(config!.isEnabled).toBe(true);
      expect(config!.updatedAt).toBeInstanceOf(Date);
    });

    it('应该正确更新API配置', async () => {
      const newConfig: APIConfig = {
        id: 'default',
        isEnabled: false,
        defaultScope: 'groups',
        defaultGroups: ['grp_000001'],
        allowedParameters: [],
        updatedAt: new Date()
      };

      await databaseService.updateAPIConfig(newConfig);

      expect(mockDb.set).toHaveBeenCalledWith('api_config', expect.objectContaining({
        isEnabled: false,
        defaultScope: 'groups'
      }));
    });
  });

  describe('工具方法', () => {
    it('应该正确获取统计信息', async () => {
      mockDb.get
        .mockResolvedValueOnce(['img_000001', 'img_000002']) // image_index
        .mockResolvedValueOnce({ id: 'grp_000001', name: '分组1', createdAt: new Date() }); // getGroup
      mockDb.list.mockResolvedValue(['groups:grp_000001']);

      const stats = await databaseService.getStats();

      expect(stats.totalImages).toBe(2);
      expect(stats.totalGroups).toBe(1);
    });

    it('应该正确检查数据库连接', async () => {
      mockDb.get.mockResolvedValue(null);

      const isConnected = await databaseService.checkConnection();

      expect(isConnected).toBe(true);
      expect(mockDb.get).toHaveBeenCalledWith('health_check');
    });

    it('应该在连接失败时返回false', async () => {
      mockDb.get.mockRejectedValue(new Error('连接失败'));

      const isConnected = await databaseService.checkConnection();

      expect(isConnected).toBe(false);
    });

    it('应该正确清理数据库', async () => {
      mockDb.list.mockResolvedValue(['key1', 'key2', 'key3']);

      await databaseService.cleanup();

      expect(mockDb.delete).toHaveBeenCalledTimes(3);
      expect(mockDb.delete).toHaveBeenCalledWith('key1');
      expect(mockDb.delete).toHaveBeenCalledWith('key2');
      expect(mockDb.delete).toHaveBeenCalledWith('key3');
    });
  });

  describe('错误处理', () => {
    it('应该在数据库操作失败时抛出DatabaseError', async () => {
      mockDb.get.mockRejectedValue(new Error('数据库错误'));

      await expect(databaseService.getImage('test'))
        .rejects.toThrow(DatabaseError);
    });

    it('应该在保存图片失败时抛出DatabaseError', async () => {
      mockDb.get.mockResolvedValue({ imageId: 0, groupId: 0 });
      mockDb.set.mockRejectedValue(new Error('保存失败'));

      const imageData = {
        cloudinaryId: 'test',
        publicId: 'test',
        url: 'https://example.com/test.jpg',
        secureUrl: 'https://example.com/test.jpg',
        filename: 'test.jpg',
        format: 'jpg',
        width: 800,
        height: 600,
        bytes: 50000,
        tags: []
      };

      await expect(databaseService.saveImage(imageData))
        .rejects.toThrow(DatabaseError);
    });
  });

  describe('分组图片关联', () => {
    it('应该正确处理带分组的图片保存', async () => {
      const imageData = {
        cloudinaryId: 'test',
        publicId: 'test',
        url: 'https://example.com/test.jpg',
        secureUrl: 'https://example.com/test.jpg',
        filename: 'test.jpg',
        format: 'jpg',
        width: 800,
        height: 600,
        bytes: 50000,
        tags: [],
        groupId: 'grp_000001'
      };

      const mockGroup = {
        id: 'grp_000001',
        name: '测试分组',
        imageCount: 0
      };

      mockDb.get
        .mockResolvedValueOnce({ imageId: 0, groupId: 0 }) // getCounters
        .mockResolvedValueOnce([]) // getImageIndex
        .mockResolvedValueOnce([]) // getGroupImages
        .mockResolvedValueOnce(mockGroup); // getGroup for updateGroupImageCount

      await databaseService.saveImage(imageData);

      // 验证分组图片列表更新
      expect(mockDb.set).toHaveBeenCalledWith('group_images:grp_000001', ['img_000001']);
      
      // 验证分组图片数量更新
      expect(mockDb.set).toHaveBeenCalledWith('groups:grp_000001', expect.objectContaining({
        imageCount: 1
      }));
    });

    it('应该正确获取分组中的随机图片', async () => {
      const mockImage = {
        id: 'img_000001',
        filename: 'test.jpg',
        uploadedAt: '2024-01-01T00:00:00.000Z'
      };

      mockDb.get
        .mockResolvedValueOnce(['img_000001']) // getGroupImages
        .mockResolvedValueOnce(mockImage); // getImage

      jest.spyOn(Math, 'random').mockReturnValue(0);

      const randomImage = await databaseService.getRandomImage('grp_000001');

      expect(randomImage).toBeTruthy();
      expect(randomImage!.id).toBe('img_000001');

      (Math.random as jest.Mock).mockRestore();
    });
  });
});