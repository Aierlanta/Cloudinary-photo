/**
 * Telegram 图片代理 API
 * 用于通过 file_id 获取 Telegram 图片
 */

import { NextRequest, NextResponse } from 'next/server';

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
    const resp = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(5000)
    });
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
 * GET /api/telegram/image?file_id=xxx
 * 通过 file_id 获取 Telegram 图片
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fileId = searchParams.get('file_id');
    const botId = searchParams.get('bot_id'); // 可选：用于精确选择 token
    
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

    // 优先：file_id 命中缓存的 token，直接试用
    const cachedToken = fileIdToToken.get(fileId);
    if (!botId && cachedToken) {
      try {
        const getFileResponse = await fetch(
          `https://api.telegram.org/bot${cachedToken}/getFile?file_id=${encodeURIComponent(fileId)}`,
          { signal: AbortSignal.timeout(10000) }
        );
        if (getFileResponse.ok) {
          const getFileResult: TelegramFileResponse = await getFileResponse.json();
          if (getFileResult.ok && getFileResult.result) {
            const filePath = getFileResult.result.file_path;
            const downloadUrl = `https://api.telegram.org/file/bot${cachedToken}/${filePath}`;
            const downloadResponse = await fetch(downloadUrl, {
              signal: AbortSignal.timeout(30000)
            });
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
          }
        }
        // 失败则删除缓存，进入后续流程
        fileIdToToken.delete(fileId);
        console.warn(`[Telegram Image Proxy] file_id 缓存 token 失效，删除缓存并回退流程`);
      } catch {
        fileIdToToken.delete(fileId);
      }
    }

    // 优先：如果提供了 bot_id，则尝试用对应 token
    if (botId) {
      const token = await resolveTokenByBotId(botId);
      if (token) {
        try {
          // 1) 获取文件路径
          const getFileResponse = await fetch(
            `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`,
            { signal: AbortSignal.timeout(10000) }
          );
          if (getFileResponse.ok) {
            const getFileResult: TelegramFileResponse = await getFileResponse.json();
            if (getFileResult.ok && getFileResult.result) {
              const filePath = getFileResult.result.file_path;
              // 2) 下载文件
              const downloadUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
              const downloadResponse = await fetch(downloadUrl, {
                signal: AbortSignal.timeout(30000)
              });
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
            }
          }
          // 失败则继续进入下方轮询逻辑
          console.warn(`[Telegram Image Proxy] 指定 bot_id=${botId} 获取失败，回退到轮询`);
        } catch (e) {
          console.warn(`[Telegram Image Proxy] 指定 bot_id=${botId} 获取异常，回退到轮询`, e);
        }
      } else {
        console.warn(`[Telegram Image Proxy] 未能为 bot_id=${botId} 解析到 token，回退到轮询`);
      }
    }

    // 尝试使用轮询与故障切换（兼容旧链接或无 bot_id 的情况）
    const startIndex = currentTokenIndex;
    let lastErrorStatus: number | undefined;
    let lastErrorDesc: string | undefined;

    for (let i = 0; i < tokens.length; i++) {
      const token = getNextTelegramToken();
      if (!token) break;

      try {
        // 1. 获取文件路径
        const getFileResponse = await fetch(
          `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`,
          { signal: AbortSignal.timeout(10000) }
        );

        if (!getFileResponse.ok) {
          lastErrorStatus = getFileResponse.status;
          console.warn(
            `[Telegram Image Proxy] getFile 使用 token 失败 (HTTP ${getFileResponse.status})，尝试下一个`
          );
          continue; // 尝试下一个 token
        }

        const getFileResult: TelegramFileResponse = await getFileResponse.json();
        if (!getFileResult.ok || !getFileResult.result) {
          lastErrorDesc = getFileResult.description || 'Failed to get file path';
          console.warn(
            `[Telegram Image Proxy] getFile 返回错误: ${lastErrorDesc}，尝试下一个 token`
          );
          continue; // 尝试下一个
        }

        const filePath = getFileResult.result.file_path;

        // 2. 下载文件
        const downloadUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
        const downloadResponse = await fetch(downloadUrl, {
          signal: AbortSignal.timeout(30000)
        });

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
        console.warn('[Telegram Image Proxy] 使用当前 token 访问失败，尝试下一个', err);
        continue;
      }
    }

    // 所有 token 均失败
    console.error(
      `[Telegram Image Proxy] 所有 Bot Token 均尝试失败。lastStatus=${lastErrorStatus}, lastDesc=${lastErrorDesc}`
    );
    return NextResponse.json(
      { error: 'Failed to fetch image from Telegram with all tokens' },
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

