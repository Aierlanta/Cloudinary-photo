'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLocale } from '@/hooks/useLocale'
import { useAdminVersion } from '@/contexts/AdminVersionContext'
import { GlassCard, GlassButton } from '@/components/ui/glass'
import { 
  Activity, 
  RefreshCw, 
  Database, 
  Cloud, 
  Server, 
  Cpu, 
  AlertTriangle, 
  CheckCircle, 
  Info,
  Zap
} from 'lucide-react'

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
  const { t } = useLocale();
  const { version } = useAdminVersion();
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const loadStatus = useCallback(async () => {
    try {
      setError(null)
      const response = await fetch('/api/status')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setStatus(data.data)
        } else {
          setError(t.adminStatus.loadFailedFormat)
        }
      } else {
        setError(`${t.adminStatus.loadFailedHttp} ${response.status}`)
      }
    } catch (error) {
      console.error('加载系统状态失败:', error)
      setError(t.adminStatus.loadFailedNetwork)
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(loadStatus, 30000) // 30秒刷新一次
      return () => clearInterval(interval)
    }
  }, [autoRefresh, loadStatus])

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (days > 0) return `${days}${t.adminStatus.days}${hours}${t.adminStatus.hours}${minutes}${t.adminStatus.minutes}`
    if (hours > 0) return `${hours}${t.adminStatus.hours}${minutes}${t.adminStatus.minutes}`
    return `${minutes}${t.adminStatus.minutes}`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-500'
      case 'degraded': return 'text-yellow-500'
      case 'down': return 'text-red-500'
      default: return 'text-muted-foreground'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'healthy': return t.adminStatus.healthy
      case 'degraded': return t.adminStatus.degraded
      case 'down': return t.adminStatus.down
      default: return t.adminStatus.unknown
    }
  }

  const getHealthScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-500'
    if (score >= 70) return 'text-yellow-500'
    return 'text-red-500'
  }

  if (loading) {
    if (version === 'v2') {
       return <div className="p-8 text-center text-muted-foreground">Loading system status...</div>
    }
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
     if (version === 'v2') {
        return <div className="p-8 text-center text-red-500">{error}</div>
     }
    return (
      <div className="space-y-6">
        <div className="transparent-panel rounded-lg p-6 shadow-lg">
          <h1 className="text-2xl font-bold panel-text mb-4">{t.adminStatus.title}</h1>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700 dark:text-red-300">{error}</span>
            </div>
            <button
              onClick={loadStatus}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              {t.adminStatus.retry}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!status) return null

  // --- V2 Layout ---
  if (version === 'v2') {
     return (
        <div className="space-y-8">
           {/* Header */}
           <div className="flex justify-between items-start">
              <div>
                 <h1 className="text-3xl font-bold mb-2">{t.adminStatus.title}</h1>
                 <p className="text-muted-foreground">{t.adminStatus.description}</p>
              </div>
              <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="relative flex h-2 w-2">
                       <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${status.status === 'healthy' ? 'bg-green-400' : 'bg-yellow-400'}`}></span>
                       <span className={`relative inline-flex rounded-full h-2 w-2 ${status.status === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                    </span>
                    {autoRefresh ? 'Live' : 'Paused'}
                 </div>
                 <GlassButton onClick={loadStatus} icon={RefreshCw}>
                    {t.adminStatus.refreshStatus}
                 </GlassButton>
              </div>
           </div>

           {/* Main Stats Grid */}
           <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <GlassCard className="p-6 flex items-center gap-4" hover>
                 <div className="p-3 rounded-xl bg-blue-500/20 text-blue-500">
                    <Activity className="w-6 h-6" />
                 </div>
                 <div>
                    <p className="text-sm text-muted-foreground">{t.adminStatus.uptime}</p>
                    <p className="text-xl font-bold">{formatUptime(status.uptime)}</p>
                 </div>
              </GlassCard>
              
              <GlassCard className="p-6 flex items-center gap-4" hover>
                 <div className="p-3 rounded-xl bg-green-500/20 text-green-500">
                    <Zap className="w-6 h-6" />
                 </div>
                 <div>
                    <p className="text-sm text-muted-foreground">{t.adminStatus.healthScore}</p>
                    <p className={`text-xl font-bold ${getHealthScoreColor(status.health.score)}`}>{status.health.score}/100</p>
                 </div>
              </GlassCard>

              <GlassCard className="p-6 flex items-center gap-4" hover>
                 <div className="p-3 rounded-xl bg-purple-500/20 text-purple-500">
                    <Activity className="w-6 h-6" />
                 </div>
                 <div>
                    <p className="text-sm text-muted-foreground">{t.adminStatus.responseTime}</p>
                    <p className="text-xl font-bold">{status.performance.responseTime}</p>
                 </div>
              </GlassCard>

              <GlassCard className="p-6 flex items-center gap-4" hover>
                 <div className="p-3 rounded-xl bg-orange-500/20 text-orange-500">
                    <Info className="w-6 h-6" />
                 </div>
                 <div>
                    <p className="text-sm text-muted-foreground">{t.adminStatus.version}</p>
                    <p className="text-xl font-bold">{status.version}</p>
                 </div>
              </GlassCard>
           </div>

           {/* Services Status */}
           <GlassCard className="p-6">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                 <Server className="w-5 h-5 text-primary" />
                 {t.adminStatus.serviceStatus}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {/* Database */}
                 <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex justify-between items-start mb-4">
                       <div className="flex items-center gap-3">
                          <Database className="w-5 h-5 text-muted-foreground" />
                          <span className="font-medium">{t.adminStatus.database}</span>
                       </div>
                       <div className={`w-3 h-3 rounded-full ${status.services.database.healthy ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
                    </div>
                    <div className="space-y-2 text-sm">
                       <div className="flex justify-between text-muted-foreground">
                          <span>Status</span>
                          <span className={status.services.database.healthy ? 'text-green-500' : 'text-red-500'}>
                             {status.services.database.healthy ? t.adminStatus.normal : t.adminStatus.abnormal}
                          </span>
                       </div>
                       <div className="flex justify-between text-muted-foreground">
                          <span>Response</span>
                          <span>{status.services.database.responseTime}ms</span>
                       </div>
                    </div>
                 </div>

                 {/* Cloudinary */}
                 <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex justify-between items-start mb-4">
                       <div className="flex items-center gap-3">
                          <Cloud className="w-5 h-5 text-muted-foreground" />
                          <span className="font-medium">Cloudinary</span>
                       </div>
                       <div className={`w-3 h-3 rounded-full ${status.services.cloudinary.healthy ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
                    </div>
                    <div className="space-y-2 text-sm">
                       <div className="flex justify-between text-muted-foreground">
                          <span>Status</span>
                          <span className={status.services.cloudinary.healthy ? 'text-green-500' : 'text-red-500'}>
                             {status.services.cloudinary.healthy ? t.adminStatus.normal : t.adminStatus.abnormal}
                          </span>
                       </div>
                       <div className="flex justify-between text-muted-foreground">
                          <span>Response</span>
                          <span>{status.services.cloudinary.responseTime}ms</span>
                       </div>
                    </div>
                 </div>

                 {/* API */}
                 <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex justify-between items-start mb-4">
                       <div className="flex items-center gap-3">
                          <Server className="w-5 h-5 text-muted-foreground" />
                          <span className="font-medium">{t.adminStatus.apiService}</span>
                       </div>
                       <div className={`w-3 h-3 rounded-full ${status.services.api.enabled ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
                    </div>
                    <div className="space-y-2 text-sm">
                       <div className="flex justify-between text-muted-foreground">
                          <span>Status</span>
                          <span className={status.services.api.enabled ? 'text-green-500' : 'text-red-500'}>
                             {status.services.api.enabled ? t.adminStatus.enabled : t.adminStatus.disabled}
                          </span>
                       </div>
                       <div className="flex justify-between text-muted-foreground">
                          <span>Params</span>
                          <span>{status.services.api.parametersCount}</span>
                       </div>
                    </div>
                 </div>
              </div>
           </GlassCard>

           {/* Performance & Stats Grid */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <GlassCard className="p-6">
                 <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-primary" />
                    {t.adminStatus.memoryUsage}
                 </h3>
                 <div className="space-y-4">
                    {[
                       { label: t.adminStatus.used, value: status.performance.memoryUsage.used, total: status.performance.memoryUsage.total },
                       { label: t.adminStatus.heapMemory, value: status.performance.memoryUsage.heap, total: status.performance.memoryUsage.total },
                    ].map((item, i) => (
                       <div key={i}>
                          <div className="flex justify-between text-sm mb-1">
                             <span className="text-muted-foreground">{item.label}</span>
                             <span className="font-medium">{item.value}MB</span>
                          </div>
                          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                             <div 
                                className="h-full bg-primary transition-all duration-1000" 
                                style={{ width: `${Math.min((item.value / item.total) * 100, 100)}%` }} 
                             />
                          </div>
                       </div>
                    ))}
                    <div className="flex justify-between text-sm pt-2 border-t border-white/10">
                       <span className="text-muted-foreground">{t.adminStatus.totalMemory}</span>
                       <span className="font-mono">{status.performance.memoryUsage.total}MB</span>
                    </div>
                 </div>
              </GlassCard>

              <GlassCard className="p-6">
                 <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary" />
                    {t.adminStatus.systemStats}
                 </h3>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                       <div className="text-2xl font-bold">{status.stats.totalImages}</div>
                       <div className="text-xs text-muted-foreground uppercase mt-1">{t.adminStatus.totalImages}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                       <div className="text-2xl font-bold">{status.stats.totalGroups}</div>
                       <div className="text-xs text-muted-foreground uppercase mt-1">{t.adminStatus.groupsCount}</div>
                    </div>
                    {status.stats.logStats && (
                       <>
                          <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                             <div className="text-2xl font-bold">{status.stats.logStats.totalLogs}</div>
                             <div className="text-xs text-muted-foreground uppercase mt-1">{t.adminStatus.totalLogs}</div>
                          </div>
                          <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                             <div className={`text-2xl font-bold ${status.stats.logStats.recentErrors > 0 ? 'text-red-500' : ''}`}>
                                {status.stats.logStats.recentErrors}
                             </div>
                             <div className="text-xs text-muted-foreground uppercase mt-1">{t.adminStatus.recentErrors}</div>
                          </div>
                       </>
                    )}
                 </div>
              </GlassCard>
           </div>

           {/* Issues */}
           {status.health.issues.length > 0 && (
              <GlassCard className="p-6 border-yellow-500/30 bg-yellow-500/5">
                 <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-yellow-500">
                    <AlertTriangle className="w-5 h-5" />
                    {t.adminStatus.healthIssues}
                 </h3>
                 <div className="space-y-2">
                    {status.health.issues.map((issue, index) => (
                       <div key={index} className="flex items-center gap-3 text-sm text-yellow-200/80 bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                          {issue}
                       </div>
                    ))}
                 </div>
              </GlassCard>
           )}
        </div>
     )
  }

  // ... V1 Layout ...
  return (
    <div className="space-y-6">
      {/* 页面标题和总体状态 */}
      <div className="transparent-panel rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold panel-text mb-2">{t.adminStatus.title}</h1>
            <p className="text-gray-600 dark:text-gray-300 panel-text">
              {t.adminStatus.description}
            </p>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold ${getStatusColor(status.status)}`}>
              {getStatusText(status.status)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300 panel-text">
              {t.adminStatus.systemStatus}
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={loadStatus}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm transition-colors"
            >
              {t.adminStatus.refreshStatus}
            </button>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm panel-text">{t.adminStatus.autoRefresh}</span>
            </label>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t.adminStatus.lastUpdate}: {new Date(status.timestamp).toLocaleString('zh-CN')}
          </div>
        </div>
      </div>

      {/* 系统概览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="transparent-panel rounded-lg p-6 shadow-lg">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-500 bg-opacity-20">
              <Activity className="w-8 h-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <h2 className="text-lg font-semibold panel-text">{t.adminStatus.uptime}</h2>
              <p className="text-2xl font-bold text-blue-600 panel-text">
                {formatUptime(status.uptime)}
              </p>
            </div>
          </div>
        </div>

        <div className="transparent-panel rounded-lg p-6 shadow-lg">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-500 bg-opacity-20">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div className="ml-4">
              <h2 className="text-lg font-semibold panel-text">{t.adminStatus.healthScore}</h2>
              <p className={`text-2xl font-bold ${getHealthScoreColor(status.health.score)}`}>
                {status.health.score}/100
              </p>
            </div>
          </div>
        </div>

        <div className="transparent-panel rounded-lg p-6 shadow-lg">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-500 bg-opacity-20">
              <Activity className="w-8 h-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <h2 className="text-lg font-semibold panel-text">{t.adminStatus.responseTime}</h2>
              <p className="text-2xl font-bold text-purple-600 panel-text">
                {status.performance.responseTime}
              </p>
            </div>
          </div>
        </div>

        <div className="transparent-panel rounded-lg p-6 shadow-lg">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-orange-500 bg-opacity-20">
              <Info className="w-8 h-8 text-orange-600" />
            </div>
            <div className="ml-4">
              <h2 className="text-lg font-semibold panel-text">{t.adminStatus.version}</h2>
              <p className="text-2xl font-bold text-orange-600 panel-text">
                {status.version}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 服务状态 */}
      <div className="transparent-panel rounded-lg p-6 shadow-lg">
        <h2 className="text-xl font-semibold panel-text mb-4">{t.adminStatus.serviceStatus}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 数据库状态 */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium panel-text">{t.adminStatus.database}</h3>
              <div className={`w-3 h-3 rounded-full ${
                status.services.database.healthy ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {t.adminStatus.status}: {status.services.database.healthy ? t.adminStatus.normal : t.adminStatus.abnormal}
            </p>
            {status.services.database.responseTime && (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {t.adminStatus.responseTime}: {status.services.database.responseTime}ms
              </p>
            )}
            {status.services.database.error && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                {t.adminStatus.error}: {status.services.database.error}
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
              {t.adminStatus.status}: {status.services.cloudinary.healthy ? t.adminStatus.normal : t.adminStatus.abnormal}
            </p>
            {status.services.cloudinary.responseTime && (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {t.adminStatus.responseTime}: {status.services.cloudinary.responseTime}ms
              </p>
            )}
            {status.services.cloudinary.error && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                {t.adminStatus.error}: {status.services.cloudinary.error}
              </p>
            )}
          </div>

          {/* API状态 */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium panel-text">{t.adminStatus.apiService}</h3>
              <div className={`w-3 h-3 rounded-full ${
                status.services.api.enabled ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {t.adminStatus.status}: {status.services.api.enabled ? t.adminStatus.enabled : t.adminStatus.disabled}
            </p>
            {status.services.api.parametersCount !== undefined && (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {t.adminStatus.parametersCount}: {status.services.api.parametersCount}
              </p>
            )}
            {status.services.api.error && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                {t.adminStatus.error}: {status.services.api.error}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 性能指标 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 内存使用 */}
        <div className="transparent-panel rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-semibold panel-text mb-4">{t.adminStatus.memoryUsage}</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm panel-text">{t.adminStatus.used}</span>
              <span className="text-sm font-medium panel-text">{status.performance.memoryUsage.used}MB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm panel-text">{t.adminStatus.totalMemory}</span>
              <span className="text-sm font-medium panel-text">{status.performance.memoryUsage.total}MB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm panel-text">{t.adminStatus.heapMemory}</span>
              <span className="text-sm font-medium panel-text">{status.performance.memoryUsage.heap}MB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm panel-text">{t.adminStatus.externalMemory}</span>
              <span className="text-sm font-medium panel-text">{status.performance.memoryUsage.external}MB</span>
            </div>
          </div>
        </div>

        {/* 系统统计 */}
        <div className="transparent-panel rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-semibold panel-text mb-4">{t.adminStatus.systemStats}</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm panel-text">{t.adminStatus.totalImages}</span>
              <span className="text-sm font-medium panel-text">{status.stats.totalImages}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm panel-text">{t.adminStatus.groupsCount}</span>
              <span className="text-sm font-medium panel-text">{status.stats.totalGroups}</span>
            </div>
            {status.stats.logStats && (
              <>
                <div className="flex justify-between">
                  <span className="text-sm panel-text">{t.adminStatus.totalLogs}</span>
                  <span className="text-sm font-medium panel-text">{status.stats.logStats.totalLogs}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm panel-text">{t.adminStatus.recentErrors}</span>
                  <span className="text-sm font-medium panel-text">{status.stats.logStats.recentErrors}</span>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <span className="text-sm panel-text">{t.adminStatus.environment}</span>
              <span className="text-sm font-medium panel-text">{status.environment}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 健康问题 */}
      {status.health.issues.length > 0 && (
        <div className="transparent-panel rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-semibold panel-text mb-4">{t.adminStatus.healthIssues}</h2>
          <div className="space-y-2">
            {status.health.issues.map((issue, index) => (
              <div key={index} className="flex items-center p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-yellow-500 mr-2 flex-shrink-0" />
                <span className="text-yellow-700 dark:text-yellow-300">{issue}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
