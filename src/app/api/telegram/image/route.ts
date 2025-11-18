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
 * 获取第一个可用的 Telegram Bot Token
 */
function getFirstTelegramToken(): string | null {
  const tokens = process.env.TELEGRAM_BOT_TOKENS || process.env.TELEGRAM_BOT_TOKEN;
  if (!tokens) return null;
  
  const tokenList = tokens.split(',').map(t => t.trim()).filter(t => t.length > 0);
  return tokenList.length > 0 ? tokenList[0] : null;
}

/**
 * GET /api/telegram/image?file_id=xxx
 * 通过 file_id 获取 Telegram 图片
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fileId = searchParams.get('file_id');
    
    if (!fileId) {
      return NextResponse.json(
        { error: 'Missing file_id parameter' },
        { status: 400 }
      );
    }
    
    const token = getFirstTelegramToken();
    if (!token) {
      return NextResponse.json(
        { error: 'Telegram bot token not configured' },
        { status: 500 }
      );
    }
    
    // 1. 获取文件路径
    const getFileResponse = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`,
      { signal: AbortSignal.timeout(10000) }
    );
    
    if (!getFileResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to get file info from Telegram' },
        { status: getFileResponse.status }
      );
    }
    
    const getFileResult: TelegramFileResponse = await getFileResponse.json();
    
    if (!getFileResult.ok || !getFileResult.result) {
      return NextResponse.json(
        { error: getFileResult.description || 'Failed to get file path' },
        { status: 400 }
      );
    }
    
    const filePath = getFileResult.result.file_path;
    
    // 2. 下载文件
    const downloadUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
    const downloadResponse = await fetch(downloadUrl, {
      signal: AbortSignal.timeout(30000)
    });
    
    if (!downloadResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to download file from Telegram' },
        { status: downloadResponse.status }
      );
    }
    
    // 3. 返回图片
    const imageBuffer = await downloadResponse.arrayBuffer();
    const contentType = downloadResponse.headers.get('content-type') || 'application/octet-stream';
    
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable', // 缓存 1 年
      }
    });
    
  } catch (error) {
    console.error('[Telegram Image Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

