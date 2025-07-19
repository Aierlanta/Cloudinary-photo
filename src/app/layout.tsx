import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { PageErrorBoundary } from '@/components/ErrorBoundary'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '随机图片API',
  description: '基于Next.js的随机图片API服务，集成Cloudinary图床',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <PageErrorBoundary>
          {children}
        </PageErrorBoundary>
      </body>
    </html>
  )
}