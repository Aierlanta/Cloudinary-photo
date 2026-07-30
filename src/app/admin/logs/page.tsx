'use client'

import React, { useState } from 'react'
import LogViewer from '@/components/admin/LogViewer'
import { useLocale } from '@/hooks/useLocale'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/useToast'
import { ToastContainer } from '@/components/ui/Toast'
import {
  FileText,
  Download,
  Trash2,
  ChevronDown,
  Flower2,
} from 'lucide-react'
import { useAdminApi } from '@/lib/admin-api-client'
import styles from '../admin-pages.module.css'

export default function SystemLogsPage() {
  const { t } = useLocale()
  const { adminFetch } = useAdminApi()
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false)
  const { toasts, success, error: showError, removeToast } = useToast()

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
    } catch (error) {
      console.error('导出日志失败:', error)
      showError(t.adminLogs.exportFailed)
    }
    setIsExportMenuOpen(false)
  }

  const handleClearLogs = async () => {
    if (!confirm(t.adminLogs.clearConfirm)) return

    try {
      const response = await adminFetch('/api/admin/logs/clear', {
        method: 'POST',
      })

      if (response.ok) {
        success(t.adminLogs.cleared)
        window.location.reload()
      } else {
        showError(t.adminLogs.clearFailed)
      }
    } catch (error) {
      console.error('清空日志失败:', error)
      showError(t.adminLogs.clearFailed)
    }
  }

  return (
    <div className={cn(styles.page, styles.fillHeight, "admin-logs-page")}>
      <header className={styles.hero}>
        <div>
          <h1 className={styles.heroTitle}>
            <span>{t.adminUi.accessLogs}</span>
            <Flower2 className={styles.heroIcon} aria-hidden />
          </h1>
          <p className={styles.heroSubtitle}>{t.adminLogs.description}</p>
        </div>
        <div className={cn(styles.heroActions, 'relative')}>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className={cn(styles.btn, styles.btnLavender)}
            >
              <Download className="w-4 h-4" />
              {t.adminUi.exportData}
              <ChevronDown className="w-4 h-4" />
            </button>
            {isExportMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 z-50 rounded-2xl border-2 border-border bg-card shadow-lift overflow-hidden">
                <button
                  type="button"
                  onClick={() => handleExportLogs('json')}
                  className="w-full text-left px-3 py-2 text-sm font-bold hover:bg-primary/10"
                >
                  {t.adminLogs.jsonFormat}
                </button>
                <button
                  type="button"
                  onClick={() => handleExportLogs('csv')}
                  className="w-full text-left px-3 py-2 text-sm font-bold hover:bg-primary/10"
                >
                  {t.adminLogs.csvFormat}
                </button>
                <button
                  type="button"
                  onClick={() => handleExportLogs('txt')}
                  className="w-full text-left px-3 py-2 text-sm font-bold hover:bg-primary/10"
                >
                  {t.adminLogs.textFormat}
                </button>
              </div>
            )}
          </div>

          {process.env.NODE_ENV === 'development' && (
            <button type="button" onClick={handleClearLogs} className={cn(styles.btn, styles.btnPink)}>
              <Trash2 className="w-4 h-4" />
              {t.adminLogs.clearLogs}
            </button>
          )}
        </div>
      </header>

      <section className={styles.panel}>
        <div className="relative z-[1] flex items-center gap-3 mb-4 shrink-0">
          <span className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center text-white">
            <FileText className="w-5 h-5" />
          </span>
          <h2 className={styles.panelTitle} style={{ marginBottom: 0 }}>
            {t.adminLogs.systemLogsStream}
          </h2>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {t.adminLogs.live}
          </div>
        </div>
        <div className="relative z-[1] flex-1 overflow-hidden min-h-[420px] rounded-2xl border-2 border-border">
          <LogViewer maxEntries={7} autoRefresh={true} refreshInterval={5000} />
        </div>
      </section>

      <ToastContainer toasts={toasts.map((toast) => ({ ...toast, onClose: removeToast }))} />
    </div>
  )
}
