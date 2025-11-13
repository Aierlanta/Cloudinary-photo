/**
 * 管理端认证路由测试
 */

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

jest.mock('next/server', () => {
  const G: any = typeof globalThis !== 'undefined' ? globalThis : global;
  const HeadersCtor: any =
    G.Headers ||
    class {
      private map = new Map<string, string>();
      constructor(init?: Record<string, string>) {
        if (init) {
          for (const [key, value] of Object.entries(init)) {
            this.map.set(String(key).toLowerCase(), String(value));
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

  class BaseResponse {
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
  }

  class NextResponse extends BaseResponse {
    constructor(body?: any, init?: any) {
      super(body, init);
    }
    static json(data: any, init?: any) {
      const headers = { 'Content-Type': 'application/json', ...(init?.headers || {}) };
      return new NextResponse(JSON.stringify(data), { ...init, headers });
    }
  }

  class NextRequest {}

  return { NextResponse, NextRequest };
});

import { cookies } from 'next/headers';
import { GET } from '../check/route';
import { POST } from '../login/route';
import { generateSessionToken } from '@/lib/auth';
import { AppError, ErrorType } from '@/types/errors';

type MockCookieStore = {
  get: jest.Mock;
  set: jest.Mock;
};

const originalEnv = process.env;

const createMockRequest = (body: unknown) => {
  return {
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Request;
};

describe('管理员认证路由', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.ADMIN_PASSWORD = 'test-password-123';
    process.env.SESSION_SECRET = 'session-secret';
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const setupCookies = (overrides: Partial<MockCookieStore> = {}) => {
    const store: MockCookieStore = {
      get: jest.fn(),
      set: jest.fn(),
      ...overrides,
    };
    (cookies as jest.Mock).mockReturnValue(store);
    return store;
  };

  describe('GET /api/admin/auth/check', () => {
    it('缺少Session Cookie时应返回401', async () => {
      setupCookies({
        get: jest.fn().mockReturnValue(undefined),
      });

      const response = await GET();
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({ message: '未登录' });
    });

    it('无效的会话令牌应返回401', async () => {
      setupCookies({
        get: jest.fn().mockReturnValue({ name: 'admin-session', value: 'invalid.token' }),
      });

      const response = await GET();
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({ message: '未登录' });
    });

    it('有效令牌应返回200', async () => {
      const token = generateSessionToken();
      setupCookies({
        get: jest.fn().mockReturnValue({ name: 'admin-session', value: token }),
      });

      const response = await GET();
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ message: '已登录' });
    });

    it('发生异常时应返回500', async () => {
      (cookies as jest.Mock).mockImplementation(() => {
        throw new Error('Cookies API unavailable');
      });

      const response = await GET();
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toEqual({ message: '服务器内部错误' });
    });
  });

  describe('POST /api/admin/auth/login', () => {
    it('缺少密码时应返回400', async () => {
      const cookieStore = setupCookies();
      const request = createMockRequest({});

      const response = await POST(request);
      expect(cookieStore.set).not.toHaveBeenCalled();
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toEqual({ message: '密码不能为空' });
    });

    it('管理员密码未配置时应返回500', async () => {
      const cookieStore = setupCookies();
      delete process.env.ADMIN_PASSWORD;
      const request = createMockRequest({ password: 'anything' });

      const response = await POST(request);
      expect(cookieStore.set).not.toHaveBeenCalled();
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toEqual({ message: '服务器配置错误：未设置管理员密码' });
    });

    it('密码错误时应返回401', async () => {
      const cookieStore = setupCookies();
      const request = createMockRequest({ password: 'wrong-password' });

      const response = await POST(request);
      expect(cookieStore.set).not.toHaveBeenCalled();
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({ message: '密码错误' });
    });

    it('密码正确时应设置cookie并返回成功', async () => {
      const cookieStore = setupCookies();
      const request = createMockRequest({ password: 'test-password-123' });

      const response = await POST(request);

      expect(cookieStore.set).toHaveBeenCalledWith(
        'admin-session',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          secure: false,
          sameSite: 'strict',
          maxAge: 24 * 60 * 60,
        }),
      );
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ message: '登录成功' });
    });

    it('cookie 设置失败时应返回500', async () => {
      setupCookies({
        set: jest.fn().mockImplementation(() => {
          throw new AppError(ErrorType.INTERNAL_ERROR, 'cookie failed', 500);
        }),
      });
      const request = createMockRequest({ password: 'test-password-123' });

      const response = await POST(request);
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toEqual({ message: '服务器内部错误' });
    });
  });
});

