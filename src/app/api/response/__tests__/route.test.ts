/**
 * /api/response 端点测试
 */

import { NextRequest } from 'next/server';
import { GET } from '../route';

// Mock dependencies
jest.mock('@/lib/database');
jest.mock('@/lib/cloudinary');
jest.mock('@/lib/logger');

const mockDatabaseService = {
  getAPIConfig: jest.fn(),
  initialize: jest.fn(),
  getRandomImages: jest.fn(),
  getImages: jest.fn()
};

const mockCloudinaryService = {
  downloadImage: jest.fn()
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  apiResponse: jest.fn()
};

// Mock modules
jest.mock('@/lib/database', () => ({
  databaseService: mockDatabaseService
}));

jest.mock('@/lib/cloudinary', () => ({
  CloudinaryService: {
    getInstance: () => mockCloudinaryService
  }
}));

jest.mock('@/lib/logger', () => ({
  logger: mockLogger
}));

describe('/api/response', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // 默认配置
    mockDatabaseService.getAPIConfig.mockResolvedValue({
      id: 'default',
      isEnabled: true,
      enableDirectResponse: true,
      defaultScope: 'all',
      defaultGroups: [],
      allowedParameters: [],
      updatedAt: new Date()
    });

    // 默认图片数据
    mockDatabaseService.getRandomImages.mockResolvedValue([
      {
        id: 'img_000001',
        publicId: 'test_image',
        url: 'https://res.cloudinary.com/test/image/upload/test_image.jpg',
        title: 'Test Image',
        description: 'A test image',
        tags: ['test'],
        groupId: null,
        uploadedAt: new Date()
      }
    ]);

    // 默认图片数据
    const mockImageBuffer = Buffer.from('fake-image-data');
    mockCloudinaryService.downloadImage.mockResolvedValue(mockImageBuffer);
  });

  describe('基础功能测试', () => {
    it('应该成功返回图片数据流', async () => {
      const request = new NextRequest('http://localhost:3000/api/response');

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('image/jpeg');
      expect(response.headers.get('X-Image-Id')).toBe('img_000001');
      expect(response.headers.get('X-Image-PublicId')).toBe('test_image');

      const responseBuffer = Buffer.from(await response.arrayBuffer());
      expect(responseBuffer.toString()).toBe('fake-image-data');

      expect(mockDatabaseService.getAPIConfig).toHaveBeenCalledTimes(1);
      expect(mockDatabaseService.getRandomImages).toHaveBeenCalledWith(1);
      expect(mockCloudinaryService.downloadImage).toHaveBeenCalledWith('test_image');
    });

    it('应该正确识别不同的图片格式', async () => {
      mockDatabaseService.getRandomImages.mockResolvedValue([
        {
          id: 'img_000002',
          publicId: 'test_image_png',
          url: 'https://res.cloudinary.com/test/image/upload/test_image.png',
          title: 'Test PNG Image',
          description: 'A test PNG image',
          tags: ['test'],
          groupId: null,
          uploadedAt: new Date()
        }
      ]);

      const request = new NextRequest('http://localhost:3000/api/response');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('image/png');
    });
  });

  describe('配置验证测试', () => {
    it('当API被禁用时应该返回403', async () => {
      mockDatabaseService.getAPIConfig.mockResolvedValue({
        id: 'default',
        isEnabled: false,
        enableDirectResponse: true,
        defaultScope: 'all',
        defaultGroups: [],
        allowedParameters: [],
        updatedAt: new Date()
      });

      const request = new NextRequest('http://localhost:3000/api/response');
      const response = await GET(request);

      expect(response.status).toBe(403);
    });

    it('当直接响应模式被禁用时应该返回403', async () => {
      mockDatabaseService.getAPIConfig.mockResolvedValue({
        id: 'default',
        isEnabled: true,
        enableDirectResponse: false,
        defaultScope: 'all',
        defaultGroups: [],
        allowedParameters: [],
        updatedAt: new Date()
      });

      const request = new NextRequest('http://localhost:3000/api/response');
      const response = await GET(request);

      expect(response.status).toBe(403);
    });

    it('当API配置不存在时应该初始化数据库', async () => {
      mockDatabaseService.getAPIConfig
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'default',
          isEnabled: true,
          enableDirectResponse: true,
          defaultScope: 'all',
          defaultGroups: [],
          allowedParameters: [],
          updatedAt: new Date()
        });

      const request = new NextRequest('http://localhost:3000/api/response');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockDatabaseService.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('参数验证测试', () => {
    it('应该接受有效的参数', async () => {
      mockDatabaseService.getAPIConfig.mockResolvedValue({
        id: 'default',
        isEnabled: true,
        enableDirectResponse: true,
        defaultScope: 'all',
        defaultGroups: [],
        allowedParameters: [
          {
            name: 'category',
            type: 'custom',
            allowedValues: ['nature', 'city'],
            mappedGroups: ['group1', 'group2'],
            isEnabled: true
          }
        ],
        updatedAt: new Date()
      });

      const request = new NextRequest('http://localhost:3000/api/response?category=nature');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该拒绝无效的参数', async () => {
      mockDatabaseService.getAPIConfig.mockResolvedValue({
        id: 'default',
        isEnabled: true,
        enableDirectResponse: true,
        defaultScope: 'all',
        defaultGroups: [],
        allowedParameters: [
          {
            name: 'category',
            type: 'custom',
            allowedValues: ['nature', 'city'],
            mappedGroups: ['group1', 'group2'],
            isEnabled: true
          }
        ],
        updatedAt: new Date()
      });

      const request = new NextRequest('http://localhost:3000/api/response?category=invalid');
      const response = await GET(request);

      expect(response.status).toBe(400);
    });
  });

  describe('错误处理测试', () => {
    it('当没有找到图片时应该返回404', async () => {
      mockDatabaseService.getRandomImages.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/response');
      const response = await GET(request);

      expect(response.status).toBe(404);
    });

    it('当图片下载失败时应该抛出错误', async () => {
      mockCloudinaryService.downloadImage.mockRejectedValue(new Error('Download failed'));

      const request = new NextRequest('http://localhost:3000/api/response');
      
      await expect(GET(request)).rejects.toThrow('Download failed');
    });
  });

  describe('响应头测试', () => {
    it('应该设置正确的响应头', async () => {
      const request = new NextRequest('http://localhost:3000/api/response');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('image/jpeg');
      expect(response.headers.get('Content-Length')).toBe('15'); // 'fake-image-data'.length
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
      expect(response.headers.get('X-Image-Id')).toBe('img_000001');
      expect(response.headers.get('X-Image-PublicId')).toBe('test_image');
      expect(response.headers.get('X-Image-Size')).toBe('15');
      expect(response.headers.get('X-Response-Time')).toMatch(/^\d+ms$/);
    });
  });
});
