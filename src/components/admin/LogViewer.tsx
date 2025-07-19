'use client'

import { useState, useEffect } from 'react'
import { LogLevel } from '@/lib/logger'

interface LogEntry {
  timestamp: Date
  level: LogLevel
  message: string
  context?: Record<string, any>
  error?: Error
  requestId?: string
}

interface LogViewerProps {
  maxEntries?: number
  autoRefresh?: boolean
  refreshInterval?: number
}

export default function LogViewer({
  maxEntries = 100,
  autoRefresh: initialAutoRefresh = false,
  refreshInterval = 5000
}: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(initialAutoRefresh)
  const [filter, setFilter] = useState<{
    level: LogLevel | 'all'
    search: string
    type: string
  }>({
    level: 'all',
    search: '',
    type: 'all'
  })

  // 加载日志
  const loadLogs = async () => {
    try {
      const params = new URLSearchParams()
      params.append('limit', maxEntries.toString())
      if (filter.level !== 'all') {
        params.append('level', filter.level.toString())
      }
      if (filter.search) {
        params.append('search', filter.search)
      }
      if (filter.type !== 'all') {
        params.append('type', filter.type)
      }

      const response = await fetch(`/api/admin/logs?${params}`)
      if (response.ok) {
        const data = await response.json()
        setLogs(data.data?.logs || [])
      }
    } catch (error) {
      console.error('加载日志失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [filter])

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(loadLogs, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, refreshInterval])

  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case LogLevel.DEBUG:
        return 'text-gray-500 bg-gray-100 dark:bg-gray-800'
      case LogLevel.INFO:
        return 'text-blue-600 bg-blue-100 dark:bg-blue-900'
      case LogLevel.WARN:
        return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900'
      case LogLevel.ERROR:
        return 'text-red-600 bg-red-100 dark:bg-red-900'
      default:
        return 'text-gray-500 bg-gray-100 dark:bg-gray-800'
    }
  }

  const getLevelName = (level: LogLevel) => {
    return LogLevel[level] || 'UNKNOWN'
  }

  const formatTimestamp = (timestamp: Date) => {
    return new Date(timestamp).toLocaleString('zh-CN')
  }

  const filteredLogs = logs.filter(log => {
    if (filter.search && !log.message.toLowerCase().includes(filter.search.toLowerCase())) {
      return false
    }
    return true
  })

  return (
    <div className="transparent-panel rounded-lg p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold panel-text">系统日志</h2>
        <div className="flex items-center space-x-3">
          <button
            onClick={loadLogs}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
          >
            刷新
          </button>
          <label className="flex items-center text-sm panel-text">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="mr-2"
            />
            自动刷新
          </label>
        </div>
      </div>

      {/* 筛选器 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium panel-text mb-1">
            日志级别
          </label>
          <select
            value={filter.level}
            onChange={(e) => setFilter(prev => ({ ...prev, level: e.target.value as LogLevel | 'all' }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 panel-text text-sm"
          >
            <option value="all">全部</option>
            <option value={LogLevel.DEBUG}>DEBUG</option>
            <option value={LogLevel.INFO}>INFO</option>
            <option value={LogLevel.WARN}>WARN</option>
            <option value={LogLevel.ERROR}>ERROR</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium panel-text mb-1">
            日志类型
          </label>
          <select
            value={filter.type}
            onChange={(e) => setFilter(prev => ({ ...prev, type: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 panel-text text-sm"
          >
            <option value="all">全部</option>
            <option value="api_request">API请求</option>
            <option value="api_response">API响应</option>
            <option value="database">数据库</option>
            <option value="user_action">用户操作</option>
            <option value="security">安全事件</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium panel-text mb-1">
            搜索
          </label>
          <input
            type="text"
            value={filter.search}
            onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
            placeholder="搜索日志内容..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 panel-text text-sm"
          />
        </div>
      </div>

      {/* 日志列表 */}
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">加载中...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">暂无日志记录</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredLogs.map((log, index) => (
              <div
                key={index}
                className="bg-white dark:bg-gray-800 rounded p-3 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getLevelColor(log.level)}`}>
                        {getLevelName(log.level)}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatTimestamp(log.timestamp)}
                      </span>
                      {log.requestId && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                          {log.requestId}
                        </span>
                      )}
                    </div>
                    <p className="text-sm panel-text mb-1">{log.message}</p>
                    {log.context && Object.keys(log.context).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
                          查看详情
                        </summary>
                        <pre className="text-xs text-gray-600 dark:text-gray-300 mt-1 bg-gray-100 dark:bg-gray-700 p-2 rounded overflow-auto">
                          {JSON.stringify(log.context, null, 2)}
                        </pre>
                      </details>
                    )}
                    {log.error && (
                      <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded">
                        <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                          {log.error.message}
                        </p>
                        {log.error.stack && (
                          <details className="mt-1">
                            <summary className="text-xs text-red-600 dark:text-red-400 cursor-pointer">
                              堆栈跟踪
                            </summary>
                            <pre className="text-xs text-red-600 dark:text-red-400 mt-1 overflow-auto max-h-32">
                              {log.error.stack}
                            </pre>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 统计信息 */}
      <div className="mt-4 text-sm text-gray-500 dark:text-gray-400 panel-text">
        显示 {filteredLogs.length} 条日志记录
        {filter.search && ` (搜索: "${filter.search}")`}
        {filter.level !== 'all' && ` (级别: ${getLevelName(filter.level as LogLevel)})`}
      </div>
    </div>
  )
}
