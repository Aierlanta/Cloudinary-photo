/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['res.cloudinary.com'],
  },
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
  // 优化服务器启动
  poweredByHeader: false,
  compress: true,
}

module.exports = nextConfig