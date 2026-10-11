/**
 * @jest-environment node
 */
import {
  buildTelegramProxyPath,
  fetchTelegramImage,
  parseTelegramProxyUrl
} from '@/lib/telegram-image-fetch';

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('telegram-image-fetch', () => {
  const originalFetch = global.fetch;
  const originalTokens = process.env.TELEGRAM_BOT_TOKENS;

  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKENS = '111:aaa,222:bbb';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.TELEGRAM_BOT_TOKENS = originalTokens;
  });

  it('builds a relative proxy path and parses relative/absolute proxy urls', () => {
    const path = buildTelegramProxyPath({ fileId: 'FID', botId: '222', filePath: 'documents/a.png' });
    expect(path).toBe('/api/telegram/image?file_id=FID&bot_id=222&file_path=documents%2Fa.png');

    expect(parseTelegramProxyUrl(path)).toEqual({ fileId: 'FID', botId: '222', filePath: 'documents/a.png' });
    // 线上 request.url 会变成 https://localhost:3000，这类绝对地址也要识别为站内代理
    expect(parseTelegramProxyUrl(`https://localhost:3000${path}`)).toEqual({
      fileId: 'FID',
      botId: '222',
      filePath: 'documents/a.png'
    });
    expect(parseTelegramProxyUrl('https://res.cloudinary.com/demo/image/upload/a.png')).toBeNull();
    expect(parseTelegramProxyUrl('/api/telegram/image')).toBeNull();
  });

  it('refreshes an expired file_path via file_id', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/bot111:aaa/getMe')) return jsonResponse({ ok: true, result: { id: 111 } });
      if (url.endsWith('/bot222:bbb/getMe')) return jsonResponse({ ok: true, result: { id: 222 } });
      if (url.includes('/bot222:bbb/getFile')) {
        return jsonResponse({ ok: true, result: { file_id: 'FID-REFRESH', file_unique_id: 'u', file_size: 12, file_path: 'documents/new.png' } });
      }
      if (url.includes('/getFile')) return jsonResponse({ ok: false, description: 'Bad Request: wrong file_id' }, 400);
      if (url.endsWith('/file/bot222:bbb/documents/new.png')) {
        return new Response(PNG_BYTES, { status: 200, headers: { 'content-type': 'application/octet-stream' } });
      }
      return new Response('Not Found', { status: 404 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchTelegramImage({ fileId: 'FID-REFRESH', botId: '222', filePath: 'documents/old.png' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.filePath).toBe('documents/new.png');
    expect(result.contentType).toBe('image/png');
    expect(new Uint8Array(result.buffer)).toEqual(PNG_BYTES);
  });

  it('returns 410 when only an expired file_path is given', async () => {
    global.fetch = jest.fn(async () => new Response('Not Found', { status: 404 })) as unknown as typeof fetch;

    const result = await fetchTelegramImage({ filePath: 'documents/expired.png' });

    expect(result).toEqual(expect.objectContaining({ ok: false, status: 410 }));
    if (result.ok) return;
    expect(result.body.error).toBe('FILE_PATH_EXPIRED');
  });
});
