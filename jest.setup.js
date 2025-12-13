require('@testing-library/jest-dom');

// Mock environment variables for testing
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY = 'test-key';
process.env.CLOUDINARY_API_SECRET = 'test-secret';
process.env.ADMIN_PASSWORD = 'test-password';
process.env.NODE_ENV = 'test';

// Polyfill Request/Response/Headers for Next.js in Jest (jsdom)
if (typeof globalThis.Request === 'undefined' && typeof window !== 'undefined') {
    // @ts-ignore
    globalThis.Request = window.Request;
    // @ts-ignore
    globalThis.Response = window.Response;
    // @ts-ignore
    globalThis.Headers = window.Headers;
}

// Polyfill Web Streams (ReadableStream) for route tests running in jsdom
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const web = require('stream/web');
  if (typeof globalThis.ReadableStream === 'undefined' && web.ReadableStream) {
    globalThis.ReadableStream = web.ReadableStream;
  }
  if (typeof globalThis.WritableStream === 'undefined' && web.WritableStream) {
    globalThis.WritableStream = web.WritableStream;
  }
  if (typeof globalThis.TransformStream === 'undefined' && web.TransformStream) {
    globalThis.TransformStream = web.TransformStream;
  }
} catch {
  // ignore
}
