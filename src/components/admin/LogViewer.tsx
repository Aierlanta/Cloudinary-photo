'use client'

import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  MoreHorizontal,
  RefreshCw,
  Search,
  AlertTriangle,
  Trash2,
} from 'lucide-react'

import { useState, useEffect, useCallback, useRef } from 'react'
import { LogLevel } from '@/lib/logger'
import { useLocale } from '@/hooks/useLocale'
import { useToast } from '@/hooks/useToast'
import { ToastContainer } from '@/components/ui/Toast'
import { useAdminApi } from '@/lib/admin-api-client'
import { OrnateIcon } from '@/components/ui/ornate-icon'

interface LogEntry {
  id?: string
  timestamp: Date | string
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
  maxEntries = 25,
  autoRefresh: initialAutoRefresh = false,
  refreshInterval = 5000
}: LogViewerProps) {
  const { t, locale } = useLocale();
  const { adminFetch } = useAdminApi();
  const { toasts, success, error: showError, removeToast } = useToast();
  const {
    loadFailedFormat,
    loadFailedHttp,
    loadFailedNetwork
  } = t.adminLogs;
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(initialAutoRefresh)
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false)
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

  const filterRef = useRef(filter)
  const limitRef = useRef(pagination.limit)
  const pageRef = useRef(pagination.page)
  const logsRef = useRef(logs)
  filterRef.current = filter
  limitRef.current = pagination.limit
  pageRef.current = pagination.page
  logsRef.current = logs

  // 加载日志：filter/limit 走 ref，避免翻页更新 page 后重建 loadLogs，
  // 再被下方 useEffect 误当成「筛选变了」把页码打回 1。
  const loadLogs = useCallback(async (page: number = 1) => {
    const currentFilter = filterRef.current
    const limit = limitRef.current
    pageRef.current = page
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', limit.toString())
      if (currentFilter.level !== 'all') {
        params.append('level', currentFilter.level.toString())
      }
      if (currentFilter.search) {
        params.append('search', currentFilter.search)
      }
      if (currentFilter.type !== 'all') {
        params.append('type', currentFilter.type)
      }
      if (currentFilter.dateFrom) {
        params.append('dateFrom', currentFilter.dateFrom)
      }
      if (currentFilter.dateTo) {
        params.append('dateTo', currentFilter.dateTo)
      }

      const response = await adminFetch(`/api/admin/logs?${params}`)
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
          setError(loadFailedFormat)
        }
      } else {
        setError(`${loadFailedHttp} ${response.status}`)
      }
    } catch (error) {
      console.error('加载日志失败:', error)
      setError(loadFailedNetwork)
    } finally {
      setLoading(false)
    }
  }, [adminFetch, loadFailedFormat, loadFailedHttp, loadFailedNetwork])

  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }))
    void loadLogs(1)
  }, [filter, loadLogs])

  // 自动刷新：仅第 1 页做流式追加，避免打乱翻页结果
  const fetchNewLogs = useCallback(async () => {
    if (pageRef.current !== 1) return

    const currentLogs = logsRef.current
    const currentFilter = filterRef.current

    if (currentLogs.length === 0) {
      void loadLogs(1)
      return
    }

    try {
      const latestLog = currentLogs[0]
      const dateFrom = typeof latestLog.timestamp === 'string'
        ? latestLog.timestamp
        : latestLog.timestamp.toISOString()

      const params = new URLSearchParams()
      params.append('page', '1')
      params.append('limit', '50')
      if (currentFilter.level !== 'all') params.append('level', currentFilter.level.toString())
      if (currentFilter.search) params.append('search', currentFilter.search)
      if (currentFilter.type !== 'all') params.append('type', currentFilter.type)
      params.append('dateFrom', dateFrom)

      const response = await adminFetch(`/api/admin/logs?${params}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data?.logs?.length > 0) {
          const newLogs = data.data.logs as LogEntry[]

          const uniqueNewLogs = newLogs.filter(newLog => {
            if (newLog.id && latestLog.id) {
              return !currentLogs.some(existingLog => existingLog.id === newLog.id)
            }
            const newTime = typeof newLog.timestamp === 'string'
              ? newLog.timestamp
              : new Date(newLog.timestamp).toISOString()
            return !currentLogs.some(existingLog => {
              const existingTime = typeof existingLog.timestamp === 'string'
                ? existingLog.timestamp
                : new Date(existingLog.timestamp).toISOString()
              return existingTime === newTime && existingLog.message === newLog.message
            })
          })

          if (uniqueNewLogs.length > 0) {
            setLogs(prevLogs => [...uniqueNewLogs, ...prevLogs].slice(0, 500))
            setPagination(prev => ({
              ...prev,
              total: (prev.total || 0) + uniqueNewLogs.length
            }))
          }
        }
      }
    } catch (error) {
      console.error('流式获取日志失败:', error)
    }
  }, [adminFetch, loadLogs])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      void fetchNewLogs()
    }, refreshInterval)
    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchNewLogs])

  const handlePageChange = (newPage: number) => {
    const maxPage = Math.max(1, pagination.totalPages)
    if (newPage >= 1 && newPage <= maxPage && newPage !== pagination.page) {
      void loadLogs(newPage)
    }
  }

  const handleExportLogs = async (format: 'json' | 'csv' | 'txt') => {
    try {
      const response = await adminFetch('/api/admin/logs/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format }),
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `logs_${new Date().toISOString().split('T')[0]}.${format}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } else {
        showError(t.adminLogs.exportFailed)
      }
    } catch (exportError) {
      console.error('导出日志失败:', exportError)
      showError(t.adminLogs.exportFailed)
    }
    setIsExportMenuOpen(false)
  }

  const handleClearLogs = async () => {
    if (!confirm(t.adminLogs.clearConfirm)) return

    try {
      const response = await adminFetch('/api/admin/logs/clear', { method: 'POST' })
      if (response.ok) {
        success(t.adminLogs.cleared)
        void loadLogs(1)
      } else {
        showError(t.adminLogs.clearFailed)
      }
    } catch (clearError) {
      console.error('清空日志失败:', clearError)
      showError(t.adminLogs.clearFailed)
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

  const totalRecords = pagination.total || logs.length
  const errorCount = logs.filter((log) => log.level === LogLevel.ERROR).length
  const warningCount = logs.filter((log) => log.level === LogLevel.WARN).length
  const totalPages = Math.max(1, pagination.totalPages)
  const paginationStart = Math.max(1, Math.min(pagination.page - 1, totalPages - 2))
  const visiblePages = Array.from({ length: Math.min(3, totalPages) }, (_, index) => paginationStart + index)
  const lastVisiblePage = visiblePages[visiblePages.length - 1]

  // 翻译日志消息（智能模式匹配）
  const translateLogMessage = (message: string): string => {
    // 关键词模式匹配（按优先级排序）
    const patterns: Array<{ pattern: RegExp; key: keyof typeof t.adminLogs.logMessages }> = [
      // API 相关
      { pattern: /API.*状态.*检查.*成功/i, key: 'apiStatusCheckSuccess' },
      { pattern: /API.*状态.*检查.*失败/i, key: 'apiStatusCheckFailed' },
      { pattern: /API.*状态.*记录/i, key: 'apiStatusRecorded' },
      { pattern: /API.*状态.*完成/i, key: 'statusCheckComplete' },
      
      // 状态检查
      { pattern: /.*状态.*检查.*完成/i, key: 'statusCheckComplete' },
      { pattern: /.*自检.*完成/i, key: 'statusCheckComplete' },
      
      // 配置相关
      { pattern: /.*配置.*保存.*成功/i, key: 'configSaveSuccess' },
      { pattern: /.*配置.*更新/i, key: 'configUpdated' },
      { pattern: /.*配置.*开.*启/i, key: 'configUpdated' },
      { pattern: /.*配置.*开.*始/i, key: 'configUpdated' },
      
      // 存储相关
      { pattern: /.*存储.*缺失/i, key: 'queryLastUsedStorage' },
      { pattern: /.*上传.*存储/i, key: 'uploadLogToStorage' },
      
      // 管理操作
      { pattern: /.*管理.*操作.*日志/i, key: 'getAdminActionLogs' },
      { pattern: /.*获取.*日志/i, key: 'getAdminActionLogs' },
      
      // 任务相关
      { pattern: /.*启动.*任务/i, key: 'startScheduledCleanup' },
      { pattern: /.*开始.*任务/i, key: 'startScheduledCleanup' },
      { pattern: /.*清理.*任务/i, key: 'startScheduledCleanup' },
      
      // 分组操作
      { pattern: /.*分组.*操作/i, key: 'executeGroupOperation' },
      { pattern: /.*分组.*创建/i, key: 'groupCreated' },
      { pattern: /.*分组.*删除/i, key: 'groupDeleted' },
      
      // 数据库
      { pattern: /.*数据库.*成功/i, key: 'databaseQuerySuccess' },
      { pattern: /.*数据库.*失败/i, key: 'databaseQueryFailed' },
      
      // 图片操作
      { pattern: /.*图片.*上传/i, key: 'imageUploaded' },
      { pattern: /.*图片.*删除/i, key: 'imageDeleted' },
      
      // 备份相关
      { pattern: /.*备份状态.*查询.*成功/i, key: 'backupStatusQueried' },
      { pattern: /.*手动备份.*成功/i, key: 'manualBackupSuccess' },
      { pattern: /.*数据库备份.*完成/i, key: 'databaseBackupComplete' },
      { pattern: /.*开始.*数据库备份/i, key: 'startDatabaseBackup' },
      { pattern: /.*表.*备份.*完成/i, key: 'tableBackupComplete' },
      { pattern: /.*表数据.*逐行.*复制.*完成/i, key: 'tableDataRowCopied' },
      { pattern: /.*表数据.*复制.*完成/i, key: 'tableDataCopied' },
      { pattern: /.*表结构.*复制.*完成/i, key: 'tableStructureCopied' },
      { pattern: /.*清空备份表.*成功/i, key: 'backupTableCleared' },
      { pattern: /.*发现.*表.*备份/i, key: 'tablesFoundForBackup' },
      { pattern: /.*跳过.*备份/i, key: 'skipBackup' },
      { pattern: /.*启动.*备份.*调度器/i, key: 'startLogScheduler' },
      { pattern: /.*备份.*操作/i, key: 'backupOperation' },
      
      // 任务相关（更具体）
      { pattern: /.*定时.*清除/i, key: 'cleanupTask' },
      { pattern: /.*定时.*处理/i, key: 'processingTask' },
      { pattern: /.*定期.*处理/i, key: 'processingTask' },
      { pattern: /.*定时.*任务/i, key: 'scheduleTask' },
      { pattern: /.*定期.*任务/i, key: 'scheduleTask' },
      
      // 统计相关
      { pattern: /.*统计.*日志/i, key: 'statisticsLog' },
      { pattern: /.*统计.*任务/i, key: 'statisticsLog' },
      
      // 日志清理
      { pattern: /.*没有.*清理.*旧日志/i, key: 'noOldLogs' },
      { pattern: /.*开始.*日志清理/i, key: 'startLogCleanup' },
      { pattern: /.*执行.*日志清理/i, key: 'startLogCleanup' },
      { pattern: /.*启动.*清理.*调度器/i, key: 'startLogScheduler' },
      
      // 系统检查
      { pattern: /.*开始.*系统.*检查/i, key: 'startSystemCheck' },
      
      // 其他
      { pattern: /.*用户操作/i, key: 'userActionRecorded' },
      { pattern: /.*安全事件/i, key: 'securityEventDetected' },
      { pattern: /.*参数.*更新/i, key: 'parameterUpdated' },
    ];

    // 尝试模式匹配
    for (const { pattern, key } of patterns) {
      if (pattern.test(message)) {
        // 如果原消息包含数字或特殊信息，保留它们
        const translated = t.adminLogs.logMessages[key];
        // 尝试提取数字和特殊标识
        const numbers = message.match(/\d+/g);
        if (numbers && numbers.length > 0) {
          return `${translated} (${numbers.join(', ')})`;
        }
        return translated;
      }
    }

    // 没有匹配则返回原消息
    return message;
  };

  const formatTimestamp = (timestamp: Date | string) => {
    try {
      const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
      return date.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
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
      return t.adminLogs.invalidTime;
    }
  }

  return (
    <div className="admin-log-viewer transparent-panel rounded-lg p-6 shadow-lg flex flex-col h-full">
      <div className="admin-log-toolbar shrink-0">
        <div className="admin-log-toolbar-actions">
          <button
            type="button"
            className="admin-log-action admin-log-action-refresh"
            onClick={() => void loadLogs(pagination.page)}
          >
            <OrnateIcon icon={RefreshCw} tone="lavender" size="sm" />
            {t.adminLogs.refresh}
          </button>

          <label className={`admin-log-autorefresh${autoRefresh ? ' is-on' : ''}`}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span className="admin-log-switch" aria-hidden />
            <span>{t.adminLogs.autoRefresh}</span>
          </label>

          <div className="admin-log-export">
            <button
              type="button"
              className="admin-log-action admin-log-action-export"
              onClick={() => setIsExportMenuOpen((open) => !open)}
              aria-expanded={isExportMenuOpen}
            >
              <OrnateIcon icon={Download} tone="mint" size="sm" />
              {t.adminUi.exportData}
              <OrnateIcon icon={ChevronDown} tone="lavender" size="sm" />
            </button>
            {isExportMenuOpen ? (
              <div className="admin-log-export-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => void handleExportLogs('json')}>
                  {t.adminLogs.jsonFormat}
                </button>
                <button type="button" role="menuitem" onClick={() => void handleExportLogs('csv')}>
                  {t.adminLogs.csvFormat}
                </button>
                <button type="button" role="menuitem" onClick={() => void handleExportLogs('txt')}>
                  {t.adminLogs.textFormat}
                </button>
              </div>
            ) : null}
          </div>

          {process.env.NODE_ENV === 'development' ? (
            <button
              type="button"
              className="admin-log-action admin-log-action-clear"
              onClick={() => void handleClearLogs()}
            >
              <OrnateIcon icon={Trash2} tone="pink" size="sm" />
              {t.adminLogs.clearLogs}
            </button>
          ) : null}
        </div>
      </div>

      {/* 筛选器 */}
      <div className="admin-log-filterbar space-y-4 mb-6 shrink-0">
        <div className="admin-log-filter-selects grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* 日志级别过滤 */}
          <div>
            <label className="block text-sm font-medium panel-text mb-2 rounded-lg">
              {t.adminLogs.logLevel}
            </label>
            <select
              value={filter.level}
              onChange={(e) => setFilter(prev => ({ ...prev, level: e.target.value as LogLevel | 'all' }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-lg"
            >
              <option value="all">{t.adminLogs.allLevels}</option>
              <option value={LogLevel.DEBUG}>DEBUG</option>
              <option value={LogLevel.INFO}>INFO</option>
              <option value={LogLevel.WARN}>WARN</option>
              <option value={LogLevel.ERROR}>ERROR</option>
            </select>
          </div>

          {/* 日志类型过滤 */}
          <div>
            <label className="block text-sm font-medium panel-text mb-2 rounded-lg">
              {t.adminLogs.logType}
            </label>
            <select
              value={filter.type}
              onChange={(e) => setFilter(prev => ({ ...prev, type: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-lg"
            >
              <option value="all">{t.adminLogs.allTypes}</option>
              <option value="api_request">{t.adminLogs.apiRequest}</option>
              <option value="api_response">{t.adminLogs.apiResponse}</option>
              <option value="database">{t.adminLogs.database}</option>
              <option value="user_action">{t.adminLogs.userAction}</option>
              <option value="security">{t.adminLogs.security}</option>
              <option value="admin_action">{t.adminLogs.adminAction}</option>
              <option value="api_status">{t.adminLogs.statusCheck}</option>
              <option value="api_config">{t.adminLogs.configManagement}</option>
            </select>
          </div>

          {/* 时间范围 */}
          <div>
            <label className="block text-sm font-medium panel-text mb-2 rounded-lg">
              {t.adminLogs.timeRange}
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
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-lg"
            >
              <option value="all">{t.adminLogs.allTime}</option>
              <option value="1h">{t.adminLogs.lastHour}</option>
              <option value="24h">{t.adminLogs.last24Hours}</option>
              <option value="7d">{t.adminLogs.last7Days}</option>
              <option value="30d">{t.adminLogs.last30Days}</option>
            </select>
          </div>

          {/* 每页条数 */}
          <div>
            <label className="block text-sm font-medium panel-text mb-2 rounded-lg">
              {t.adminLogs.itemsPerPage}
            </label>
            <select
              value={pagination.limit}
              onChange={(e) => {
                const newLimit = parseInt(e.target.value, 10)
                limitRef.current = newLimit
                setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }))
                void loadLogs(1)
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-lg"
            >
              <option value="7">7</option>
              <option value="25">{t.adminLogs.items25}</option>
              <option value="50">{t.adminLogs.items50}</option>
              <option value="100">{t.adminLogs.items100}</option>
              <option value="200">{t.adminLogs.items200}</option>
            </select>
          </div>
        </div>

        {/* 搜索框和操作按钮 */}
        <div className="admin-log-searchrow flex items-end space-x-4">
          <div className="flex-1">
            <label className="block text-sm font-medium panel-text mb-2 rounded-lg">
              {t.adminLogs.searchLogMessage}
            </label>
            <div className="relative">
              <input
                type="text"
                value={filter.search}
                onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
                placeholder={t.adminLogs.searchPlaceholder}
                className="w-full px-3 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-lg"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <OrnateIcon icon={Search} tone="lavender" size="sm" />
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
            className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors rounded-lg"
          >
            {t.adminLogs.clearFilters}
          </button>
        </div>
      </div>

      {/* 错误显示 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg shrink-0">
          <div className="flex items-center">
            <OrnateIcon icon={AlertTriangle} tone="pink" size="sm" />
            <span className="text-red-700 dark:text-red-300">{error}</span>
          </div>
        </div>
      )}

      {/* 日志列表 */}
      <div className="admin-log-list bg-gray-50 dark:bg-gray-900 rounded-lg p-4 flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="text-center py-8 rounded-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{t.common.loading}</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400">{t.adminLogs.noLogsFound}</p>
          </div>
        ) : (
          <div className="space-y-2 rounded-lg">
            <AnimatePresence initial={false}>
              {logs.map((log, index) => (
                <motion.div
                  key={log.id || `${typeof log.timestamp === 'string' ? log.timestamp : log.timestamp.toISOString()}-${index}`}
                  initial={{ opacity: 0, y: -20, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="admin-log-entry bg-white dark:bg-gray-800 rounded p-3 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                >
                  <div className="admin-log-entry-layout flex items-start justify-between">
                    <span
                      className="admin-log-artwork"
                      data-level={log.level}
                      aria-hidden="true"
                    />
                    <div className="admin-log-entry-main flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`admin-log-level px-2 py-1 rounded text-xs font-medium ${getLevelColor(log.level)}`}>
                          {getLevelName(log.level)}
                        </span>
                        <span className="admin-log-time text-xs text-gray-500 dark:text-gray-400 rounded-lg">
                          {formatTimestamp(log.timestamp)}
                        </span>
                        {log.requestId && (
                          <span className="text-xs text-gray-400 dark:text-gray-500 font-mono rounded-lg">
                            {log.requestId}
                          </span>
                        )}
                      </div>
                      <p className="admin-log-message text-sm panel-text mb-1 rounded-lg">{translateLogMessage(log.message)}</p>
                      {log.context && Object.keys(log.context).length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer rounded-lg">
                            {t.adminLogs.viewDetails}
                          </summary>
                          <pre className="text-xs text-gray-600 dark:text-gray-300 mt-1 bg-gray-100 dark:bg-gray-700 p-2 rounded overflow-auto rounded-lg">
                            {JSON.stringify(log.context, null, 2)}
                          </pre>
                        </details>
                      )}
                      {log.error && (
                        <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded rounded-lg">
                          <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                            {log.error.message}
                          </p>
                          {log.error.stack && (
                            <details className="mt-1">
                              <summary className="text-xs text-red-600 dark:text-red-400 cursor-pointer rounded-lg">
                                {t.adminUi.stackTrace}
                              </summary>
                              <pre className="text-xs text-red-600 dark:text-red-400 mt-1 overflow-auto max-h-32 rounded-lg">
                                {log.error.stack}
                              </pre>
                            </details>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className="admin-log-footer shrink-0">
        <div className="admin-log-summary" aria-label={t.adminUi.logSummary}>
          <span><small>{t.adminUi.total}</small><strong>{totalRecords}</strong></span>
          <span><small>{t.adminUi.errors}</small><strong>{errorCount}</strong></span>
          <span><small>{t.adminUi.warnings}</small><strong>{warningCount}</strong></span>
        </div>
        <nav className="admin-log-pagination" aria-label={t.adminLogs.title}>
          <button
            type="button"
            aria-label={t.adminLogs.previous}
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
          >
            <OrnateIcon icon={ChevronLeft} tone="lavender" size="sm" />
          </button>
          {visiblePages[0] > 1 ? (
            <span className="admin-log-page-ellipsis" aria-hidden><OrnateIcon icon={MoreHorizontal} tone="lavender" size="sm" /></span>
          ) : null}
          {visiblePages.map((page) => (
            <button
              key={page}
              type="button"
              className={page === pagination.page ? "admin-log-page-current" : undefined}
              onClick={() => handlePageChange(page)}
              aria-current={page === pagination.page ? "page" : undefined}
              aria-label={`${t.adminLogs.page} ${page}`}
            >
              {page}
            </button>
          ))}
          {lastVisiblePage < totalPages ? (
            <>
                <span className="admin-log-page-ellipsis" aria-hidden><OrnateIcon icon={MoreHorizontal} tone="lavender" size="sm" /></span>
              <button
                type="button"
                onClick={() => handlePageChange(totalPages)}
                aria-label={`${t.adminLogs.page} ${totalPages}`}
              >
                {totalPages}
              </button>
            </>
          ) : null}
          <button
            type="button"
            aria-label={t.adminLogs.next}
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page >= totalPages}
          >
            <OrnateIcon icon={ChevronRight} tone="lavender" size="sm" />
          </button>
        </nav>
        <p className="admin-log-meta">
          {t.adminLogs.showingRecords.replace('{count}', logs.length.toString())}
          {filter.search && ` (${t.adminLogs.searchFilter.replace('{search}', filter.search)})`}
          {filter.level !== 'all' && ` (${t.adminLogs.levelFilter.replace('{level}', getLevelName(filter.level as LogLevel))})`}
          {filter.type !== 'all' && ` (${t.adminLogs.typeFilter.replace('{type}', filter.type)})`}
        </p>
      </div>

      <ToastContainer toasts={toasts.map((toast) => ({ ...toast, onClose: removeToast }))} />
    </div>
  )
}
