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
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(initialAutoRefresh)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: maxEntries,
    total: 0,
    totalPages: 0
  })
  const [filter, setFilter] = useState<{
    level: LogLevel | 'all'
    search: string
    type: string
    timeRange?: string
    dateFrom?: string
    dateTo?: string
  }>({
    level: 'all',
    search: '',
    type: 'all'
  })

  // 加载日志
  const loadLogs = async (page: number = pagination.page) => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', pagination.limit.toString())
      if (filter.level !== 'all') {
        params.append('level', filter.level.toString())
      }
      if (filter.search) {
        params.append('search', filter.search)
      }
      if (filter.type !== 'all') {
        params.append('type', filter.type)
      }
      if (filter.dateFrom) {
        params.append('dateFrom', filter.dateFrom)
      }
      if (filter.dateTo) {
        params.append('dateTo', filter.dateTo)
      }

      const response = await fetch(`/api/admin/logs?${params}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setLogs(data.data?.logs || [])
          setPagination(prev => ({
            ...prev,
            page: data.data?.page || page,
            total: data.data?.total || 0,
            totalPages: data.data?.totalPages || 0
          }))
        } else {
          setError('获取日志失败：响应格式错误')
        }
      } else {
        setError(`获取日志失败：HTTP ${response.status}`)
      }
    } catch (error) {
      console.error('加载日志失败:', error)
      setError('获取日志失败：网络错误')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }))
    loadLogs(1)
  }, [filter])

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => loadLogs(), refreshInterval)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, refreshInterval])

  // 分页处理
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      loadLogs(newPage)
    }
  }

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

  const formatTimestamp = (timestamp: Date | string) => {
    try {
      const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
      return date.toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch (error) {
      return '无效时间';
    }
  }

  return (
    <div className="transparent-panel rounded-lg p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold panel-text">系统日志</h2>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => loadLogs()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
          >
            刷新
          </button>
          {(process.env.NODE_ENV === 'development' || true) && (
            <button
              onClick={async () => {
                try {
                  const response = await fetch('/api/admin/logs/test', { method: 'POST' });
                  if (response.ok) {
                    loadLogs(); // 重新加载日志
                  }
                } catch (error) {
                  console.error('生成测试日志失败:', error);
                }
              }}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors"
            >
              生成测试日志
            </button>
          )}
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
      <div className="space-y-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* 日志级别过滤 */}
          <div>
            <label className="block text-sm font-medium panel-text mb-2">
              日志级别
            </label>
            <select
              value={filter.level}
              onChange={(e) => setFilter(prev => ({ ...prev, level: e.target.value as LogLevel | 'all' }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">全部级别</option>
              <option value={LogLevel.DEBUG}>DEBUG</option>
              <option value={LogLevel.INFO}>INFO</option>
              <option value={LogLevel.WARN}>WARN</option>
              <option value={LogLevel.ERROR}>ERROR</option>
            </select>
          </div>

          {/* 日志类型过滤 */}
          <div>
            <label className="block text-sm font-medium panel-text mb-2">
              日志类型
            </label>
            <select
              value={filter.type}
              onChange={(e) => setFilter(prev => ({ ...prev, type: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">全部类型</option>
              <option value="api_request">API请求</option>
              <option value="api_response">API响应</option>
              <option value="database">数据库</option>
              <option value="user_action">用户操作</option>
              <option value="security">安全</option>
              <option value="admin_action">管理操作</option>
              <option value="api_status">状态检查</option>
              <option value="api_config">配置管理</option>
            </select>
          </div>

          {/* 时间范围 */}
          <div>
            <label className="block text-sm font-medium panel-text mb-2">
              时间范围
            </label>
            <select
              value={filter.timeRange || 'all'}
              onChange={(e) => {
                const value = e.target.value;
                if (value === 'all') {
                  setFilter(prev => ({ ...prev, timeRange: undefined, dateFrom: undefined, dateTo: undefined }));
                } else {
                  const now = new Date();
                  let dateFrom: Date;

                  switch (value) {
                    case '1h':
                      dateFrom = new Date(now.getTime() - 60 * 60 * 1000);
                      break;
                    case '24h':
                      dateFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                      break;
                    case '7d':
                      dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                      break;
                    case '30d':
                      dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                      break;
                    default:
                      dateFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                  }

                  setFilter(prev => ({
                    ...prev,
                    timeRange: value,
                    dateFrom: dateFrom.toISOString(),
                    dateTo: now.toISOString()
                  }));
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">全部时间</option>
              <option value="1h">最近1小时</option>
              <option value="24h">最近24小时</option>
              <option value="7d">最近7天</option>
              <option value="30d">最近30天</option>
            </select>
          </div>

          {/* 每页条数 */}
          <div>
            <label className="block text-sm font-medium panel-text mb-2">
              每页条数
            </label>
            <select
              value={pagination.limit}
              onChange={(e) => {
                const newLimit = parseInt(e.target.value);
                setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }));
                loadLogs(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="25">25条</option>
              <option value="50">50条</option>
              <option value="100">100条</option>
              <option value="200">200条</option>
            </select>
          </div>
        </div>

        {/* 搜索框和操作按钮 */}
        <div className="flex items-end space-x-4">
          <div className="flex-1">
            <label className="block text-sm font-medium panel-text mb-2">
              搜索日志消息
            </label>
            <div className="relative">
              <input
                type="text"
                value={filter.search}
                onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
                placeholder="搜索日志消息、错误信息、用户ID等..."
                className="w-full px-3 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* 清除过滤器按钮 */}
          <button
            onClick={() => {
              setFilter({
                level: 'all',
                search: '',
                type: 'all',
                timeRange: undefined,
                dateFrom: undefined,
                dateTo: undefined
              });
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            清除过滤器
          </button>
        </div>
      </div>

      {/* 错误显示 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-700 dark:text-red-300">{error}</span>
          </div>
        </div>
      )}

      {/* 日志列表 */}
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 h-[calc(100vh-400px)] min-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">加载中...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">暂无日志记录</p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log, index) => (
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

      {/* 分页控件 */}
      {pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            第 {pagination.page} 页，共 {pagination.totalPages} 页 (总计 {pagination.total} 条记录)
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              上一页
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              下一页
            </button>
          </div>
        </div>
      )}

      {/* 统计信息 */}
      <div className="mt-4 text-sm text-gray-500 dark:text-gray-400 panel-text">
        显示 {logs.length} 条日志记录
        {filter.search && ` (搜索: "${filter.search}")`}
        {filter.level !== 'all' && ` (级别: ${getLevelName(filter.level as LogLevel)})`}
        {filter.type !== 'all' && ` (类型: ${filter.type})`}
      </div>
    </div>
  )
}
