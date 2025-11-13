/**
 * 认证中间件测试
 */

import type { NextRequest } from 'next/server';
import {
  validateAdminPassword,
  extractAuthFromRequest,
  verifyAdminAuth,
  createAuthResponse,
  withAdminAuth
} from '../auth';
import { AppError } from '@/types/errors';

// 模拟全局Response对象，保持旧测试的断言形式
global.Response = class MockResponse {
  status: number;
  headers: Map<string, string>;
  body: any;

  constructor(body?: any, init?: { status?: number; headers?: Record<string, string> }) {
    this.body = body;
    this.status = init?.status || 200;
    this.headers = new Map(Object.entries(init?.headers || {}));
  }

  text() {
    return Promise.resolve(typeof this.body === 'string' ? this.body : JSON.stringify(this.body));
  }

  json() {
    return Promise.resolve(typeof this.body === 'string' ? JSON.parse(this.body) : this.body);
  }
} as any;

// 模拟环境变量
const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
  process.env.ADMIN_PASSWORD = 'test-password-123';
});

afterEach(() => {
  process.env = originalEnv;
});

const createMockRequest = (options: {
  headers?: Record<string, string>;
  url?: string;
  sessionToken?: string | null;
} = {}) => {
  const headerEntries = Object.entries(options.headers || {});
  const headerMap = new Map<string, string>();
  headerEntries.forEach(([key, value]) => headerMap.set(key.toLowerCase(), value));

  return {
    method: 'GET',
    headers: {
      get: (key: string) => headerMap.get(key.toLowerCase()) ?? null
    },
    url: options.url || 'http://localhost:3000/api/admin/test',
    cookies: {
      get: (name: string) => {
        if (name === 'admin-session' && options.sessionToken) {
          return { name, value: options.sessionToken };
        }
        return undefined;
      }
    }
  } as unknown as NextRequest;
};

describe('认证中间件测试', () => {
  describe('validateAdminPassword', () => {
    it('应该验证正确的密码', () => {
      expect(validateAdminPassword('test-password-123')).toBe(true);
    });

    it('应该拒绝错误的密码', () => {
      expect(validateAdminPassword('wrong-password')).toBe(false);
    });

    it('应该在密码未配置时抛出错误', () => {
      delete process.env.ADMIN_PASSWORD;

      expect(() => {
        validateAdminPassword('any-password');
      }).toThrow(AppError);
    });
  });

  describe('extractAuthFromRequest', () => {
    it('应该从Authorization头提取密码', () => {
      const mockRequest = createMockRequest({
        headers: { authorization: 'Bearer test-password-123' }
      });

      const password = extractAuthFromRequest(mockRequest);
      expect(password).toBe('test-password-123');
    });

    it('应该从X-Admin-Password头提取密码', () => {
      const mockRequest = createMockRequest({
        headers: { 'x-admin-password': 'test-password-123' }
      });

      const password = extractAuthFromRequest(mockRequest);
      expect(password).toBe('test-password-123');
    });

    it('应该从查询参数提取密码', () => {
      const mockRequest = createMockRequest({
        url: 'http://localhost:3000/api/admin/test?admin_password=test-password-123'
      });

      const password = extractAuthFromRequest(mockRequest);
      expect(password).toBe('test-password-123');
    });

    it('应该在没有认证信息时返回null', () => {
      const mockRequest = createMockRequest();

      const password = extractAuthFromRequest(mockRequest);
      expect(password).toBeNull();
    });

    it('应该优先使用Authorization头', () => {
      const mockRequest = createMockRequest({
        headers: {
          authorization: 'Bearer auth-header-password',
          'x-admin-password': 'header-password'
        },
        url: 'http://localhost:3000/api/admin/test?admin_password=query-password'
      });

      const password = extractAuthFromRequest(mockRequest);
      expect(password).toBe('auth-header-password');
    });

    it('应该优先使用Session Cookie', () => {
      const mockRequest = createMockRequest({
        headers: {
          authorization: 'Bearer should-not-use',
          'x-admin-password': 'header-password'
        },
        url: 'http://localhost:3000/api/admin/test?admin_password=query-password',
        sessionToken: 'session-token-value'
      });

      const password = extractAuthFromRequest(mockRequest);
      expect(password).toBe('session-token-value');
    });
  });

  describe('verifyAdminAuth', () => {
    it('应该验证有效的认证', () => {
      const mockRequest = createMockRequest({
        headers: { authorization: 'Bearer test-password-123' }
      });

      expect(() => {
        verifyAdminAuth(mockRequest);
      }).not.toThrow();
    });

    it('应该接受有效的Session Token', () => {
      const mockRequest = createMockRequest({
        sessionToken: 'valid-session-token'
      });

      expect(() => {
        verifyAdminAuth(mockRequest);
      }).not.toThrow();
    });

    it('应该在缺少认证时抛出错误', () => {
      const mockRequest = createMockRequest();

      expect(() => {
        verifyAdminAuth(mockRequest);
      }).toThrow(AppError);
    });

    it('应该在密码错误时抛出错误', () => {
      const mockRequest = createMockRequest({
        headers: { authorization: 'Bearer wrong-password' }
      });

      expect(() => {
        verifyAdminAuth(mockRequest);
      }).toThrow(AppError);
    });
  });

  describe('createAuthResponse', () => {
    it('应该创建认证错误响应', () => {
      const response = createAuthResponse('需要管理员认证');

      expect(response.status).toBe(401);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('WWW-Authenticate')).toBe('Bearer realm="Admin Area"');
    });

    it('应该支持自定义状态码', () => {
      const response = createAuthResponse('禁止访问', 403);

      expect(response.status).toBe(403);
    });
  });

  describe('withAdminAuth装饰器', () => {
    it('应该允许有效的认证请求', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        new Response('success', { status: 200 })
      );

      const authHandler = withAdminAuth(mockHandler);

      const mockRequest = createMockRequest({
        headers: { authorization: 'Bearer test-password-123' }
      });

      const response = await authHandler(mockRequest);

      expect(mockHandler).toHaveBeenCalledWith(mockRequest);
      expect(response.status).toBe(200);
    });

    it('应该拒绝无效的认证请求', async () => {
      const mockHandler = jest.fn();

      const authHandler = withAdminAuth(mockHandler);

      const mockRequest = createMockRequest({
        headers: { authorization: 'Bearer wrong-password' }
      });

      const response = await authHandler(mockRequest);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(response.status).toBe(401);
    });

    it('应该拒绝缺少认证的请求', async () => {
      const mockHandler = jest.fn();

      const authHandler = withAdminAuth(mockHandler);

      const mockRequest = createMockRequest();

      const response = await authHandler(mockRequest);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(response.status).toBe(401);
    });

    it('应该传递其他错误', async () => {
      const mockHandler = jest.fn().mockRejectedValue(new Error('其他错误'));

      const authHandler = withAdminAuth(mockHandler);

      const mockRequest = createMockRequest({
        headers: { authorization: 'Bearer test-password-123' }
      });

      await expect(authHandler(mockRequest)).rejects.toThrow('其他错误');
    });
  });

  describe('多种认证方式组合', () => {
    it('应该支持多种认证方式的优先级', () => {
      const request1 = createMockRequest({
        headers: {
          authorization: 'Bearer auth-password',
          'x-admin-password': 'header-password'
        },
        url: 'http://localhost:3000/api/admin/test?admin_password=query-password'
      });
      expect(extractAuthFromRequest(request1)).toBe('auth-password');

      const request2 = createMockRequest({
        headers: { 'x-admin-password': 'header-password' },
        url: 'http://localhost:3000/api/admin/test?admin_password=query-password'
      });
      expect(extractAuthFromRequest(request2)).toBe('header-password');

      const request3 = createMockRequest({
        url: 'http://localhost:3000/api/admin/test?admin_password=query-password'
      });
      expect(extractAuthFromRequest(request3)).toBe('query-password');

      const request4 = createMockRequest({
        sessionToken: 'session-token-value'
      });
      expect(extractAuthFromRequest(request4)).toBe('session-token-value');
    });
  });
});