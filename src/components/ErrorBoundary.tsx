'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { logger } from '@/lib/logger'
import { captureError } from '@/lib/error-handler'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

/**
 * React错误边界组件
 * 捕获子组件中的JavaScript错误并显示友好的错误界面
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    // 更新state以显示错误UI
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 记录错误信息
    this.setState({ errorInfo })
    
    // 记录到日志系统
    logger.error('React Error Boundary caught an error', error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true
    })

    // 发送到错误监控服务
    captureError(error, {
      componentStack: errorInfo.componentStack,
      type: 'react_error_boundary'
    })

    // 调用自定义错误处理函数
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  render() {
    if (this.state.hasError) {
      // 如果提供了自定义fallback，使用它
      if (this.props.fallback) {
        return this.props.fallback
      }

      // 否则显示默认错误界面
      return <DefaultErrorFallback error={this.state.error} />
    }

    return this.props.children
  }
}

/**
 * 默认错误回退界面
 */
function DefaultErrorFallback({ error }: { error?: Error }) {
  const handleReload = () => {
    window.location.reload()
  }

  const handleGoHome = () => {
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full mx-4">
        <div className="transparent-panel rounded-lg p-8 text-center">
          {/* 错误图标 */}
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mb-6">
            <svg 
              className="w-8 h-8 text-red-600 dark:text-red-400" 
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
          <h1 className="text-2xl font-bold panel-text mb-4">
            出现了一些问题
          </h1>

          {/* 错误描述 */}
          <p className="text-gray-600 dark:text-gray-300 panel-text mb-6">
            页面遇到了意外错误。我们已经记录了这个问题，正在努力修复。
          </p>

          {/* 开发环境下显示错误详情 */}
          {process.env.NODE_ENV === 'development' && error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-left">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                错误详情 (仅开发环境显示)
              </h3>
              <pre className="text-xs text-red-700 dark:text-red-300 overflow-auto">
                {error.message}
                {error.stack && (
                  <>
                    {'\n\n'}
                    {error.stack}
                  </>
                )}
              </pre>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleReload}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              重新加载页面
            </button>
            <button
              onClick={handleGoHome}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              返回首页
            </button>
          </div>

          {/* 帮助信息 */}
          <p className="text-xs text-gray-500 dark:text-gray-400 panel-text mt-6">
            如果问题持续存在，请联系技术支持
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * 简化的错误边界Hook
 */
export function useErrorHandler() {
  return (error: Error, errorInfo?: any) => {
    logger.error('Manual error report', error, errorInfo)
    captureError(error, errorInfo)
  }
}

/**
 * 异步错误处理Hook
 */
export function useAsyncError() {
  const [, setError] = React.useState()
  
  return React.useCallback((error: Error) => {
    setError(() => {
      throw error
    })
  }, [])
}

/**
 * 页面级错误边界
 */
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <DefaultErrorFallback />
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  )
}

/**
 * 组件级错误边界
 */
export function ComponentErrorBoundary({ 
  children, 
  componentName 
}: { 
  children: ReactNode
  componentName?: string 
}) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        logger.error(`Error in component: ${componentName || 'Unknown'}`, error, {
          componentStack: errorInfo.componentStack,
          componentName
        })
      }}
      fallback={
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <div className="flex items-center">
            <svg 
              className="w-5 h-5 text-red-500 mr-2" 
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
            <span className="text-sm text-red-700 dark:text-red-200">
              {componentName ? `${componentName} 组件` : '组件'}加载失败
            </span>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  )
}

export default ErrorBoundary
