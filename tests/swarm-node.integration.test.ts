import type { NextRequest } from 'next/server';
import {
  buildSignedResolveUrl,
  createRemoteOwnerRedirect,
  verifyHandoffParams
} from '@/lib/swarm-node';

const originalEnv = process.env;

function mockRequest(url: string): NextRequest {
  const parsed = new URL(url);
  return {
    nextUrl: parsed,
    url,
    headers: new Headers({
      host: parsed.host,
      'x-forwarded-proto': parsed.protocol.replace(':', ''),
    }),
  } as unknown as NextRequest;
}

describe('swarm node handoff', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NODE_ID = 'node-a';
    process.env.PUBLIC_API_BASE_URL = 'https://a.example.com';
    process.env.NODE_HANDOFF_SECRET = 'handoff-secret';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('生成可验证的跨节点 resolve URL，并保留原始公开参数', () => {
    const request = mockRequest('https://a.example.com/api/random?format=webp&key=secret-key');
    const url = buildSignedResolveUrl(
      'https://b.example.com',
      request,
      { id: 'img_000001' },
      'random-response'
    );

    expect(url.origin).toBe('https://b.example.com');
    expect(url.pathname).toBe('/api/delivery/resolve');
    expect(url.searchParams.get('imageId')).toBe('img_000001');
    expect(url.searchParams.get('mode')).toBe('random-response');
    expect(url.searchParams.get('format')).toBe('webp');
    expect(url.searchParams.get('key')).toBe('secret-key');

    expect(() => verifyHandoffParams(url.searchParams)).not.toThrow();
  });

  it('非所属节点只跳转到所属节点 resolve，不直接交付图床 URL', () => {
    const request = mockRequest('https://a.example.com/api/random');
    const response = createRemoteOwnerRedirect(
      request,
      {
        id: 'img_000002',
        ownerNodeId: 'node-b',
        ownerNodeBaseUrl: 'https://b.example.com',
      },
      'random-redirect'
    );

    expect(response).not.toBeNull();
    expect(response?.status).toBe(302);
    const location = response?.headers.get('location');
    expect(location).toContain('https://b.example.com/api/delivery/resolve');
    expect(location).toContain('imageId=img_000002');
    expect(location).not.toContain('res.cloudinary.com');
  });
});
