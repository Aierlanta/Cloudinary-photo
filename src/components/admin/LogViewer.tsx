'use client'

import { motion, AnimatePresence } from 'framer-motion'

import { useState, useEffect, useCallback } from 'react'
import { LogLevel } from '@/lib/logger'
import { useLocale } from '@/hooks/useLocale'

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
  const { t } = useLocale();
  const {
    loadFailedFormat,
    loadFailedHttp,
    loadFailedNetwork
  } = t.adminLogs;
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
  const loadLogs = useCallback(async (page: number = pagination.page) => {
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
  }, [pagination.page, pagination.limit, filter, loadFailedFormat, loadFailedHttp, loadFailedNetwork])

  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }))
    loadLogs(1)
  }, [filter, loadLogs])

  // 自动刷新逻辑 - 改为流式更新
  const fetchNewLogs = useCallback(async () => {
    if (logs.length === 0) {
      loadLogs(1);
      return;
    }

    try {
      // 获取最新的一条日志的时间戳
      const latestLog = logs[0];
      const dateFrom = typeof latestLog.timestamp === 'string' 
        ? latestLog.timestamp 
        : latestLog.timestamp.toISOString();

      const params = new URLSearchParams();
      params.append('page', '1');
      params.append('limit', '50'); // 获取最新的50条，防止漏掉
      if (filter.level !== 'all') params.append('level', filter.level.toString());
      if (filter.search) params.append('search', filter.search);
      if (filter.type !== 'all') params.append('type', filter.type);
      
      // 使用 dateFrom 获取比当前最新日志更新的日志
      // 注意：API是 gte (大于等于)，所以我们需要在前端去重
      params.append('dateFrom', dateFrom);

      const response = await fetch(`/api/admin/logs?${params}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.logs?.length > 0) {
          const newLogs = data.data.logs as LogEntry[];
          
          // 过滤掉已存在的日志
          const uniqueNewLogs = newLogs.filter(newLog => {
            // 如果有ID，使用ID去重
            if (newLog.id && latestLog.id) {
              // 检查当前日志列表中是否存在该ID
              return !logs.some(existingLog => existingLog.id === newLog.id);
            }
            // 降级使用时间戳+消息内容去重
            const newTime = typeof newLog.timestamp === 'string' ? newLog.timestamp : new Date(newLog.timestamp).toISOString();
            return !logs.some(existingLog => {
              const existingTime = typeof existingLog.timestamp === 'string' ? existingLog.timestamp : new Date(existingLog.timestamp).toISOString();
              return existingTime === newTime && existingLog.message === newLog.message;
            });
          });

          if (uniqueNewLogs.length > 0) {
            setLogs(prevLogs => {
              // 将新日志插入到顶部
              const updatedLogs = [...uniqueNewLogs, ...prevLogs];
              // 保持列表长度不超过一定限制（例如 500 条），避免内存溢出
              return updatedLogs.slice(0, 500);
            });
            
            // 更新分页总数信息
            setPagination(prev => ({
              ...prev,
              total: (prev.total || 0) + uniqueNewLogs.length
            }));
          }
        }
      }
    } catch (error) {
      console.error('流式获取日志失败:', error);
    }
  }, [logs, filter, loadLogs]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchNewLogs();
      }, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchNewLogs]);

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
      return t.adminLogs.invalidTime;
    }
  }

  return (
    <div className="transparent-panel rounded-lg p-6 shadow-lg flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h2 className="text-lg font-semibold panel-text">{t.adminLogs.systemLogs}</h2>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => loadLogs()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors rounded-lg"
          >
            {t.adminLogs.refresh}
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
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors rounded-lg"
            >
              {t.adminLogs.generateTestLog}
            </button>
          )}
          <label className="flex items-center text-sm panel-text rounded-lg">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="mr-2"
            />
            {t.adminLogs.autoRefresh}
          </label>
        </div>
      </div>

      {/* 筛选器 */}
      <div className="space-y-4 mb-6 shrink-0">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                const newLimit = parseInt(e.target.value);
                setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }));
                loadLogs(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-lg"
            >
              <option value="25">{t.adminLogs.items25}</option>
              <option value="50">{t.adminLogs.items50}</option>
              <option value="100">{t.adminLogs.items100}</option>
              <option value="200">{t.adminLogs.items200}</option>
            </select>
          </div>
        </div>

        {/* 搜索框和操作按钮 */}
        <div className="flex items-end space-x-4">
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
            <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-700 dark:text-red-300">{error}</span>
          </div>
        </div>
      )}

      {/* 日志列表 */}
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="text-center py-8 rounded-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">加载中...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400">暂无日志记录</p>
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
                  className="bg-white dark:bg-gray-800 rounded p-3 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getLevelColor(log.level)}`}>
                          {getLevelName(log.level)}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 rounded-lg">
                          {formatTimestamp(log.timestamp)}
                        </span>
                        {log.requestId && (
                          <span className="text-xs text-gray-400 dark:text-gray-500 font-mono rounded-lg">
                            {log.requestId}
                          </span>
                        )}
                      </div>
                      <p className="text-sm panel-text mb-1 rounded-lg">{translateLogMessage(log.message)}</p>
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
                                堆栈跟踪
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

      {/* 分页控件 */}
      {pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between shrink-0">
          <div className="text-sm text-gray-500 dark:text-gray-400 rounded-lg">
            {t.adminLogs.pageInfo
              .replace('{page}', pagination.page.toString())
              .replace('{totalPages}', pagination.totalPages.toString())
              .replace('{total}', pagination.total.toString())}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              {t.adminLogs.previous}
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              {t.adminLogs.next}
            </button>
          </div>
        </div>
      )}

      {/* 统计信息 */}
      <div className="mt-4 text-sm text-gray-500 dark:text-gray-400 panel-text shrink-0">
        {t.adminLogs.showingRecords.replace('{count}', logs.length.toString())}
        {filter.search && ` (${t.adminLogs.searchFilter.replace('{search}', filter.search)})`}
        {filter.level !== 'all' && ` (${t.adminLogs.levelFilter.replace('{level}', getLevelName(filter.level as LogLevel))})`}
        {filter.type !== 'all' && ` (${t.adminLogs.typeFilter.replace('{type}', filter.type)})`}
      </div>
    </div>
  )
}
