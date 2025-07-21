'use client';

import { useState, useEffect } from 'react';

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
          <h2 className="text-xl font-semibold panel-text">系统健康监控</h2>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          刷新
        </button>
      </div>
      <p className="text-gray-600 dark:text-gray-300 panel-text mb-4">
        实时监控数据库和系统状态
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
            <span className="font-medium panel-text">整体状态</span>
          </div>
          {healthData && (
            <span className={`px-2 py-1 text-xs rounded ${
              healthData.overall.status === 'healthy' ? 'bg-green-500 text-white' :
              healthData.overall.status === 'degraded' ? 'bg-yellow-500 text-white' :
              'bg-red-500 text-white'
            }`}>
              {healthData.overall.status === 'healthy' ? '健康' :
               healthData.overall.status === 'degraded' ? '降级' : '异常'}
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
              <span className="font-medium panel-text">主数据库</span>
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
                {healthData?.mainDatabase.status === 'healthy' ? '健康' : '异常'}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
              <span className="font-medium panel-text">备份数据库</span>
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
                {healthData?.backupDatabase.status === 'healthy' ? '健康' : '异常'}
              </span>
            </div>
          </div>
        </div>

        {/* 统计信息 */}
        {healthData?.stats && (
          <div className="space-y-2">
            <h4 className="font-medium panel-text">数据统计</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-300">图片总数:</span>
                <span className="ml-2 font-medium panel-text">{healthData.stats.totalImages}</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-300">分组总数:</span>
                <span className="ml-2 font-medium panel-text">{healthData.stats.totalGroups}</span>
              </div>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              最后检查: {new Date(healthData.stats.lastCheck).toLocaleString('zh-CN')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
