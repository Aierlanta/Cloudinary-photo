/**
 * /api/response 端点测试
 */

// Mock Next.js server module to avoid global Request dependency in tests
jest.mock('next/server', () => {
  const G: any = (typeof globalThis !== 'undefined') ? globalThis : global;
  const W: any = (typeof window !== 'undefined') ? window : undefined;

  // 简单 Headers 兜底实现
  class SimpleHeaders {
    private map = new Map<string, string>();
    constructor(init?: Record<string, string> | [string, string][]) {
      if (Array.isArray(init)) {
        for (const [k, v] of init) this.map.set(String(k).toLowerCase(), String(v));
      } else if (init && typeof init === 'object') {
        for (const k of Object.keys(init)) this.map.set(k.toLowerCase(), String((init as any)[k]));
      }
    }
    get(name: string) { return this.map.get(String(name).toLowerCase()) || null; }
    set(name: string, value: string) { this.map.set(String(name).toLowerCase(), String(value)); }
    append(name: string, value: string) { this.set(name, value); }
  }

  const HeadersCtor: any = G.Headers || (W && W.Headers) || SimpleHeaders;

  // 简单 Response 兜底实现
  class SimpleResponse {
    status: number;
    headers: any;
    private _body: any;
    constructor(body?: any, init?: any) {
      this.status = (init && init.status) || 200;
      this.headers = new HeadersCtor(init && init.headers);
      this._body = body;
    }
    async text() {
      if (typeof this._body === 'string') return this._body;
      const buf = await this.arrayBuffer();
      return new TextDecoder().decode(buf);
    }
    async arrayBuffer() {
      if (this._body == null) return new ArrayBuffer(0);
      if (this._body instanceof ArrayBuffer) return this._body;
      if (typeof this._body === 'string') return new TextEncoder().encode(this._body).buffer;
      if (typeof Buffer !== 'undefined' && Buffer.isBuffer(this._body)) return this._body.buffer.slice(this._body.byteOffset, this._body.byteOffset + this._body.byteLength);
      return new ArrayBuffer(0);
    }
  }

  const BaseResponse: any = G.Response || (W && W.Response) || SimpleResponse;

  class NextResponse extends BaseResponse {
    static json(data: any, init?: any) {
      const headers = { 'Content-Type': 'application/json', ...(init?.headers || {}) };
      return new BaseResponse(JSON.stringify(data), { ...init, headers });
    }
  }

  class NextRequest {}
  return { NextResponse, NextRequest };
});

// 使用 require 延后引入路由，确保上面的 mock 已生效
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GET } = require('../route');

// 简易的请求构造器，避免在Jest环境依赖 NextRequest
function createMockRequest(url: string, init?: { headers?: Record<string, string> }) {
  const headers = new Headers(init?.headers);
  return {
    url,
    method: 'GET',
    headers,
    nextUrl: new URL(url)
  } as any;
}

// Mock modules (placed before route import)
jest.mock('@/lib/database', () => {
  const databaseService = {
    getAPIConfig: jest.fn(),
    initialize: jest.fn(),
    getRandomImages: jest.fn(),
    getImages: jest.fn()
  };
  return { databaseService };
});

jest.mock('@/lib/cloudinary', () => {
  const instance = { downloadImage: jest.fn() };
  return { CloudinaryService: { getInstance: () => instance } };
});

jest.mock('@/lib/logger', () => {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), apiResponse: jest.fn() };
  return { logger };
});

// Access mocks for convenience
const { databaseService: mockDatabaseService } = require('@/lib/database');
const { CloudinaryService } = require('@/lib/cloudinary');
const mockCloudinaryService = CloudinaryService.getInstance();
const { logger: mockLogger } = require('@/lib/logger');

describe('/api/response', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 重置预取缓存，避免跨用例干扰
    const { __resetPrefetchCacheForTests } = require('../route');
    __resetPrefetchCacheForTests();

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
      const request = createMockRequest('http://localhost:3000/api/response');

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

      const request = createMockRequest('http://localhost:3000/api/response');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('image/png');
    });
  });

  describe('预缓存功能测试', () => {
    it('第二次请求应命中预取缓存', async () => {
      const url = 'http://localhost:3000/api/response';
      const r1 = await GET(createMockRequest(url));
      expect(r1.headers.get('X-Transfer-Mode')).toBe('buffered');
      await new Promise((r) => setTimeout(r, 20));
      const r2 = await GET(createMockRequest(url));
      expect(r2.headers.get('X-Transfer-Mode')).toBe('prefetch');
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

      const request = createMockRequest('http://localhost:3000/api/response');
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

      const request = createMockRequest('http://localhost:3000/api/response');
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

      const request = createMockRequest('http://localhost:3000/api/response');
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

      const request = createMockRequest('http://localhost:3000/api/response?category=nature');
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

      const request = createMockRequest('http://localhost:3000/api/response?category=invalid');
      const response = await GET(request);

      expect(response.status).toBe(400);
    });
  });

  describe('错误处理测试', () => {
    it('当没有找到图片时应该返回404', async () => {
      mockDatabaseService.getRandomImages.mockResolvedValue([]);

      const request = createMockRequest('http://localhost:3000/api/response');
      const response = await GET(request);

      expect(response.status).toBe(404);
    });

    it('当图片下载失败时应该抛出错误', async () => {
      mockCloudinaryService.downloadImage.mockRejectedValue(new Error('Download failed'));

      const request = createMockRequest('http://localhost:3000/api/response');

      const res = await GET(request);
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('响应头测试', () => {
    it('应该设置正确的响应头', async () => {
      const request = createMockRequest('http://localhost:3000/api/response');
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
