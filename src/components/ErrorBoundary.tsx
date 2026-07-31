'use client'

import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { OrnateIcon } from '@/components/ui/ornate-icon'
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

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })
    logger.error('React Error Boundary caught an error', error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
    })
    captureError(error, {
      componentStack: errorInfo.componentStack,
      type: 'react_error_boundary',
    })
    this.props.onError?.(error, errorInfo)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return this.props.fallback ?? <DefaultErrorFallback error={this.state.error} />
  }
}

function DefaultErrorFallback({ error }: { error?: Error }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full mx-4">
        <div className="transparent-panel rounded-lg p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mb-6">
            <OrnateIcon icon={AlertTriangle} tone="pink" size="md" surface="light" />
          </div>
          <h1 className="text-2xl font-bold panel-text mb-4">出现了一些问题</h1>
          <p className="text-gray-600 dark:text-gray-300 panel-text mb-6">
            页面遇到了意外错误。我们已经记录了这个问题，正在努力修复。
          </p>
          {process.env.NODE_ENV === 'development' && error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-left">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                错误详情 (仅开发环境显示)
              </h3>
              <pre className="text-xs text-red-700 dark:text-red-300 overflow-auto">
                {error.message}{error.stack ? `\n\n${error.stack}` : ''}
              </pre>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              重新加载页面
            </button>
            <button
              onClick={() => { window.location.href = '/' }}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              返回首页
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 panel-text mt-6">
            如果问题持续存在，请联系技术支持
          </p>
        </div>
      </div>
    </div>
  )
}

export function useErrorHandler() {
  return (error: Error, errorInfo?: unknown) => {
    const context = errorInfo && typeof errorInfo === 'object'
      ? (errorInfo as Record<string, any>)
      : undefined
    logger.error('Manual error report', error, context)
    captureError(error, context)
  }
}

export function useAsyncError() {
  const [, setError] = React.useState<Error>()
  return React.useCallback((error: Error) => {
    setError(() => { throw error })
  }, [])
}

export function PageErrorBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary fallback={<DefaultErrorFallback />}>{children}</ErrorBoundary>
}

export function ComponentErrorBoundary({
  children,
  componentName,
}: {
  children: ReactNode
  componentName?: string
}) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        logger.error(`Error in component: ${componentName || 'Unknown'}`, error, {
          componentStack: errorInfo.componentStack,
          componentName,
        })
      }}
      fallback={
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <div className="flex items-center">
            <OrnateIcon icon={AlertTriangle} tone="pink" size="sm" surface="light" />
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
