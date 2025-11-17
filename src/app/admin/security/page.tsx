"use client";

import { useState, useEffect } from "react";
import { useLocale } from "@/hooks/useLocale";
import BannedIPManagement from "@/components/admin/BannedIPManagement";
import RateLimitManagement from "@/components/admin/RateLimitManagement";

interface AccessStats {
  totalAccess: number;
  uniqueIPs: number;
  topPaths: Array<{ path: string; count: number }>;
  topIPs: Array<{ ip: string; count: number }>;
  dailyStats: Array<{ date: string; count: number }>;
}

interface RealtimeStats {
  lastHour: number;
  last24Hours: number;
  total: number;
}

interface BannedIP {
  ip: string;
  reason?: string;
  bannedAt: Date;
  bannedBy?: string;
  expiresAt?: Date;
}

interface RateLimit {
  ip: string;
  maxRequests: number;
  windowMs: number;
  maxTotal?: number;
  createdAt: Date;
}

export default function SecurityManagement() {
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState<"stats" | "banned" | "limits">(
    "stats"
  );
  const [loading, setLoading] = useState(true);

  // 访问统计数据
  const [stats, setStats] = useState<AccessStats | null>(null);
  const [realtimeStats, setRealtimeStats] = useState<RealtimeStats | null>(
    null
  );

  // 封禁IP数据
  const [bannedIPs, setBannedIPs] = useState<BannedIP[]>([]);

  // 速率限制数据
  const [rateLimits, setRateLimits] = useState<RateLimit[]>([]);

  // 加载访问统计
  const loadStats = async () => {
    try {
      const response = await fetch("/api/admin/security/stats?days=7");
      if (response.ok) {
        const data = await response.json();
        setStats(data.data.stats);
        setRealtimeStats(data.data.realtime);
      }
    } catch (error) {
      console.error("加载统计数据失败:", error);
    }
  };

  // 加载封禁IP列表
  const loadBannedIPs = async () => {
    try {
      const response = await fetch("/api/admin/security/banned-ips");
      if (response.ok) {
        const data = await response.json();
        setBannedIPs(data.data.bannedIPs);
      }
    } catch (error) {
      console.error("加载封禁IP列表失败:", error);
    }
  };

  // 加载速率限制列表
  const loadRateLimits = async () => {
    try {
      const response = await fetch("/api/admin/security/rate-limits");
      if (response.ok) {
        const data = await response.json();
        setRateLimits(data.data.rateLimits);
      }
    } catch (error) {
      console.error("加载速率限制列表失败:", error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([loadStats(), loadBannedIPs(), loadRateLimits()]);
      setLoading(false);
    };
    loadData();
  }, []);

  const handleRefresh = () => {
    loadStats();
    loadBannedIPs();
    loadRateLimits();
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="transparent-panel rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold panel-text mb-2">
              {t.adminSecurity.title}
            </h1>
            <p className="text-gray-600 dark:text-gray-300 panel-text">
              {t.adminSecurity.description}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            {t.adminSecurity.refresh}
          </button>
        </div>
      </div>

      {/* 标签页 */}
      <div className="transparent-panel rounded-lg shadow-lg">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab("stats")}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "stats"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              {t.adminSecurity.accessStats}
            </button>
            <button
              onClick={() => setActiveTab("banned")}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "banned"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              {t.adminSecurity.bannedIPs}
            </button>
            <button
              onClick={() => setActiveTab("limits")}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "limits"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              {t.adminSecurity.rateLimits}
            </button>
          </nav>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">
                {t.adminSecurity.loading}
              </p>
            </div>
          ) : (
            <>
              {/* 访问统计标签页 */}
              {activeTab === "stats" && (
                <div className="space-y-6">
                  {/* 实时统计 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t.adminSecurity.lastHour}
                      </p>
                      <p className="text-2xl font-bold panel-text mt-2">
                        {realtimeStats?.lastHour || 0}
                      </p>
                    </div>
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t.adminSecurity.last24Hours}
                      </p>
                      <p className="text-2xl font-bold panel-text mt-2">
                        {realtimeStats?.last24Hours || 0}
                      </p>
                    </div>
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t.adminSecurity.totalAccess}
                      </p>
                      <p className="text-2xl font-bold panel-text mt-2">
                        {realtimeStats?.total || 0}
                      </p>
                    </div>
                  </div>

                  {/* 7天统计 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {t.adminSecurity.last7Days}
                      </p>
                      <p className="text-lg font-semibold panel-text">
                        {t.adminSecurity.totalAccess}: {stats?.totalAccess || 0}
                      </p>
                      <p className="text-lg font-semibold panel-text">
                        {t.adminSecurity.uniqueIPs}: {stats?.uniqueIPs || 0}
                      </p>
                    </div>
                  </div>

                  {/* 热门路径 */}
                  {stats?.topPaths && stats.topPaths.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold panel-text mb-4">
                        {t.adminSecurity.topPaths}
                      </h3>
                      <div className="space-y-2">
                        {stats.topPaths.slice(0, 10).map((item, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                          >
                            <span className="panel-text font-mono text-sm">
                              {item.path}
                            </span>
                            <span className="text-blue-600 dark:text-blue-400 font-semibold">
                              {item.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 访问最多的IP */}
                  {stats?.topIPs && stats.topIPs.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold panel-text mb-4">
                        {t.adminSecurity.topIPs}
                      </h3>
                      <div className="space-y-2">
                        {stats.topIPs.slice(0, 10).map((item, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                          >
                            <span className="panel-text font-mono text-sm">
                              {item.ip}
                            </span>
                            <span className="text-blue-600 dark:text-blue-400 font-semibold">
                              {item.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 封禁IP标签页 */}
              {activeTab === "banned" && (
                <BannedIPManagement
                  bannedIPs={bannedIPs}
                  onRefresh={handleRefresh}
                />
              )}

              {/* 速率限制标签页 */}
              {activeTab === "limits" && (
                <RateLimitManagement
                  rateLimits={rateLimits}
                  onRefresh={handleRefresh}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
