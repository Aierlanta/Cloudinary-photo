/**
 * Telegram 图片获取（服务端直接调用）
 *
 * 原先 /api/response、/api/random 等通过 HTTP 自调用 /api/telegram/image 取图，
 * 但部署在反向代理后 request.url 会变成 https://localhost:PORT，自调用必然失败。
 * 这里把取图逻辑抽成普通函数，路由与各出图链路都直接调用。
 */

import { buildFetchInitFor, maskTelegramBotToken, redactTelegramBotTokenInUrl } from '@/lib/telegram-proxy';

export const TELEGRAM_PROXY_PATH = '/api/telegram/image';

export interface TelegramImageParams {
  fileId?: string | null;
  botId?: string | null;
  filePath?: string | null;
}

export type TelegramImageResult =
  | { ok: true; buffer: ArrayBuffer; contentType: string; filePath: string }
  | { ok: false; status: number; body: Record<string, string | undefined> };

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
 * 生成站内代理路径 /api/telegram/image?file_id=...（相对路径，不依赖 request.url）
 */
export function buildTelegramProxyPath(params: TelegramImageParams): string {
  const sp = new URLSearchParams();
  if (params.fileId) sp.set('file_id', params.fileId);
  if (params.botId) sp.set('bot_id', params.botId);
  if (params.filePath) sp.set('file_path', params.filePath);
  return `${TELEGRAM_PROXY_PATH}?${sp.toString()}`;
}

/**
 * 如果 URL（相对或绝对）指向站内 /api/telegram/image，解析出参数；否则返回 null
 */
export function parseTelegramProxyUrl(url: string): TelegramImageParams | null {
  try {
    const parsed = new URL(url, 'http://localhost');
    if (parsed.pathname !== TELEGRAM_PROXY_PATH) return null;
    const params = {
      fileId: parsed.searchParams.get('file_id'),
      botId: parsed.searchParams.get('bot_id'),
      filePath: parsed.searchParams.get('file_path')
    };
    return params.fileId || params.filePath ? params : null;
  } catch {
    return null;
  }
}

/**
 * 当上游返回 application/octet-stream 时，根据文件头（magic bytes）猜测真实图片类型。
 * 仅识别常见光栅格式；无法识别则返回 null，保持 octet-stream（避免潜在 XSS 风险）。
 */
function sniffImageContentType(imageBuffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(imageBuffer);

  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

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
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return 'image/bmp';
  }

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
  const token = tokenList[currentTokenIndex % tokenList.length];
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
          console.warn(`[Telegram Image Proxy] Token ${maskTelegramBotToken(token, { prefixLen: 5, suffixLen: 0 })} 遇到临时不可用 (Retry ${i + 1}/${maxRetries}): ${lastDesc}`);
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
        console.warn(`[Telegram Image Proxy] Token ${maskTelegramBotToken(token, { prefixLen: 5, suffixLen: 0 })} 遇到 400 临时不可用 (Retry ${i + 1}/${maxRetries}): ${lastDesc}`);
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        continue;
      }

      // 5xx 或 429 错误重试
      if (resp.status >= 500 || resp.status === 429) {
        console.warn(`[Telegram Image Proxy] Token ${maskTelegramBotToken(token, { prefixLen: 5, suffixLen: 0 })} 遇到 HTTP ${resp.status} (Retry ${i + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        continue;
      }

      // 其他 4xx 错误（如 401 Unauthorized, 403 Forbidden, 404 Not Found）不重试
      return { success: false, error: lastDesc || `HTTP ${resp.status}`, status: resp.status, description: lastDesc };

    } catch (e) {
      lastError = e;
      const safeError = redactTelegramBotTokenInUrl(e instanceof Error ? e.message : String(e));
      console.warn(
        `[Telegram Image Proxy] Token ${maskTelegramBotToken(token, { prefixLen: 5, suffixLen: 0 })} 网络请求异常 (Retry ${i + 1}/${maxRetries}): ${safeError}`
      );
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
 * 用指定 token 下载 file_path 对应的文件。
 * 成功返回内容；HTTP 失败返回 { status }；网络异常直接抛出。
 */
async function downloadTelegramFile(
  token: string,
  filePath: string
): Promise<{ buffer: ArrayBuffer; contentType: string } | { status: number }> {
  const downloadUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
  const resp = await fetch(
    downloadUrl,
    buildFetchInitFor(downloadUrl, { signal: AbortSignal.timeout(30000), cache: 'no-store' } as RequestInit)
  );
  if (!resp.ok) {
    return { status: resp.status };
  }

  const buffer = await resp.arrayBuffer();
  let contentType = resp.headers.get('content-type') || 'application/octet-stream';
  // 安全检查：如果不是图片且不是 octet-stream，强制设为 octet-stream 以避免浏览器渲染 HTML/JS
  if (!contentType.startsWith('image/') && contentType !== 'application/octet-stream') {
    contentType = 'application/octet-stream';
  }
  // Telegram 有时会返回 octet-stream，但实际上是图片；这里按 magic-bytes 纠正类型
  if (contentType === 'application/octet-stream') {
    const sniffed = sniffImageContentType(buffer);
    if (sniffed) contentType = sniffed;
  }
  return { buffer, contentType };
}

/**
 * 通过 file_id / file_path 获取 Telegram 图片。
 * 流程：
 * 1. 传了 file_path 先直接下载（省一次 getFile）；失败且没有 file_id 时返回 410
 * 2. file_id 命中缓存的 token 时直接用该 token getFile + 下载
 * 3. 传了 bot_id 时用对应 token getFile + 下载
 * 4. 以上都不行，轮询所有 token，全部失败返回 502
 */
export async function fetchTelegramImage(params: TelegramImageParams): Promise<TelegramImageResult> {
  const { fileId, botId, filePath: filePathParam } = params;

  // 至少需要 file_id 或 file_path 其中一个
  if (!fileId && !filePathParam) {
    return { ok: false, status: 400, body: { error: 'Missing file_id or file_path parameter' } };
  }

  const tokens = getTokenList();
  if (tokens.length === 0) {
    return { ok: false, status: 500, body: { error: 'Telegram bot token not configured' } };
  }

  // 快速路径：如果提供了 file_path，则可直接尝试下载，减少对 getFile 的依赖
  // 这也支持只有 file_path 没有 file_id 的情况（兼容旧数据）
  if (filePathParam) {
    // 优先根据 bot_id 解析 token，再追加所有可用 token 作为后备
    const candidateTokens: string[] = [];
    if (botId) {
      const token = await resolveTokenByBotId(botId);
      if (token) candidateTokens.push(token);
    }
    candidateTokens.push(...tokens);

    for (const token of Array.from(new Set(candidateTokens))) {
      try {
        const downloaded = await downloadTelegramFile(token, filePathParam);
        if ('buffer' in downloaded) {
          // 写入缓存映射，后续同一 file_id 直达该 token（仅当有 file_id 时）
          if (fileId) cacheFileIdToken(fileId, token);
          return { ok: true, ...downloaded, filePath: filePathParam };
        }
      } catch {
        // 忽略，尝试下一个 token
      }
    }

    // 快速路径失败，且只有 file_path 没有 file_id，无法继续（file_path 已过期）
    if (!fileId) {
      // 使用 410 Gone 表示资源曾经存在但现在已过期/不可用
      return {
        ok: false,
        status: 410,
        body: {
          error: 'FILE_PATH_EXPIRED',
          message: 'Telegram file path has expired and no file_id is available for refresh',
          hint: 'This image was uploaded without storing file_id. Consider re-uploading or running a migration script.'
        }
      };
    }
    // 有 file_id 则继续走下方常规流程
  }

  if (!fileId) {
    return { ok: false, status: 400, body: { error: 'Missing file_id parameter' } };
  }

  // 优先：file_id 命中缓存的 token，直接试用
  const cachedToken = fileIdToToken.get(fileId);
  if (!botId && cachedToken) {
    const result = await fetchTelegramFilePath(cachedToken, fileId);
    if (result.success && result.filePath) {
      try {
        const downloaded = await downloadTelegramFile(cachedToken, result.filePath);
        if ('buffer' in downloaded) {
          return { ok: true, ...downloaded, filePath: result.filePath };
        }
      } catch {
        // 下载失败，可能是网络问题，继续回退流程
      }
    } else {
      // 获取 filePath 失败，缓存失效
      fileIdToToken.delete(fileId);
      console.warn(`[Telegram Image Proxy] file_id 缓存 token 失效 (${result.error})，删除缓存并回退流程`);
    }
  }

  // 优先：如果提供了 bot_id，则尝试用对应 token
  if (botId) {
    const token = await resolveTokenByBotId(botId);
    if (token) {
      const result = await fetchTelegramFilePath(token, fileId);
      if (result.success && result.filePath) {
        try {
          const downloaded = await downloadTelegramFile(token, result.filePath);
          if ('buffer' in downloaded) {
            // 写入缓存，后续相同 file_id 直达
            cacheFileIdToken(fileId, token);
            return { ok: true, ...downloaded, filePath: result.filePath };
          }
        } catch (e) {
          console.warn(
            `[Telegram Image Proxy] 指定 bot_id=${botId} 下载异常，回退到轮询`,
            redactTelegramBotTokenInUrl(e instanceof Error ? e.message : String(e))
          );
        }
      } else {
        console.warn(`[Telegram Image Proxy] 指定 bot_id=${botId} 获取路径失败: ${result.error}，回退到轮询`);
      }
    } else {
      console.warn(`[Telegram Image Proxy] 未能为 bot_id=${botId} 解析到 token，回退到轮询`);
    }
  }

  // 轮询与故障切换（兼容旧链接或无 bot_id 的情况）
  let lastErrorStatus: number | undefined;
  let lastErrorDesc: string | undefined;

  for (let i = 0; i < tokens.length; i++) {
    const token = getNextTelegramToken();
    if (!token) break;

    // 轮询模式下 getFile 仅尝试 1 次以避免超时
    const result = await fetchTelegramFilePath(token, fileId, 1);
    if (!result.success || !result.filePath) {
      lastErrorStatus = result.status;
      lastErrorDesc = result.description || result.error;
      // wrong file_id 在轮询所有 bot 时是预期内的，继续下一个
      continue;
    }

    try {
      const downloaded = await downloadTelegramFile(token, result.filePath);
      if (!('buffer' in downloaded)) {
        lastErrorStatus = downloaded.status;
        console.warn(`[Telegram Image Proxy] 下载失败 (HTTP ${downloaded.status})，尝试下一个 token`);
        continue;
      }
      cacheFileIdToken(fileId, token);
      return { ok: true, ...downloaded, filePath: result.filePath };
    } catch (err) {
      const safeError = redactTelegramBotTokenInUrl(err instanceof Error ? err.message : String(err));
      console.warn('[Telegram Image Proxy] 使用当前 token 下载失败，尝试下一个', safeError);
    }
  }

  console.error(
    `[Telegram Image Proxy] 所有 Bot Token 均尝试失败。lastStatus=${lastErrorStatus}, lastDesc=${lastErrorDesc}`
  );
  return {
    ok: false,
    status: 502,
    body: { error: 'Failed to fetch image from Telegram with all tokens', details: lastErrorDesc }
  };
}
