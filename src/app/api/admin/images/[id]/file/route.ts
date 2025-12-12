/**
 * Admin 图片文件代理（同源下载/预览）
 * 主要用于解决 tgState 等跨域资源在浏览器侧 fetch 失败（CORS/鉴权）导致的“下载失败”问题。
 *
 * GET /api/admin/images/:id/file?disposition=attachment|inline
 */
import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '@/lib/database';
import { verifyAdminAuth } from '@/lib/auth';
import { AppError, ErrorType } from '@/types/errors';
import { IdSchema } from '@/types/schemas';
import { convertTgStateToProxyUrl, getFileExtensionFromUrl } from '@/lib/image-utils';
import { buildFetchInitFor } from '@/lib/telegram-proxy';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

function stripHttpHeaderControlChars(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, '');
}

function escapeQuotedString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function encodeRFC5987ValueChars(value: string): string {
  return encodeURIComponent(value).replace(/['()*]/g, (c) => {
    return `%${c.charCodeAt(0).toString(16).toUpperCase()}`;
  });
}

function buildContentDisposition(
  disposition: 'inline' | 'attachment',
  filenameWithExt: string
): string {
  const cleaned = stripHttpHeaderControlChars(filenameWithExt);
  const safe = cleaned.length > 0 ? cleaned : 'image';

  const asciiFallback = safe.replace(/[^\x20-\x7E]/g, '_');
  const quoted = escapeQuotedString(asciiFallback);
  const encoded = encodeRFC5987ValueChars(safe);
  return `${disposition}; filename="${quoted}"; filename*=UTF-8''${encoded}`;
}

function sanitizeFilenameBase(value: string): string {
  return stripHttpHeaderControlChars(value)
    .replace(/[\\/]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function sniffImageContentType(imageBuffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(imageBuffer);

  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
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
  ) {
    return 'image/png';
  }

  // GIF: "GIF87a" / "GIF89a"
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return 'image/gif';
  }

  // WebP: "RIFF" .... "WEBP"
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
  ) {
    return 'image/webp';
  }

  // AVIF: ISO BMFF, "ftyp" + brand "avif"/"avis"
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
  ) {
    return 'image/avif';
  }

  // BMP: "BM"
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return 'image/bmp';

  // ICO: 00 00 01 00
  if (bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00) {
    return 'image/x-icon';
  }

  // TIFF: "II*\0" or "MM\0*"
  if (
    bytes.length >= 4 &&
    ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
      (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a))
  ) {
    return 'image/tiff';
  }

  return null;
}

function normalizeContentType(raw: string | null, imageBuffer: ArrayBuffer): string {
  const candidate = (raw || 'application/octet-stream').split(';')[0].trim().toLowerCase();
  if (candidate.startsWith('image/')) return candidate;

  // 安全兜底：非图片类型一律降为 octet-stream，避免浏览器渲染 HTML/JS
  let safe = candidate === 'application/octet-stream' ? candidate : 'application/octet-stream';
  if (safe === 'application/octet-stream') {
    const sniffed = sniffImageContentType(imageBuffer);
    if (sniffed) safe = sniffed;
  }
  return safe;
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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  try {
    verifyAdminAuth(request);

    const imageId = IdSchema.parse(params.id);
    const image = await databaseService.getImage(imageId);
    if (!image) {
      throw new AppError(ErrorType.NOT_FOUND, `图片 ${imageId} 不存在`, 404);
    }

    const dispositionParam = request.nextUrl.searchParams.get('disposition');
    const disposition: 'inline' | 'attachment' =
      dispositionParam === 'inline' ? 'inline' : 'attachment';

    // 构建拉取 URL（tgState 支持按环境变量转换为代理地址）
    let sourceUrl = image.url.replace(/^http:/, 'https:');
    sourceUrl = convertTgStateToProxyUrl(sourceUrl);

    const resp = await fetch(
      sourceUrl,
      buildFetchInitFor(sourceUrl, { signal: AbortSignal.timeout(30000), cache: 'no-store' } as RequestInit)
    );
    if (!resp.ok) {
      throw new AppError(
        ErrorType.INTERNAL_ERROR,
        `下载源图失败 (HTTP ${resp.status})`,
        502,
        { status: resp.status, statusText: resp.statusText }
      );
    }

    const imageBuffer = await resp.arrayBuffer();
    const contentType = normalizeContentType(resp.headers.get('content-type'), imageBuffer);

    // 文件名：优先 title，否则 publicId，再否则 id
    const baseName = sanitizeFilenameBase(image.title || image.publicId || image.id || 'image') || 'image';
    const urlExt = getFileExtensionFromUrl(sourceUrl);
    const mimeExt = extFromMime(contentType);
    const ext = mimeExt !== 'bin' ? mimeExt : (urlExt || 'bin');
    const filenameWithExt = `${baseName}.${ext}`;

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': buildContentDisposition(disposition, filenameWithExt),
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: error.type,
            message: error.message,
            details: error.details,
            timestamp: new Date(),
          },
          timestamp: new Date(),
        },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          type: ErrorType.INTERNAL_ERROR,
          message: '下载图片时发生内部错误',
          timestamp: new Date(),
        },
        timestamp: new Date(),
      },
      { status: 500 }
    );
  }
}


