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
  Zap,
  Flower2,
} from 'lucide-react'
import { useAdminApi } from '@/lib/admin-api-client'
import pageStyles from '../admin-pages.module.css'

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
  const { t, locale } = useLocale();
  const isLight = useTheme();
  const { adminFetch } = useAdminApi();
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const loadStatus = useCallback(async () => {
    try {
      setError(null)
      const response = await adminFetch('/api/status?mode=full')
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
  }, [adminFetch, t])

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
    
    if (days > 0) return `${days} ${t.adminStatus.days} ${hours} ${t.adminStatus.hours}`
    if (hours > 0) return `${hours} ${t.adminStatus.hours} ${minutes} ${t.adminStatus.minutes}`
    return `${minutes} ${t.adminStatus.minutes}`
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
      <div className={`${pageStyles.page} admin-status-page`}>
        <div className={cn(pageStyles.panel, "animate-pulse")}>
          <div className="relative z-[1] h-10 w-1/3 rounded-2xl bg-primary/20 mb-4" />
          <div className="relative z-[1] h-4 w-3/4 rounded-xl bg-primary/10 mb-2" />
          <div className="relative z-[1] h-4 w-1/2 rounded-xl bg-primary/10" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${pageStyles.page} admin-status-page`}>
        <header className={pageStyles.hero}>
          <div>
            <h1 className={pageStyles.heroTitle}>
              <span>{t.adminNav.status}</span>
              <Flower2 className={pageStyles.heroIcon} aria-hidden />
            </h1>
          </div>
        </header>
        <div className={cn(pageStyles.panel, "border-rose-300")}>
          <div className="relative z-[1] flex items-center gap-2 mb-3 text-rose-600">
            <AlertTriangle className="w-5 h-5" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={loadStatus}
            className={cn(pageStyles.btn, pageStyles.btnPink)}
          >
            {t.adminStatus.retry}
          </button>
        </div>
      </div>
    );
  }

  if (!status) return null

  const memoryUsed = Math.round((status.performance.memoryUsage?.used || 0) / 1024 / 1024)
  const memoryTotal = Math.max(1, Math.round((status.performance.memoryUsage?.total || 0) / 1024 / 1024))
  const memoryPercent = Math.min(100, Math.round((memoryUsed / memoryTotal) * 100))
  const checkedAt = new Date(status.timestamp).toLocaleTimeString(locale === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <div className={`${pageStyles.page} admin-status-page`}>
      <header className={pageStyles.hero}>
        <h1 className={pageStyles.heroTitle}>
          <span>{t.adminStatus.systemStatus}</span>
          <Activity className={pageStyles.heroIcon} aria-hidden />
        </h1>
        <button type="button" onClick={loadStatus} className={cn(pageStyles.btn, pageStyles.btnLavender)}>
          <RefreshCw className="w-4 h-4" />
          {t.common.refresh}
        </button>
      </header>

      <section className={pageStyles.statusServiceGrid} aria-label={t.adminStatus.serviceStatus}>
        {[
          { label: t.adminStatus.apiService, healthy: status.services.api.enabled, icon: Server },
          { label: t.adminUi.storageService, healthy: status.services.cloudinary.healthy, icon: Cloud },
          { label: t.adminStatus.database, healthy: status.services.database.healthy, icon: Database },
        ].map(({ label, healthy, icon: Icon }) => (
          <article key={label} className={cn(pageStyles.statusServiceCard, healthy ? pageStyles.statusHealthy : pageStyles.statusWarning)}>
            {healthy ? <CheckCircle aria-hidden /> : <AlertTriangle aria-hidden />}
            <div>
              <h2>{label}</h2>
              <p>{t.adminUi.checkedAt.replace('{time}', checkedAt)}</p>
            </div>
            <Icon className={pageStyles.statusCardAccent} aria-hidden />
          </article>
        ))}
      </section>

      <section className={pageStyles.statusDetailsGrid}>
        <article className={pageStyles.statusDetailPanel}>
          <h2>{t.adminUi.systemInfo}</h2>
          <div className={pageStyles.statusMetricGrid}>
            <div className={pageStyles.statusMetric}><Info aria-hidden /><span>{t.adminStatus.version}</span><strong>v{status.version}</strong></div>
            <div className={pageStyles.statusMetric}><Activity aria-hidden /><span>{t.adminStatus.uptime}</span><strong>{formatUptime(status.uptime)}</strong></div>
            <div className={pageStyles.statusMetric}><Cpu aria-hidden /><span>{t.adminStatus.memoryUsage}</span><strong>{memoryUsed} MB</strong><progress max="100" value={memoryPercent} /></div>
            <div className={pageStyles.statusMetric}><Server aria-hidden /><span>Node.js</span><strong>{status.environment || t.adminUi.running}</strong></div>
          </div>
        </article>

        <article className={pageStyles.statusDetailPanel}>
          <h2>{t.adminUi.storageProviders}</h2>
          <div className={pageStyles.statusProviderList}>
            <div><Cloud aria-hidden /><span><strong>Cloudinary</strong><small>{status.services.cloudinary.responseTime ?? 0}ms {t.adminStatus.responseTime}</small></span><b className={status.services.cloudinary.healthy ? pageStyles.providerHealthy : pageStyles.providerDisabled}>{status.services.cloudinary.healthy ? t.adminStatus.healthy : t.adminStatus.disabled}</b></div>
            <div><Database aria-hidden /><span><strong>TgState</strong><small>{status.services.database.responseTime ?? 0}ms {t.adminStatus.responseTime}</small></span><b className={status.services.database.healthy ? pageStyles.providerHealthy : pageStyles.providerDisabled}>{status.services.database.healthy ? t.adminStatus.healthy : t.adminStatus.disabled}</b></div>
            <div><Server aria-hidden /><span><strong>{t.adminStatus.apiService}</strong><small>{status.services.api.parametersCount ?? 0} {t.adminUi.configuredParameters}</small></span><b className={status.services.api.enabled ? pageStyles.providerHealthy : pageStyles.providerDisabled}>{status.services.api.enabled ? t.adminStatus.healthy : t.adminStatus.disabled}</b></div>
          </div>
        </article>
      </section>

      {status.health.issues.length > 0 ? (
        <section className={pageStyles.statusIssues} aria-label={t.adminStatus.healthIssues}>
          <h2>{t.adminStatus.healthIssues}</h2>
          {status.health.issues.map((issue) => <p key={issue}>{issue}</p>)}
        </section>
      ) : null}
    </div>
  );
}
