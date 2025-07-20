'use client'

import { useState, useEffect } from 'react'

interface SystemStatus {
  status: 'healthy' | 'degraded' | 'down'
  timestamp: string
  uptime: number
  version: string
  environment: string
  services: {
    database: {
      healthy: boolean
      responseTime?: number
      error?: string
      details?: any
    }
    cloudinary: {
      healthy: boolean
      responseTime?: number
      error?: string
      details?: any
    }
    api: {
      enabled: boolean
      configured: boolean
      parametersCount?: number
      error?: string
      details?: any
    }
  }
  stats: {
    totalImages: number
    totalGroups: number
    memoryUsage: NodeJS.MemoryUsage
    cpuUsage?: {
      user: number
      system: number
    }
    logStats?: {
      totalLogs: number
      recentErrors: number
    }
  }
  performance: {
    responseTime: string
    memoryUsage: {
      used: number
      total: number
      heap: number
      external: number
    }
    cpuUsage?: {
      user: number
      system: number
    }
  }
  health: {
    score: number
    issues: string[]
  }
}

export default function SystemStatusPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const loadStatus = async () => {
    try {
      setError(null)
      const response = await fetch('/api/status')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setStatus(data.data)
        } else {
          setError('获取状态失败：响应格式错误')
        }
      } else {
        setError(`获取状态失败：HTTP ${response.status}`)
      }
    } catch (error) {
      console.error('加载系统状态失败:', error)
      setError('获取状态失败：网络错误')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(loadStatus, 30000) // 30秒刷新一次
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (days > 0) {
      return `${days}天${hours}小时${minutes}分钟`
    } else if (hours > 0) {
      return `${hours}小时${minutes}分钟`
    } else {
      return `${minutes}分钟`
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 dark:text-green-400'
      case 'degraded':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'down':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'healthy':
        return '正常'
      case 'degraded':
        return '部分可用'
      case 'down':
        return '不可用'
      default:
        return '未知'
    }
  }

  const getHealthScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 dark:text-green-400'
    if (score >= 70) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="transparent-panel rounded-lg p-6 shadow-lg">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="transparent-panel rounded-lg p-6 shadow-lg">
          <h1 className="text-2xl font-bold panel-text mb-4">系统状态</h1>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-700 dark:text-red-300">{error}</span>
            </div>
            <button
              onClick={loadStatus}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              重试
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!status) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* 页面标题和总体状态 */}
      <div className="transparent-panel rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold panel-text mb-2">系统状态</h1>
            <p className="text-gray-600 dark:text-gray-300 panel-text">
              实时监控系统运行状态和性能指标
            </p>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold ${getStatusColor(status.status)}`}>
              {getStatusText(status.status)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300 panel-text">
              系统状态
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={loadStatus}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm transition-colors"
            >
              刷新状态
            </button>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm panel-text">自动刷新</span>
            </label>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            最后更新: {new Date(status.timestamp).toLocaleString('zh-CN')}
          </div>
        </div>
      </div>

      {/* 系统概览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="transparent-panel rounded-lg p-6 shadow-lg">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-500 bg-opacity-20">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-lg font-semibold panel-text">运行时间</h2>
              <p className="text-2xl font-bold text-blue-600 panel-text">
                {formatUptime(status.uptime)}
              </p>
            </div>
          </div>
        </div>

        <div className="transparent-panel rounded-lg p-6 shadow-lg">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-500 bg-opacity-20">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-lg font-semibold panel-text">健康评分</h2>
              <p className={`text-2xl font-bold ${getHealthScoreColor(status.health.score)}`}>
                {status.health.score}/100
              </p>
            </div>
          </div>
        </div>

        <div className="transparent-panel rounded-lg p-6 shadow-lg">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-500 bg-opacity-20">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-lg font-semibold panel-text">响应时间</h2>
              <p className="text-2xl font-bold text-purple-600 panel-text">
                {status.performance.responseTime}
              </p>
            </div>
          </div>
        </div>

        <div className="transparent-panel rounded-lg p-6 shadow-lg">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-orange-500 bg-opacity-20">
              <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-lg font-semibold panel-text">版本</h2>
              <p className="text-2xl font-bold text-orange-600 panel-text">
                {status.version}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 服务状态 */}
      <div className="transparent-panel rounded-lg p-6 shadow-lg">
        <h2 className="text-xl font-semibold panel-text mb-4">服务状态</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 数据库状态 */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium panel-text">数据库</h3>
              <div className={`w-3 h-3 rounded-full ${
                status.services.database.healthy ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              状态: {status.services.database.healthy ? '正常' : '异常'}
            </p>
            {status.services.database.responseTime && (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                响应时间: {status.services.database.responseTime}ms
              </p>
            )}
            {status.services.database.error && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                错误: {status.services.database.error}
              </p>
            )}
          </div>

          {/* Cloudinary状态 */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium panel-text">Cloudinary</h3>
              <div className={`w-3 h-3 rounded-full ${
                status.services.cloudinary.healthy ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              状态: {status.services.cloudinary.healthy ? '正常' : '异常'}
            </p>
            {status.services.cloudinary.responseTime && (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                响应时间: {status.services.cloudinary.responseTime}ms
              </p>
            )}
            {status.services.cloudinary.error && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                错误: {status.services.cloudinary.error}
              </p>
            )}
          </div>

          {/* API状态 */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium panel-text">API服务</h3>
              <div className={`w-3 h-3 rounded-full ${
                status.services.api.enabled ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              状态: {status.services.api.enabled ? '启用' : '禁用'}
            </p>
            {status.services.api.parametersCount !== undefined && (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                参数数量: {status.services.api.parametersCount}
              </p>
            )}
            {status.services.api.error && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                错误: {status.services.api.error}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 性能指标 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 内存使用 */}
        <div className="transparent-panel rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-semibold panel-text mb-4">内存使用</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm panel-text">已使用</span>
              <span className="text-sm font-medium panel-text">{status.performance.memoryUsage.used}MB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm panel-text">总内存</span>
              <span className="text-sm font-medium panel-text">{status.performance.memoryUsage.total}MB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm panel-text">堆内存</span>
              <span className="text-sm font-medium panel-text">{status.performance.memoryUsage.heap}MB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm panel-text">外部内存</span>
              <span className="text-sm font-medium panel-text">{status.performance.memoryUsage.external}MB</span>
            </div>
          </div>
        </div>

        {/* 系统统计 */}
        <div className="transparent-panel rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-semibold panel-text mb-4">系统统计</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm panel-text">图片总数</span>
              <span className="text-sm font-medium panel-text">{status.stats.totalImages}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm panel-text">分组数量</span>
              <span className="text-sm font-medium panel-text">{status.stats.totalGroups}</span>
            </div>
            {status.stats.logStats && (
              <>
                <div className="flex justify-between">
                  <span className="text-sm panel-text">日志总数</span>
                  <span className="text-sm font-medium panel-text">{status.stats.logStats.totalLogs}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm panel-text">最近错误</span>
                  <span className="text-sm font-medium panel-text">{status.stats.logStats.recentErrors}</span>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <span className="text-sm panel-text">环境</span>
              <span className="text-sm font-medium panel-text">{status.environment}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 健康问题 */}
      {status.health.issues.length > 0 && (
        <div className="transparent-panel rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-semibold panel-text mb-4">健康问题</h2>
          <div className="space-y-2">
            {status.health.issues.map((issue, index) => (
              <div key={index} className="flex items-center p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <svg className="w-5 h-5 text-yellow-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span className="text-yellow-700 dark:text-yellow-300">{issue}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
