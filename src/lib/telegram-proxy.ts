/**
 * Telegram 请求代理工具
 * 为发往 https://api.telegram.org 的请求按需附加 undici ProxyAgent
 * 只在服务端环境（Node.js Runtime）下使用
 */

const TELEGRAM_PROXY_ENABLED = process.env.TELEGRAM_PROXY_ENABLED === 'true';
const TELEGRAM_PROXY_URL = process.env.TELEGRAM_PROXY_URL || '';

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


