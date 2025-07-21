'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/ui/Toast';

interface BackupStatus {
  lastBackupTime: string | null;
  lastBackupSuccess: boolean;
  lastBackupError?: string;
  backupCount: number;
  isAutoBackupEnabled: boolean;
  isDatabaseHealthy: boolean;
}

export default function BackupPage() {
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const { toasts, removeToast, success: showSuccess, error: showError } = useToast();

  // 格式化时间为上海时区
  const formatShanghaiTime = (timeString: string | null): string => {
    if (!timeString) return '从未备份';

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
  const fetchBackupStatus = async () => {
    try {
      const response = await fetch('/api/admin/backup/status');
      const data = await response.json();
      
      if (data.success) {
        setBackupStatus(data.data);
      } else {
        showError('获取备份状态失败');
      }
    } catch (error) {
      showError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  // 创建备份
  const createBackup = async () => {
    setIsCreatingBackup(true);
    
    try {
      const response = await fetch('/api/admin/backup/create', {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        showSuccess('备份创建成功');
        await fetchBackupStatus();
      } else {
        showError(data.message || '备份创建失败');
      }
    } catch (error) {
      showError('网络错误');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  // 还原备份
  const restoreBackup = async () => {
    if (!confirm('确定要从备份数据库还原数据吗？这将覆盖当前的所有数据！')) {
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
        showSuccess('数据还原成功');
        await fetchBackupStatus();
      } else {
        showError(data.message || '数据还原失败');
      }
    } catch (error) {
      showError('网络错误');
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
        showSuccess('备份数据库初始化成功');
      } else {
        showError(data.message || '备份数据库初始化失败');
      }
    } catch (error) {
      showError('网络错误');
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
        showSuccess('设置更新成功');
      } else {
        showError(data.message || '设置更新失败');
      }
    } catch (error) {
      showError('网络错误');
    }
  };

  useEffect(() => {
    fetchBackupStatus();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ToastContainer
        toasts={toasts.map(toast => ({ ...toast, onClose: removeToast }))}
      />
      
      {/* 页面标题 */}
      <div className="transparent-panel rounded-lg p-6 shadow-lg">
        <h1 className="text-3xl font-bold panel-text mb-2">数据库备份管理</h1>
        <p className="text-gray-600 dark:text-gray-300 panel-text">
          管理数据库备份和还原操作
        </p>
      </div>

      {/* 备份状态 */}
      <div className="transparent-panel rounded-lg p-6 shadow-lg">
        <h2 className="text-xl font-semibold panel-text mb-4">备份状态</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="space-y-2">
            <label className="text-sm font-medium panel-text">数据库健康状态</label>
            <div className="flex items-center gap-2">
              {backupStatus?.isDatabaseHealthy ? (
                <>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm panel-text">健康</span>
                </>
              ) : (
                <>
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-sm panel-text">异常</span>
                </>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium panel-text">上次备份时间</label>
            <p className="text-sm panel-text">
              {formatShanghaiTime(backupStatus?.lastBackupTime)}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium panel-text">备份状态</label>
            <div className="flex items-center gap-2">
              {backupStatus?.lastBackupSuccess ? (
                <>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm panel-text">成功</span>
                </>
              ) : (
                <>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm panel-text">失败</span>
                </>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium panel-text">备份次数</label>
            <p className="text-sm panel-text">{backupStatus?.backupCount || 0} 次</p>
          </div>
        </div>

        {backupStatus?.lastBackupError && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-4">
            <p className="text-sm text-red-700 dark:text-red-300">
              上次备份错误：{backupStatus.lastBackupError}
            </p>
          </div>
        )}
      </div>

      {/* 备份操作 */}
      <div className="transparent-panel rounded-lg p-6 shadow-lg">
        <h2 className="text-xl font-semibold panel-text mb-4">备份操作</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <button
            onClick={createBackup}
            disabled={isCreatingBackup}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreatingBackup ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            )}
            {isCreatingBackup ? '创建中...' : '立即备份'}
          </button>

          <button
            onClick={restoreBackup}
            disabled={isRestoring}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRestoring ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 11l3 3m0 0l3-3m-3 3V8" />
              </svg>
            )}
            {isRestoring ? '还原中...' : '从备份还原'}
          </button>

          <button
            onClick={initializeBackupDatabase}
            disabled={isInitializing}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isInitializing ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
            {isInitializing ? '初始化中...' : '初始化备份数据库'}
          </button>
        </div>

        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            ⚠️ 还原操作将覆盖当前数据库中的所有数据，请谨慎操作！
          </p>
        </div>
      </div>

      {/* 自动备份设置 */}
      <div className="transparent-panel rounded-lg p-6 shadow-lg">
        <h2 className="text-xl font-semibold panel-text mb-4">自动备份设置</h2>
        
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="auto-backup"
            checked={backupStatus?.isAutoBackupEnabled || false}
            onChange={(e) => updateAutoBackupSetting(e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
          />
          <label htmlFor="auto-backup" className="text-sm font-medium panel-text">
            启用自动备份
          </label>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 panel-text mt-2">
          启用后，系统将每6小时自动创建一次数据库备份
        </p>
      </div>
    </div>
  );
}
