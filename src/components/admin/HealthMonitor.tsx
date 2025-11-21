'use client';

import { useState, useEffect } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';
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
  const isLight = useTheme();
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

  // --- V3 Layout (Flat Design) ---
  if (loading) {
    return (
      <div className={cn(
        "border p-6 flex items-center justify-center h-48 rounded-lg",
        isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
      )}>
        <div className={cn(
          "w-8 h-8 border-2 border-t-transparent animate-spin",
          isLight ? "border-blue-500" : "border-blue-600"
        )}></div>
      </div>
    );
  }

  return (
      <div className={cn(
        "border p-6 rounded-lg",
        isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
      )}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 flex items-center justify-center rounded-lg",
              isLight ? "bg-emerald-500" : "bg-emerald-600"
            )}>
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className={cn(
                "text-lg font-semibold rounded-lg",
                isLight ? "text-gray-900" : "text-gray-100"
              )}>
                {t.healthMonitor.title}
              </h2>
              <p className={cn(
                "text-sm rounded-lg",
                isLight ? "text-gray-600" : "text-gray-400"
              )}>
                {t.healthMonitor.description}
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={cn(
              "p-2 border transition-colors disabled:opacity-50 rounded-lg",
              isLight
                ? "bg-white border-gray-300 hover:bg-gray-50"
                : "bg-gray-800 border-gray-600 hover:bg-gray-700"
            )}
            title={t.healthMonitor.refresh}
          >
            <RefreshCw className={cn(
              "w-5 h-5",
              isLight ? "text-gray-700" : "text-gray-300",
              refreshing ? 'animate-spin' : ''
            )} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-lg">
          {/* Overall Status */}
          <div className={cn(
            "border p-4 rounded-lg",
            healthData?.overall.healthy
              ? isLight
                ? "bg-emerald-50 border-emerald-300"
                : "bg-emerald-900/20 border-emerald-600"
              : isLight
              ? "bg-red-50 border-red-300"
              : "bg-red-900/20 border-red-600"
          )}>
            <div className="flex items-center gap-3 mb-2">
              {healthData?.overall.healthy ? (
                <CheckCircle className={cn(
                  "w-5 h-5",
                  isLight ? "text-emerald-600" : "text-emerald-400"
                )} />
              ) : (
                <AlertCircle className={cn(
                  "w-5 h-5",
                  isLight ? "text-red-600" : "text-red-400"
                )} />
              )}
              <span className={cn(
                "font-semibold rounded-lg",
                healthData?.overall.healthy
                  ? isLight ? "text-emerald-900" : "text-emerald-200"
                  : isLight ? "text-red-900" : "text-red-200"
              )}>
                {t.healthMonitor.overallStatus}
              </span>
            </div>
            <div className={cn(
              "text-sm pl-8 rounded-lg",
              healthData?.overall.healthy
                ? isLight ? "text-emerald-700" : "text-emerald-300"
                : isLight ? "text-red-700" : "text-red-300"
            )}>
              {healthData?.overall.status === 'healthy' ? t.healthMonitor.healthy : t.healthMonitor.unhealthy}
            </div>
          </div>

          {/* Main Database */}
          <div className={cn(
            "border p-4 rounded-lg",
            healthData?.mainDatabase.healthy
              ? isLight
                ? "bg-blue-50 border-blue-300"
                : "bg-blue-900/20 border-blue-600"
              : isLight
              ? "bg-red-50 border-red-300"
              : "bg-red-900/20 border-red-600"
          )}>
            <div className="flex items-center gap-3 mb-2">
              <Database className={cn(
                "w-5 h-5",
                healthData?.mainDatabase.healthy
                  ? isLight ? "text-blue-600" : "text-blue-400"
                  : isLight ? "text-red-600" : "text-red-400"
              )} />
              <span className={cn(
                "font-semibold rounded-lg",
                healthData?.mainDatabase.healthy
                  ? isLight ? "text-blue-900" : "text-blue-200"
                  : isLight ? "text-red-900" : "text-red-200"
              )}>
                {t.healthMonitor.mainDatabase}
              </span>
            </div>
            <div className={cn(
              "text-sm pl-8 rounded-lg",
              healthData?.mainDatabase.healthy
                ? isLight ? "text-blue-700" : "text-blue-300"
                : isLight ? "text-red-700" : "text-red-300"
            )}>
              {healthData?.mainDatabase.status === 'healthy' ? t.healthMonitor.healthy : t.healthMonitor.unhealthy}
            </div>
          </div>

          {/* Backup Database */}
          <div className={cn(
            "border p-4 rounded-lg",
            healthData?.backupDatabase.healthy
              ? isLight
                ? "bg-purple-50 border-purple-300"
                : "bg-purple-900/20 border-purple-600"
              : isLight
              ? "bg-red-50 border-red-300"
              : "bg-red-900/20 border-red-600"
          )}>
            <div className="flex items-center gap-3 mb-2">
              <Server className={cn(
                "w-5 h-5",
                healthData?.backupDatabase.healthy
                  ? isLight ? "text-purple-600" : "text-purple-400"
                  : isLight ? "text-red-600" : "text-red-400"
              )} />
              <span className={cn(
                "font-semibold rounded-lg",
                healthData?.backupDatabase.healthy
                  ? isLight ? "text-purple-900" : "text-purple-200"
                  : isLight ? "text-red-900" : "text-red-200"
              )}>
                {t.healthMonitor.backupDatabase}
              </span>
            </div>
            <div className={cn(
              "text-sm pl-8 rounded-lg",
              healthData?.backupDatabase.healthy
                ? isLight ? "text-purple-700" : "text-purple-300"
                : isLight ? "text-red-700" : "text-red-300"
            )}>
              {healthData?.backupDatabase.status === 'healthy' ? t.healthMonitor.healthy : t.healthMonitor.unhealthy}
            </div>
          </div>
        </div>

        {healthData?.stats && (
          <div className={cn(
            "mt-6 pt-6 border-t grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm",
            isLight ? "border-gray-300 text-gray-600" : "border-gray-600 text-gray-400"
          )}>
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 rounded-lg" />
              <span>
                {t.healthMonitor.totalImagesLabel}: <strong className={isLight ? "text-gray-900" : "text-gray-100"}>
                  {healthData.stats.totalImages}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 rounded-lg" />
              <span>
                {t.healthMonitor.totalGroupsLabel}: <strong className={isLight ? "text-gray-900" : "text-gray-100"}>
                  {healthData.stats.totalGroups}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 rounded-lg" />
              <span>
                {t.healthMonitor.lastCheck}: <span className={isLight ? "text-gray-900" : "text-gray-100"}>
                  {new Date(healthData.stats.lastCheck).toLocaleTimeString()}
                </span>
              </span>
            </div>
          </div>
        )}
      </div>
    );
}
