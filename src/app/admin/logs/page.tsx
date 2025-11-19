'use client'

import React, { useState } from 'react'
import LogViewer from '@/components/admin/LogViewer'
import { useLocale } from '@/hooks/useLocale'
import { useAdminVersion } from '@/contexts/AdminVersionContext'
import { GlassCard, GlassButton } from '@/components/ui/glass'
import { 
  FileText, 
  Download, 
  Trash2, 
  ChevronDown
} from 'lucide-react'

export default function SystemLogsPage() {
  const { t } = useLocale();
  const { version } = useAdminVersion();
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  const handleExportLogs = async (format: 'json' | 'csv' | 'txt') => {
    try {
      const response = await fetch('/api/admin/logs/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ format })
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
        alert(t.adminLogs.exportFailed)
      }
    } catch (error) {
      console.error('导出日志失败:', error)
      alert('导出日志失败')
    }
    setIsExportMenuOpen(false);
  }

  const handleClearLogs = async () => {
    if (!confirm(t.adminLogs.clearConfirm)) {
      return
    }

    try {
      const response = await fetch('/api/admin/logs/clear', {
        method: 'POST'
      })

      if (response.ok) {
        alert(t.adminLogs.cleared)
        window.location.reload()
      } else {
        alert(t.adminLogs.clearFailed)
      }
    } catch (error) {
      console.error('清空日志失败:', error)
      alert('清空日志失败')
    }
  }

  if (version === 'v2') {
     return (
        <div className="space-y-8 h-[calc(100vh-8rem)] flex flex-col">
           <div className="flex justify-between items-start shrink-0">
              <div>
                 <h1 className="text-3xl font-bold mb-2">{t.adminLogs.title}</h1>
                 <p className="text-muted-foreground">{t.adminLogs.description}</p>
              </div>
              <div className="flex gap-3 relative">
                 <div className="relative">
                    <GlassButton 
                       primary 
                       icon={Download} 
                       onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                    >
                       {t.adminLogs.exportLogs}
                       <ChevronDown className="w-4 h-4 ml-2" />
                    </GlassButton>
                    {isExportMenuOpen && (
                       <div className="absolute right-0 top-full mt-2 w-48 p-1 rounded-xl bg-black/80 backdrop-blur-xl border border-white/10 shadow-xl z-50">
                          <button 
                             onClick={() => handleExportLogs('json')}
                             className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-sm transition-colors"
                          >
                             {t.adminLogs.jsonFormat}
                          </button>
                          <button 
                             onClick={() => handleExportLogs('csv')}
                             className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-sm transition-colors"
                          >
                             {t.adminLogs.csvFormat}
                          </button>
                          <button 
                             onClick={() => handleExportLogs('txt')}
                             className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-sm transition-colors"
                          >
                             {t.adminLogs.textFormat}
                          </button>
                       </div>
                    )}
                 </div>
                 
                 {process.env.NODE_ENV === 'development' && (
                    <GlassButton 
                       icon={Trash2} 
                       className="text-red-400 hover:bg-red-500/10 hover:text-red-300 border-red-500/20"
                       onClick={handleClearLogs}
                    >
                       {t.adminLogs.clearLogs}
                    </GlassButton>
                 )}
              </div>
           </div>

           <GlassCard className="flex-1 overflow-hidden flex flex-col" noPadding>
              <div className="p-4 border-b border-white/10 bg-white/5 flex items-center gap-3">
                 <div className="p-2 rounded-lg bg-blue-500/20 text-blue-500">
                    <FileText className="w-5 h-5" />
                 </div>
                 <h3 className="font-semibold">System Logs Stream</h3>
                 <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    Live
                 </div>
              </div>
              <div className="flex-1 overflow-hidden relative">
                 <LogViewer maxEntries={200} autoRefresh={true} refreshInterval={5000} />
              </div>
           </GlassCard>
        </div>
     )
  }

  // V1 Layout
  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="transparent-panel rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold panel-text mb-2">{t.adminLogs.title}</h1>
            <p className="text-gray-600 dark:text-gray-300 panel-text">
              {t.adminLogs.description}
            </p>
          </div>
          <div className="flex space-x-3">
            <div className="relative">
              <button
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
                onClick={() => {
                  const dropdown = document.getElementById('export-dropdown')
                  dropdown?.classList.toggle('hidden')
                }}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {t.adminLogs.exportLogs}
              </button>
              <div id="export-dropdown" className="hidden absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                <button
                  onClick={() => handleExportLogs('json')}
                  className="block w-full text-left px-4 py-2 text-sm panel-text hover:bg-gray-100 dark:hover:bg-gray-700 rounded-t-lg"
                >
                  {t.adminLogs.jsonFormat}
                </button>
                <button
                  onClick={() => handleExportLogs('csv')}
                  className="block w-full text-left px-4 py-2 text-sm panel-text hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  {t.adminLogs.csvFormat}
                </button>
                <button
                  onClick={() => handleExportLogs('txt')}
                  className="block w-full text-left px-4 py-2 text-sm panel-text hover:bg-gray-100 dark:hover:bg-gray-700 rounded-b-lg"
                >
                  {t.adminLogs.textFormat}
                </button>
              </div>
            </div>
            {process.env.NODE_ENV === 'development' && (
              <button
                onClick={handleClearLogs}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {t.adminLogs.clearLogs}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 日志查看器 */}
      <LogViewer maxEntries={100} autoRefresh={true} refreshInterval={10000} />
    </div>
  )
}
