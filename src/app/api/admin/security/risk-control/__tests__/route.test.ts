jest.mock('next/server', () => {
  const G: any = typeof globalThis !== 'undefined' ? globalThis : global;
  const BaseResponse: any = G.Response || class {
    status: number;
    headers: any;
    private body: any;
    constructor(body?: any, init?: any) {
      this.status = init?.status ?? 200;
      this.headers = new Map(Object.entries(init?.headers || {}));
      this.body = body;
    }
    async json() {
      return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
    }
  };
  return {
    NextRequest: class {},
    NextResponse: {
      json: (data: any, init?: any) => new BaseResponse(JSON.stringify(data), {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) }
      })
    }
  };
});

export {};

jest.mock('@/lib/auth', () => ({
  withAdminAuth: (handler: any) => handler
}));

jest.mock('@/lib/security', () => ({
  withSecurity: () => (handler: any) => handler
}));

jest.mock('@/lib/error-handler', () => ({
  withErrorHandler: (handler: any) => handler
}));

jest.mock('@/lib/risk-control', () => ({
  getRiskControlSnapshot: jest.fn(),
  updateSecurityConfig: jest.fn(),
  createIPWhitelistEntry: jest.fn(),
  updateIPWhitelistEntry: jest.fn(),
  deleteIPWhitelistEntry: jest.fn()
}));

const {
  getRiskControlSnapshot,
  updateSecurityConfig,
  createIPWhitelistEntry,
  updateIPWhitelistEntry,
  deleteIPWhitelistEntry
} = require('@/lib/risk-control');
const { GET, PUT, POST, PATCH, DELETE } = require('../route');

function createRequest(body?: any) {
  return {
    json: jest.fn().mockResolvedValue(body ?? {}),
    method: 'GET',
    nextUrl: { pathname: '/api/admin/security/risk-control', search: '' },
    headers: new Map()
  } as any;
}

describe('/api/admin/security/risk-control', () => {
  const config = {
    id: 'default',
    guardEnabled: false,
    guardAutoEnabled: false,
    guardTriggerWindowMinutes: 5,
    guardTriggerUniqueIpThreshold: 50,
    whitelistOnlyEnabled: false,
    guardTriggeredAt: null,
    guardTriggeredReason: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  const entry = {
    id: 'wl_1',
    cidr: '203.0.113.0/24',
    note: 'office',
    isEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getRiskControlSnapshot.mockResolvedValue({ config, whitelist: [entry] });
    updateSecurityConfig.mockResolvedValue(config);
    createIPWhitelistEntry.mockResolvedValue(entry);
    updateIPWhitelistEntry.mockResolvedValue(entry);
    deleteIPWhitelistEntry.mockResolvedValue(undefined);
  });

  it('GET 应返回风控配置和白名单', async () => {
    const response = await GET(createRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.config).toEqual(expect.objectContaining({
      id: 'default',
      guardEnabled: false
    }));
    expect(json.data.whitelist[0]).toEqual(expect.objectContaining({
      id: 'wl_1',
      cidr: '203.0.113.0/24'
    }));
  });

  it('PUT 应更新风控配置', async () => {
    const response = await PUT(createRequest({
      guardEnabled: true,
      guardAutoEnabled: true,
      guardTriggerWindowMinutes: 10,
      guardTriggerUniqueIpThreshold: 20,
      whitelistOnlyEnabled: false
    }));

    expect(response.status).toBe(200);
    expect(updateSecurityConfig).toHaveBeenCalledWith(expect.objectContaining({
      guardEnabled: true,
      guardTriggerWindowMinutes: 10
    }));
  });

  it('POST 应新增白名单条目', async () => {
    const response = await POST(createRequest({
      cidr: '203.0.113.0/24',
      note: 'office',
      isEnabled: true
    }));

    expect(response.status).toBe(201);
    expect(createIPWhitelistEntry).toHaveBeenCalledWith({
      cidr: '203.0.113.0/24',
      note: 'office',
      isEnabled: true
    });
  });

  it('PATCH 应更新白名单条目', async () => {
    const response = await PATCH(createRequest({
      id: 'wl_1',
      isEnabled: false
    }));

    expect(response.status).toBe(200);
    expect(updateIPWhitelistEntry).toHaveBeenCalledWith({
      id: 'wl_1',
      isEnabled: false
    });
  });

  it('DELETE 应删除白名单条目', async () => {
    const response = await DELETE(createRequest({ id: 'wl_1' }));

    expect(response.status).toBe(200);
    expect(deleteIPWhitelistEntry).toHaveBeenCalledWith('wl_1');
  });
});
