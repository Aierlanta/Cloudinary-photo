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