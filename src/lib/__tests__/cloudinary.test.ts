/**
 * CloudinaryService单元测试
 */

import { CloudinaryService, cloudinaryService } from '../cloudinary';
import { CloudinaryError } from '@/types/errors';
import { v2 as cloudinary } from 'cloudinary';

// Mock cloudinary
jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn(),
      destroy: jest.fn()
    },
    api: {
      resource: jest.fn(),
      ping: jest.fn(),
      usage: jest.fn()
    },
    url: jest.fn()
  }
}));

// Mock fetch
global.fetch = jest.fn();

describe('CloudinaryService', () => {
  let service: CloudinaryService;
  
  // Mock环境变量
  const originalEnv = process.env;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // 重置单例
    (CloudinaryService as any).instance = undefined;
    
    // 设置测试环境变量
    process.env = {
      ...originalEnv,
      CLOUDINARY_CLOUD_NAME: 'test-cloud',
      CLOUDINARY_API_KEY: 'test-key',
      CLOUDINARY_API_SECRET: 'test-secret'
    };
    
    service = CloudinaryService.getInstance();
  });
  
  afterEach(() => {
    process.env = originalEnv;
  });

  describe('配置', () => {
    it('应该正确配置Cloudinary', () => {
      expect(cloudinary.config).toHaveBeenCalledWith({
        cloud_name: 'test-cloud',
        api_key: 'test-key',
        api_secret: 'test-secret',
        secure: true
      });
    });

    it('缺少环境变量时应该抛出错误', () => {
      // 重置单例
      (CloudinaryService as any).instance = undefined;
      delete process.env.CLOUDINARY_CLOUD_NAME;
      
      expect(() => {
        CloudinaryService.getInstance();
      }).toThrow(CloudinaryError);
    });
  });

  describe('uploadImage', () => {
    it('应该成功上传图片', async () => {
      // Mock File with arrayBuffer method
      const mockFile = {
        name: 'test.jpg',
        type: 'image/jpeg',
        size: 1024,
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(10))
      } as unknown as File;
      
      const mockResult = {
        public_id: 'test-id',
        url: 'http://test.com/image.jpg',
        secure_url: 'https://test.com/image.jpg',
        width: 100,
        height: 100,
        format: 'jpg',
        bytes: 1024
      };

      // Mock upload_stream
      const mockUploadStream = {
        end: jest.fn()
      };
      
      (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
        (options, callback) => {
          // 模拟异步回调
          setTimeout(() => callback(null, mockResult), 0);
          return mockUploadStream;
        }
      );

      const result = await service.uploadImage(mockFile);

      expect(result).toEqual(expect.objectContaining(mockResult));
      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
        expect.objectContaining({
          resource_type: 'image',
          folder: 'random-image-api',
          tags: [],
          use_filename: true,
          unique_filename: true,
          overwrite: false
        }),
        expect.any(Function)
      );
      expect(mockUploadStream.end).toHaveBeenCalled();
    });

    it('上传失败时应该抛出CloudinaryError', async () => {
      const mockFile = {
        name: 'test.jpg',
        type: 'image/jpeg',
        size: 1024,
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(10))
      } as unknown as File;
      
      const mockError = new Error('Upload failed');

      const mockUploadStream = {
        end: jest.fn()
      };
      
      (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
        (options, callback) => {
          setTimeout(() => callback(mockError, null), 0);
          return mockUploadStream;
        }
      );

      await expect(service.uploadImage(mockFile)).rejects.toThrow(CloudinaryError);
    });

    it('应该支持自定义上传选项', async () => {
      const mockFile = {
        name: 'test.jpg',
        type: 'image/jpeg',
        size: 1024,
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(10))
      } as unknown as File;
      
      const mockResult = { public_id: 'test-id' };
      const options = {
        folder: 'custom-folder',
        tags: ['tag1', 'tag2'],
        transformation: { width: 200 }
      };

      const mockUploadStream = {
        end: jest.fn()
      };
      
      (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
        (uploadOptions, callback) => {
          setTimeout(() => callback(null, mockResult), 0);
          return mockUploadStream;
        }
      );

      await service.uploadImage(mockFile, options);

      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
        expect.objectContaining({
          folder: 'custom-folder',
          tags: ['tag1', 'tag2'],
          transformation: { width: 200 }
        }),
        expect.any(Function)
      );
    });
  });

  describe('deleteImage', () => {
    it('应该成功删除图片', async () => {
      const publicId = 'test-id';
      (cloudinary.uploader.destroy as jest.Mock).mockResolvedValue({
        result: 'ok'
      });

      await service.deleteImage(publicId);

      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(publicId);
    });

    it('删除失败时应该抛出CloudinaryError', async () => {
      const publicId = 'test-id';
      (cloudinary.uploader.destroy as jest.Mock).mockResolvedValue({
        result: 'not found'
      });

      await expect(service.deleteImage(publicId)).rejects.toThrow(CloudinaryError);
    });

    it('API调用失败时应该抛出CloudinaryError', async () => {
      const publicId = 'test-id';
      (cloudinary.uploader.destroy as jest.Mock).mockRejectedValue(
        new Error('API Error')
      );

      await expect(service.deleteImage(publicId)).rejects.toThrow(CloudinaryError);
    });
  });

  describe('getImageUrl', () => {
    it('应该返回图片URL', () => {
      const publicId = 'test-id';
      const expectedUrl = 'https://test.com/image.jpg';
      
      (cloudinary.url as jest.Mock).mockReturnValue(expectedUrl);

      const result = service.getImageUrl(publicId);

      expect(result).toBe(expectedUrl);
      expect(cloudinary.url).toHaveBeenCalledWith(publicId, {
        secure: true,
        transformation: []
      });
    });

    it('应该支持转换参数', () => {
      const publicId = 'test-id';
      const transformations = [{ width: 200, height: 200 }];
      const expectedUrl = 'https://test.com/image.jpg';
      
      (cloudinary.url as jest.Mock).mockReturnValue(expectedUrl);

      const result = service.getImageUrl(publicId, transformations);

      expect(result).toBe(expectedUrl);
      expect(cloudinary.url).toHaveBeenCalledWith(publicId, {
        secure: true,
        transformation: transformations
      });
    });

    it('URL生成失败时应该抛出CloudinaryError', () => {
      const publicId = 'test-id';
      (cloudinary.url as jest.Mock).mockImplementation(() => {
        throw new Error('URL generation failed');
      });

      expect(() => service.getImageUrl(publicId)).toThrow(CloudinaryError);
    });
  });

  describe('downloadImage', () => {
    it('应该成功下载图片', async () => {
      const publicId = 'test-id';
      const expectedUrl = 'https://test.com/image.jpg';
      const mockArrayBuffer = new ArrayBuffer(10);
      
      (cloudinary.url as jest.Mock).mockReturnValue(expectedUrl);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockArrayBuffer)
      });

      const result = await service.downloadImage(publicId);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(10);
      expect(global.fetch).toHaveBeenCalledWith(expectedUrl);
    });

    it('HTTP请求失败时应该抛出CloudinaryError', async () => {
      const publicId = 'test-id';
      const expectedUrl = 'https://test.com/image.jpg';
      
      (cloudinary.url as jest.Mock).mockReturnValue(expectedUrl);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(service.downloadImage(publicId)).rejects.toThrow(CloudinaryError);
    }, 10000);

    it('应该支持转换参数', async () => {
      const publicId = 'test-id';
      const transformations = [{ width: 200 }];
      const expectedUrl = 'https://test.com/image.jpg';
      const mockArrayBuffer = new ArrayBuffer(10);
      
      (cloudinary.url as jest.Mock).mockReturnValue(expectedUrl);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockArrayBuffer)
      });

      await service.downloadImage(publicId, transformations);

      expect(cloudinary.url).toHaveBeenCalledWith(publicId, {
        secure: true,
        transformation: transformations
      });
    });
  });

  describe('getImageInfo', () => {
    it('应该返回图片信息', async () => {
      const publicId = 'test-id';
      const mockInfo = {
        public_id: publicId,
        width: 100,
        height: 100,
        format: 'jpg'
      };
      
      (cloudinary.api.resource as jest.Mock).mockResolvedValue(mockInfo);

      const result = await service.getImageInfo(publicId);

      expect(result).toEqual(mockInfo);
      expect(cloudinary.api.resource).toHaveBeenCalledWith(publicId);
    });

    it('API调用失败时应该抛出CloudinaryError', async () => {
      const publicId = 'test-id';
      (cloudinary.api.resource as jest.Mock).mockRejectedValue(
        new Error('API Error')
      );

      await expect(service.getImageInfo(publicId)).rejects.toThrow(CloudinaryError);
    }, 10000);
  });

  describe('deleteImages', () => {
    it('应该批量删除图片', async () => {
      const publicIds = ['id1', 'id2', 'id3'];
      (cloudinary.uploader.destroy as jest.Mock).mockResolvedValue({
        result: 'ok'
      });

      const result = await service.deleteImages(publicIds);

      expect(result.deleted).toEqual(publicIds);
      expect(result.failed).toEqual([]);
      expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(3);
    });

    it('应该处理部分失败的情况', async () => {
      const publicIds = ['id1', 'id2', 'id3'];
      
      // Mock deleteImage method directly to control the behavior
      const originalDeleteImage = service.deleteImage;
      service.deleteImage = jest.fn()
        .mockResolvedValueOnce(undefined) // id1 success
        .mockRejectedValueOnce(new Error('Delete failed')) // id2 fail
        .mockResolvedValueOnce(undefined); // id3 success

      const result = await service.deleteImages(publicIds);

      expect(result.deleted).toContain('id1');
      expect(result.deleted).toContain('id3');
      expect(result.failed).toContain('id2');
      expect(result.deleted.length).toBe(2);
      expect(result.failed.length).toBe(1);
      
      // Restore original method
      service.deleteImage = originalDeleteImage;
    });
  });

  describe('checkConnection', () => {
    it('连接成功时应该返回连接状态', async () => {
      (cloudinary.api.ping as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({}), 10))
      );

      const result = await service.checkConnection();

      expect(result.connected).toBe(true);
      expect(result.responseTime).toBeGreaterThan(0);
    });

    it('连接失败时应该返回失败状态', async () => {
      (cloudinary.api.ping as jest.Mock).mockRejectedValue(
        new Error('Connection failed')
      );

      const result = await service.checkConnection();

      expect(result.connected).toBe(false);
      expect(result.responseTime).toBeUndefined();
    });
  });

  describe('getUsageStats', () => {
    it('应该返回使用统计', async () => {
      const mockStats = {
        plan: 'Free',
        usage: {
          bandwidth: 1000,
          storage: 500
        }
      };
      
      (cloudinary.api.usage as jest.Mock).mockResolvedValue(mockStats);

      const result = await service.getUsageStats();

      expect(result).toEqual(mockStats);
      expect(cloudinary.api.usage).toHaveBeenCalled();
    });

    it('API调用失败时应该抛出CloudinaryError', async () => {
      (cloudinary.api.usage as jest.Mock).mockRejectedValue(
        new Error('API Error')
      );

      await expect(service.getUsageStats()).rejects.toThrow(CloudinaryError);
    }, 10000);
  });

  describe('重试机制', () => {
    it('应该在失败时重试操作', async () => {
      const publicId = 'test-id';
      (cloudinary.uploader.destroy as jest.Mock)
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce({ result: 'ok' });

      await service.deleteImage(publicId);

      expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(2);
    });

    it('达到最大重试次数后应该抛出错误', async () => {
      const publicId = 'test-id';
      (cloudinary.uploader.destroy as jest.Mock).mockRejectedValue(
        new Error('Persistent error')
      );

      await expect(service.deleteImage(publicId)).rejects.toThrow(CloudinaryError);
      
      // 应该重试3次 + 初始尝试1次 = 4次
      expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(4);
    }, 15000);
  });

  describe('单例模式', () => {
    it('应该返回同一个实例', () => {
      const instance1 = CloudinaryService.getInstance();
      const instance2 = CloudinaryService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('导出的实例应该是单例', () => {
      // 重置单例以确保测试的准确性
      (CloudinaryService as any).instance = undefined;
      const instance = CloudinaryService.getInstance();
      
      expect(cloudinaryService()).toBe(instance);
    });
  });
});