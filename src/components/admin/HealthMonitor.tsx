'use client';

import { useState, useEffect } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { useAdminVersion } from '@/contexts/AdminVersionContext';
import { GlassCard } from '@/components/ui/glass';
import {
  Activity,
  RefreshCw,
  Database,
  CheckCircle,
  AlertCircle,
  Server,
  HardDrive,
  Clock
} from 'lucide-react';

interface HealthData {
  mainDatabase: {
    healthy: boolean;
    status: string;
  };
  backupDatabase: {
    healthy: boolean;
    status: string;
  };
  overall: {
    healthy: boolean;
    status: string;
  };
  stats: {
    totalImages: number;
    totalGroups: number;
    lastCheck: string;
  } | null;
}

export default function HealthMonitor() {
  const { t } = useLocale();
  const { version } = useAdminVersion();
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealthData = async () => {
    try {
      const response = await fetch('/api/admin/health');
      const data = await response.json();
      
      if (data.success) {
        setHealthData(data.data);
      }
    } catch (error) {
      console.error('获取健康状态失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchHealthData();
  };

  useEffect(() => {
    fetchHealthData();
    
    // 每30秒自动刷新一次
    const interval = setInterval(fetchHealthData, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // --- V2 Layout (Glassmorphism) ---
  if (version === 'v2') {
    if (loading) {
      return (
        <GlassCard className="flex items-center justify-center h-48">
           <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
        </GlassCard>
      );
    }

    return (
      <GlassCard>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
             <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-500">
               <Activity className="w-6 h-6" />
             </div>
             <div>
                <h2 className="text-lg font-semibold">{t.healthMonitor.title}</h2>
                <p className="text-sm text-muted-foreground">{t.healthMonitor.description}</p>
             </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
            title={t.healthMonitor.refresh}
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           {/* Overall Status */}
           <div className={`p-4 rounded-xl border transition-all ${
             healthData?.overall.healthy 
               ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" 
               : "bg-red-500/10 border-red-500/20 text-red-500"
           }`}>
              <div className="flex items-center gap-3 mb-2">
                 {healthData?.overall.healthy ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                 <span className="font-semibold">{t.healthMonitor.overallStatus}</span>
              </div>
              <div className="text-sm opacity-80 pl-8">
                 {healthData?.overall.status === 'healthy' ? t.healthMonitor.healthy : t.healthMonitor.unhealthy}
              </div>
           </div>

           {/* Main Database */}
           <div className={`p-4 rounded-xl border transition-all ${
             healthData?.mainDatabase.healthy 
               ? "bg-blue-500/10 border-blue-500/20 text-blue-500" 
               : "bg-red-500/10 border-red-500/20 text-red-500"
           }`}>
              <div className="flex items-center gap-3 mb-2">
                 <Database className="w-5 h-5" />
                 <span className="font-semibold">{t.healthMonitor.mainDatabase}</span>
              </div>
              <div className="text-sm opacity-80 pl-8">
                 {healthData?.mainDatabase.status === 'healthy' ? t.healthMonitor.healthy : t.healthMonitor.unhealthy}
              </div>
           </div>

           {/* Backup Database */}
           <div className={`p-4 rounded-xl border transition-all ${
             healthData?.backupDatabase.healthy 
               ? "bg-purple-500/10 border-purple-500/20 text-purple-500" 
               : "bg-red-500/10 border-red-500/20 text-red-500"
           }`}>
              <div className="flex items-center gap-3 mb-2">
                 <Server className="w-5 h-5" />
                 <span className="font-semibold">{t.healthMonitor.backupDatabase}</span>
              </div>
              <div className="text-sm opacity-80 pl-8">
                 {healthData?.backupDatabase.status === 'healthy' ? t.healthMonitor.healthy : t.healthMonitor.unhealthy}
              </div>
           </div>
        </div>

        {healthData?.stats && (
          <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-muted-foreground">
             <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4" />
                <span>{t.healthMonitor.totalImagesLabel}: <strong className="text-foreground">{healthData.stats.totalImages}</strong></span>
             </div>
             <div className="flex items-center gap-2">
                <Server className="w-4 h-4" />
                <span>{t.healthMonitor.totalGroupsLabel}: <strong className="text-foreground">{healthData.stats.totalGroups}</strong></span>
             </div>
             <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>{t.healthMonitor.lastCheck}: <span className="text-foreground">{new Date(healthData.stats.lastCheck).toLocaleTimeString()}</span></span>
             </div>
          </div>
        )}
      </GlassCard>
    );
  }

  // --- V1 Layout (Classic) ---
  if (loading) {
    return (
      <div className="transparent-panel rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="transparent-panel rounded-lg p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h2 className="text-xl font-semibold panel-text">{t.healthMonitor.title}</h2>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {refreshing ? t.healthMonitor.refreshing : t.healthMonitor.refresh}
        </button>
      </div>
      <p className="text-gray-600 dark:text-gray-300 panel-text mb-4">
        {t.healthMonitor.description}
      </p>

      <div className="space-y-4">
        {/* 整体状态 */}
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center gap-2">
            {healthData?.overall.healthy ? (
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            )}
            <span className="font-medium panel-text">{t.healthMonitor.overallStatus}</span>
          </div>
          {healthData && (
            <span className={`px-2 py-1 text-xs rounded ${
              healthData.overall.status === 'healthy' ? 'bg-green-500 text-white' :
              healthData.overall.status === 'degraded' ? 'bg-yellow-500 text-white' :
              'bg-red-500 text-white'
            }`}>
              {healthData.overall.status === 'healthy' ? t.healthMonitor.healthy :
               healthData.overall.status === 'degraded' ? 'Degraded' : t.healthMonitor.unhealthy}
            </span>
          )}
        </div>

        {/* 数据库状态 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
              <span className="font-medium panel-text">{t.healthMonitor.mainDatabase}</span>
            </div>
            <div className="flex items-center gap-2">
              {healthData?.mainDatabase.healthy ? (
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <span className={`px-2 py-1 text-xs rounded ${
                healthData?.mainDatabase.status === 'healthy' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
              }`}>
                {healthData?.mainDatabase.status === 'healthy' ? t.healthMonitor.healthy : t.healthMonitor.unhealthy}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
              <span className="font-medium panel-text">{t.healthMonitor.backupDatabase}</span>
            </div>
            <div className="flex items-center gap-2">
              {healthData?.backupDatabase.healthy ? (
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <span className={`px-2 py-1 text-xs rounded ${
                healthData?.backupDatabase.status === 'healthy' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
              }`}>
                {healthData?.backupDatabase.status === 'healthy' ? t.healthMonitor.healthy : t.healthMonitor.unhealthy}
              </span>
            </div>
          </div>
        </div>

        {/* 统计信息 */}
        {healthData?.stats && (
          <div className="space-y-2">
            <h4 className="font-medium panel-text">{t.healthMonitor.dataStats}</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-300">{t.healthMonitor.totalImagesLabel}:</span>
                <span className="ml-2 font-medium panel-text">{healthData.stats.totalImages}</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-300">{t.healthMonitor.totalGroupsLabel}:</span>
                <span className="ml-2 font-medium panel-text">{healthData.stats.totalGroups}</span>
              </div>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {t.healthMonitor.lastCheck}: {new Date(healthData.stats.lastCheck).toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
