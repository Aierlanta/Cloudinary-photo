import type { Metadata } from 'next'
import { Baloo_2, Nunito, ZCOOL_KuaiLe, DM_Mono } from 'next/font/google'
import './globals.css'
import { PageErrorBoundary } from '@/components/ErrorBoundary'
import { cookies, headers } from 'next/headers'
import { PHProvider } from './providers'

const displayFont = Baloo_2({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display',
})

const bodyFont = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-body',
})

const displayZhFont = ZCOOL_KuaiLe({
  weight: '400',
  variable: '--font-display-zh',
  preload: false,
})

const monoFont = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: '随机图片API',
  description: '基于Next.js的随机图片API服务，集成Cloudinary图床',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = cookies()
  const hdrs = headers()

  const adminMode = cookieStore.get('admin-theme-mode')?.value
  const adminTheme = cookieStore.get('admin-theme')?.value
  const siteMode = cookieStore.get('site-theme-mode')?.value
  const siteTheme = cookieStore.get('site-theme')?.value

  let theme: 'light' | 'dark'

  if (adminMode === 'manual' && (adminTheme === 'light' || adminTheme === 'dark')) {
    theme = adminTheme
  } else if (siteMode === 'manual' && (siteTheme === 'light' || siteTheme === 'dark')) {
    theme = siteTheme
  } else {
    const prefersDark = hdrs.get('sec-ch-prefers-color-scheme') === 'dark'
    theme = prefersDark ? 'dark' : 'light'
  }

  return (
    <html lang="zh-CN" data-theme={theme} className={theme === 'dark' ? 'dark' : undefined}>
      <body className={`${displayFont.variable} ${displayZhFont.variable} ${bodyFont.variable} ${monoFont.variable} font-body`}>
        <PHProvider>
          <PageErrorBoundary>
            {children}
          </PageErrorBoundary>
        </PHProvider>
      </body>
    </html>
  )
}