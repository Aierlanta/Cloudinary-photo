/**
 * 安全中间件测试
 */

import { NextRequest } from 'next/server';
import { isIPBanned, getIPRateLimit, checkIPTotalLimit } from '../ip-management';
import { evaluatePublicRiskControl } from '../risk-control';
import { 
  rateLimit, 
  createRateLimitResponse, 
  setSecurityHeaders,
  validateContentType,
  validateMethod,
  validateRequestSize,
  withSecurity,
  clearRateLimitStore,
  getRateLimitStats
} from '../security';
import { AppError, ErrorType } from '@/types/errors';

jest.mock('../ip-management', () => ({
  isIPBanned: jest.fn().mockResolvedValue(false),
  getIPRateLimit: jest.fn().mockResolvedValue(null),
  checkIPTotalLimit: jest.fn().mockResolvedValue({ exceeded: false, current: 0 })
}));

jest.mock('../risk-control', () => ({
  GUARD_RATE_LIMIT: {
    windowMs: 60000,
    maxRequests: 1,
    message: '当前处于警戒状态，非白名单 IP 每分钟仅允许 1 次请求'
  },
  evaluatePublicRiskControl: jest.fn().mockResolvedValue({
    isWhitelisted: false,
    whitelistOnlyBlocked: false,
    guardLimited: false
  })
}));

jest.mock('../access-tracking', () => ({
  logAccess: jest.fn().mockResolvedValue(undefined)
}));

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

// 模拟NextResponse
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn((data, options) => ({
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
      status: options?.status || 200,
      headers: new Map(Object.entries(options?.headers || {}))
    }))
  }
}));

describe('安全中间件测试', () => {
  const mockIsIPBanned = isIPBanned as jest.MockedFunction<typeof isIPBanned>;
  const mockGetIPRateLimit = getIPRateLimit as jest.MockedFunction<typeof getIPRateLimit>;
  const mockCheckIPTotalLimit = checkIPTotalLimit as jest.MockedFunction<typeof checkIPTotalLimit>;
  const mockEvaluatePublicRiskControl = evaluatePublicRiskControl as jest.MockedFunction<typeof evaluatePublicRiskControl>;

  beforeEach(() => {
    // 清理限流存储
    clearRateLimitStore();
    jest.clearAllMocks();
    mockIsIPBanned.mockResolvedValue(false);
    mockGetIPRateLimit.mockResolvedValue(null);
    mockCheckIPTotalLimit.mockResolvedValue({ exceeded: false, current: 0 });
    mockEvaluatePublicRiskControl.mockResolvedValue({
      isWhitelisted: false,
      whitelistOnlyBlocked: false,
      guardLimited: false
    });
  });

  describe('限流功能', () => {
    it('应该允许在限制范围内的请求', async () => {
      const mockRequest = {
        nextUrl: { pathname: '/api/test' },
        headers: new Map([['x-forwarded-for', '192.168.1.1']])
      } as any;

      const rateLimitFn = rateLimit({
        windowMs: 60000,
        maxRequests: 10,
        message: '请求过于频繁'
      });

      const result = await rateLimitFn(mockRequest);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('应该阻止超出限制的请求', async () => {
      const mockRequest = {
        nextUrl: { pathname: '/api/test' },
        headers: new Map([['x-forwarded-for', '192.168.1.1']])
      } as any;

      const rateLimitFn = rateLimit({
        windowMs: 60000,
        maxRequests: 2,
        message: '请求过于频繁'
      });

      // 发送3个请求
      await rateLimitFn(mockRequest);
      await rateLimitFn(mockRequest);
      const result = await rateLimitFn(mockRequest);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('应该在时间窗口重置后允许新请求', async () => {
      const mockRequest = {
        nextUrl: { pathname: '/api/test' },
        headers: new Map([['x-forwarded-for', '192.168.1.1']])
      } as any;

      const rateLimitFn = rateLimit({
        windowMs: 100, // 100ms窗口
        maxRequests: 1,
        message: '请求过于频繁'
      });

      // 第一个请求
      const result1 = await rateLimitFn(mockRequest);
      expect(result1.allowed).toBe(true);

      // 第二个请求应该被阻止
      const result2 = await rateLimitFn(mockRequest);
      expect(result2.allowed).toBe(false);

      // 等待时间窗口重置
      await new Promise(resolve => setTimeout(resolve, 150));

      // 新的请求应该被允许
      const result3 = await rateLimitFn(mockRequest);
      expect(result3.allowed).toBe(true);
    });

    it('警戒状态应将公开请求收紧为每分钟1次', async () => {
      mockEvaluatePublicRiskControl.mockResolvedValue({
        isWhitelisted: false,
        whitelistOnlyBlocked: false,
        guardLimited: true,
        reason: '当前处于警戒状态，非白名单 IP 每分钟仅允许 1 次请求'
      });
      const mockRequest = {
        nextUrl: { pathname: '/api/random' },
        headers: new Map([['x-forwarded-for', '192.168.1.2']])
      } as any;

      const rateLimitFn = rateLimit({
        windowMs: 60000,
        maxRequests: 60,
        message: '请求过于频繁'
      }, { enableRiskControl: true });

      expect((await rateLimitFn(mockRequest)).allowed).toBe(true);
      const blocked = await rateLimitFn(mockRequest);
      expect(blocked.allowed).toBe(false);
      expect(blocked.reason).toContain('警戒状态');
    });

    it('警戒状态应与自定义限流取更严格者', async () => {
      mockEvaluatePublicRiskControl.mockResolvedValue({
        isWhitelisted: false,
        whitelistOnlyBlocked: false,
        guardLimited: true
      });
      mockGetIPRateLimit.mockResolvedValue({
        ip: '192.168.1.3',
        maxRequests: 10,
        windowMs: 60000,
        maxTotal: null
      } as any);
      const mockRequest = {
        nextUrl: { pathname: '/api/random' },
        headers: new Map([['x-forwarded-for', '192.168.1.3']])
      } as any;
      const rateLimitFn = rateLimit({
        windowMs: 60000,
        maxRequests: 60,
        message: '请求过于频繁'
      }, { enableRiskControl: true });

      expect((await rateLimitFn(mockRequest)).allowed).toBe(true);
      expect((await rateLimitFn(mockRequest)).allowed).toBe(false);
    });

    it('封禁优先级应高于白名单', async () => {
      mockIsIPBanned.mockResolvedValue(true);
      mockEvaluatePublicRiskControl.mockResolvedValue({
        isWhitelisted: true,
        whitelistOnlyBlocked: false,
        guardLimited: false
      });
      const mockRequest = {
        nextUrl: { pathname: '/api/random' },
        headers: new Map([['x-forwarded-for', '192.168.1.4']])
      } as any;

      const result = await rateLimit({
        windowMs: 60000,
        maxRequests: 60,
        message: '请求过于频繁'
      }, { enableRiskControl: true })(mockRequest);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('IP已被封禁');
      expect(mockEvaluatePublicRiskControl).not.toHaveBeenCalled();
    });
  });

  describe('请求验证', () => {
    it('应该验证Content-Type', () => {
      const mockRequest = {
        headers: new Map([['content-type', 'application/json']])
      } as any;

      expect(() => {
        validateContentType(mockRequest, ['application/json']);
      }).not.toThrow();

      expect(() => {
        validateContentType(mockRequest, ['text/plain']);
      }).toThrow(AppError);
    });

    it('应该验证HTTP方法', () => {
      const mockRequest = {
        method: 'POST'
      } as any;

      expect(() => {
        validateMethod(mockRequest, ['POST', 'PUT']);
      }).not.toThrow();

      expect(() => {
        validateMethod(mockRequest, ['GET']);
      }).toThrow(AppError);
    });

    it('应该验证请求大小', () => {
      const mockRequest = {
        headers: new Map([['content-length', '1024']])
      } as any;

      expect(() => {
        validateRequestSize(mockRequest, 2048);
      }).not.toThrow();

      expect(() => {
        validateRequestSize(mockRequest, 512);
      }).toThrow(AppError);
    });
  });

  describe('安全头设置', () => {
    it('应该设置所有必要的安全头', () => {
      const mockResponse = {
        headers: new Map()
      } as any;

      mockResponse.headers.set = jest.fn();

      const result = setSecurityHeaders(mockResponse);

      expect(mockResponse.headers.set).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(mockResponse.headers.set).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(mockResponse.headers.set).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
      expect(mockResponse.headers.set).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
    });
  });

  describe('withSecurity装饰器', () => {
    it('应该应用所有安全检查', async () => {
      const mockHandler = jest.fn().mockResolvedValue({
        text: () => Promise.resolve('{"success": true}'),
        status: 200,
        headers: new Map()
      });

      const secureHandler = withSecurity({
        rateLimit: 'public',
        allowedMethods: ['GET'],
        allowedContentTypes: ['application/json'],
        maxRequestSize: 1024
      })(mockHandler);

      const mockRequest = {
        method: 'GET',
        nextUrl: { pathname: '/api/test' },
        headers: new Map([
          ['x-forwarded-for', '192.168.1.1'],
          ['content-type', 'application/json'],
          ['content-length', '512']
        ])
      } as any;

      const response = await secureHandler(mockRequest);

      expect(mockHandler).toHaveBeenCalled();
      expect(response).toBeDefined();
    });

    it('应该处理验证错误', async () => {
      const mockHandler = jest.fn();

      const secureHandler = withSecurity({
        allowedMethods: ['POST']
      })(mockHandler);

      const mockRequest = {
        method: 'GET',
        nextUrl: { pathname: '/api/test' },
        headers: new Map([['x-forwarded-for', '192.168.1.1']])
      } as any;

      const response = await secureHandler(mockRequest);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(response.status).toBe(400);
    });

    it('白名单模式应阻止非白名单公开请求并返回403', async () => {
      mockEvaluatePublicRiskControl.mockResolvedValue({
        isWhitelisted: false,
        whitelistOnlyBlocked: true,
        guardLimited: false,
        reason: '当前处于白名单模式，仅白名单 IP 可以访问公开 API'
      });
      const mockHandler = jest.fn();
      const secureHandler = withSecurity({
        rateLimit: 'public',
        allowedMethods: ['GET']
      })(mockHandler);
      const mockRequest = {
        method: 'GET',
        nextUrl: { pathname: '/api/random' },
        headers: new Map([['x-forwarded-for', '192.168.1.5']])
      } as any;

      const response = await secureHandler(mockRequest);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(response.status).toBe(403);
    });
  });

  describe('限流统计', () => {
    it('应该返回限流统计信息', async () => {
      const mockRequest = {
        nextUrl: { pathname: '/api/test' },
        headers: new Map([['x-forwarded-for', '192.168.1.1']])
      } as any;

      const rateLimitFn = rateLimit({
        windowMs: 60000,
        maxRequests: 10,
        message: '请求过于频繁'
      });

      await rateLimitFn(mockRequest);

      const stats = getRateLimitStats();
      expect(stats).toHaveLength(1);
      expect(stats[0].count).toBe(1);
      expect(stats[0].key).toContain('192.168.1.1');
    });

    it('应该清除限流存储', async () => {
      const mockRequest = {
        nextUrl: { pathname: '/api/test' },
        headers: new Map([['x-forwarded-for', '192.168.1.1']])
      } as any;

      const rateLimitFn = rateLimit({
        windowMs: 60000,
        maxRequests: 10,
        message: '请求过于频繁'
      });

      await rateLimitFn(mockRequest);
      expect(getRateLimitStats()).toHaveLength(1);

      clearRateLimitStore();
      expect(getRateLimitStats()).toHaveLength(0);
    });
  });

  describe('限流响应创建', () => {
    it('应该创建正确的限流响应', () => {
      const resetTime = Date.now() + 60000;
      const response = createRateLimitResponse('请求过于频繁', resetTime, 5);

      expect(response.status).toBe(429);
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('5');
      expect(response.headers.get('Retry-After')).toBeDefined();
    });

    it('限流 429 响应应包含统一安全响应头', async () => {
      const mockHandler = jest.fn().mockResolvedValue({
        text: () => Promise.resolve('{"success": true}'),
        status: 200,
        headers: new Map()
      });

      const secureHandler = withSecurity({ 
        rateLimit: { windowMs: 1000, maxRequests: 1, message: '请求过于频繁' } 
      })(mockHandler);

      const mockRequest = {
        method: 'GET',
        nextUrl: { pathname: '/api/test' },
        headers: new Map([['x-forwarded-for', '192.168.1.100']])
      } as any;

      // 首次请求应该通过
      await secureHandler(mockRequest);
      
      // 第二次请求应该触发限流
      const response = await secureHandler(mockRequest);

      expect(response.status).toBe(429);
      
      // 验证统一安全响应头
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
      expect(response.headers.get('Permissions-Policy')).toContain('camera=()');
      
      // 验证限流相关头仍然存在
      expect(response.headers.get('X-RateLimit-Remaining')).toBeDefined();
      expect(response.headers.get('Retry-After')).toBeDefined();
    });
  });
});
