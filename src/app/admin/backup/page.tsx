'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/useToast';
import { useLocale } from '@/hooks/useLocale';
import { ToastContainer } from '@/components/ui/Toast';
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { 
  Database, 
  RotateCcw, 
  RefreshCw, 
  Settings, 
  Clock, 
  AlertTriangle, 
  CheckCircle,
  Play,
  HardDrive,
  History
} from 'lucide-react'

interface BackupStatus {
  lastBackupTime: string | null;
  lastBackupSuccess: boolean;
  lastBackupError?: string;
  backupCount: number;
  isAutoBackupEnabled: boolean;
  isDatabaseHealthy: boolean;
}

export default function BackupPage() {
  const { t } = useLocale();
  const isLight = useTheme();
  // 使用 ref 保存最新的翻译对象，避免在 useCallback 依赖中包含 t
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const { toasts, removeToast, success: showSuccess, error: showError } = useToast();

  // 格式化时间为上海时区
  const formatShanghaiTime = (timeString: string | null): string => {
    if (!timeString) return t.adminBackup.neverBackedUp;

    try {
      const date = new Date(timeString);
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
      return timeString;
    }
  };

  // 获取备份状态
  const fetchBackupStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/backup/status');
      const data = await response.json();

      if (data.success) {
        setBackupStatus(data.data);
      } else {
        // 使用 ref 访问最新的翻译，避免将 t 加入依赖数组导致语言切换时重新获取
        showError(tRef.current.adminBackup.getStatusFailed);
      }
    } catch (error) {
      showError(tRef.current.adminBackup.networkError);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  // 创建备份
  const createBackup = async () => {
    setIsCreatingBackup(true);
    
    try {
      const response = await fetch('/api/admin/backup/create', {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        showSuccess(t.adminBackup.backupCreated);
        await fetchBackupStatus();
      } else {
        showError(data.message || t.adminBackup.backupCreateFailed);
      }
    } catch (error) {
      showError(t.adminBackup.networkError);
    } finally {
      setIsCreatingBackup(false);
    }
  };

  // 还原备份
  const restoreBackup = async () => {
    if (!confirm(t.adminBackup.restoreConfirm)) {
      return;
    }

    setIsRestoring(true);
    
    try {
      const response = await fetch('/api/admin/backup/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ confirm: true })
      });
      const data = await response.json();
      
      if (data.success) {
        showSuccess(t.adminBackup.dataRestored);
        await fetchBackupStatus();
      } else {
        showError(data.message || t.adminBackup.dataRestoreFailed);
      }
    } catch (error) {
      showError(t.adminBackup.networkError);
    } finally {
      setIsRestoring(false);
    }
  };

  // 初始化备份数据库
  const initializeBackupDatabase = async () => {
    setIsInitializing(true);
    
    try {
      const response = await fetch('/api/admin/backup/init', {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        showSuccess(t.adminBackup.backupDbInitialized);
      } else {
        showError(data.message || t.adminBackup.backupDbInitFailed);
      }
    } catch (error) {
      showError(t.adminBackup.networkError);
    } finally {
      setIsInitializing(false);
    }
  };

  // 更新自动备份设置
  const updateAutoBackupSetting = async (enabled: boolean) => {
    try {
      const response = await fetch('/api/admin/backup/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isAutoBackupEnabled: enabled })
      });
      const data = await response.json();
      
      if (data.success) {
        setBackupStatus(prev => prev ? { ...prev, isAutoBackupEnabled: enabled } : null);
        showSuccess(t.adminBackup.settingsUpdated);
      } else {
        showError(data.message || t.adminBackup.settingsUpdateFailed);
      }
    } catch (error) {
      showError(t.adminBackup.networkError);
    }
  };

  useEffect(() => {
    fetchBackupStatus();
  }, [fetchBackupStatus]);

  if (loading) {
    return (
      <div className={cn(
        "border p-6 flex items-center justify-center h-64 rounded-lg",
        isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
      )}>
        <div className={cn(
          "w-8 h-8 border-2 border-t-transparent animate-spin rounded-lg",
          isLight ? "border-blue-500" : "border-blue-600"
        )}></div>
      </div>
    );
  }

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
              {t.adminBackup.title}
            </h1>
            <p className={cn(
              "text-gray-600 rounded-lg",
              isLight ? "text-gray-600" : "text-gray-400"
            )}>
              {t.adminBackup.description}
            </p>
          </div>
          <button
            onClick={createBackup}
            disabled={isCreatingBackup}
            className={cn(
              "px-4 py-2 border flex items-center gap-2 transition-colors disabled:opacity-50 rounded-lg",
              isLight
                ? "bg-blue-500 text-white border-blue-600 hover:bg-blue-600"
                : "bg-blue-600 text-white border-blue-500 hover:bg-blue-700"
            )}
          >
            <Play className="w-4 h-4 rounded-lg" />
            {isCreatingBackup ? t.adminBackup.creating : t.adminBackup.createBackup}
          </button>
        </div>

        <ToastContainer toasts={toasts.map(toast => ({ ...toast, onClose: removeToast }))} />

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 rounded-lg">
          {/* Database Health */}
          <div className={cn(
            "border p-6 flex flex-col justify-between rounded-lg",
            isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
          )}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className={cn(
                  "text-sm font-medium mb-1 rounded-lg",
                  isLight ? "text-gray-600" : "text-gray-400"
                )}>
                  {t.adminBackup.databaseHealth}
                </p>
                <h3 className={cn(
                  "text-xl font-bold flex items-center gap-2 rounded-lg",
                  backupStatus?.isDatabaseHealthy
                    ? isLight ? "text-green-600" : "text-green-400"
                    : isLight ? "text-red-600" : "text-red-400"
                )}>
                  {backupStatus?.isDatabaseHealthy ? (
                    <CheckCircle className="w-5 h-5 rounded-lg" />
                  ) : (
                    <AlertTriangle className="w-5 h-5" />
                  )}
                  {backupStatus?.isDatabaseHealthy ? t.adminBackup.healthy : t.adminBackup.abnormal}
                </h3>
              </div>
              <div className={cn(
                "w-10 h-10 flex items-center justify-center rounded-lg",
                backupStatus?.isDatabaseHealthy
                  ? isLight ? "bg-green-500" : "bg-green-600"
                  : isLight ? "bg-red-500" : "bg-red-600"
              )}>
                <Database className="w-5 h-5 text-white rounded-lg" />
              </div>
            </div>
            <button
              onClick={initializeBackupDatabase}
              disabled={isInitializing}
              className={cn(
                "w-full px-3 py-2 text-xs border transition-colors disabled:opacity-50 flex items-center justify-center gap-2 rounded-lg",
                isLight
                  ? "bg-gray-100 border-gray-300 hover:bg-gray-200 text-gray-700"
                  : "bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-300"
              )}
            >
              <RefreshCw className={cn("w-4 h-4 rounded-lg", isInitializing ? "animate-spin" : "")} />
              {isInitializing ? t.adminBackup.initializing : t.adminBackup.initializeBackupDb}
            </button>
          </div>

          {/* Last Backup Time */}
          <div className={cn(
            "border p-6 flex flex-col justify-between rounded-lg",
            isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
          )}>
            <div className="flex justify-between items-start mb-4 rounded-lg">
              <div>
                <p className={cn(
                  "text-sm font-medium mb-1 rounded-lg",
                  isLight ? "text-gray-600" : "text-gray-400"
                )}>
                  {t.adminBackup.lastBackupTime}
                </p>
                <h3 className={cn(
                  "text-lg font-bold rounded-lg",
                  isLight ? "text-gray-900" : "text-gray-100"
                )}>
                  {backupStatus?.lastBackupTime ? (
                    <div className="flex flex-col">
                      <span>{new Date(backupStatus.lastBackupTime).toLocaleDateString()}</span>
                      <span className={cn(
                        "text-sm rounded-lg",
                        isLight ? "text-gray-600" : "text-gray-400"
                      )}>
                        {backupStatus.lastBackupTime ? new Date(backupStatus.lastBackupTime).toLocaleTimeString() : ''}
                      </span>
                    </div>
                  ) : (
                    t.adminBackup.neverBackedUp
                  )}
                </h3>
              </div>
              <div className={cn(
                "w-10 h-10 flex items-center justify-center rounded-lg",
                isLight ? "bg-blue-500" : "bg-blue-600"
              )}>
                <Clock className="w-5 h-5 text-white rounded-lg" />
              </div>
            </div>
          </div>

          {/* Backup Status */}
          <div className={cn(
            "border p-6 flex flex-col justify-between rounded-lg",
            isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
          )}>
            <div className="flex justify-between items-start mb-4 rounded-lg">
              <div>
                <p className={cn(
                  "text-sm font-medium mb-1 rounded-lg",
                  isLight ? "text-gray-600" : "text-gray-400"
                )}>
                  {t.adminBackup.backupStatusLabel}
                </p>
                <h3 className={cn(
                  "text-xl font-bold flex items-center gap-2 rounded-lg",
                  backupStatus?.lastBackupSuccess
                    ? isLight ? "text-green-600" : "text-green-400"
                    : isLight ? "text-yellow-600" : "text-yellow-400"
                )}>
                  {backupStatus?.lastBackupSuccess ? (
                    <CheckCircle className="w-5 h-5 rounded-lg" />
                  ) : (
                    <AlertTriangle className="w-5 h-5" />
                  )}
                  {backupStatus?.lastBackupSuccess ? t.adminBackup.success : t.adminBackup.failed}
                </h3>
              </div>
              <div className={cn(
                "w-10 h-10 flex items-center justify-center rounded-lg",
                isLight ? "bg-purple-500" : "bg-purple-600"
              )}>
                <History className="w-5 h-5 text-white rounded-lg" />
              </div>
            </div>
            {backupStatus?.lastBackupError && (
              <p className={cn(
                "text-xs truncate mt-2 rounded-lg",
                isLight ? "text-red-600" : "text-red-400"
              )} title={backupStatus?.lastBackupError}>
                {backupStatus?.lastBackupError}
              </p>
            )}
          </div>

          {/* Backup Count */}
          <div className={cn(
            "border p-6 flex flex-col justify-between rounded-lg",
            isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
          )}>
            <div className="flex justify-between items-start mb-4 rounded-lg">
              <div>
                <p className={cn(
                  "text-sm font-medium mb-1 rounded-lg",
                  isLight ? "text-gray-600" : "text-gray-400"
                )}>
                  {t.adminBackup.backupCount}
                </p>
                <h3 className={cn(
                  "text-3xl font-bold rounded-lg",
                  isLight ? "text-blue-600" : "text-blue-400"
                )}>
                  {backupStatus?.backupCount || 0}
                </h3>
              </div>
              <div className={cn(
                "w-10 h-10 flex items-center justify-center rounded-lg",
                isLight ? "bg-blue-500" : "bg-blue-600"
              )}>
                <HardDrive className="w-5 h-5 text-white rounded-lg" />
              </div>
            </div>
          </div>
        </div>

        {/* Operations and Settings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 rounded-lg">
          {/* Operations */}
          <div className={cn(
            "border p-6 rounded-lg",
            isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
          )}>
            <h3 className={cn(
              "text-lg font-bold mb-6 flex items-center gap-2 rounded-lg",
              isLight ? "text-gray-900" : "text-gray-100"
            )}>
              <Settings className={cn(
                "w-5 h-5 rounded-lg",
                isLight ? "text-blue-500" : "text-blue-400"
              )} />
              {t.adminBackup.backupOperations}
            </h3>

            <div className={cn(
              "border p-4 mb-4 rounded-lg",
              isLight ? "bg-gray-50 border-gray-300" : "bg-gray-700 border-gray-600"
            )}>
              <div className="flex justify-between items-center mb-4 rounded-lg">
                <div>
                  <h4 className={cn(
                    "font-medium mb-1 rounded-lg",
                    isLight ? "text-gray-900" : "text-gray-100"
                  )}>
                    {t.adminBackup.restoreFromBackup}
                  </h4>
                  <p className={cn(
                    "text-sm rounded-lg",
                    isLight ? "text-gray-600" : "text-gray-400"
                  )}>
                    {t.adminBackup.restoreWarning}
                  </p>
                </div>
                <div className={cn(
                  "w-10 h-10 flex items-center justify-center rounded-lg",
                  isLight ? "bg-orange-500" : "bg-orange-600"
                )}>
                  <RotateCcw className="w-5 h-5 text-white rounded-lg" />
                </div>
              </div>
              <button
                onClick={restoreBackup}
                disabled={isRestoring}
                className={cn(
                  "w-full px-4 py-2 border transition-colors disabled:opacity-50 rounded-lg",
                  isLight
                    ? "bg-orange-500 text-white border-orange-600 hover:bg-orange-600"
                    : "bg-orange-600 text-white border-orange-500 hover:bg-orange-700"
                )}
              >
                {isRestoring ? t.adminBackup.restoring : t.adminBackup.restoreFromBackup}
              </button>
            </div>
          </div>

          {/* Settings */}
          <div className={cn(
            "border p-6 rounded-lg",
            isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
          )}>
            <h3 className={cn(
              "text-lg font-bold mb-6 flex items-center gap-2 rounded-lg",
              isLight ? "text-gray-900" : "text-gray-100"
            )}>
              <Settings className={cn(
                "w-5 h-5 rounded-lg",
                isLight ? "text-blue-500" : "text-blue-400"
              )} />
              {t.adminBackup.autoBackupSettings}
            </h3>

            <div className={cn(
              "flex items-center justify-between p-4 border rounded-lg",
              isLight ? "bg-gray-50 border-gray-300" : "bg-gray-700 border-gray-600"
            )}>
              <div>
                <h4 className={cn(
                  "font-medium mb-1 rounded-lg",
                  isLight ? "text-gray-900" : "text-gray-100"
                )}>
                  {t.adminBackup.enableAutoBackup}
                </h4>
                <p className={cn(
                  "text-sm mt-1 rounded-lg",
                  isLight ? "text-gray-600" : "text-gray-400"
                )}>
                  {t.adminBackup.autoBackupDescription}
                </p>
              </div>
              <label className="relative inline-block w-12 h-6 cursor-pointer rounded-lg">
                <input
                  type="checkbox"
                  name="toggle"
                  id="toggle-auto"
                  checked={backupStatus?.isAutoBackupEnabled || false}
                  onChange={(e) => updateAutoBackupSetting(e.target.checked)}
                  className="sr-only"
                />
                <span className={cn(
                  "absolute inset-0 transition-colors rounded-lg",
                  backupStatus?.isAutoBackupEnabled
                    ? isLight ? "bg-blue-500" : "bg-blue-600"
                    : isLight ? "bg-gray-300" : "bg-gray-600"
                )}></span>
                <span className={cn(
                  "absolute left-0 top-0 h-6 w-6 border transition-transform rounded-lg",
                  isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600",
                  backupStatus?.isAutoBackupEnabled ? "translate-x-6" : "translate-x-0"
                )}></span>
              </label>
            </div>
          </div>
        </div>
      </div>
    );
}
