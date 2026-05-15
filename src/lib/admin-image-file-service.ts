import { NextRequest, NextResponse } from 'next/server';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { databaseService } from '@/lib/database';
import { AppError, ErrorType } from '@/types/errors';
import { convertTgStateToProxyUrl, getFileExtensionFromUrl } from '@/lib/image-utils';
import { buildFetchInitFor } from '@/lib/telegram-proxy';
import { createRemoteOwnerRedirect } from '@/lib/swarm-node';

const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;
const MIN_SNIFF_BYTES = 32;

const INLINE_SAFE_IMAGE_MIMES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/bmp',
  'image/x-icon',
  'image/tiff',
]);

function stripHttpHeaderControlChars(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, '');
}

function escapeQuotedString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function encodeRFC5987ValueChars(value: string): string {
  return encodeURIComponent(value).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function buildContentDisposition(disposition: 'inline' | 'attachment', filenameWithExt: string): string {
  const cleaned = stripHttpHeaderControlChars(filenameWithExt);
  const safe = cleaned.length > 0 ? cleaned : 'image';
  const asciiFallback = safe.replace(/[^\x20-\x7E]/g, '_');
  return `${disposition}; filename="${escapeQuotedString(asciiFallback)}"; filename*=UTF-8''${encodeRFC5987ValueChars(safe)}`;
}

function sanitizeFilenameBase(value: string): string {
  return stripHttpHeaderControlChars(value)
    .replace(/[\\/]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function sniffImageContentTypeFromBytes(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) return 'image/png';
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) return 'image/gif';
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) return 'image/webp';
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70 &&
    bytes[8] === 0x61 &&
    bytes[9] === 0x76 &&
    bytes[10] === 0x69 &&
    (bytes[11] === 0x66 || bytes[11] === 0x73)
  ) return 'image/avif';
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return 'image/bmp';
  if (bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00) return 'image/x-icon';
  if (
    bytes.length >= 4 &&
    ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
      (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a))
  ) return 'image/tiff';
  return null;
}

function normalizeContentType(raw: string | null, headBytes: Uint8Array): string {
  const candidate = (raw || 'application/octet-stream').split(';')[0].trim().toLowerCase();
  if (candidate.startsWith('image/')) return candidate;
  const sniffed = sniffImageContentTypeFromBytes(headBytes);
  return sniffed || 'application/octet-stream';
}

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/avif': 'avif',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'image/x-icon': 'ico',
    'image/tiff': 'tiff',
  };
  return map[mime] || 'bin';
}

function getMaxBytes(): number {
  const raw = (process.env.ADMIN_IMAGE_FILE_MAX_BYTES || '').trim();
  if (!raw) return DEFAULT_MAX_BYTES;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_BYTES;
  return Math.min(Math.max(parsed, 1 * 1024 * 1024), 500 * 1024 * 1024);
}

function getAllowedHostPatterns(): string[] {
  const patterns: string[] = [];
  const addHostFromUrl = (urlStr?: string) => {
    if (!urlStr) return;
    try {
      patterns.push(new URL(urlStr).hostname.toLowerCase());
    } catch {
      // ignore invalid configured URLs
    }
  };

  addHostFromUrl(process.env.TGSTATE_BASE_URL);
  addHostFromUrl(process.env.TGSTATE_PROXY_URL);
  patterns.push('res.cloudinary.com');
  for (let i = 1; i <= 5; i++) patterns.push(`res-${i}.cloudinary.com`);
  patterns.push(
    ...(process.env.CLOUDINARY_ALLOWED_HOSTS || '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean),
    ...(process.env.ADMIN_IMAGE_FILE_ALLOWED_HOSTS || process.env.IMAGE_PROXY_ALLOWED_HOSTS || '')
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean)
  );
  return Array.from(new Set(patterns));
}

function hostnameMatchesPatterns(hostname: string, patterns: string[]): boolean {
  const host = hostname.toLowerCase();
  for (const raw of patterns) {
    const p = raw.toLowerCase();
    if (!p) continue;
    if (p === host) return true;
    const suffix = p.startsWith('*.') ? p.slice(1) : p.startsWith('.') ? p : '';
    if (suffix && host.endsWith(suffix)) return true;
  }
  return false;
}

function ipv4ToInt(ip: string): number | null {
  const nums = ip.split('.').map((p) => Number.parseInt(p, 10));
  if (nums.length !== 4 || nums.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return null;
  return (((nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3]) >>> 0);
}

function inRangeInt(value: number, start: number, end: number): boolean {
  return value >= start && value <= end;
}

function isPrivateIPv4(ip: string): boolean {
  const v = ipv4ToInt(ip);
  if (v === null) return true;
  return (
    inRangeInt(v, ipv4ToInt('0.0.0.0')!, ipv4ToInt('0.255.255.255')!) ||
    inRangeInt(v, ipv4ToInt('10.0.0.0')!, ipv4ToInt('10.255.255.255')!) ||
    inRangeInt(v, ipv4ToInt('127.0.0.0')!, ipv4ToInt('127.255.255.255')!) ||
    inRangeInt(v, ipv4ToInt('169.254.0.0')!, ipv4ToInt('169.254.255.255')!) ||
    inRangeInt(v, ipv4ToInt('172.16.0.0')!, ipv4ToInt('172.31.255.255')!) ||
    inRangeInt(v, ipv4ToInt('192.168.0.0')!, ipv4ToInt('192.168.255.255')!) ||
    inRangeInt(v, ipv4ToInt('100.64.0.0')!, ipv4ToInt('100.127.255.255')!) ||
    inRangeInt(v, ipv4ToInt('224.0.0.0')!, ipv4ToInt('255.255.255.255')!)
  );
}

function parseIPv6ToBytes(ip: string): Uint8Array | null {
  const input = ip.toLowerCase();
  const hasV4 = input.includes('.');
  const v4Part = hasV4 ? input.split(':').pop() || '' : '';
  const [headStr, tailStr = ''] = input.split('::');
  if (input.includes('::') && input.split('::').length > 2) return null;

  const headParts = headStr ? headStr.split(':').filter(Boolean) : [];
  let tailParts = tailStr ? tailStr.split(':').filter(Boolean) : [];
  const groups: number[] = [];
  for (const p of headParts) {
    const n = Number.parseInt(p, 16);
    if (!Number.isFinite(n) || n < 0 || n > 0xffff) return null;
    groups.push(n);
  }

  let v4Groups: number[] = [];
  if (hasV4) {
    if (tailParts.length > 0 && tailParts[tailParts.length - 1].includes('.')) tailParts = tailParts.slice(0, -1);
    const nums = v4Part.split('.').map((p) => Number.parseInt(p, 10));
    if (nums.length !== 4 || nums.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return null;
    v4Groups = [((nums[0] << 8) | nums[1]) & 0xffff, ((nums[2] << 8) | nums[3]) & 0xffff];
  }

  const tailGroupNums: number[] = [];
  for (const p of tailParts) {
    const n = Number.parseInt(p, 16);
    if (!Number.isFinite(n) || n < 0 || n > 0xffff) return null;
    tailGroupNums.push(n);
  }

  const totalGroups = groups.length + tailGroupNums.length + v4Groups.length;
  if (totalGroups > 8) return null;
  const fullGroups = [
    ...groups,
    ...Array.from({ length: input.includes('::') ? (8 - totalGroups) : 0 }, () => 0),
    ...tailGroupNums,
    ...v4Groups,
  ];
  if (fullGroups.length !== 8) return null;

  const bytes = new Uint8Array(16);
  for (let i = 0; i < 8; i++) {
    bytes[i * 2] = (fullGroups[i] >> 8) & 0xff;
    bytes[i * 2 + 1] = fullGroups[i] & 0xff;
  }
  return bytes;
}

function isPrivateIPv6(ip: string): boolean {
  const bytes = parseIPv6ToBytes(ip);
  if (!bytes) return true;
  if (bytes.every((b) => b === 0)) return true;
  if (bytes.slice(0, 15).every((b) => b === 0) && bytes[15] === 1) return true;
  if ((bytes[0] & 0xfe) === 0xfc) return true;
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return true;
  const isV4Mapped = bytes.slice(0, 10).every((b) => b === 0) && bytes[10] === 0xff && bytes[11] === 0xff;
  if (isV4Mapped) return isPrivateIPv4(`${bytes[12]}.${bytes[13]}.${bytes[14]}.${bytes[15]}`);
  return false;
}

function isPrivateIpAddress(ip: string, family: number): boolean {
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
  return true;
}

async function assertSafeOutboundUrl(url: URL, allowedHostPatterns: string[]): Promise<void> {
  const protocol = url.protocol.toLowerCase();
  const host = url.hostname.toLowerCase();
  const hostAllowed = hostnameMatchesPatterns(host, allowedHostPatterns);

  if (protocol !== 'https:' && !(protocol === 'http:' && hostAllowed)) {
    throw new AppError(ErrorType.VALIDATION_ERROR, '不允许的URL协议', 400, { protocol });
  }
  if (url.username || url.password) {
    throw new AppError(ErrorType.VALIDATION_ERROR, 'URL 不允许包含用户名或密码', 400);
  }
  if ((host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) && !hostAllowed) {
    throw new AppError(ErrorType.VALIDATION_ERROR, '不允许的主机名', 400, { host });
  }

  const hostIpFamily = isIP(host);
  if (hostIpFamily) {
    if (isPrivateIpAddress(host, hostIpFamily) && !hostAllowed) {
      throw new AppError(ErrorType.VALIDATION_ERROR, '不允许访问私网/本机地址', 400, { host });
    }
    return;
  }

  let resolved: Array<{ address: string; family: number }>;
  try {
    resolved = (await lookup(host, { all: true, verbatim: true })) as Array<{ address: string; family: number }>;
  } catch (e) {
    const err = e as { code?: string };
    throw new AppError(ErrorType.EXTERNAL_SERVICE_ERROR, 'DNS 解析失败', 502, { host, code: err.code });
  }
  if (!resolved || resolved.length === 0) {
    throw new AppError(ErrorType.VALIDATION_ERROR, '无法解析目标主机', 400, { host });
  }
  if (resolved.some((r) => isPrivateIpAddress(r.address, r.family)) && !hostAllowed) {
    throw new AppError(ErrorType.VALIDATION_ERROR, '目标主机解析到私网/保留地址，已拒绝', 400, {
      host,
      addresses: resolved.map((r) => `${r.address}/${r.family}`),
    });
  }
}

async function fetchWithRedirectGuard(initialUrl: URL, init: RequestInit, allowedHostPatterns: string[], maxRedirects = 3): Promise<Response> {
  let current = initialUrl;
  for (let i = 0; i <= maxRedirects; i++) {
    await assertSafeOutboundUrl(current, allowedHostPatterns);
    const resp = await fetch(
      current.toString(),
      buildFetchInitFor(current.toString(), { ...init, redirect: 'manual' } as RequestInit)
    );

    if ([301, 302, 303, 307, 308].includes(resp.status)) {
      try {
        await resp.body?.cancel();
      } catch {
        // ignore
      }
      const location = resp.headers.get('location');
      if (!location) {
        throw new AppError(ErrorType.EXTERNAL_SERVICE_ERROR, '上游重定向缺少 Location', 502, { status: resp.status });
      }
      current = new URL(location, current);
      continue;
    }
    return resp;
  }
  throw new AppError(ErrorType.EXTERNAL_SERVICE_ERROR, '上游重定向次数过多', 502);
}

function concatBytes(chunks: Uint8Array[], limit: number): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const size = Math.min(total, limit);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    if (offset >= size) break;
    const take = Math.min(c.length, size - offset);
    out.set(c.subarray(0, take), offset);
    offset += take;
  }
  return out;
}

async function buildLimitedRewindStream(body: ReadableStream<Uint8Array>, maxBytes: number) {
  const reader = body.getReader();
  const initialChunks: Uint8Array[] = [];
  let transferred = 0;

  while (initialChunks.reduce((sum, chunk) => sum + chunk.length, 0) < MIN_SNIFF_BYTES) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    transferred += value.length;
    if (transferred > maxBytes) {
      try { await reader.cancel(); } catch {}
      throw new AppError(ErrorType.FILE_TOO_LARGE, '文件过大，已拒绝下载', 413);
    }
    initialChunks.push(value);
    if (initialChunks.length > 8) break;
  }

  const head = concatBytes(initialChunks, MIN_SNIFF_BYTES);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of initialChunks) controller.enqueue(chunk);
    },
    async pull(controller) {
      const { value, done } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      if (!value) return;
      transferred += value.length;
      if (transferred > maxBytes) {
        try { await reader.cancel(); } catch {}
        controller.error(new AppError(ErrorType.FILE_TOO_LARGE, '文件过大，已拒绝下载', 413));
        return;
      }
      controller.enqueue(value);
    },
    async cancel(reason) {
      try { await reader.cancel(reason); } catch {}
    },
  });

  return { stream, head };
}

export async function serveAdminImageFileFromOwner(request: NextRequest, imageId: string): Promise<Response> {
  const maxBytes = getMaxBytes();
  const image = await databaseService.getImage(imageId);
  if (!image) {
    throw new AppError(ErrorType.NOT_FOUND, `图片 ${imageId} 不存在`, 404);
  }

  const ownerRedirect = createRemoteOwnerRedirect(request, image, 'admin-file');
  if (ownerRedirect) return ownerRedirect;

  const requestedDisposition = request.nextUrl.searchParams.get('disposition') === 'inline' ? 'inline' : 'attachment';
  let sourceUrlStr = convertTgStateToProxyUrl(image.url.replace(/^http:/, 'https:'));
  let sourceUrl: URL;
  try {
    sourceUrl = new URL(sourceUrlStr);
  } catch {
    throw new AppError(ErrorType.VALIDATION_ERROR, '图片源地址格式无效', 400, { url: sourceUrlStr });
  }

  const upstream = await fetchWithRedirectGuard(
    sourceUrl,
    { signal: AbortSignal.timeout(30000), cache: 'no-store' } as RequestInit,
    getAllowedHostPatterns(),
    3
  );
  if (!upstream.ok) {
    throw new AppError(ErrorType.EXTERNAL_SERVICE_ERROR, `下载源图失败 (HTTP ${upstream.status})`, 502, {
      status: upstream.status,
      statusText: upstream.statusText,
    });
  }
  if (!upstream.body) {
    throw new AppError(ErrorType.EXTERNAL_SERVICE_ERROR, '上游响应缺少 body', 502);
  }

  const contentLengthHeader = upstream.headers.get('content-length');
  if (contentLengthHeader) {
    const len = Number.parseInt(contentLengthHeader, 10);
    if (Number.isFinite(len) && len > maxBytes) {
      throw new AppError(ErrorType.FILE_TOO_LARGE, '文件过大，已拒绝下载', 413, { contentLength: len, maxBytes });
    }
  }

  const { stream, head } = await buildLimitedRewindStream(upstream.body as ReadableStream<Uint8Array>, maxBytes);
  const detectedContentType = normalizeContentType(upstream.headers.get('content-type'), head);
  const isSvg = detectedContentType === 'image/svg+xml';
  const safeDisposition =
    requestedDisposition === 'inline' && INLINE_SAFE_IMAGE_MIMES.has(detectedContentType) && !isSvg
      ? 'inline'
      : 'attachment';
  const responseContentType = isSvg ? 'application/octet-stream' : detectedContentType;
  const baseName = sanitizeFilenameBase(image.title || image.publicId || image.id || 'image') || 'image';
  const urlExt = getFileExtensionFromUrl(sourceUrl.toString());
  const mimeExt = extFromMime(detectedContentType);
  const filenameWithExt = `${baseName}.${mimeExt !== 'bin' ? mimeExt : (urlExt || 'bin')}`;

  const headers = new Headers();
  headers.set('Content-Type', responseContentType);
  headers.set('Content-Disposition', buildContentDisposition(safeDisposition, filenameWithExt));
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  if (contentLengthHeader) {
    const len = Number.parseInt(contentLengthHeader, 10);
    if (Number.isFinite(len) && len > 0 && len <= maxBytes) {
      headers.set('Content-Length', String(len));
    }
  }

  return new NextResponse(stream, { status: 200, headers });
}
