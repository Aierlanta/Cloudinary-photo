/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**',
      },
      // 允许 Telegram 文件直链域名
      {
        protocol: 'https',
        hostname: 'api.telegram.org',
        port: '',
        pathname: '/**',
      },
      // 动态添加 tgState 域名
      ...(process.env.TGSTATE_BASE_URL ? [{
        protocol: 'https',
        hostname: new URL(process.env.TGSTATE_BASE_URL).hostname,
        port: '',
        pathname: '/**',
      }] : []),
      // 如果配置了 tgState 代理域名，也允许
      ...(process.env.TGSTATE_PROXY_URL ? [{
        protocol: new URL(process.env.TGSTATE_PROXY_URL).protocol.replace(':', ''),
        hostname: new URL(process.env.TGSTATE_PROXY_URL).hostname,
        port: new URL(process.env.TGSTATE_PROXY_URL).port || '',
        pathname: '/**',
      }] : []),
    ],
    // 启用图片优化
    formats: ['image/webp', 'image/avif'],
    // 允许的图片尺寸 - 针对缩略图优化
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 150, 256, 300, 384, 400],
    // 大幅增加缓存时间 - 从60秒增加到24小时
    minimumCacheTTL: 86400, // 24小时 = 24 * 60 * 60
    // 启用图片优化的额外选项
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  env: {
    // 将 tgState 域名暴露给客户端
    NEXT_PUBLIC_TGSTATE_DOMAIN: process.env.TGSTATE_BASE_URL ? new URL(process.env.TGSTATE_BASE_URL).hostname : '',
  },
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
  // 优化服务器启动
  poweredByHeader: false,
  compress: true,
}

module.exports = nextConfig