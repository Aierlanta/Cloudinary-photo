/**
 * /api/admin/images/[id]/file 回归测试
 * 覆盖：错误详情泄漏、重定向响应体释放
 */

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
    static json(data: any, init?: any) {
      const headers = { 'Content-Type': 'application/json', ...(init?.headers || {}) };
      return new BaseResponse(JSON.stringify(data), { ...init, headers });
    }
  }

  class NextRequest {}

  return { NextResponse, NextRequest };
});

// Mock 认证/安全装饰器：避免引入真实依赖（DB/限流/鉴权）
jest.mock('@/lib/auth', () => ({
  withAdminAuth: (handler: any) => handler,
}));

jest.mock('@/lib/security', () => ({
  withSecurity: () => (handler: any) => handler,
}));

// Mock 数据库服务：避免真实数据库访问
jest.mock('@/lib/database', () => ({
  databaseService: {
    getImage: jest.fn(),
    saveLog: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock logger：避免测试输出及动态写库
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

// 兼容 error-handler 内部的相对导入路径（./logger）
jest.mock('../../src/lib/logger', () => ({
  logger: {
    apiRequest: jest.fn(),
    apiResponse: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    security: jest.fn(),
  },
}));

// Mock DNS 查询
jest.mock('dns/promises', () => ({
  lookup: jest.fn(),
}));

// 延迟加载路由，确保上面的 jest.mock 已生效
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GET } = require('@/app/api/admin/images/[id]/file/route');

const mockedDatabaseService = databaseService as unknown as {
  getImage: jest.Mock;
};

const { lookup } = jest.requireMock('dns/promises') as {
  lookup: jest.Mock;
};

function createMockRequest(url = 'http://localhost:3000/api/admin/images/img_1/file'): any {
  return {
    method: 'GET',
    headers: new Headers(),
    url,
    nextUrl: new URL(url),
    cookies: {
      get: jest.fn().mockReturnValue(undefined),
    },
  };
}

describe('/api/admin/images/[id]/file 回归测试', () => {
  const originalFetch = (global as any).fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).fetch = originalFetch;
  });

  afterAll(() => {
    (global as any).fetch = originalFetch;
  });

  it('数据库抛出 Error 时，不应在响应 details 中泄漏 stack/originalError', async () => {
    mockedDatabaseService.getImage.mockRejectedValueOnce(new Error('DB_DOWN'));

    const request = createMockRequest();
    const response = await GET(request, { params: { id: 'img_1' } });

    expect(response.status).toBe(500);
    const json = await response.json();

    expect(json?.success).toBe(false);
    expect(json?.error?.details?.stack).toBeUndefined();
    expect(json?.error?.details?.originalError).toBeUndefined();
  });

  it('处理 302 重定向时应 cancel 响应体，避免连接/内存泄漏', async () => {
    mockedDatabaseService.getImage.mockResolvedValueOnce({
      id: 'img_1',
      url: 'https://example.com/start',
      title: 't',
      publicId: 'p',
    });

    // 使用文档保留网段（TEST-NET-3），避免依赖真实 DNS/IP
    lookup.mockResolvedValue([{ address: '203.0.113.10', family: 4 }]);

    const cancel = jest.fn().mockResolvedValue(undefined);
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        status: 302,
        headers: new Headers({ location: 'https://example.com/next' }),
        body: { cancel },
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'ERR',
        headers: new Headers(),
        body: null,
      });
    (global as any).fetch = fetchMock;

    const request = createMockRequest();
    const response = await GET(request, { params: { id: 'img_1' } });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(502);
  });
});
