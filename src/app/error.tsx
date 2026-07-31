'use client'

import { useEffect } from 'react'
import { logger } from '@/lib/logger'
import { captureError } from '@/lib/error-handler'
import { AlertTriangle } from 'lucide-react'
import { OrnateIcon } from '@/components/ui/ornate-icon'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Next.js 全局错误页面（路由段级）
 * 注意：这里渲染在根布局内部，不能再输出 <html>/<body>；
 * 需要整页替换根布局时才应使用 global-error.tsx。
 */
export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // 记录错误到日志系统
    logger.error('Global error page triggered', error, {
      digest: error.digest,
      type: 'global_error_page'
    })

    // 发送到错误监控服务
    captureError(error, {
      digest: error.digest,
      type: 'global_error_page'
    })
  }, [error])

  const handleReload = () => {
    window.location.reload()
  }

  const handleGoHome = () => {
    window.location.href = '/'
  }

  const handleReset = () => {
    reset()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-polka px-4">
      <div className="max-w-lg w-full">
        <div className="dialogue-box relative p-8 pt-12 text-center">
          {/* 名牌 */}
          <div className="name-plate absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-1.5 text-sm font-bold tracking-wider uppercase">
            Oops
          </div>

          {/* 错误图标 */}
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center">
            <OrnateIcon icon={AlertTriangle} tone="pink" size="xl" />
          </div>

          {/* 错误标题 */}
          <h1 className="font-display text-3xl font-bold text-foreground mb-4">
            应用程序错误
          </h1>

          {/* 错误描述 */}
          <p className="text-muted-foreground mb-6 leading-relaxed">
            很抱歉，应用程序遇到了意外错误。我们已经记录了这个问题，
            技术团队将尽快修复。请尝试以下解决方案：
          </p>

          {/* 开发环境下显示错误详情 */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl text-left">
              <h3 className="text-sm font-bold text-red-800 dark:text-red-200 mb-2">
                错误详情 (仅开发环境显示)
              </h3>
              <div className="text-xs text-red-700 dark:text-red-300">
                <p className="font-mono mb-2">{error.message}</p>
                {error.digest && (
                  <p className="text-muted-foreground">
                    错误ID: {error.digest}
                  </p>
                )}
                {error.stack && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-red-600 dark:text-red-400">
                      查看堆栈跟踪
                    </summary>
                    <pre className="mt-2 text-xs overflow-auto max-h-40 bg-red-100 dark:bg-red-900/40 p-2 rounded-xl">
                      {error.stack}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          )}

          {/* 解决方案列表 */}
          <div className="mb-8 text-left">
            <h3 className="text-lg font-bold text-foreground mb-4">
              尝试解决方案：
            </h3>
            <ul className="space-y-2 text-muted-foreground">
              {[
                '刷新页面重新加载应用程序',
                '清除浏览器缓存和Cookie',
                '返回首页重新开始',
                '如果问题持续存在，请联系技术支持',
              ].map((tip, index) => (
                <li key={tip} className="flex items-start">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary/20 text-primary-strong rounded-full flex items-center justify-center text-sm font-bold mr-3 mt-0.5">
                    {index + 1}
                  </span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 操作按钮 */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 bg-primary hover:bg-primary-strong text-white font-bold py-3 px-6 rounded-full shadow-soft transition-colors"
            >
              重试
            </button>
            <button
              type="button"
              onClick={handleReload}
              className="flex-1 bg-accent/80 hover:bg-accent text-white font-bold py-3 px-6 rounded-full shadow-soft transition-colors"
            >
              刷新页面
            </button>
            <button
              type="button"
              onClick={handleGoHome}
              className="flex-1 bg-card border-2 border-border hover:border-primary text-foreground font-bold py-3 px-6 rounded-full transition-colors"
            >
              返回首页
            </button>
          </div>

          {/* 帮助信息 */}
          <div className="mt-8 pt-6 border-t-2 border-dashed border-border">
            <p className="text-sm text-muted-foreground">
              错误已自动报告给技术团队
            </p>
            {error.digest && (
              <p className="text-xs text-muted-foreground/70 mt-1">
                错误ID: {error.digest}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
