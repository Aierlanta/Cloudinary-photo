/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['res.cloudinary.com'],
  },
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
  // 优化生产环境启动速度
  output: 'standalone',
  // 减少启动时的检查
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // 优化服务器启动
  poweredByHeader: false,
  compress: true,
}

module.exports = nextConfig