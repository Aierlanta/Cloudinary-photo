/**
 * 认证中间件测试
 */

import { NextRequest } from 'next/server';
import {
  validateAdminPassword,
  extractAuthFromRequest,
  verifyAdminAuth,
  createAuthResponse,
  withAdminAuth
} from '../auth';
import { APIError, ErrorType } from '@/types/errors';

// 模拟全局Response对象
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
      }).toThrow(APIError);
    });
  });

  describe('extractAuthFromRequest', () => {
    it('应该从Authorization头提取密码', () => {
      const mockRequest = {
        headers: new Map([['authorization', 'Bearer test-password-123']]),
        url: 'http://localhost:3000/api/admin/test'
      } as any;

      const password = extractAuthFromRequest(mockRequest);
      expect(password).toBe('test-password-123');
    });

    it('应该从X-Admin-Password头提取密码', () => {
      const mockRequest = {
        headers: new Map([['x-admin-password', 'test-password-123']]),
        url: 'http://localhost:3000/api/admin/test'
      } as any;

      const password = extractAuthFromRequest(mockRequest);
      expect(password).toBe('test-password-123');
    });

    it('应该从查询参数提取密码', () => {
      const mockRequest = {
        headers: new Map(),
        url: 'http://localhost:3000/api/admin/test?admin_password=test-password-123'
      } as any;

      const password = extractAuthFromRequest(mockRequest);
      expect(password).toBe('test-password-123');
    });

    it('应该在没有认证信息时返回null', () => {
      const mockRequest = {
        headers: new Map(),
        url: 'http://localhost:3000/api/admin/test'
      } as any;

      const password = extractAuthFromRequest(mockRequest);
      expect(password).toBeNull();
    });

    it('应该优先使用Authorization头', () => {
      const mockRequest = {
        headers: new Map([
          ['authorization', 'Bearer auth-header-password'],
          ['x-admin-password', 'header-password']
        ]),
        url: 'http://localhost:3000/api/admin/test?admin_password=query-password'
      } as any;

      const password = extractAuthFromRequest(mockRequest);
      expect(password).toBe('auth-header-password');
    });
  });

  describe('verifyAdminAuth', () => {
    it('应该验证有效的认证', () => {
      const mockRequest = {
        headers: new Map([['authorization', 'Bearer test-password-123']]),
        url: 'http://localhost:3000/api/admin/test'
      } as any;

      expect(() => {
        verifyAdminAuth(mockRequest);
      }).not.toThrow();
    });

    it('应该在缺少认证时抛出错误', () => {
      const mockRequest = {
        headers: new Map(),
        url: 'http://localhost:3000/api/admin/test'
      } as any;

      expect(() => {
        verifyAdminAuth(mockRequest);
      }).toThrow(APIError);
    });

    it('应该在密码错误时抛出错误', () => {
      const mockRequest = {
        headers: new Map([['authorization', 'Bearer wrong-password']]),
        url: 'http://localhost:3000/api/admin/test'
      } as any;

      expect(() => {
        verifyAdminAuth(mockRequest);
      }).toThrow(APIError);
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

      const mockRequest = {
        headers: new Map([['authorization', 'Bearer test-password-123']]),
        url: 'http://localhost:3000/api/admin/test'
      } as any;

      const response = await authHandler(mockRequest);

      expect(mockHandler).toHaveBeenCalledWith(mockRequest);
      expect(response.status).toBe(200);
    });

    it('应该拒绝无效的认证请求', async () => {
      const mockHandler = jest.fn();

      const authHandler = withAdminAuth(mockHandler);

      const mockRequest = {
        headers: new Map([['authorization', 'Bearer wrong-password']]),
        url: 'http://localhost:3000/api/admin/test'
      } as any;

      const response = await authHandler(mockRequest);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(response.status).toBe(401);
    });

    it('应该拒绝缺少认证的请求', async () => {
      const mockHandler = jest.fn();

      const authHandler = withAdminAuth(mockHandler);

      const mockRequest = {
        headers: new Map(),
        url: 'http://localhost:3000/api/admin/test'
      } as any;

      const response = await authHandler(mockRequest);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(response.status).toBe(401);
    });

    it('应该传递其他错误', async () => {
      const mockHandler = jest.fn().mockRejectedValue(new Error('其他错误'));

      const authHandler = withAdminAuth(mockHandler);

      const mockRequest = {
        headers: new Map([['authorization', 'Bearer test-password-123']]),
        url: 'http://localhost:3000/api/admin/test'
      } as any;

      await expect(authHandler(mockRequest)).rejects.toThrow('其他错误');
    });
  });

  describe('多种认证方式组合', () => {
    it('应该支持多种认证方式的优先级', () => {
      // Authorization头优先级最高
      const request1 = {
        headers: new Map([
          ['authorization', 'Bearer auth-password'],
          ['x-admin-password', 'header-password']
        ]),
        url: 'http://localhost:3000/api/admin/test?admin_password=query-password'
      } as any;

      expect(extractAuthFromRequest(request1)).toBe('auth-password');

      // X-Admin-Password头次之
      const request2 = {
        headers: new Map([['x-admin-password', 'header-password']]),
        url: 'http://localhost:3000/api/admin/test?admin_password=query-password'
      } as any;

      expect(extractAuthFromRequest(request2)).toBe('header-password');

      // 查询参数优先级最低
      const request3 = {
        headers: new Map(),
        url: 'http://localhost:3000/api/admin/test?admin_password=query-password'
      } as any;

      expect(extractAuthFromRequest(request3)).toBe('query-password');
    });
  });
});