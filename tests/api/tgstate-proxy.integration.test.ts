/**
 * tgState 代理相关 API 集成测试
 * 验证 /api/random 和 /api/response 在配置带路径的 TGSTATE_PROXY_URL 时的行为
 */

import { databaseService } from '@/lib/database';

// Mock CloudinaryService
const mockCloudinary = {
  downloadImage: jest.fn().mockResolvedValue(Buffer.from('binary-image')),
  uploadImage: jest.fn(),
  deleteImage: jest.fn()
};
jest.mock('@/lib/cloudinary', () => ({
  CloudinaryService: {
    getInstance: () => mockCloudinary
  }
}));

// Mock Next.js server 模块，提供精简的 NextResponse/NextRequest 以便在 Jest 环境下运行
jest.mock('next/server', () => {
  const G: any = typeof globalThis !== 'undefined' ? globalThis : (global as any);
  const HeadersCtor: any = G.Headers || class {
    private map = new Map<string, string>();
    constructor(init?: Record<string, string>) {
      if (init) {
        for (const key of Object.keys(init)) {
          this.map.set(key.toLowerCase(), String(init[key]));
        }
      }
    }
    get(name: string) {
      return this.map.get(String(name).toLowerCase()) ?? null;
    }
    set(name: string, value: string) {
      this.map.set(String(name).toLowerCase(), String(value));
    }
    append(name: string, value: string) {
      this.set(name, value);
    }
  };

  const BaseResponse: any = G.Response || class {
    status: number;
    headers: any;
    private body: any;
    constructor(body?: any, init?: any) {
      this.status = init?.status ?? 200;
      this.headers = new HeadersCtor(init?.headers);
      this.body = body;
    }
    async json() {
      return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
    }
    async text() {
      return typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
    }
  };

  class NextResponse extends BaseResponse {
    static redirect(url: string | URL, init?: { status?: number; headers?: Record<string, string> }) {
      const headers = new HeadersCtor(init?.headers);
      headers.set('Location', typeof url === 'string' ? url : url.toString());
      return new BaseResponse(null, { ...init, status: init?.status ?? 302, headers });
    }
    static json(data: any, init?: any) {
      const headers = { 'Content-Type': 'application/json', ...(init?.headers || {}) };
      return new BaseResponse(JSON.stringify(data), { ...init, headers });
    }
  }

  class NextRequest {}

  return { NextResponse, NextRequest };
});

// Mock 数据库服务，避免真实数据库访问
jest.mock('@/lib/database', () => ({
  databaseService: {
    getAPIConfig: jest.fn(),
    initialize: jest.fn(),
    getRandomImages: jest.fn(),
    saveLog: jest.fn().mockResolvedValue(undefined)
  }
}));

// 使用 require 延迟加载路由，确保上面的 jest.mock 已生效
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GET: RandomGET } = require('@/app/api/random/route');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GET: ResponseGET } = require('@/app/api/response/route');

// 便捷访问 mock 实例
const mockedDatabaseService = databaseService as unknown as {
  getAPIConfig: jest.Mock;
  initialize: jest.Mock;
  getRandomImages: jest.Mock;
};

const originalEnv = process.env;
const originalFetch = (global as any).fetch;

function createMockRequest(url: string): any {
  return {
    method: 'GET',
    headers: new Headers(),
    url,
    nextUrl: new URL(url)
  };
}

describe('tgState 代理集成测试 - 带路径 TGSTATE_PROXY_URL', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    mockCloudinary.downloadImage.mockClear();
  });

  afterAll(() => {
    process.env = originalEnv;
    (global as any).fetch = originalFetch;
  });

  it('GET /api/random 应该使用带路径的代理 URL 进行重定向', async () => {
    process.env.TGSTATE_BASE_URL = 'https://tg.example.com';
    process.env.TGSTATE_PROXY_URL = 'https://proxy.example.com/tg-images';

    const apiConfig = {
      id: 'default',
      isEnabled: true,
      defaultScope: 'all',
      defaultGroups: [] as string[],
      allowedParameters: [] as any[],
      enableDirectResponse: true,
      apiKeyEnabled: false,
      apiKey: undefined,
      updatedAt: new Date()
    };

    mockedDatabaseService.getAPIConfig.mockResolvedValue(apiConfig);
    mockedDatabaseService.initialize.mockResolvedValue(undefined);
    mockedDatabaseService.getRandomImages.mockResolvedValue([
      {
        id: 'img_001',
        url: 'https://tg.example.com/d/abc123?w=300#top',
        publicId: '/d/abc123',
        title: 'Test Image',
        description: null,
        tags: null,
        groupId: null,
        uploadedAt: new Date()
      }
    ]);

    const request = createMockRequest('https://example.com/api/random');
    const response = await RandomGET(request as any);

    expect(response.status).toBe(302);
    const location = response.headers.get('location');
    expect(location).toBe('https://proxy.example.com/tg-images/d/abc123?w=300#top');
  });

  it('GET /api/response 应该通过带路径代理 URL 拉取 tgState 图片', async () => {
    process.env.TGSTATE_BASE_URL = 'https://tg.example.com';
    process.env.TGSTATE_PROXY_URL = 'https://proxy.example.com/tg-images';

    const apiConfig = {
      id: 'default',
      isEnabled: true,
      defaultScope: 'all',
      defaultGroups: [] as string[],
      allowedParameters: [] as any[],
      enableDirectResponse: true,
      apiKeyEnabled: false,
      apiKey: undefined,
      updatedAt: new Date()
    };

    mockedDatabaseService.getAPIConfig.mockResolvedValue(apiConfig);
    mockedDatabaseService.initialize.mockResolvedValue(undefined);
    mockedDatabaseService.getRandomImages.mockResolvedValue([
      {
        id: 'img_002',
        url: 'http://tg.example.com/d/xyz987.png',
        publicId: '/d/xyz987.png',
        title: 'Test Image 2',
        description: null,
        tags: null,
        groupId: null,
        uploadedAt: new Date()
      }
    ]);

    const mockBuffer = Buffer.from('test-image');
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: async () => mockBuffer
    });
    (global as any).fetch = mockFetch;

    const request = createMockRequest('https://example.com/api/response');
    const response = await ResponseGET(request as any);

    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalled();
    const calledUrl = (mockFetch.mock.calls[0] as unknown[])[0] as string;
    expect(calledUrl).toBe('https://proxy.example.com/tg-images/d/xyz987.png');
  });

  it('GET /api/random 多分组筛选应按随机分组调用', async () => {
    process.env.TGSTATE_BASE_URL = 'https://tg.example.com';
    process.env.TGSTATE_PROXY_URL = 'https://proxy.example.com/tg-images';

    const multiConfig = {
      id: 'default',
      isEnabled: true,
      defaultScope: 'all',
      defaultGroups: [] as string[],
      allowedParameters: [
        { name: 'category', allowedValues: ['anime'], mappedGroups: ['grp_A'], isEnabled: true },
        { name: 'type', allowedValues: ['foo'], mappedGroups: ['grp_B'], isEnabled: true }
      ],
      enableDirectResponse: true,
      apiKeyEnabled: false,
      apiKey: undefined,
      updatedAt: new Date()
    };

    mockedDatabaseService.getAPIConfig.mockResolvedValue(multiConfig);
    // 控制随机选择为第二个分组（索引1）
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.9);

    mockedDatabaseService.getRandomImages.mockResolvedValue([
      {
        id: 'img_003',
        url: 'https://res.cloudinary.com/test/image/upload/test_public_id.jpg',
        publicId: 'test_public_id',
        title: 'Any',
        description: null,
        tags: null,
        groupId: 'grp_B',
        uploadedAt: new Date()
      }
    ]);

    const request = createMockRequest('https://example.com/api/random?category=anime&type=foo');
    const response = await RandomGET(request as any);

    expect(response.status).toBe(302);
    // 应该按随机选择的第二个分组调用
    expect(mockedDatabaseService.getRandomImages).toHaveBeenCalledWith(1, 'grp_B');

    randomSpy.mockRestore();
  });

  it('GET /api/response 对 Cloudinary URL 不应用代理并使用 Cloudinary 下载', async () => {
    process.env.TGSTATE_BASE_URL = 'https://tg.example.com';
    process.env.TGSTATE_PROXY_URL = 'https://proxy.example.com/tg-images';

    const apiConfig = {
      id: 'default',
      isEnabled: true,
      defaultScope: 'all',
      defaultGroups: [] as string[],
      allowedParameters: [] as any[],
      enableDirectResponse: true,
      apiKeyEnabled: false,
      apiKey: undefined,
      updatedAt: new Date()
    };

    mockedDatabaseService.getAPIConfig.mockResolvedValue(apiConfig);
    mockedDatabaseService.initialize.mockResolvedValue(undefined);
    mockedDatabaseService.getRandomImages.mockResolvedValue([
      {
        id: 'img_004',
        url: 'http://res.cloudinary.com/test/image/upload/test_public_id.jpg',
        publicId: 'test_public_id',
        title: 'CLD',
        description: null,
        tags: null,
        groupId: null,
        uploadedAt: new Date()
      }
    ]);

    const prevFetch = (global as any).fetch;
    const fetchSpy = jest.fn();
    (global as any).fetch = fetchSpy;

    const request = createMockRequest('https://example.com/api/response');
    const response = await ResponseGET(request as any);

    expect(response.status).toBe(200);
    expect(mockCloudinary.downloadImage).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();

    (global as any).fetch = prevFetch;
  });
});

