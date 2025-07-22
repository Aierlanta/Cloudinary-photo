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
      // 动态添加 tgState 域名
      ...(process.env.TGSTATE_BASE_URL ? [{
        protocol: 'https',
        hostname: new URL(process.env.TGSTATE_BASE_URL).hostname,
        port: '',
        pathname: '/**',
      }] : []),
    ],
    // 启用图片优化
    formats: ['image/webp', 'image/avif'],
    // 允许的图片尺寸
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // 最小缓存时间
    minimumCacheTTL: 60,
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