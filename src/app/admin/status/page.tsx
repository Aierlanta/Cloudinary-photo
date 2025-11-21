'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLocale } from '@/hooks/useLocale'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
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
  const isLight = useTheme();
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
    return (
      <div className={cn(
        "border p-6",
        isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
      )}>
        <div className="animate-pulse">
          <div className={cn(
            "h-8 mb-4",
            isLight ? "bg-gray-200" : "bg-gray-700"
          )} style={{ width: '25%' }}></div>
          <div className="space-y-3">
            <div className={cn(
              "h-4",
              isLight ? "bg-gray-200" : "bg-gray-700"
            )} style={{ width: '75%' }}></div>
            <div className={cn(
              "h-4",
              isLight ? "bg-gray-200" : "bg-gray-700"
            )} style={{ width: '50%' }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn(
        "border p-6",
        isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
      )}>
        <h1 className={cn(
          "text-2xl font-bold mb-4",
          isLight ? "text-gray-900" : "text-gray-100"
        )}>
          {t.adminStatus.title}
        </h1>
        <div className={cn(
          "border p-4",
          isLight
            ? "bg-red-50 border-red-300"
            : "bg-red-900/20 border-red-800"
        )}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className={isLight ? "text-red-700" : "text-red-300"}>{error}</span>
          </div>
          <button
            onClick={loadStatus}
            className={cn(
              "px-4 py-2 border transition-colors",
              isLight
                ? "bg-red-600 text-white border-red-700 hover:bg-red-700"
                : "bg-red-600 text-white border-red-500 hover:bg-red-700"
            )}
          >
            {t.adminStatus.retry}
          </button>
        </div>
      </div>
    );
  }

  if (!status) return null

  // --- V3 Layout (Flat Design) ---
  return (
      <div className="space-y-6 rounded-lg">
        {/* Header */}
        <div className={cn(
          "border p-6 flex justify-between items-start rounded-lg",
          isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
        )}>
          <div>
            <h1 className={cn(
              "text-3xl font-bold mb-2 rounded-lg",
              isLight ? "text-gray-900" : "text-gray-100"
            )}>
              {t.adminStatus.title}
            </h1>
            <p className={cn(
              "text-sm rounded-lg",
              isLight ? "text-gray-600" : "text-gray-400"
            )}>
              {t.adminStatus.description}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className={cn(
              "flex items-center gap-2 text-sm rounded-lg",
              isLight ? "text-gray-600" : "text-gray-400"
            )}>
              <span className="relative flex h-2 w-2">
                <span className={cn(
                  "absolute inline-flex h-full w-full opacity-75",
                  status.status === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'
                )} style={{ animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite' }}></span>
                <span className={cn(
                  "relative inline-flex h-2 w-2",
                  status.status === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'
                )}></span>
              </span>
              {autoRefresh ? t.adminStatus.live : t.adminStatus.paused}
            </div>
            <button
              onClick={loadStatus}
              className={cn(
                "px-4 py-2 border flex items-center gap-2 transition-colors rounded-lg",
                isLight
                  ? "bg-blue-500 text-white border-blue-600 hover:bg-blue-600"
                  : "bg-blue-600 text-white border-blue-500 hover:bg-blue-700"
              )}
            >
              <RefreshCw className="w-4 h-4" />
              {t.adminStatus.refreshStatus}
            </button>
          </div>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 rounded-lg">
          <div className={cn(
            "border p-6 flex items-center gap-4 rounded-lg",
            isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
          )}>
            <div className={cn(
              "w-12 h-12 flex items-center justify-center rounded-lg",
              isLight ? "bg-blue-500" : "bg-blue-600"
            )}>
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className={cn(
                "text-sm mb-1 rounded-lg",
                isLight ? "text-gray-600" : "text-gray-400"
              )}>
                {t.adminStatus.uptime}
              </p>
              <p className={cn(
                "text-xl font-bold rounded-lg",
                isLight ? "text-gray-900" : "text-gray-100"
              )}>
                {formatUptime(status.uptime)}
              </p>
            </div>
          </div>

          <div className={cn(
            "border p-6 flex items-center gap-4 rounded-lg",
            isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
          )}>
            <div className={cn(
              "w-12 h-12 flex items-center justify-center rounded-lg",
              isLight ? "bg-green-500" : "bg-green-600"
            )}>
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className={cn(
                "text-sm mb-1 rounded-lg",
                isLight ? "text-gray-600" : "text-gray-400"
              )}>
                {t.adminStatus.healthScore}
              </p>
              <p className={cn(
                "text-xl font-bold rounded-lg",
                getHealthScoreColor(status.health.score)
              )}>
                {status.health.score}/100
              </p>
            </div>
          </div>

          <div className={cn(
            "border p-6 flex items-center gap-4 rounded-lg",
            isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
          )}>
            <div className={cn(
              "w-12 h-12 flex items-center justify-center rounded-lg",
              isLight ? "bg-purple-500" : "bg-purple-600"
            )}>
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className={cn(
                "text-sm mb-1 rounded-lg",
                isLight ? "text-gray-600" : "text-gray-400"
              )}>
                {t.adminStatus.responseTime}
              </p>
              <p className={cn(
                "text-xl font-bold rounded-lg",
                isLight ? "text-gray-900" : "text-gray-100"
              )}>
                {status.performance.responseTime}
              </p>
            </div>
          </div>

          <div className={cn(
            "border p-6 flex items-center gap-4 rounded-lg",
            isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
          )}>
            <div className={cn(
              "w-12 h-12 flex items-center justify-center rounded-lg",
              isLight ? "bg-orange-500" : "bg-orange-600"
            )}>
              <Cpu className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className={cn(
                "text-sm mb-1 rounded-lg",
                isLight ? "text-gray-600" : "text-gray-400"
              )}>
                {t.adminStatus.version}
              </p>
              <p className={cn(
                "text-xl font-bold rounded-lg",
                isLight ? "text-gray-900" : "text-gray-100"
              )}>
                v{status.version}
              </p>
            </div>
          </div>
        </div>

        {/* Services Status */}
        <div className={cn(
          "border p-6 rounded-lg",
          isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
        )}>
          <h2 className={cn(
            "text-lg font-semibold mb-4 rounded-lg",
            isLight ? "text-gray-900" : "text-gray-100"
          )}>
            {t.adminStatus.serviceStatus}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-lg">
            <div className={cn(
              "border p-4 rounded-lg",
              isLight ? "bg-gray-50 border-gray-300" : "bg-gray-700 border-gray-600"
            )}>
              <div className="flex items-center justify-between mb-2">
                <span className={cn(
                  "text-sm font-medium rounded-lg",
                  isLight ? "text-gray-900" : "text-gray-100"
                )}>
                  {t.adminStatus.database}
                </span>
                <div className={cn(
                  "w-3 h-3",
                  status.services.database.healthy ? 'bg-green-500' : 'bg-red-500'
                )}></div>
              </div>
              {status.services.database.responseTime && (
                <p className={cn(
                  "text-xs rounded-lg",
                  isLight ? "text-gray-600" : "text-gray-400"
                )}>
                  {status.services.database.responseTime}ms
                </p>
              )}
            </div>

            <div className={cn(
              "border p-4 rounded-lg",
              isLight ? "bg-gray-50 border-gray-300" : "bg-gray-700 border-gray-600"
            )}>
              <div className="flex items-center justify-between mb-2">
                <span className={cn(
                  "text-sm font-medium rounded-lg",
                  isLight ? "text-gray-900" : "text-gray-100"
                )}>
                  {t.adminStatus.cloudinary}
                </span>
                <div className={cn(
                  "w-3 h-3",
                  status.services.cloudinary.healthy ? 'bg-green-500' : 'bg-red-500'
                )}></div>
              </div>
              {status.services.cloudinary.responseTime && (
                <p className={cn(
                  "text-xs rounded-lg",
                  isLight ? "text-gray-600" : "text-gray-400"
                )}>
                  {status.services.cloudinary.responseTime}ms
                </p>
              )}
            </div>

            <div className={cn(
              "border p-4 rounded-lg",
              isLight ? "bg-gray-50 border-gray-300" : "bg-gray-700 border-gray-600"
            )}>
              <div className="flex items-center justify-between mb-2">
                <span className={cn(
                  "text-sm font-medium rounded-lg",
                  isLight ? "text-gray-900" : "text-gray-100"
                )}>
                  {t.adminStatus.apiService}
                </span>
                <div className={cn(
                  "w-3 h-3",
                  status.services.api.enabled ? 'bg-green-500' : 'bg-red-500'
                )}></div>
              </div>
              {status.services.api.parametersCount !== undefined && (
                <p className={cn(
                  "text-xs rounded-lg",
                  isLight ? "text-gray-600" : "text-gray-400"
                )}>
                  {status.services.api.parametersCount} {t.adminStatus.parameters}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Health Issues */}
        {status.health.issues.length > 0 && (
          <div className={cn(
            "border p-6 rounded-lg",
            isLight ? "bg-yellow-50 border-yellow-300" : "bg-yellow-900/20 border-yellow-800"
          )}>
            <h2 className={cn(
              "text-lg font-semibold mb-4 rounded-lg",
              isLight ? "text-yellow-900" : "text-yellow-200"
            )}>
              {t.adminStatus.healthIssues}
            </h2>
            <div className="space-y-2 rounded-lg">
              {status.health.issues.map((issue, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex items-center gap-3 p-3 border rounded-lg",
                    isLight
                      ? "bg-white border-yellow-300"
                      : "bg-gray-800 border-yellow-800"
                  )}
                >
                  <span className={cn(
                    "w-1.5 h-1.5",
                    isLight ? "bg-yellow-500" : "bg-yellow-400"
                  )}></span>
                  <span className={cn(
                    "text-sm rounded-lg",
                    isLight ? "text-yellow-800" : "text-yellow-200"
                  )}>
                    {issue}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
}
