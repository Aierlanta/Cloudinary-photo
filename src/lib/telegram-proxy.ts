/**
 * Telegram 请求代理工具
 * 为发往 https://api.telegram.org 的请求按需附加 undici ProxyAgent
 * 只在服务端环境（Node.js Runtime）下使用
 */

const TELEGRAM_PROXY_ENABLED = process.env.TELEGRAM_PROXY_ENABLED === 'true';
const TELEGRAM_PROXY_URL = process.env.TELEGRAM_PROXY_URL || '';

/**
 * 对 Telegram Bot 直连 URL 做脱敏（bot<TOKEN> -> bot***）
 * 仅用于日志/错误信息；不影响实际请求
 */
export function redactTelegramBotTokenInUrl(url: string): string {
  if (!url) return url;
  // https://api.telegram.org/file/bot<TOKEN>/...
  // https://api.telegram.org/bot<TOKEN>/...
  return url
    .replace(/(api\.telegram\.org\/file\/bot)[^/]+/ig, '$1***')
    .replace(/(api\.telegram\.org\/bot)[^/]+/ig, '$1***');
}

/**
 * 脱敏 Telegram Bot Token（默认保留前后各4位；可通过 options 调整）
 */
export function maskTelegramBotToken(
  token: string,
  options: { prefixLen?: number; suffixLen?: number } = {}
): string {
  const prefixLen = options.prefixLen ?? 4;
  const suffixLen = options.suffixLen ?? 4;

  if (!token) return '****';
  if (prefixLen < 0 || suffixLen < 0) return '****';

  // 过短时直接整体脱敏
  if (token.length <= prefixLen + suffixLen) return '****';

  const head = prefixLen > 0 ? token.substring(0, prefixLen) : '';
  const tail = suffixLen > 0 ? token.substring(token.length - suffixLen) : '';
  return suffixLen > 0 ? `${head}...${tail}` : `${head}...`;
}

/**
 * 为指定 URL 构造带 Telegram 代理的 RequestInit
 * - 仅当启用 TELEGRAM_PROXY_ENABLED 且 TELEGRAM_PROXY_URL 有值时生效
 * - 仅匹配 api.telegram.org 域名
 * - 失败时静默回退为直连，请求方逻辑不受影响
 */
export function buildFetchInitFor(url: string, extra: RequestInit = {}): RequestInit {
  if (
    TELEGRAM_PROXY_ENABLED &&
    TELEGRAM_PROXY_URL &&
    /^https?:\/\/api\.telegram\.org\//i.test(url)
  ) {
    try {
      // 动态引入，避免类型依赖，并且只在服务端执行
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const undici = require('undici');
      if (undici?.ProxyAgent) {
        const dispatcher = new undici.ProxyAgent(TELEGRAM_PROXY_URL);
        return { dispatcher, ...extra } as RequestInit;
      }
    } catch {
      // 代理不可用时静默回退为直连
    }
  }

  return { ...extra } as RequestInit;
}


