/**
 * 图片工具函数测试
 * 主要测试 tgState 代理URL转换功能
 */

import {
  convertTgStateToProxyUrl,
  convertTgStateUrlsToProxy,
  applyProxyToImageUrl,
  applyProxyToImageUrls,
  isTgStateImage
} from '../image-utils';

describe('Image Utils - tgState Proxy', () => {
  // 保存原始环境变量
  const originalEnv = process.env;

  beforeEach(() => {
    // 每个测试前重置环境变量
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // 恢复环境变量
    process.env = originalEnv;
  });

  describe('isTgStateImage', () => {
    it('应该正确识别 tgState 图片', () => {
      process.env.TGSTATE_BASE_URL = 'https://tg.example.com';
      
      expect(isTgStateImage('https://tg.example.com/d/abc123')).toBe(true);
      expect(isTgStateImage('https://tg.example.com/file/xyz')).toBe(true);
    });

    it('应该正确识别非 tgState 图片', () => {
      process.env.TGSTATE_BASE_URL = 'https://tg.example.com';
      
      expect(isTgStateImage('https://res.cloudinary.com/demo/test.jpg')).toBe(false);
      expect(isTgStateImage('https://other.example.com/d/abc123')).toBe(false);
    });

    it('未配置 TGSTATE_BASE_URL 时应返回 false', () => {
      delete process.env.TGSTATE_BASE_URL;
      
      expect(isTgStateImage('https://tg.example.com/d/abc123')).toBe(false);
    });

    it('应该处理无效的 BASE_URL', () => {
      process.env.TGSTATE_BASE_URL = 'invalid-url';
      
      expect(isTgStateImage('https://tg.example.com/d/abc123')).toBe(false);
    });
  });

  describe('convertTgStateToProxyUrl', () => {
    it('未配置代理时应返回原URL', () => {
      delete process.env.TGSTATE_PROXY_URL;
      process.env.TGSTATE_BASE_URL = 'https://tg.example.com';
      
      const originalUrl = 'https://tg.example.com/d/abc123';
      const result = convertTgStateToProxyUrl(originalUrl);
      
      expect(result).toBe(originalUrl);
    });

    it('配置代理后应正确转换 tgState URL', () => {
      process.env.TGSTATE_BASE_URL = 'https://tg.example.com';
      process.env.TGSTATE_PROXY_URL = 'https://proxy.example.com';
      
      const originalUrl = 'https://tg.example.com/d/abc123';
      const result = convertTgStateToProxyUrl(originalUrl);
      
      expect(result).toBe('https://proxy.example.com/d/abc123');
    });

    it('应该保留 URL 的查询参数', () => {
      process.env.TGSTATE_BASE_URL = 'https://tg.example.com';
      process.env.TGSTATE_PROXY_URL = 'https://proxy.example.com';
      
      const originalUrl = 'https://tg.example.com/d/abc123?size=large&quality=high';
      const result = convertTgStateToProxyUrl(originalUrl);
      
      expect(result).toBe('https://proxy.example.com/d/abc123?size=large&quality=high');
    });

    it('应该保留 URL 的 hash 片段', () => {
      process.env.TGSTATE_BASE_URL = 'https://tg.example.com';
      process.env.TGSTATE_PROXY_URL = 'https://proxy.example.com';
      
      const originalUrl = 'https://tg.example.com/d/abc123#section1';
      const result = convertTgStateToProxyUrl(originalUrl);
      
      expect(result).toBe('https://proxy.example.com/d/abc123#section1');
    });

    it('应该保留完整的路径、查询参数和hash', () => {
      process.env.TGSTATE_BASE_URL = 'https://tg.example.com';
      process.env.TGSTATE_PROXY_URL = 'https://proxy.example.com';
      
      const originalUrl = 'https://tg.example.com/d/abc123?w=300#top';
      const result = convertTgStateToProxyUrl(originalUrl);
      
      expect(result).toBe('https://proxy.example.com/d/abc123?w=300#top');
    });

    it('非 tgState 图片不应被转换', () => {
      process.env.TGSTATE_BASE_URL = 'https://tg.example.com';
      process.env.TGSTATE_PROXY_URL = 'https://proxy.example.com';
      
      const cloudinaryUrl = 'https://res.cloudinary.com/demo/image/upload/abc.jpg';
      const result = convertTgStateToProxyUrl(cloudinaryUrl);
      
      expect(result).toBe(cloudinaryUrl);
    });

    it('空URL应返回原值', () => {
      process.env.TGSTATE_BASE_URL = 'https://tg.example.com';
      process.env.TGSTATE_PROXY_URL = 'https://proxy.example.com';
      
      expect(convertTgStateToProxyUrl('')).toBe('');
      expect(convertTgStateToProxyUrl(null as any)).toBeNull();
      expect(convertTgStateToProxyUrl(undefined as any)).toBeUndefined();
    });

    it('代理URL格式错误时应返回原URL', () => {
      process.env.TGSTATE_BASE_URL = 'https://tg.example.com';
      process.env.TGSTATE_PROXY_URL = 'invalid-proxy-url';
      
      const originalUrl = 'https://tg.example.com/d/abc123';
      const result = convertTgStateToProxyUrl(originalUrl);
      
      // 应该捕获异常并返回原URL
      expect(result).toBe(originalUrl);
    });

    it('未配置 TGSTATE_BASE_URL 时应返回原URL', () => {
      delete process.env.TGSTATE_BASE_URL;
      process.env.TGSTATE_PROXY_URL = 'https://proxy.example.com';
      
      const originalUrl = 'https://tg.example.com/d/abc123';
      const result = convertTgStateToProxyUrl(originalUrl);
      
      expect(result).toBe(originalUrl);
    });
  });

  describe('convertTgStateUrlsToProxy', () => {
    it('应该批量转换URL数组', () => {
      process.env.TGSTATE_BASE_URL = 'https://tg.example.com';
      process.env.TGSTATE_PROXY_URL = 'https://proxy.example.com';
      
      const urls = [
        'https://tg.example.com/d/abc',
        'https://tg.example.com/d/def',
        'https://tg.example.com/d/ghi'
      ];
      
      const result = convertTgStateUrlsToProxy(urls);
      
      expect(result).toEqual([
        'https://proxy.example.com/d/abc',
        'https://proxy.example.com/d/def',
        'https://proxy.example.com/d/ghi'
      ]);
    });

    it('应该正确处理混合类型的URL数组', () => {
      process.env.TGSTATE_BASE_URL = 'https://tg.example.com';
      process.env.TGSTATE_PROXY_URL = 'https://proxy.example.com';
      
      const urls = [
        'https://tg.example.com/d/abc',
        'https://res.cloudinary.com/demo/test.jpg',
        'https://tg.example.com/d/def'
      ];
      
      const result = convertTgStateUrlsToProxy(urls);
      
      expect(result).toEqual([
        'https://proxy.example.com/d/abc',
        'https://res.cloudinary.com/demo/test.jpg',  // Cloudinary 不变
        'https://proxy.example.com/d/def'
      ]);
    });

    it('空数组应返回空数组', () => {
      const result = convertTgStateUrlsToProxy([]);
      expect(result).toEqual([]);
    });
  });

  describe('applyProxyToImageUrl', () => {
    it('应该转换图片对象的url字段', () => {
      process.env.TGSTATE_BASE_URL = 'https://tg.example.com';
      process.env.TGSTATE_PROXY_URL = 'https://proxy.example.com';
      
      const image = {
        id: 'img_001',
        url: 'https://tg.example.com/d/abc123',
        publicId: '/d/abc123',
        title: 'Test Image'
      };
      
      const result = applyProxyToImageUrl(image);
      
      expect(result.url).toBe('https://proxy.example.com/d/abc123');
      expect(result.id).toBe('img_001');
      expect(result.publicId).toBe('/d/abc123');
      expect(result.title).toBe('Test Image');
    });

    it('不应修改原对象', () => {
      process.env.TGSTATE_BASE_URL = 'https://tg.example.com';
      process.env.TGSTATE_PROXY_URL = 'https://proxy.example.com';
      
      const image = {
        id: 'img_001',
        url: 'https://tg.example.com/d/abc123',
        publicId: '/d/abc123'
      };
      
      const original = { ...image };
      const result = applyProxyToImageUrl(image);
      
      expect(image).toEqual(original);  // 原对象未被修改
      expect(result).not.toBe(image);    // 返回新对象
    });

    it('应该保留所有其他字段', () => {
      process.env.TGSTATE_BASE_URL = 'https://tg.example.com';
      process.env.TGSTATE_PROXY_URL = 'https://proxy.example.com';
      
      const image = {
        id: 'img_001',
        url: 'https://tg.example.com/d/abc123',
        publicId: '/d/abc123',
        title: 'Test',
        description: 'Description',
        tags: ['tag1', 'tag2'],
        groupId: 'grp_001',
        uploadedAt: new Date(),
        primaryProvider: 'tgstate'
      };
      
      const result = applyProxyToImageUrl(image);
      
      expect(result.title).toBe('Test');
      expect(result.description).toBe('Description');
      expect(result.tags).toEqual(['tag1', 'tag2']);
      expect(result.groupId).toBe('grp_001');
      expect(result.primaryProvider).toBe('tgstate');
    });
  });

  describe('applyProxyToImageUrls', () => {
    it('应该批量转换图片数组中的URL', () => {
      process.env.TGSTATE_BASE_URL = 'https://tg.example.com';
      process.env.TGSTATE_PROXY_URL = 'https://proxy.example.com';
      
      const images = [
        { id: 'img_001', url: 'https://tg.example.com/d/abc' },
        { id: 'img_002', url: 'https://tg.example.com/d/def' }
      ];
      
      const result = applyProxyToImageUrls(images);
      
      expect(result[0].url).toBe('https://proxy.example.com/d/abc');
      expect(result[1].url).toBe('https://proxy.example.com/d/def');
    });

    it('应该正确处理混合图床的图片数组', () => {
      process.env.TGSTATE_BASE_URL = 'https://tg.example.com';
      process.env.TGSTATE_PROXY_URL = 'https://proxy.example.com';
      
      const images = [
        { id: 'img_001', url: 'https://tg.example.com/d/abc' },
        { id: 'img_002', url: 'https://res.cloudinary.com/demo/test.jpg' },
        { id: 'img_003', url: 'https://tg.example.com/d/xyz' }
      ];
      
      const result = applyProxyToImageUrls(images);
      
      expect(result[0].url).toBe('https://proxy.example.com/d/abc');
      expect(result[1].url).toBe('https://res.cloudinary.com/demo/test.jpg');  // Cloudinary 不变
      expect(result[2].url).toBe('https://proxy.example.com/d/xyz');
    });

    it('空数组应返回空数组', () => {
      const result = applyProxyToImageUrls([]);
      expect(result).toEqual([]);
    });

    it('不应修改原数组中的对象', () => {
      process.env.TGSTATE_BASE_URL = 'https://tg.example.com';
      process.env.TGSTATE_PROXY_URL = 'https://proxy.example.com';
      
      const images = [
        { id: 'img_001', url: 'https://tg.example.com/d/abc' }
      ];
      
      const originalUrl = images[0].url;
      const result = applyProxyToImageUrls(images);
      
      expect(images[0].url).toBe(originalUrl);  // 原对象未被修改
      expect(result[0].url).toBe('https://proxy.example.com/d/abc');
    });
  });

  describe('向后兼容性测试', () => {
    it('未配置任何 tgState 环境变量时应正常工作', () => {
      delete process.env.TGSTATE_BASE_URL;
      delete process.env.TGSTATE_PROXY_URL;
      
      const url = 'https://example.com/image.jpg';
      const result = convertTgStateToProxyUrl(url);
      
      expect(result).toBe(url);
    });

    it('只配置 BASE_URL 不配置代理时应返回原URL', () => {
      process.env.TGSTATE_BASE_URL = 'https://tg.example.com';
      delete process.env.TGSTATE_PROXY_URL;
      
      const url = 'https://tg.example.com/d/abc123';
      const result = convertTgStateToProxyUrl(url);
      
      expect(result).toBe(url);
    });

    it('所有函数在未配置代理时都应该是无操作的', () => {
      delete process.env.TGSTATE_PROXY_URL;
      process.env.TGSTATE_BASE_URL = 'https://tg.example.com';
      
      const url = 'https://tg.example.com/d/abc123';
      const urls = [url, url, url];
      const image = { id: 'img_001', url };
      const images = [image, image];
      
      expect(convertTgStateToProxyUrl(url)).toBe(url);
      expect(convertTgStateUrlsToProxy(urls)).toEqual(urls);
      expect(applyProxyToImageUrl(image).url).toBe(url);
      expect(applyProxyToImageUrls(images).every(img => img.url === url)).toBe(true);
    });
  });
});

