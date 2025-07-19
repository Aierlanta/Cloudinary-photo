'use client'

import { useEffect } from 'react'
import { logger } from '@/lib/logger'
import { captureError } from '@/lib/error-handler'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Next.js 全局错误页面
 * 处理应用级别的错误
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
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="max-w-lg w-full mx-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
              {/* 错误图标 */}
              <div className="mx-auto w-20 h-20 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mb-6">
                <svg 
                  className="w-10 h-10 text-red-600 dark:text-red-400" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" 
                  />
                </svg>
              </div>

              {/* 错误标题 */}
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                应用程序错误
              </h1>

              {/* 错误描述 */}
              <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                很抱歉，应用程序遇到了意外错误。我们已经记录了这个问题，
                技术团队将尽快修复。请尝试以下解决方案：
              </p>

              {/* 开发环境下显示错误详情 */}
              {process.env.NODE_ENV === 'development' && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-left">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                    错误详情 (仅开发环境显示)
                  </h3>
                  <div className="text-xs text-red-700 dark:text-red-300">
                    <p className="font-mono mb-2">{error.message}</p>
                    {error.digest && (
                      <p className="text-gray-600 dark:text-gray-400">
                        错误ID: {error.digest}
                      </p>
                    )}
                    {error.stack && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-red-600 dark:text-red-400">
                          查看堆栈跟踪
                        </summary>
                        <pre className="mt-2 text-xs overflow-auto max-h-40 bg-red-100 dark:bg-red-900/40 p-2 rounded">
                          {error.stack}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              )}

              {/* 解决方案列表 */}
              <div className="mb-8 text-left">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  尝试解决方案：
                </h3>
                <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                  <li className="flex items-start">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-medium mr-3 mt-0.5">
                      1
                    </span>
                    <span>刷新页面重新加载应用程序</span>
                  </li>
                  <li className="flex items-start">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-medium mr-3 mt-0.5">
                      2
                    </span>
                    <span>清除浏览器缓存和Cookie</span>
                  </li>
                  <li className="flex items-start">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-medium mr-3 mt-0.5">
                      3
                    </span>
                    <span>返回首页重新开始</span>
                  </li>
                  <li className="flex items-start">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-medium mr-3 mt-0.5">
                      4
                    </span>
                    <span>如果问题持续存在，请联系技术支持</span>
                  </li>
                </ul>
              </div>

              {/* 操作按钮 */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleReset}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  重试
                </button>
                <button
                  onClick={handleReload}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  刷新页面
                </button>
                <button
                  onClick={handleGoHome}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  返回首页
                </button>
              </div>

              {/* 帮助信息 */}
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  错误已自动报告给技术团队
                </p>
                {error.digest && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    错误ID: {error.digest}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
