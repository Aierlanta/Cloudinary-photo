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
