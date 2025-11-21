'use client'

import React, { useState } from 'react'
import LogViewer from '@/components/admin/LogViewer'
import { useLocale } from '@/hooks/useLocale'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { 
  FileText, 
  Download, 
  Trash2, 
  ChevronDown
} from 'lucide-react'

export default function SystemLogsPage() {
  const { t } = useLocale();
  const isLight = useTheme();
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

  // --- V3 Layout (Flat Design) ---
  return (
      <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
        {/* Header */}
        <div className={cn(
          "border p-6 flex justify-between items-start shrink-0",
          isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
        )}>
          <div>
            <h1 className={cn(
              "text-3xl font-bold mb-2",
              isLight ? "text-gray-900" : "text-gray-100"
            )}>
              {t.adminLogs.title}
            </h1>
            <p className={isLight ? "text-gray-600" : "text-gray-400"}>
              {t.adminLogs.description}
            </p>
          </div>
          <div className="flex gap-3 relative">
            <div className="relative">
              <button
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className={cn(
                  "px-4 py-2 border flex items-center gap-2 transition-colors",
                  isLight
                    ? "bg-blue-500 text-white border-blue-600 hover:bg-blue-600"
                    : "bg-blue-600 text-white border-blue-500 hover:bg-blue-700"
                )}
              >
                <Download className="w-4 h-4" />
                {t.adminLogs.exportLogs}
                <ChevronDown className="w-4 h-4" />
              </button>
              {isExportMenuOpen && (
                <div className={cn(
                  "absolute right-0 top-full mt-2 w-48 border z-50",
                  isLight
                    ? "bg-white border-gray-300"
                    : "bg-gray-800 border-gray-600"
                )}>
                  <button
                    onClick={() => handleExportLogs('json')}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm transition-colors border-b",
                      isLight
                        ? "bg-white hover:bg-gray-50 border-gray-300 text-gray-900"
                        : "bg-gray-800 hover:bg-gray-700 border-gray-600 text-gray-100"
                    )}
                  >
                    {t.adminLogs.jsonFormat}
                  </button>
                  <button
                    onClick={() => handleExportLogs('csv')}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm transition-colors border-b",
                      isLight
                        ? "bg-white hover:bg-gray-50 border-gray-300 text-gray-900"
                        : "bg-gray-800 hover:bg-gray-700 border-gray-600 text-gray-100"
                    )}
                  >
                    {t.adminLogs.csvFormat}
                  </button>
                  <button
                    onClick={() => handleExportLogs('txt')}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm transition-colors",
                      isLight
                        ? "bg-white hover:bg-gray-50 text-gray-900"
                        : "bg-gray-800 hover:bg-gray-700 text-gray-100"
                    )}
                  >
                    {t.adminLogs.textFormat}
                  </button>
                </div>
              )}
            </div>

            {process.env.NODE_ENV === 'development' && (
              <button
                onClick={handleClearLogs}
                className={cn(
                  "px-4 py-2 border flex items-center gap-2 transition-colors",
                  isLight
                    ? "bg-red-500 text-white border-red-600 hover:bg-red-600"
                    : "bg-red-600 text-white border-red-500 hover:bg-red-700"
                )}
              >
                <Trash2 className="w-4 h-4" />
                {t.adminLogs.clearLogs}
              </button>
            )}
          </div>
        </div>

        {/* Log Viewer */}
        <div className={cn(
          "border flex-1 overflow-hidden flex flex-col",
          isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
        )}>
          <div className={cn(
            "p-4 border-b flex items-center gap-3 shrink-0",
            isLight ? "bg-gray-50 border-gray-300" : "bg-gray-700 border-gray-600"
          )}>
            <div className={cn(
              "w-10 h-10 flex items-center justify-center",
              isLight ? "bg-blue-500" : "bg-blue-600"
            )}>
              <FileText className="w-5 h-5 text-white" />
            </div>
            <h3 className={cn(
              "font-semibold",
              isLight ? "text-gray-900" : "text-gray-100"
            )}>
              System Logs Stream
            </h3>
            <div className={cn(
              "ml-auto flex items-center gap-2 text-xs",
              isLight ? "text-gray-600" : "text-gray-400"
            )}>
              <span className={cn(
                "w-2 h-2",
                isLight ? "bg-green-500" : "bg-green-400"
              )} style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}></span>
              Live
            </div>
          </div>
          <div className="flex-1 overflow-hidden relative">
            <LogViewer maxEntries={200} autoRefresh={true} refreshInterval={5000} />
          </div>
        </div>
      </div>
    );
}
