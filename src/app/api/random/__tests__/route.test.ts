/**
 * 随机图片API端点测试（基于当前实现：302 重定向到图片URL）
 */

import type { NextRequest } from 'next/server';
import { APIConfig, Image } from '@/types/models';
import { databaseService } from '@/lib/database';

// Mock Next.js server模块，提供精简的 NextResponse/NextRequest 在Jest环境下运行
jest.mock('next/server', () => {
  const G: any = typeof globalThis !== 'undefined' ? globalThis : global;
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

// 使用 require 延迟加载路由，确保上面的 jest.mock 已生效
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GET } = require('../route');

// 手动mock数据库模块，确保 route.ts 中使用的 databaseService 可控
jest.mock('@/lib/database', () => ({
  databaseService: {
    getAPIConfig: jest.fn(),
    initialize: jest.fn(),
    getRandomImages: jest.fn(),
    saveLog: jest.fn()
  },
}));

jest.mock('@/lib/security', () => ({
  withSecurity: () => (handler: any) => handler
}));


const mockDatabaseService = databaseService as unknown as {
  getAPIConfig: jest.Mock,
  initialize: jest.Mock,
  getRandomImages: jest.Mock,
};

const createMockRequest = (url: string): NextRequest => {
  return {
    method: 'GET',
    headers: new Headers(),
    nextUrl: new URL(url),
    url,
    cookies: {
      get: jest.fn().mockReturnValue(undefined)
    }
  } as unknown as NextRequest;
};

describe('/api/random API端点测试', () => {
  const mockAPIConfig: APIConfig = {
    id: 'default',
    isEnabled: true,
    defaultScope: 'all',
    defaultGroups: [],
    allowedParameters: [
      {
        name: 'category',
        type: 'group',
        allowedValues: ['nature'],
        mappedGroups: ['grp_000001'],
        isEnabled: true,
      },
    ],
    enableDirectResponse: false,
    apiKeyEnabled: false,
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  const mockImage: Image = {
    id: 'img_000001',
    publicId: 'test_public_id',
    url: 'http://res.cloudinary.com/test/image/upload/test_public_id.jpg',
    uploadedAt: new Date('2024-01-01T00:00:00Z'),
    tags: ['test'],
    groupId: 'grp_000001',
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabaseService.getAPIConfig.mockResolvedValue(mockAPIConfig);
    mockDatabaseService.getRandomImages.mockResolvedValue([mockImage]);
  });

  describe('基础行为', () => {
    it('应该重定向到随机图片URL（强制https）', async () => {
      const request = createMockRequest('http://localhost:3000/api/random');
      const response = await GET(request);

      expect(response.status).toBe(302);
      // Location 应为 https 协议
      expect(response.headers.get('Location')).toBe(
        'https://res.cloudinary.com/test/image/upload/test_public_id.jpg'
      );
      expect(response.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate');
      expect(response.headers.get('X-Image-Id')).toBe('img_000001');
      expect(response.headers.get('X-Image-PublicId')).toBe('test_public_id');
      expect(response.headers.get('X-Response-Time')).toBeTruthy();
      // 不再返回图片二进制内容
      expect(response.headers.get('Content-Type')).toBeNull();
    });

    it('response=true 时应重定向到 image 路径', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/random?response=true&opacity=80&format=png&quality=70'
      );
      const response = await GET(request);

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe(
        'http://localhost:3000/image/img_000001.jpg?opacity=80&format=png&quality=70'
      );
      expect(response.headers.get('X-Image-Mode')).toBe('direct-response');
    });
  });

  describe('参数验证', () => {
    it('接受有效参数并按分组获取图片', async () => {
      const request = createMockRequest('http://localhost:3000/api/random?category=nature');
      await GET(request);
      expect(mockDatabaseService.getRandomImages).toHaveBeenCalledWith(1, 'grp_000001', undefined);
    });

    it('拒绝无效参数名', async () => {
      const request = createMockRequest('http://localhost:3000/api/random?invalid_param=value');
      const response = await GET(request);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error.type).toBe('VALIDATION_ERROR');
    });

    it('拒绝无效参数值', async () => {
      const request = createMockRequest('http://localhost:3000/api/random?category=invalid');
      const response = await GET(request);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error.type).toBe('VALIDATION_ERROR');
    });
  });

  describe('错误处理', () => {
    it('API配置未找到（初始化后仍为空）返回500', async () => {
      mockDatabaseService.getAPIConfig
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      const request = createMockRequest('http://localhost:3000/api/random');
      const response = await GET(request);
      expect(mockDatabaseService.initialize).toHaveBeenCalled();
      expect(response.status).toBe(500);
    });

    it('API被禁用返回403', async () => {
      mockDatabaseService.getAPIConfig.mockResolvedValue({ ...mockAPIConfig, isEnabled: false });
      const request = createMockRequest('http://localhost:3000/api/random');
      const response = await GET(request);
      expect(response.status).toBe(403);
    });

    it('没有图片返回404', async () => {
      mockDatabaseService.getRandomImages.mockResolvedValue([]);
      const request = createMockRequest('http://localhost:3000/api/random');
      const response = await GET(request);
      expect(response.status).toBe(404);
    });

    it('数据库抛错返回500', async () => {
      mockDatabaseService.getAPIConfig.mockRejectedValue(new Error('db error'));
      const request = createMockRequest('http://localhost:3000/api/random');
      const response = await GET(request);
      expect(response.status).toBe(500);
    });
  });

  describe('新增参数', () => {
    it('orientation=landscape 时将筛选条件传递到数据库查询', async () => {
      const request = createMockRequest('http://localhost:3000/api/random?orientation=landscape');
      await GET(request);
      expect(mockDatabaseService.getRandomImages).toHaveBeenCalledWith(1, undefined, { orientation: 'landscape' });
    });

    it('携带 width/height 且未使用 response=true 时返回 400', async () => {
      const request = createMockRequest('http://localhost:3000/api/random?width=800&height=600');
      const response = await GET(request);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error.type).toBe('VALIDATION_ERROR');
    });

    it('orientation 非法时返回 400', async () => {
      const request = createMockRequest('http://localhost:3000/api/random?orientation=wide');
      const response = await GET(request);
      expect(response.status).toBe(400);
    });
  });
});
