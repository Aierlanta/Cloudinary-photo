/**
 * Telegram 图片代理 API
 * 用于通过 file_id 获取 Telegram 图片（取图逻辑见 @/lib/telegram-image-fetch）
 */

import { NextRequest, NextResponse } from 'next/server';
import { redactTelegramBotTokenInUrl } from '@/lib/telegram-proxy';
import { fetchTelegramImage } from '@/lib/telegram-image-fetch';

// 该路由依赖查询参数与外部请求，必须禁用静态优化
export const dynamic = 'force-dynamic';
// 禁止 Next.js 对外部 fetch 做增量缓存
export const fetchCache = 'force-no-store';
export const revalidate = 0;

/**
 * 从 file_path 或 Content-Type 推断文件扩展名
 */
function getFileExtension(filePath?: string | null, contentType?: string): string {
  // 优先从 file_path 提取扩展名
  if (filePath) {
    const match = filePath.match(/\.([a-zA-Z0-9]+)$/);
    if (match) return match[1].toLowerCase();
  }
  // 从 Content-Type 推断
  if (contentType) {
    const mime = contentType.split(';')[0].trim().toLowerCase();
    const mimeToExt: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/avif': 'avif',
      'image/svg+xml': 'svg',
      'image/bmp': 'bmp',
      'image/x-icon': 'ico',
      // 安全兜底：无法识别类型/被强制为二进制时，不要误标为 png
      'application/octet-stream': 'bin',
    };

    const mapped = mimeToExt[mime];
    if (mapped) return mapped;

    // 对于未知的 image/*，尽量从 subtype 推断扩展名（例如 image/heic -> heic）
    if (mime.startsWith('image/')) {
      const subtype = mime.slice('image/'.length);
      // 常见归一化
      if (subtype === 'jpeg') return 'jpg';
      if (subtype === 'svg+xml') return 'svg';
      // 仅允许安全字符，避免生成奇怪扩展名
      if (/^[a-z0-9.+-]+$/i.test(subtype)) return subtype.toLowerCase();
    }

    // 非图片/未知类型：回退为通用二进制扩展名
    return 'bin';
  }
  // 没有任何线索时，回退为通用二进制扩展名
  return 'bin';
}

function normalizeImageContentType(contentType: string, ext: string): string {
  // 已经是图片 MIME，直接使用
  if (contentType.startsWith('image/')) return contentType;

  // Telegram 很多情况下返回 octet-stream，但其实是图片；这里根据扩展名矫正
  const extToMime: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    avif: 'image/avif',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
  };

  if (contentType === 'application/octet-stream') {
    return extToMime[ext] || contentType;
  }

  // 安全兜底：非 image/* 也非 octet-stream，一律按二进制返回，避免浏览器渲染潜在 HTML/JS
  return 'application/octet-stream';
}

function stripHttpHeaderControlChars(value: string): string {
  // 去掉控制字符，防止响应头注入（CR/LF）与非法 header 值
  // 0x00-0x1F + 0x7F
  return value.replace(/[\u0000-\u001F\u007F]/g, '');
}

function escapeQuotedString(value: string): string {
  // quoted-string 需要转义 \ 和 "
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function encodeRFC5987ValueChars(value: string): string {
  // RFC 5987: 使用 percent-encoding，encodeURIComponent 作为基础即可
  // 额外把 RFC 要求的字符也编码掉
  return encodeURIComponent(value).replace(/['()*]/g, (c) => {
    return `%${c.charCodeAt(0).toString(16).toUpperCase()}`;
  });
}

function buildInlineContentDisposition(filenameWithExt: string): string {
  const cleaned = stripHttpHeaderControlChars(filenameWithExt);
  const safe = cleaned.length > 0 ? cleaned : 'image';

  // filename= 走 ASCII 回退，避免旧 UA 对非 ASCII 解析问题
  const asciiFallback = safe.replace(/[^\x20-\x7E]/g, '_');
  const quoted = escapeQuotedString(asciiFallback);

  // filename* 提供 UTF-8 真实文件名（RFC 6266/5987）
  const encoded = encodeRFC5987ValueChars(safe);
  return `inline; filename="${quoted}"; filename*=UTF-8''${encoded}`;
}

/**
 * 构建图片响应头，包含正确的 Content-Disposition
 */
function buildImageHeaders(contentType: string, filePath?: string | null, fileId?: string | null): HeadersInit {
  const ext = getFileExtension(filePath, contentType);
  const normalizedContentType = normalizeImageContentType(contentType, ext);
  // 文件名：优先从 file_path 提取，否则使用 file_id 的前 16 位
  let filename = 'image';
  if (filePath) {
    const pathParts = filePath.split('/');
    const lastPart = pathParts[pathParts.length - 1];
    // 移除扩展名后的部分作为基础名
    filename = lastPart.replace(/\.[^.]+$/, '') || 'image';
  } else if (fileId) {
    filename = fileId.substring(0, 16);
  }

  const filenameWithExt = `${filename}.${ext}`;
  return {
    'Content-Type': normalizedContentType,
    'Content-Disposition': buildInlineContentDisposition(filenameWithExt),
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  };
}

/**
 * GET /api/telegram/image?file_id=xxx
 * 通过 file_id 获取 Telegram 图片
 * 也支持只传 file_path（用于兼容没有存储 file_id 的旧图片）
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fileId = searchParams.get('file_id');
    const result = await fetchTelegramImage({
      fileId,
      botId: searchParams.get('bot_id'), // 可选：用于精确选择 token
      filePath: searchParams.get('file_path') // 可选：直接传入 file_path 以跳过 getFile
    });

    if (!result.ok) {
      return NextResponse.json(result.body, { status: result.status });
    }

    return new NextResponse(result.buffer, {
      status: 200,
      headers: buildImageHeaders(result.contentType, result.filePath, fileId),
    });
  } catch (error) {
    const safeError = redactTelegramBotTokenInUrl(error instanceof Error ? error.message : String(error));
    console.error('[Telegram Image Proxy] Error:', safeError);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
