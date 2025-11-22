/**
 * /api/admin/images/import-urls 集成测试（后端 API 行为）
 */

// 测试环境固定管理员密码，避免 401
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

// Mock 数据库服务（仅覆盖本测试所需的方法）
jest.mock('@/lib/database', () => ({
  databaseService: {
    getGroup: jest.fn(),
  },
}));

// Mock 安全相关依赖，避免触发真实数据库写入
jest.mock('@/lib/ip-management', () => ({
  isIPBanned: jest.fn().mockResolvedValue(false),
  getIPRateLimit: jest.fn().mockResolvedValue(null),
  checkIPTotalLimit: jest.fn().mockResolvedValue({ exceeded: false, current: 0 }),
  incrementIPTotalAccess: jest.fn(),
}));

jest.mock('@/lib/access-tracking', () => ({
  logAccess: jest.fn().mockResolvedValue(undefined),
}));

// Mock 多图床数据库服务，拦截 saveImageWithStorage
jest.mock('@/lib/database/storage', () => {
  const mockSaveImageWithStorage = jest.fn();
  return {
    __esModule: true,
    StorageDatabaseService: jest.fn().mockImplementation(() => ({
      saveImageWithStorage: mockSaveImageWithStorage,
    })),
    mockSaveImageWithStorage,
  };
});

// Mock 日志，避免测试输出过多噪音
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

// 延迟加载路由，确保上面的 jest.mock 已生效
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { POST } = require('@/app/api/admin/images/import-urls/route');

const mockDatabaseService = databaseService as unknown as {
  getGroup: jest.Mock;
};

// 便捷构造符合 NextRequest 形状的对象
function createMockRequest(
  body: any,
  options: {
    method?: string;
    adminPassword?: string | null;
    contentType?: string;
    url?: string;
  } = {},
): any {
  const url = options.url ?? 'http://localhost:3000/api/admin/images/import-urls';
  const headers = new Headers(options.contentType ? { 'content-type': options.contentType } : {});

  const adminPassword =
    options.adminPassword === null
      ? null
      : options.adminPassword ?? process.env.ADMIN_PASSWORD ?? 'test-password';

  if (adminPassword) {
    headers.set('authorization', `Bearer ${adminPassword}`);
  }

  return {
    method: options.method ?? 'POST',
    headers,
    url,
    nextUrl: new URL(url),
    cookies: {
      get: jest.fn().mockReturnValue(undefined),
    },
    json: jest.fn().mockResolvedValue(body),
  };
}

// 从 jest.mock 里拿到 mockSaveImageWithStorage 实例
const { mockSaveImageWithStorage } = jest.requireMock('@/lib/database/storage');

describe('/api/admin/images/import-urls API 集成测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabaseService.getGroup.mockReset();
    mockSaveImageWithStorage.mockReset();

    // 默认：分组存在，写库成功
    mockDatabaseService.getGroup.mockResolvedValue({ id: 'grp_1', name: '测试分组' });
    mockSaveImageWithStorage.mockResolvedValue({ id: 'img_1' });
  });

  it('TXT 模式：应成功解析多行 URL 并写入数据库', async () => {
    const body = {
      provider: 'custom',
      mode: 'txt',
      groupId: 'grp_1',
      content: [
        'https://example.com/a.jpg',
        '# 注释行',
        '',
        ' https://example.com/b.png  ',
      ].join('\n'),
    };

    const request = createMockRequest(body, { contentType: 'application/json' });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(json.data.total).toBe(2);
    expect(json.data.success).toBe(2);
    expect(json.data.failed).toBe(0);
    expect(mockSaveImageWithStorage).toHaveBeenCalledTimes(2);
    expect(mockSaveImageWithStorage).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com/a.jpg',
        groupId: 'grp_1',
        primaryProvider: 'custom',
      }),
    );
  });

  it('JSON 模式：支持字符串数组形式的 URL 列表', async () => {
    const body = {
      provider: 'custom',
      mode: 'json',
      content: JSON.stringify([
        'https://example.com/a.jpg',
        'https://example.com/b.png',
      ]),
    };

    const request = createMockRequest(body, { contentType: 'application/json' });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(json.data.total).toBe(2);
    expect(json.data.success).toBe(2);
    expect(json.data.failed).toBe(0);
    expect(mockSaveImageWithStorage).toHaveBeenCalledTimes(2);
  });

  it('JSON 模式：支持对象数组 + 元数据（title/description/tags）', async () => {
    const body = {
      provider: 'custom',
      mode: 'json',
      groupId: 'grp_1',
      content: JSON.stringify([
        {
          url: 'https://example.com/a.jpg',
          title: 'A',
          description: 'desc',
          tags: ['tag1', 'tag2'],
          width: 800,
          height: 600,
        },
      ]),
    };

    const request = createMockRequest(body, { contentType: 'application/json' });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(json.data.total).toBe(1);
    expect(json.data.success).toBe(1);
    expect(json.data.failed).toBe(0);
    expect(mockSaveImageWithStorage).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com/a.jpg',
        title: 'A',
        description: 'desc',
        tags: ['tag1', 'tag2'],
        groupId: 'grp_1',
        width: 800,
        height: 600,
      }),
    );
  });

  it('JSON 模式携带 width/height 时的附加字段应传入存储层', async () => {
    const body = {
      provider: 'custom',
      mode: 'json',
      groupId: 'grp_1',
      content: JSON.stringify([
        {
          url: 'https://example.com/b.jpg',
          width: 600,
          height: 1200,
        },
      ]),
    };

    const request = createMockRequest(body, { contentType: 'application/json' });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(mockSaveImageWithStorage).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com/b.jpg',
        width: 600,
        height: 1200,
      }),
    );
  });

  it('JSON 模式：支持 { items: [...] } 包裹格式', async () => {
    const body = {
      provider: 'custom',
      mode: 'json',
      content: JSON.stringify({
        items: [
          { url: 'https://example.com/a.jpg' },
          { url: 'https://example.com/b.png' },
        ],
      }),
    };

    const request = createMockRequest(body, { contentType: 'application/json' });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(json.data.total).toBe(2);
    expect(json.data.success).toBe(2);
    expect(json.data.failed).toBe(0);
  });

  it('items 模式：直接接受已结构化的 URL 项列表', async () => {
    const body = {
      provider: 'custom',
      mode: 'items',
      items: [
        { url: 'https://example.com/a.jpg' },
        { url: 'https://example.com/b.png', title: 'B' },
      ],
    };

    const request = createMockRequest(body, { contentType: 'application/json' });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(json.data.total).toBe(2);
    expect(json.data.success).toBe(2);
    expect(json.data.failed).toBe(0);
    expect(mockSaveImageWithStorage).toHaveBeenCalledTimes(2);
  });

  it('provider 非 custom 时返回 400 验证错误', async () => {
    const body = {
      provider: 'cloudinary',
      mode: 'txt',
      content: 'https://example.com/a.jpg',
    } as any;

    const request = createMockRequest(body, { contentType: 'application/json' });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error.type).toBe('VALIDATION_ERROR');
  });

  it('分组不存在时返回 400 验证错误', async () => {
    mockDatabaseService.getGroup.mockResolvedValueOnce(null);

    const body = {
      provider: 'custom',
      mode: 'txt',
      groupId: 'non-existent',
      content: 'https://example.com/a.jpg',
    };

    const request = createMockRequest(body, { contentType: 'application/json' });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error.type).toBe('VALIDATION_ERROR');
  });

  it('请求体结构不满足 Zod 模式时，返回 400 验证错误', async () => {
    const body = {
      provider: 'custom',
      // 缺少 mode 字段，会触发 ZodError
      content: 'https://example.com/a.jpg',
    } as any;

    const request = createMockRequest(body, { contentType: 'application/json' });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error.type).toBe('VALIDATION_ERROR');
  });

  it('JSON 解析失败时返回 400 验证错误', async () => {
    const body = {
      provider: 'custom',
      mode: 'json',
      content: '{ invalid json',
    };

    const request = createMockRequest(body, { contentType: 'application/json' });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error.type).toBe('VALIDATION_ERROR');
  });

  it('部分 URL 校验失败时，成功/失败条数按条目级别统计', async () => {
    const body = {
      provider: 'custom',
      mode: 'txt',
      content: ['https://example.com/a.jpg', 'not-a-url'].join('\n'),
    };

    const request = createMockRequest(body, { contentType: 'application/json' });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(json.data.total).toBe(2);
    expect(json.data.success).toBe(1);
    expect(json.data.failed).toBe(1);
    expect(json.data.errors).toHaveLength(1);
    expect(json.data.errors[0].index).toBe(1);
  });

  it('当部分 saveImageWithStorage 抛错时应记录为失败而不是整体中断', async () => {
    mockSaveImageWithStorage
      .mockResolvedValueOnce({ id: 'img_1' })
      .mockRejectedValueOnce(new Error('DB error'));

    const body = {
      provider: 'custom',
      mode: 'txt',
      content: ['https://example.com/a.jpg', 'https://example.com/b.png'].join('\n'),
    };

    const request = createMockRequest(body, { contentType: 'application/json' });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(json.data.total).toBe(2);
    expect(json.data.success).toBe(1);
    expect(json.data.failed).toBe(1);
    expect(json.data.errors).toHaveLength(1);
  });

  it('缺少管理员认证时返回 401', async () => {
    const body = {
      provider: 'custom',
      mode: 'txt',
      content: 'https://example.com/a.jpg',
    };

    const request = createMockRequest(body, {
      contentType: 'application/json',
      adminPassword: null,
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error.type).toBe('UNAUTHORIZED');
  });

  it('使用非 POST 方法时返回 400', async () => {
    const body = {
      provider: 'custom',
      mode: 'txt',
      content: 'https://example.com/a.jpg',
    };

    const request = createMockRequest(body, {
      contentType: 'application/json',
      method: 'GET',
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error.type).toBe('VALIDATION_ERROR');
  });

  it('超过单次导入数量限制（500条）时返回 400', async () => {
    const manyItems = Array(501).fill({ url: 'https://example.com/img.jpg' });
    const body = {
      provider: 'custom',
      mode: 'items',
      items: manyItems
    };

    const request = createMockRequest(body, { contentType: 'application/json' });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error.type).toBe('VALIDATION_ERROR');
    expect(json.error.message).toContain('单次导入数量不能超过 500 条');
  });

  it('txt 模式超过数量限制时返回 400', async () => {
    const lines = Array(501).fill('https://example.com/img.jpg').join('\n');
    const body = {
      provider: 'custom',
      mode: 'txt',
      content: lines
    };

    const request = createMockRequest(body, { contentType: 'application/json' });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error.type).toBe('VALIDATION_ERROR');
    expect(json.error.message).toContain('单次导入数量不能超过 500 条');
  });
});
