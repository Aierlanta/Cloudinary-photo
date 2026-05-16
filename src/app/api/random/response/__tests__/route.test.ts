import type { NextRequest } from 'next/server';

jest.mock('next/server', () => {
  class NextRequest {}
  return { NextRequest };
});

jest.mock('@/lib/security', () => ({
  withSecurity: () => (handler: any) => handler
}));

jest.mock('@/lib/error-handler', () => ({
  withErrorHandler: (handler: any) => handler
}));

jest.mock('../service', () => ({
  serveRandomResponse: jest.fn()
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GET } = require('../route');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { serveRandomResponse } = require('../service');

function createMockRequest(url: string): NextRequest {
  return {
    url,
    headers: new Headers(),
    nextUrl: new URL(url)
  } as unknown as NextRequest;
}

describe('/api/random/response route', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (serveRandomResponse as jest.Mock).mockResolvedValue(
      { status: 200 }
    );
  });

  it('应绕过 direct response 开关，作为 random response helper 使用', async () => {
    const request = createMockRequest('http://localhost:3000/api/random/response?imageId=img_000001');

    await GET(request);

    expect(serveRandomResponse).toHaveBeenCalledWith(request, {
      requireDirectResponseEnabled: false
    });
  });
});
