/**
 * Telegram 图片代理 API
 * 用于通过 file_id 获取 Telegram 图片
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildFetchInitFor } from '@/lib/telegram-proxy';

interface TelegramFileResponse {
  ok: boolean;
  result?: {
    file_id: string;
    file_unique_id: string;
    file_size: number;
    file_path: string;
  };
  description?: string;
}

// 该路由依赖查询参数与外部请求，必须禁用静态优化
export const dynamic = 'force-dynamic';
// 禁止 Next.js 对外部 fetch 做增量缓存
export const fetchCache = 'force-no-store';
export const revalidate = 0;

/**
 * 读取 Token 列表
 */
function getTokenList(): string[] {
  const tokens = process.env.TELEGRAM_BOT_TOKENS || process.env.TELEGRAM_BOT_TOKEN || '';
  return tokens
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0);
}

// 轮询索引（进程内），用于分摊负载
let currentTokenIndex = 0;

// 缓存：token -> botId，以及 botId -> token
const tokenToBotId = new Map<string, string>();
const botIdToToken = new Map<string, string>();
// 缓存：file_id -> token，命中后可避免轮询造成的 400 抖动
const fileIdToToken = new Map<string, string>();
const MAX_CACHE_SIZE = 1000;

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

function cacheFileIdToken(fileId: string, token: string) {
  if (fileIdToToken.size >= MAX_CACHE_SIZE) {
    // 删除最早插入的一个 (Map 按插入顺序迭代)
    const firstKey = fileIdToToken.keys().next().value;
    if (firstKey) fileIdToToken.delete(firstKey);
  }
  fileIdToToken.set(fileId, token);
}

async function fetchBotIdForToken(token: string): Promise<string | null> {
  try {
    const url = `https://api.telegram.org/bot${token}/getMe`;
    const resp = await fetch(
      url,
      buildFetchInitFor(url, { signal: AbortSignal.timeout(5000), cache: 'no-store' } as RequestInit)
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data?.ok || !data?.result?.id) return null;
    return String(data.result.id);
  } catch {
    return null;
  }
}

async function ensureBotIdMappingForToken(token: string): Promise<void> {
  if (tokenToBotId.has(token)) return;
  const botId = await fetchBotIdForToken(token);
  if (botId) {
    tokenToBotId.set(token, botId);
    botIdToToken.set(botId, token);
  }
}

async function resolveTokenByBotId(botId: string): Promise<string | null> {
  if (botIdToToken.has(botId)) {
    return botIdToToken.get(botId)!;
  }
  const tokens = getTokenList();
  // 尝试为所有 token 建立映射（一次性）
  await Promise.all(tokens.map(t => ensureBotIdMappingForToken(t)));
  return botIdToToken.get(botId) || null;
}

/**
 * 取下一个 Token（Round-robin）
 */
function getNextTelegramToken(): string | null {
  const tokenList = getTokenList();
  if (tokenList.length === 0) return null;
  const token = tokenList[currentTokenIndex];
  currentTokenIndex = (currentTokenIndex + 1) % tokenList.length;
  return token;
}

/**
 * 尝试获取 Telegram 文件路径，包含重试逻辑
 * 针对 "temporarily unavailable" 或网络错误进行重试
 */
async function fetchTelegramFilePath(token: string, fileId: string, maxRetries = 3): Promise<{ 
  success: boolean; 
  filePath?: string; 
  error?: string; 
  status?: number; 
  description?: string;
}> {
  let lastError: any;
  let lastStatus: number | undefined;
  let lastDesc: string | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const getFileUrl = `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`;
      const resp = await fetch(
        getFileUrl, 
        buildFetchInitFor(getFileUrl, { signal: AbortSignal.timeout(10000), cache: 'no-store' } as RequestInit)
      );

      lastStatus = resp.status;
      
      if (resp.ok) {
        const data: TelegramFileResponse = await resp.json();
        if (data.ok && data.result) {
          return { success: true, filePath: data.result.file_path };
        }
        lastDesc = data.description;
        // 检查是否为临时不可用
        if (lastDesc && lastDesc.includes('temporarily unavailable')) {
          console.warn(`[Telegram Image Proxy] Token ${token.slice(0, 5)}... 遇到临时不可用 (Retry ${i + 1}/${maxRetries}): ${lastDesc}`);
          await new Promise(r => setTimeout(r, 1000 * (i + 1))); // 指数退避
          continue;
        }
        // 其他业务错误（如 wrong file_id），不重试直接返回
        return { success: false, error: lastDesc || 'Unknown Telegram API error', status: 200, description: lastDesc };
      }

      // 处理 HTTP 错误
      const text = await resp.text();
      // 尝试解析 JSON 错误信息
      try {
        const jsonErr = JSON.parse(text);
        lastDesc = jsonErr.description || text;
      } catch {
        lastDesc = text;
      }

      // 400 错误且包含 temporarily unavailable 则重试
      if (resp.status === 400 && (lastDesc?.includes('temporarily unavailable') || text.includes('temporarily unavailable'))) {
        console.warn(`[Telegram Image Proxy] Token ${token.slice(0, 5)}... 遇到 400 临时不可用 (Retry ${i + 1}/${maxRetries}): ${lastDesc}`);
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        continue;
      }

      // 5xx 或 429 错误重试
      if (resp.status >= 500 || resp.status === 429) {
        console.warn(`[Telegram Image Proxy] Token ${token.slice(0, 5)}... 遇到 HTTP ${resp.status} (Retry ${i + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        continue;
      }

      // 其他 4xx 错误（如 401 Unauthorized, 403 Forbidden, 404 Not Found）不重试
      return { success: false, error: lastDesc || `HTTP ${resp.status}`, status: resp.status, description: lastDesc };

    } catch (e) {
      lastError = e;
      console.warn(`[Telegram Image Proxy] Token ${token.slice(0, 5)}... 网络请求异常 (Retry ${i + 1}/${maxRetries})`, e);
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }

  return { 
    success: false, 
    error: lastDesc || (lastError ? String(lastError) : 'Max retries exceeded'), 
    status: lastStatus,
    description: lastDesc
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
    const botId = searchParams.get('bot_id'); // 可选：用于精确选择 token
    const filePathParam = searchParams.get('file_path'); // 可选：直接传入 file_path 以跳过 getFile
    
    // 至少需要 file_id 或 file_path 其中一个
    if (!fileId && !filePathParam) {
      return NextResponse.json(
        { error: 'Missing file_id or file_path parameter' },
        { status: 400 }
      );
    }
    
    const tokens = getTokenList();
    if (tokens.length === 0) {
      return NextResponse.json(
        { error: 'Telegram bot token not configured' },
        { status: 500 }
      );
    }

    // 快速路径：如果提供了 file_path，则可直接尝试下载，减少对 getFile 的依赖
    // 这也支持只有 file_path 没有 file_id 的情况（兼容旧数据）
    if (filePathParam) {
      // 优先根据 bot_id 解析 token，否则走轮询
      const candidateTokens: string[] = [];
      if (botId) {
        const token = await resolveTokenByBotId(botId);
        if (token) candidateTokens.push(token);
      }
      // 追加所有可用 token 作为后备
      candidateTokens.push(...tokens);

      for (const token of candidateTokens) {
        try {
          const downloadUrl = `https://api.telegram.org/file/bot${token}/${filePathParam}`;
          const downloadResponse = await fetch(
            downloadUrl,
            buildFetchInitFor(downloadUrl, { signal: AbortSignal.timeout(30000), cache: 'no-store' } as RequestInit)
          );
          if (downloadResponse.ok) {
            const imageBuffer = await downloadResponse.arrayBuffer();
            let contentType = downloadResponse.headers.get('content-type') || 'application/octet-stream';
            
            // 安全检查：防止 XSS
            // 如果不是图片且不是 octet-stream，强制设为 octet-stream 以避免浏览器渲染 HTML/JS
            if (!contentType.startsWith('image/') && contentType !== 'application/octet-stream') {
               contentType = 'application/octet-stream';
            }

            // 写入缓存映射，后续同一 file_id 直达该 token（仅当有 file_id 时）
            if (fileId) {
              cacheFileIdToken(fileId, token);
            }
            return new NextResponse(imageBuffer, {
              status: 200,
              headers: buildImageHeaders(contentType, filePathParam, fileId),
            });
          }
        } catch {
          // 忽略，尝试下一个 token
        }
      }
      // 快速路径失败
      // 如果只有 file_path 没有 file_id，无法继续（file_path 已过期）
      if (!fileId) {
        // 使用 410 Gone 表示资源曾经存在但现在已过期/不可用
        // 这与普通的 404 Not Found 区分开，便于前端识别
        return NextResponse.json(
          { 
            error: 'FILE_PATH_EXPIRED',
            message: 'Telegram file path has expired and no file_id is available for refresh',
            hint: 'This image was uploaded without storing file_id. Consider re-uploading or running a migration script.'
          },
          { status: 410 }  // 410 Gone - 资源曾经存在但现在已不可用
        );
      }
      // 有 file_id 则继续走下方常规流程
    }

    // 走到这里时，后续逻辑都依赖 file_id。
    // 若请求只有 file_path（无 file_id），应当已在上方快速路径内返回（200 或 410）。
    // 这里加一道硬保护，避免潜在的运行时错误（以及避免把 null 作为 Map key/函数参数继续传递）。
    if (!fileId) {
      return NextResponse.json(
        { error: 'Missing file_id parameter' },
        { status: 400 }
      );
    }
    const fileIdStr = fileId;

    // 优先：file_id 命中缓存的 token，直接试用
    const cachedToken = fileIdToToken.get(fileIdStr);
    if (!botId && cachedToken) {
      const result = await fetchTelegramFilePath(cachedToken, fileIdStr);
      if (result.success && result.filePath) {
        const downloadUrl = `https://api.telegram.org/file/bot${cachedToken}/${result.filePath}`;
        try {
          const downloadResponse = await fetch(
            downloadUrl,
            buildFetchInitFor(downloadUrl, { signal: AbortSignal.timeout(30000), cache: 'no-store' } as RequestInit)
          );
          if (downloadResponse.ok) {
            const imageBuffer = await downloadResponse.arrayBuffer();
            let contentType = downloadResponse.headers.get('content-type') || 'application/octet-stream';

             // 安全检查
            if (!contentType.startsWith('image/') && contentType !== 'application/octet-stream') {
               contentType = 'application/octet-stream';
            }

            return new NextResponse(imageBuffer, {
              status: 200,
              headers: buildImageHeaders(contentType, result.filePath, fileIdStr),
            });
          }
        } catch {
           // 下载失败，可能是网络问题，也可能是 filePath 失效（虽然刚获取，但在极少数情况下）
        }
      } else {
        // 获取 filePath 失败，缓存失效
        fileIdToToken.delete(fileIdStr);
        console.warn(`[Telegram Image Proxy] file_id 缓存 token 失效 (${result.error})，删除缓存并回退流程`);
      }
    }

    // 优先：如果提供了 bot_id，则尝试用对应 token
    if (botId) {
      const token = await resolveTokenByBotId(botId);
      if (token) {
        const result = await fetchTelegramFilePath(token, fileIdStr);
        if (result.success && result.filePath) {
          try {
            // 2) 下载文件
            const downloadUrl = `https://api.telegram.org/file/bot${token}/${result.filePath}`;
            const downloadResponse = await fetch(
              downloadUrl,
              buildFetchInitFor(downloadUrl, { signal: AbortSignal.timeout(30000), cache: 'no-store' } as RequestInit)
            );
            if (downloadResponse.ok) {
              const imageBuffer = await downloadResponse.arrayBuffer();
              let contentType = downloadResponse.headers.get('content-type') || 'application/octet-stream';

              // 安全检查
              if (!contentType.startsWith('image/') && contentType !== 'application/octet-stream') {
                 contentType = 'application/octet-stream';
              }

              // 写入缓存，后续相同 file_id 直达
              cacheFileIdToken(fileIdStr, token);
              return new NextResponse(imageBuffer, {
                status: 200,
                headers: buildImageHeaders(contentType, result.filePath, fileIdStr),
              });
            }
          } catch (e) {
            console.warn(`[Telegram Image Proxy] 指定 bot_id=${botId} 下载异常，回退到轮询`, e);
          }
        } else {
          console.warn(`[Telegram Image Proxy] 指定 bot_id=${botId} 获取路径失败: ${result.error}，回退到轮询`);
        }
      } else {
        console.warn(`[Telegram Image Proxy] 未能为 bot_id=${botId} 解析到 token，回退到轮询`);
      }
    }

    // 尝试使用轮询与故障切换（兼容旧链接或无 bot_id 的情况）
    let lastErrorStatus: number | undefined;
    let lastErrorDesc: string | undefined;

    for (let i = 0; i < tokens.length; i++) {
      const token = getNextTelegramToken();
      if (!token) break;

      // 1. 获取文件路径 (带重试，轮询模式下仅尝试1次以避免超时)
      const result = await fetchTelegramFilePath(token, fileIdStr, 1);

      if (!result.success) {
        lastErrorStatus = result.status;
        lastErrorDesc = result.description || result.error;
        // 如果是 wrong file_id，这是预期的（因为我们在轮询所有 bot），不一定是错误
        // 但如果是 temporarily unavailable，fetchTelegramFilePath 已经重试过了
        continue; 
      }

      const filePath = result.filePath!;

      // 2. 下载文件
      try {
        const downloadUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
        const downloadResponse = await fetch(
          downloadUrl,
          buildFetchInitFor(downloadUrl, { signal: AbortSignal.timeout(30000), cache: 'no-store' } as RequestInit)
        );

        if (!downloadResponse.ok) {
          lastErrorStatus = downloadResponse.status;
          console.warn(
            `[Telegram Image Proxy] 下载失败 (HTTP ${downloadResponse.status})，尝试下一个 token`
          );
          continue; // 尝试下一个
        }

        // 3. 返回图片
        const imageBuffer = await downloadResponse.arrayBuffer();
        let contentType = downloadResponse.headers.get('content-type') || 'application/octet-stream';

        // 安全检查
        if (!contentType.startsWith('image/') && contentType !== 'application/octet-stream') {
            contentType = 'application/octet-stream';
        }

         // 写入缓存映射，便于后续直达
         cacheFileIdToken(fileIdStr, token);

        return new NextResponse(imageBuffer, {
          status: 200,
          headers: buildImageHeaders(contentType, filePath, fileIdStr),
        });
      } catch (err) {
        console.warn('[Telegram Image Proxy] 使用当前 token 下载失败，尝试下一个', err);
        continue;
      }
    }

    // 所有 token 均失败
    console.error(
      `[Telegram Image Proxy] 所有 Bot Token 均尝试失败。lastStatus=${lastErrorStatus}, lastDesc=${lastErrorDesc}`
    );
    return NextResponse.json(
      { error: 'Failed to fetch image from Telegram with all tokens', details: lastErrorDesc },
      { status: 502 }
    );
    
  } catch (error) {
    console.error('[Telegram Image Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
