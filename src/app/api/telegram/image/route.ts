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

async function fetchBotIdForToken(token: string): Promise<string | null> {
  try {
    const url = `https://api.telegram.org/bot${token}/getMe`;
    const resp = await fetch(url, buildFetchInitFor(url, { signal: AbortSignal.timeout(5000) } as RequestInit));
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
async function fetchTelegramFilePath(token: string, fileId: string): Promise<{ 
  success: boolean; 
  filePath?: string; 
  error?: string; 
  status?: number; 
  description?: string;
}> {
  const maxRetries = 3;
  let lastError: any;
  let lastStatus: number | undefined;
  let lastDesc: string | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const getFileUrl = `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`;
      const resp = await fetch(
        getFileUrl, 
        buildFetchInitFor(getFileUrl, { signal: AbortSignal.timeout(10000) } as RequestInit)
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
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fileId = searchParams.get('file_id');
    const botId = searchParams.get('bot_id'); // 可选：用于精确选择 token
    const filePathParam = searchParams.get('file_path'); // 可选：直接传入 file_path 以跳过 getFile
    
    if (!fileId) {
      return NextResponse.json(
        { error: 'Missing file_id parameter' },
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
            buildFetchInitFor(downloadUrl, { signal: AbortSignal.timeout(30000) } as RequestInit)
          );
          if (downloadResponse.ok) {
            const imageBuffer = await downloadResponse.arrayBuffer();
            const contentType = downloadResponse.headers.get('content-type') || 'application/octet-stream';
            // 写入缓存映射，后续同一 file_id 直达该 token
            fileIdToToken.set(fileId, token);
            return new NextResponse(imageBuffer, {
              status: 200,
              headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable',
              }
            });
          }
        } catch {
          // 忽略，尝试下一个 token
        }
      }
      // 快速路径失败则继续走下方常规流程
    }

    // 优先：file_id 命中缓存的 token，直接试用
    const cachedToken = fileIdToToken.get(fileId);
    if (!botId && cachedToken) {
      const result = await fetchTelegramFilePath(cachedToken, fileId);
      if (result.success && result.filePath) {
        const downloadUrl = `https://api.telegram.org/file/bot${cachedToken}/${result.filePath}`;
        try {
          const downloadResponse = await fetch(downloadUrl, buildFetchInitFor(downloadUrl, { signal: AbortSignal.timeout(30000) } as RequestInit));
          if (downloadResponse.ok) {
            const imageBuffer = await downloadResponse.arrayBuffer();
            const contentType = downloadResponse.headers.get('content-type') || 'application/octet-stream';
            return new NextResponse(imageBuffer, {
              status: 200,
              headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable',
              }
            });
          }
        } catch {
           // 下载失败，可能是网络问题，也可能是 filePath 失效（虽然刚获取，但在极少数情况下）
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
            // 2) 下载文件
            const downloadUrl = `https://api.telegram.org/file/bot${token}/${result.filePath}`;
            const downloadResponse = await fetch(downloadUrl, buildFetchInitFor(downloadUrl, { signal: AbortSignal.timeout(30000) } as RequestInit));
            if (downloadResponse.ok) {
              const imageBuffer = await downloadResponse.arrayBuffer();
              const contentType = downloadResponse.headers.get('content-type') || 'application/octet-stream';
              // 写入缓存，后续相同 file_id 直达
              fileIdToToken.set(fileId, token);
              return new NextResponse(imageBuffer, {
                status: 200,
                headers: {
                  'Content-Type': contentType,
                  'Cache-Control': 'public, max-age=31536000, immutable',
                }
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

      // 1. 获取文件路径 (带重试)
      const result = await fetchTelegramFilePath(token, fileId);

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
        const downloadResponse = await fetch(downloadUrl, buildFetchInitFor(downloadUrl, { signal: AbortSignal.timeout(30000) } as RequestInit));

        if (!downloadResponse.ok) {
          lastErrorStatus = downloadResponse.status;
          console.warn(
            `[Telegram Image Proxy] 下载失败 (HTTP ${downloadResponse.status})，尝试下一个 token`
          );
          continue; // 尝试下一个
        }

        // 3. 返回图片
        const imageBuffer = await downloadResponse.arrayBuffer();
        const contentType = downloadResponse.headers.get('content-type') || 'application/octet-stream';
         // 写入缓存映射，便于后续直达
         fileIdToToken.set(fileId, token);

        return new NextResponse(imageBuffer, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable', // 缓存 1 年
          }
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
