import type { NextRequest } from 'next/server';

jest.mock('next/server', () => {
  const G: any = typeof globalThis !== 'undefined' ? globalThis : global;

  class SimpleHeaders {
    private map = new Map<string, string>();
    constructor(init?: Record<string, string>) {
      if (init) {
        for (const key of Object.keys(init)) {
          this.map.set(key.toLowerCase(), String((init as any)[key]));
        }
      }
    }
    get(name: string) {
      return this.map.get(String(name).toLowerCase()) ?? null;
    }
    set(name: string, value: string) {
      this.map.set(String(name).toLowerCase(), String(value));
    }
  }

  const HeadersCtor: any = G.Headers || SimpleHeaders;

  class SimpleResponse {
    status: number;
    headers: any;
    private body: any;
    constructor(body?: any, init?: any) {
      this.status = init?.status ?? 200;
      this.headers = new HeadersCtor(init?.headers);
      this.body = body;
    }
    async arrayBuffer() {
      if (this.body instanceof Uint8Array) {
        return this.body.buffer.slice(this.body.byteOffset, this.body.byteOffset + this.body.byteLength);
      }
      if (typeof Buffer !== 'undefined' && Buffer.isBuffer(this.body)) {
        return this.body.buffer.slice(this.body.byteOffset, this.body.byteOffset + this.body.byteLength);
      }
      return new ArrayBuffer(0);
    }
  }

  class NextResponse extends SimpleResponse {}
  class NextRequest {}

  return { NextResponse, NextRequest };
});

jest.mock('@/lib/database', () => ({
  databaseService: {
    getAPIConfig: jest.fn(),
    initialize: jest.fn(),
    getImage: jest.fn()
  }
}));

jest.mock('@/lib/cloudinary', () => {
  const instance = {
    downloadImage: jest.fn()
  };
  return {
    CloudinaryService: {
      getInstance: () => instance
    }
  };
});

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    apiResponse: jest.fn()
  }
}));

jest.mock('@/lib/telegram-proxy', () => ({
  buildFetchInitFor: jest.fn().mockReturnValue({ cache: 'no-store' })
}));

import { serveRandomResponse } from '../service';
import { databaseService } from '@/lib/database';
import { CloudinaryService } from '@/lib/cloudinary';

const mockDatabaseService = databaseService as unknown as {
  getAPIConfig: jest.Mock;
  initialize: jest.Mock;
  getImage: jest.Mock;
};

const mockCloudinaryService = CloudinaryService.getInstance() as unknown as {
  downloadImage: jest.Mock;
};

function createMockRequest(url: string): NextRequest {
  return {
    url,
    headers: new Headers(),
    nextUrl: new URL(url)
  } as unknown as NextRequest;
}

describe('serveRandomResponse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabaseService.getAPIConfig.mockResolvedValue({
      id: 'default',
      isEnabled: true,
      defaultScope: 'all',
      defaultGroups: [],
      allowedParameters: [],
      responseParams: {
        format: {
          enabled: true,
          allowedValues: ['jpeg', 'webp']
        },
        quality: {
          enabled: true
        },
        defaultWebpDelivery: {
          random: false,
          response: false
        }
      },
      enableDirectResponse: false,
      apiKeyEnabled: false,
      updatedAt: new Date()
    });
    mockDatabaseService.getImage.mockResolvedValue({
      id: 'img_000001',
      publicId: 'cloudinary_public_id',
      url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg'
    });
    mockCloudinaryService.downloadImage.mockResolvedValue(Buffer.from('native-webp'));
  });

  it('在 random 自动处理模式下不依赖 enableDirectResponse', async () => {
    const request = createMockRequest('http://localhost:3000/api/random?format=webp');
    const response = await serveRandomResponse(request, {
      imageId: 'img_000001',
      requireDirectResponseEnabled: false,
      requestPath: '/api/random'
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/webp');
    expect(mockCloudinaryService.downloadImage).toHaveBeenCalledWith(
      'cloudinary_public_id',
      [{ fetch_format: 'webp' }]
    );
  });

  it('format 被禁用时应返回 400', async () => {
    mockDatabaseService.getAPIConfig.mockResolvedValue({
      id: 'default',
      isEnabled: true,
      defaultScope: 'all',
      defaultGroups: [],
      allowedParameters: [],
      responseParams: {
        format: {
          enabled: false,
          allowedValues: ['jpeg', 'webp']
        },
        quality: {
          enabled: true
        },
        defaultWebpDelivery: {
          random: false,
          response: false
        }
      },
      enableDirectResponse: true,
      apiKeyEnabled: false,
      updatedAt: new Date()
    });

    const request = createMockRequest('http://localhost:3000/api/random/response?format=webp');
    await expect(serveRandomResponse(request, {
      imageId: 'img_000001'
    })).rejects.toMatchObject({
      statusCode: 400
    });
  });

  it('response 默认 WebP 传输开启时，response 端点即使不传 format 也应返回 webp', async () => {
    mockDatabaseService.getAPIConfig.mockResolvedValue({
      id: 'default',
      isEnabled: true,
      defaultScope: 'all',
      defaultGroups: [],
      allowedParameters: [],
      responseParams: {
        format: {
          enabled: false,
          allowedValues: ['jpeg', 'webp']
        },
        quality: {
          enabled: false
        },
        defaultWebpDelivery: {
          random: false,
          response: true
        }
      },
      enableDirectResponse: false,
      apiKeyEnabled: false,
      updatedAt: new Date()
    });

    const request = createMockRequest('http://localhost:3000/api/response');
    const response = await serveRandomResponse(request, {
      imageId: 'img_000001',
      requireDirectResponseEnabled: false,
      requestPath: '/api/response'
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/webp');
    expect(mockCloudinaryService.downloadImage).toHaveBeenCalledWith(
      'cloudinary_public_id',
      [{ fetch_format: 'webp' }]
    );
  });
});
