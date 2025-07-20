/**
 * 随机图片API端点测试
 */

import { NextRequest } from 'next/server';
import { GET } from '../route';
import { DatabaseService } from '@/lib/database';
import { CloudinaryService } from '@/lib/cloudinary';
import { APIConfig, Image } from '@/types/models';

// Mock Web APIs for testing environment
global.Request = class MockRequest {
  constructor(public url: string, public init?: RequestInit) {}
} as any;

global.Response = class MockResponse {
  constructor(public body?: any, public init?: ResponseInit) {}
} as any;

// Mock依赖
jest.mock('@/lib/database');
jest.mock('@/lib/cloudinary');

const mockDatabaseService = DatabaseService.getInstance() as jest.Mocked<DatabaseService>;
const mockCloudinaryInstance = {
  downloadImage: jest.fn()
};

// Mock CloudinaryService
(CloudinaryService as jest.MockedClass<typeof CloudinaryService>).mockImplementation(() => mockCloudinaryInstance as any);

describe('/api/random API端点测试', () => {
  const mockImageBuffer = Buffer.from('fake-image-data');

  const mockAPIConfig: APIConfig = {
    isEnabled: true,
    allowedParameters: [
      {
        name: 'category',
        type: 'group',
        allowedValues: ['nature'],
        mappedGroups: ['grp_000001'],
        isEnabled: true
      }
    ],
    defaultScope: 'all'
  };

  const mockImage: Image = {
    id: 'img_000001',
    filename: 'test_image.jpg',
    originalName: 'test.jpg',
    publicId: 'test_public_id',
    format: 'jpg',
    width: 1920,
    height: 1080,
    size: 1024000,
    url: 'https://res.cloudinary.com/test/image/upload/test_public_id.jpg',
    secureUrl: 'https://res.cloudinary.com/test/image/upload/test_public_id.jpg',
    uploadedAt: new Date('2024-01-01T00:00:00Z'),
    tags: ['test'],
    groupId: 'grp_000001'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Cloudinary下载
    mockCloudinaryInstance.downloadImage.mockResolvedValue(mockImageBuffer);

    // Mock数据库服务默认行为
    mockDatabaseService.getAPIConfig.mockResolvedValue(mockAPIConfig);
    mockDatabaseService.getImages.mockResolvedValue({
      data: [mockImage],
      total: 1,
      page: 1,
      limit: 1000,
      totalPages: 1
    });
  });

  describe('基础功能测试', () => {
    it('应该成功返回随机图片', async () => {
      const request = new NextRequest('http://localhost:3000/api/random');

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('image/jpg');
      expect(response.headers.get('X-Image-Id')).toBe('img_000001');
      expect(response.headers.get('X-Image-Filename')).toBe('test_image.jpg');

      const responseBuffer = Buffer.from(await response.arrayBuffer());
      expect(responseBuffer).toEqual(mockImageBuffer);

      expect(mockDatabaseService.getAPIConfig).toHaveBeenCalledTimes(1);
      expect(mockDatabaseService.getImages).toHaveBeenCalledWith({
        page: 1,
        limit: 1000,
        sortBy: 'uploadedAt',
        sortOrder: 'desc'
      });
      expect(mockCloudinaryInstance.downloadImage).toHaveBeenCalledWith('test_public_id');
    });

    it('应该设置正确的缓存头', async () => {
      const request = new NextRequest('http://localhost:3000/api/random');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
      expect(response.headers.get('Content-Length')).toBe(mockImageBuffer.length.toString());
      expect(response.headers.get('X-Response-Time')).toBeTruthy();
    });
  });

  describe('参数验证测试', () => {
    it('应该接受有效的参数', async () => {
      const request = new NextRequest('http://localhost:3000/api/random?category=nature');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockDatabaseService.getImages).toHaveBeenCalledWith({
        page: 1,
        limit: 1000,
        sortBy: 'uploadedAt',
        sortOrder: 'desc'
      });
    });

    it('应该拒绝无效的参数名', async () => {
      const request = new NextRequest('http://localhost:3000/api/random?invalid_param=value');
      const response = await GET(request);

      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData.success).toBe(false);
      expect(responseData.error.type).toBe('VALIDATION_ERROR');
    });

    it('应该拒绝无效的参数值', async () => {
      const request = new NextRequest('http://localhost:3000/api/random?category=invalid_value');
      const response = await GET(request);

      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData.success).toBe(false);
      expect(responseData.error.type).toBe('VALIDATION_ERROR');
    });
  });

  describe('错误处理测试', () => {
    it('应该处理API配置未找到的情况', async () => {
      mockDatabaseService.getAPIConfig.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/random');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.success).toBe(false);
      expect(responseData.error.type).toBe('INTERNAL_ERROR');
    });

    it('应该处理API被禁用的情况', async () => {
      const disabledConfig: APIConfig = {
        ...mockAPIConfig,
        isEnabled: false
      };

      mockDatabaseService.getAPIConfig.mockResolvedValue(disabledConfig);

      const request = new NextRequest('http://localhost:3000/api/random');

      const response = await GET(request);

      expect(response.status).toBe(403);
      const responseData = await response.json();
      expect(responseData.success).toBe(false);
      expect(responseData.error.type).toBe('FORBIDDEN');
    });

    it('应该处理没有找到图片的情况', async () => {
      mockDatabaseService.getImages.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 1000,
        totalPages: 0
      });

      const request = new NextRequest('http://localhost:3000/api/random');
      const response = await GET(request);

      expect(response.status).toBe(404);
      const responseData = await response.json();
      expect(responseData.success).toBe(false);
      expect(responseData.error.type).toBe('NOT_FOUND');
    });

    it('应该处理数据库错误', async () => {
      mockDatabaseService.getAPIConfig.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/random');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.success).toBe(false);
      expect(responseData.error.type).toBe('INTERNAL_ERROR');
    });

    it('应该处理Cloudinary下载错误', async () => {
      mockDatabaseService.getImages.mockResolvedValue({
        data: [mockImage],
        total: 1,
        page: 1,
        limit: 1000,
        totalPages: 1
      });
      mockCloudinaryInstance.downloadImage.mockRejectedValue(new Error('Download failed'));

      const request = new NextRequest('http://localhost:3000/api/random');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.success).toBe(false);
      expect(responseData.error.type).toBe('INTERNAL_ERROR');
    });
  });

  describe('响应格式测试', () => {
    it('应该返回正确的图片格式', async () => {
      const pngImage = {
        ...mockImage,
        format: 'png',
        filename: 'test.png'
      };

      mockDatabaseService.getImages.mockResolvedValue({
        data: [pngImage],
        total: 1,
        page: 1,
        limit: 1000,
        totalPages: 1
      });

      const request = new NextRequest('http://localhost:3000/api/random');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('image/png');
      expect(response.headers.get('X-Image-Filename')).toBe('test.png');
    });

    it('应该包含所有必要的响应头', async () => {
      const request = new NextRequest('http://localhost:3000/api/random');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBeTruthy();
      expect(response.headers.get('Content-Length')).toBeTruthy();
      expect(response.headers.get('Cache-Control')).toBeTruthy();
      expect(response.headers.get('X-Image-Id')).toBeTruthy();
      expect(response.headers.get('X-Image-Filename')).toBeTruthy();
      expect(response.headers.get('X-Response-Time')).toBeTruthy();
    });
  });
});
