jest.mock('next/server', () => {
  class NextRequest {}
  class NextResponse {}
  return { NextRequest, NextResponse };
});

describe('swarm-node offline filtering', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  function loadModule() {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('../swarm-node') as typeof import('../swarm-node');
  }

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('没有远端节点时不返回离线 owner 节点', async () => {
    process.env.NODE_ID = 'local';
    process.env.PUBLIC_API_BASE_URL = 'http://localhost:3000';
    delete process.env.NEXT_PUBLIC_BACKEND_NODES;
    global.fetch = jest.fn() as unknown as typeof fetch;

    const { getExplicitlyOfflineNodeIds } = loadModule();
    await expect(getExplicitlyOfflineNodeIds()).resolves.toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('会排除明确探测为 offline 的远端节点', async () => {
    process.env.NODE_ID = 'local';
    process.env.PUBLIC_API_BASE_URL = 'http://localhost:3000';
    process.env.NEXT_PUBLIC_BACKEND_NODES = 'node-2|Node 2|http://node2.example.com';
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: jest.fn()
    }) as unknown as typeof fetch;

    const { getExplicitlyOfflineNodeIds } = loadModule();
    await expect(getExplicitlyOfflineNodeIds()).resolves.toEqual(['node-2']);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://node2.example.com/api/status?mode=summary',
      expect.objectContaining({
        cache: 'no-store',
        redirect: 'follow'
      })
    );
  });

  it('degraded 节点不会被当作 offline 排除', async () => {
    process.env.NODE_ID = 'local';
    process.env.PUBLIC_API_BASE_URL = 'http://localhost:3000';
    process.env.NEXT_PUBLIC_BACKEND_NODES = 'node-2|Node 2|http://node2.example.com';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: { status: 'degraded' }
      })
    }) as unknown as typeof fetch;

    const { getExplicitlyOfflineNodeIds } = loadModule();
    await expect(getExplicitlyOfflineNodeIds()).resolves.toEqual([]);
  });

  it('探测超时会降级为 unknown，不会误排除慢节点', async () => {
    process.env.NODE_ID = 'local';
    process.env.PUBLIC_API_BASE_URL = 'http://localhost:3000';
    process.env.NEXT_PUBLIC_BACKEND_NODES = 'node-2|Node 2|http://node2.example.com';
    global.fetch = jest.fn().mockRejectedValue(Object.assign(new Error('timeout'), {
      name: 'AbortError'
    })) as unknown as typeof fetch;

    const { getExplicitlyOfflineNodeIds } = loadModule();
    await expect(getExplicitlyOfflineNodeIds()).resolves.toEqual([]);
  });
});
