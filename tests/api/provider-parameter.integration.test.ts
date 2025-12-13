/**
 * provider 参数集成测试
 * 覆盖：
 * - /api/random：provider 参数解析 -> 均匀随机选 provider -> 按 provider 过滤取图 + 回退
 * - /api/response：同上（直接响应模式）
 * - /api/admin/config：provider 参数 schema/校验（mappedProviders 必填）
 */

process.env.NODE_ENV = 'test';
process.env.ADMIN_PASSWORD = 'test-password';
process.env.SESSION_SECRET = 'test-secret';

import { databaseService } from '@/lib/database';

// Mock Next.js server 模块，提供精简版 NextResponse/NextRequest
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
    entries() {
      return this.map.entries();
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
    async arrayBuffer() {
      if (typeof this.body === 'string') {
        return new TextEncoder().encode(this.body).buffer;
      }
      if (typeof Buffer !== 'undefined' && Buffer.isBuffer(this.body)) {
        return this.body.buffer.slice(this.body.byteOffset, this.body.byteOffset + this.body.byteLength);
      }
      return new ArrayBuffer(0);
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

// 避免安全中间件触发真实 DB/外部依赖
jest.mock('@/lib/security', () => ({
  withSecurity: () => (handler: any) => handler,
}));

// Mock CloudinaryService（/api/response 会用）
const mockCloudinary = {
  downloadImage: jest.fn().mockResolvedValue(Buffer.from('binary-image')),
};

jest.mock('@/lib/cloudinary', () => ({
  CloudinaryService: {
    getInstance: () => mockCloudinary,
  },
}));

// Mock 数据库服务
jest.mock('@/lib/database', () => ({
  databaseService: {
    getAPIConfig: jest.fn(),
    initialize: jest.fn(),
    getGroups: jest.fn(),
    updateAPIConfig: jest.fn(),
    getRandomImagesIncludingTelegram: jest.fn(),
    saveLog: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    apiRequest: jest.fn(),
    apiResponse: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    security: jest.fn(),
  },
}));

// 延迟加载路由（确保 mocks 生效）
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GET: RandomGET } = require('@/app/api/random/route');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GET: ResponseGET } = require('@/app/api/response/route');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PUT: AdminConfigPUT } = require('@/app/api/admin/config/route');

const mockDb = databaseService as unknown as {
  getAPIConfig: jest.Mock;
  initialize: jest.Mock;
  getGroups: jest.Mock;
  updateAPIConfig: jest.Mock;
  getRandomImagesIncludingTelegram: jest.Mock;
};

function createMockRequest(url: string, init?: { method?: string; headers?: Record<string, string>; body?: any }): any {
  const headers = new Headers(init?.headers);
  return {
    method: init?.method ?? 'GET',
    headers,
    url,
    nextUrl: new URL(url),
    cookies: {
      get: jest.fn().mockReturnValue(undefined),
    },
    json: jest.fn().mockResolvedValue(init?.body ?? {}),
  };
}

describe('provider 参数集成测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // 重置 /api/response 预取缓存，避免跨用例串扰
    // route.ts 在 NODE_ENV=test 时会把 reset 函数挂到 globalThis
    const resetPrefetchCache = (globalThis as any).__resetPrefetchCacheForTests;
    if (typeof resetPrefetchCache === 'function') {
      resetPrefetchCache();
    }

    mockDb.getAPIConfig.mockResolvedValue({
      id: 'default',
      isEnabled: true,
      enableDirectResponse: true,
      defaultScope: 'all',
      defaultGroups: [],
      allowedParameters: [
        {
          name: 'src',
          type: 'provider',
          allowedValues: ['fast'],
          mappedGroups: [],
          mappedProviders: ['cloudinary', 'custom'],
          isEnabled: true,
        },
        {
          name: 'category',
          type: 'group',
          allowedValues: ['nature'],
          mappedGroups: ['grp_000001'],
          isEnabled: true,
        },
      ],
      apiKeyEnabled: false,
      apiKey: undefined,
      updatedAt: new Date(),
    });

    mockDb.getGroups.mockResolvedValue([
      { id: 'grp_000001', name: 'G1', imageCount: 1 },
    ]);
  });

  describe('/api/random：provider 过滤与回退', () => {
    it('当选中的 provider 无图时，应回退到其它 provider', async () => {
      // providers = ['cloudinary','custom']，Math.random=0.9 -> 选中 custom
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.9);

      mockDb.getRandomImagesIncludingTelegram.mockImplementation(
        async (_count: number, groupId?: string, _options?: any, provider?: string) => {
          // 叠加分组限制：category=nature -> grp_000001
          expect(groupId).toBe('grp_000001');

          if (provider === 'custom') return [];
          if (provider === 'cloudinary') {
            return [{
              id: 'img_1',
              publicId: 'p1',
              url: 'https://res.cloudinary.com/test/image/upload/p1.jpg',
              groupId: 'grp_000001',
              uploadedAt: new Date(),
              primaryProvider: 'cloudinary',
            }];
          }
          return [];
        }
      );

      const request = createMockRequest('http://localhost:3000/api/random?src=fast&category=nature');
      const response = await RandomGET(request);

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('https://res.cloudinary.com/test/image/upload/p1.jpg');

      // 先尝试 custom，再回退 cloudinary
      expect(mockDb.getRandomImagesIncludingTelegram).toHaveBeenNthCalledWith(
        1,
        1,
        'grp_000001',
        undefined,
        'custom'
      );
      expect(mockDb.getRandomImagesIncludingTelegram).toHaveBeenNthCalledWith(
        2,
        1,
        'grp_000001',
        undefined,
        'cloudinary'
      );

      randomSpy.mockRestore();
    });

    it('provider 参数值非法时应返回 400', async () => {
      const request = createMockRequest('http://localhost:3000/api/random?src=invalid');
      const response = await RandomGET(request);
      expect(response.status).toBe(400);
    });

    it('provider + group 应叠加生效（交集）：分组不匹配时应返回 404', async () => {
      // 将 provider 映射收窄为单一 cloudinary，避免回退到其它 provider 干扰断言
      mockDb.getAPIConfig.mockResolvedValueOnce({
        id: 'default',
        isEnabled: true,
        enableDirectResponse: true,
        defaultScope: 'all',
        defaultGroups: [],
        allowedParameters: [
          {
            name: 'src',
            type: 'provider',
            allowedValues: ['fast'],
            mappedGroups: [],
            mappedProviders: ['cloudinary'],
            isEnabled: true,
          },
          {
            name: 'category',
            type: 'group',
            allowedValues: ['nature'],
            mappedGroups: ['grp_000001'],
            isEnabled: true,
          },
        ],
        apiKeyEnabled: false,
        apiKey: undefined,
        updatedAt: new Date(),
      });

      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.1);

      // 模拟：cloudinary 有“全局图”，但在 grp_000001 下没有图
      mockDb.getRandomImagesIncludingTelegram.mockImplementation(
        async (_count: number, groupId?: string, _options?: any, provider?: string) => {
          expect(provider).toBe('cloudinary');
          if (groupId === 'grp_000001') return [];
          return [{
            id: 'img_global',
            publicId: 'pg',
            url: 'https://res.cloudinary.com/test/image/upload/pg.jpg',
            groupId: null,
            uploadedAt: new Date(),
            primaryProvider: 'cloudinary',
          }];
        }
      );

      // 同时带 provider 参数 + 分组参数（category=nature -> grp_000001）
      const request = createMockRequest('http://localhost:3000/api/random?src=fast&category=nature');
      const response = await RandomGET(request);
      expect(response.status).toBe(404);

      randomSpy.mockRestore();
    });
  });

  describe('/api/response：provider 过滤（均匀随机选 provider）', () => {
    it('应按选中的 provider 调用随机取图', async () => {
      // providers = ['cloudinary','custom']，Math.random=0.1 -> 选中 cloudinary
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.1);

      mockDb.getRandomImagesIncludingTelegram.mockResolvedValue([
        {
          id: 'img_2',
          publicId: 'p2',
          url: 'https://res.cloudinary.com/test/image/upload/p2.jpg',
          groupId: null,
          uploadedAt: new Date(),
          primaryProvider: 'cloudinary',
        },
      ]);

      const request = createMockRequest('http://localhost:3000/api/response?src=fast');
      const response = await ResponseGET(request);

      expect(response.status).toBe(200);
      expect(mockDb.getRandomImagesIncludingTelegram).toHaveBeenCalledWith(1, undefined, undefined, 'cloudinary');

      randomSpy.mockRestore();
    });
  });

  describe('/api/response：预取缓存 key 不应在不同 provider 过滤间串缓存', () => {
    it('不同 provider 过滤应使用不同 cacheKey：A 命中预取不应影响 B', async () => {
      // 配置：两个 provider 参数，分别映射到不同 providers
      // 注意：本用例会对同一 URL 连续请求两次，配置必须对两次请求保持一致
      mockDb.getAPIConfig.mockResolvedValue({
        id: 'default',
        isEnabled: true,
        enableDirectResponse: true,
        defaultScope: 'all',
        defaultGroups: [],
        allowedParameters: [
          {
            name: 'src',
            type: 'provider',
            allowedValues: ['fast'],
            mappedGroups: [],
            mappedProviders: ['cloudinary'],
            isEnabled: true,
          },
          {
            name: 'mirror',
            type: 'provider',
            allowedValues: ['on'],
            mappedGroups: [],
            mappedProviders: ['custom'],
            isEnabled: true,
          },
        ],
        apiKeyEnabled: false,
        apiKey: undefined,
        updatedAt: new Date(),
      });

      // 让随机 provider 选择稳定（单元素 providers 列表也稳定，这里只是避免其它随机）
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.1);

      mockDb.getRandomImagesIncludingTelegram.mockImplementation(
        async (_count: number, _groupId?: string, _options?: any, provider?: string) => {
          if (provider === 'cloudinary') {
            return [{
              id: 'img_c',
              publicId: 'pc',
              url: 'https://res.cloudinary.com/test/image/upload/pc.jpg',
              groupId: null,
              uploadedAt: new Date(),
              primaryProvider: 'cloudinary',
            }];
          }
          if (provider === 'custom') {
            return [{
              id: 'img_u',
              publicId: 'pu',
              url: 'https://res.cloudinary.com/test/image/upload/pu.jpg',
              groupId: null,
              uploadedAt: new Date(),
              primaryProvider: 'custom',
            }];
          }
          return [];
        }
      );

      // A：src=fast -> providers=['cloudinary']
      const urlA = 'http://localhost:3000/api/response?src=fast';
      const r1 = await ResponseGET(createMockRequest(urlA));
      expect(r1.status).toBe(200);
      expect(r1.headers.get('X-Transfer-Mode')).toBe('buffered');

      // 等待预取完成（避免定时器抖动导致用例偶发失败）
      const waitPrefetch = (globalThis as any).__waitForPrefetchForTests;
      const getKeys = (globalThis as any).__getPrefetchKeysForTests;

      // key 可能会随实现细节变化（providers/groups 维度），这里以实际缓存 key 为准
      const keys: string[] = typeof getKeys === 'function' ? getKeys() : [];
      const keyToWait = keys[0] || 'providers:cloudinary';

      if (typeof waitPrefetch === 'function') {
        await waitPrefetch(keyToWait, 1000);
      } else {
        await new Promise((r) => setTimeout(r, 60));
      }

      const getState = (globalThis as any).__getPrefetchStateForTests;
      const state = typeof getState === 'function' ? getState(keyToWait) : undefined;
      // 断言预取确实已经落槽（否则第二次必然 buffered）
      if (state) {
        expect(state.hasSlot).toBe(true);
        expect(state.hasItem).toBe(true);
      }

      const r2 = await ResponseGET(createMockRequest(urlA));
      expect(r2.status).toBe(200);
      expect(r2.headers.get('X-Transfer-Mode')).toBe('prefetch');

      // B：mirror=on -> providers=['custom']，不应命中 A 的预取
      const urlB = 'http://localhost:3000/api/response?mirror=on';
      const r3 = await ResponseGET(createMockRequest(urlB));
      expect(r3.status).toBe(200);
      expect(r3.headers.get('X-Transfer-Mode')).toBe('buffered');

      randomSpy.mockRestore();
    });
  });

  describe('/api/admin/config：provider 参数校验', () => {
    it('更新配置：允许 provider 参数并写入数据库', async () => {
      mockDb.getAPIConfig.mockResolvedValueOnce({
        id: 'default',
        isEnabled: true,
        enableDirectResponse: true,
        defaultScope: 'all',
        defaultGroups: [],
        allowedParameters: [],
        apiKeyEnabled: false,
        apiKey: undefined,
        updatedAt: new Date(),
      });

      const body = {
        allowedParameters: [
          {
            name: 'src',
            type: 'provider',
            allowedValues: ['fast'],
            mappedGroups: [],
            mappedProviders: ['cloudinary', 'custom'],
            isEnabled: true,
          },
        ],
      };

      const request = createMockRequest('http://localhost:3000/api/admin/config', {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-admin-password': 'test-password' },
        body,
      });

      const resp = await AdminConfigPUT(request);
      expect(resp.status).toBe(200);
      expect(mockDb.updateAPIConfig).toHaveBeenCalledTimes(1);
      const saved = mockDb.updateAPIConfig.mock.calls[0][0];
      expect(saved.allowedParameters[0].type).toBe('provider');
      expect(saved.allowedParameters[0].mappedProviders).toEqual(['cloudinary', 'custom']);
    });

    it('provider 参数缺少 mappedProviders 时应返回 400（Zod 校验）', async () => {
      const body = {
        allowedParameters: [
          {
            name: 'src',
            type: 'provider',
            allowedValues: ['fast'],
            mappedGroups: [],
            // mappedProviders missing
            isEnabled: true,
          },
        ],
      };

      const request = createMockRequest('http://localhost:3000/api/admin/config', {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-admin-password': 'test-password' },
        body,
      });

      const resp = await AdminConfigPUT(request);
      expect(resp.status).toBe(400);
    });

    it('mappedGroups 中存在不存在的分组时应返回 400（AppError）', async () => {
      // getGroups 返回空，触发“分组不存在”
      mockDb.getGroups.mockResolvedValueOnce([]);

      const body = {
        allowedParameters: [
          {
            name: 'category',
            type: 'group',
            allowedValues: ['nature'],
            mappedGroups: ['grp_missing'],
            isEnabled: true,
          },
        ],
      };

      const request = createMockRequest('http://localhost:3000/api/admin/config', {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-admin-password': 'test-password' },
        body,
      });

      const resp = await AdminConfigPUT(request);
      expect(resp.status).toBe(400);
      const json = await resp.json();
      expect(json.success).toBe(false);
      expect(json.error.type).toBe('VALIDATION_ERROR');
    });
  });
});
