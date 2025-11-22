"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useLocale } from "@/hooks/useLocale";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import BannedIPManagement from "@/components/admin/BannedIPManagement";
import RateLimitManagement from "@/components/admin/RateLimitManagement";
import { 
  Shield, 
  Ban, 
  Activity, 
  Clock, 
  Globe, 
  BarChart2,
  RefreshCw
} from "lucide-react";

interface AccessStats {
  totalAccess: number;
  uniqueIPCount: number;
  pathStats: Array<{ path: string; count: number }>;
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

type TopIPRange = "default" | "lastHour" | "last24Hours";

const TOP_IP_RANGE_TO_HOURS: Record<TopIPRange, number | null> = {
  default: null,
  lastHour: 1,
  last24Hours: 24,
};

export default function SecurityManagement() {
  const { t } = useLocale();
  const isLight = useTheme();
  const [activeTab, setActiveTab] = useState<"stats" | "banned" | "limits">("stats");
  const [loading, setLoading] = useState(true);
  const statsRef = useRef<AccessStats | null>(null);
  const topIPRangeRef = useRef<TopIPRange>("default");

  // 访问统计数据
  const [stats, setStats] = useState<AccessStats | null>(null);
  const [realtimeStats, setRealtimeStats] = useState<RealtimeStats | null>(null);
  const [topIPs, setTopIPs] = useState<AccessStats["topIPs"]>([]);
  const [topIPRange, setTopIPRange] = useState<TopIPRange>("default");
  const [topIPLoading, setTopIPLoading] = useState(false);

  // 封禁IP数据
  const [bannedIPs, setBannedIPs] = useState<BannedIP[]>([]);

  // 速率限制数据
  const [rateLimits, setRateLimits] = useState<RateLimit[]>([]);

  const refreshTopIPs = useCallback(async (range: TopIPRange, latestStats?: AccessStats | null) => {
    const hours = TOP_IP_RANGE_TO_HOURS[range];
    const fallbackStats = latestStats ?? statsRef.current;
    if (!hours) {
      setTopIPs(fallbackStats?.topIPs ?? []);
      return;
    }

    setTopIPLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("hours", hours.toString());
      const response = await fetch(`/api/admin/security/stats?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setTopIPs(data.data.stats.topIPs ?? []);
      }
    } catch (error) {
      console.error("加载Top IP列表失败:", error);
    } finally {
      setTopIPLoading(false);
    }
  }, []);

  // 加载访问统计
  const loadStats = useCallback(async (range: TopIPRange = topIPRangeRef.current) => {
    try {
      const response = await fetch("/api/admin/security/stats?days=7");
      if (response.ok) {
        const data = await response.json();
        statsRef.current = data.data.stats;
        setStats(data.data.stats);
        setRealtimeStats(data.data.realtime);
        await refreshTopIPs(range, data.data.stats);
        setTopIPRange(range);
        topIPRangeRef.current = range;
      }
    } catch (error) {
      console.error("加载统计数据失败:", error);
    }
  }, [refreshTopIPs]);
  // 加载封禁IP列表
  const loadBannedIPs = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/security/banned-ips");
      if (response.ok) {
        const data = await response.json();
        setBannedIPs(data.data.bannedIPs);
      }
    } catch (error) {
      console.error("加载封禁IP列表失败:", error);
    }
  }, []);

  // 加载速率限制列表
  const loadRateLimits = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/security/rate-limits");
      if (response.ok) {
        const data = await response.json();
        setRateLimits(data.data.rateLimits);
      }
    } catch (error) {
      console.error("加载速率限制列表失败:", error);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await Promise.all([loadStats(), loadBannedIPs(), loadRateLimits()]);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [loadStats, loadBannedIPs, loadRateLimits]);

  const handleRefresh = () => {
    loadStats(topIPRangeRef.current);
    loadBannedIPs();
    loadRateLimits();
  };

  const handleTopIPCardClick = (range: TopIPRange) => {
    setTopIPRange(range);
    topIPRangeRef.current = range;
    refreshTopIPs(range);
  };

  const topIPRangeLabel =
    topIPRange === "lastHour"
      ? t.adminSecurity.lastHour
      : topIPRange === "last24Hours"
      ? t.adminSecurity.last24Hours
      : t.adminSecurity.last7Days;

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
            {t.adminSecurity.title}
          </h1>
          <p className={cn(
            "text-sm rounded-lg",
            isLight ? "text-gray-600" : "text-gray-400"
          )}>
            {t.adminSecurity.description}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className={cn(
            "px-4 py-2 border flex items-center gap-2 transition-colors rounded-lg",
            isLight
              ? "bg-blue-500 text-white border-blue-600 hover:bg-blue-600"
              : "bg-blue-600 text-white border-blue-500 hover:bg-blue-700"
          )}
        >
          <RefreshCw className={cn("w-4 h-4", loading ? "animate-spin" : "")} />
          {t.adminSecurity.refresh}
        </button>
      </div>

      {/* Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-lg">
        <div
          className={cn(
            "border p-4 cursor-pointer transition-colors rounded-lg",
            activeTab === 'stats'
              ? isLight
                ? "bg-blue-500 border-blue-600"
                : "bg-blue-600 border-blue-500"
              : isLight
              ? "bg-white border-gray-300 hover:bg-gray-50"
              : "bg-gray-800 border-gray-600 hover:bg-gray-700"
          )}
          onClick={() => setActiveTab('stats')}
        >
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-12 h-12 flex items-center justify-center rounded-lg",
              activeTab === 'stats'
                ? "bg-white/20"
                : isLight
                ? "bg-blue-500"
                : "bg-blue-600"
            )}>
              <BarChart2 className={cn(
                "w-6 h-6",
                activeTab === 'stats' ? "text-white" : "text-white"
              )} />
            </div>
            <div>
              <h3 className={cn(
                "font-bold rounded-lg",
                activeTab === 'stats' ? "text-white" : isLight ? "text-gray-900" : "text-gray-100"
              )}>
                {t.adminSecurity.accessStats}
              </h3>
              <p className={cn(
                "text-xs rounded-lg",
                activeTab === 'stats' ? "text-white/80" : isLight ? "text-gray-600" : "text-gray-400"
              )}>
                {realtimeStats?.total || 0} {t.adminSecurity.requests}
              </p>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "border p-4 cursor-pointer transition-colors rounded-lg",
            activeTab === 'banned'
              ? isLight
                ? "bg-red-500 border-red-600"
                : "bg-red-600 border-red-500"
              : isLight
              ? "bg-white border-gray-300 hover:bg-gray-50"
              : "bg-gray-800 border-gray-600 hover:bg-gray-700"
          )}
          onClick={() => setActiveTab('banned')}
        >
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-12 h-12 flex items-center justify-center rounded-lg",
              activeTab === 'banned'
                ? "bg-white/20"
                : isLight
                ? "bg-red-500"
                : "bg-red-600"
            )}>
              <Ban className={cn(
                "w-6 h-6",
                activeTab === 'banned' ? "text-white" : "text-white"
              )} />
            </div>
            <div>
              <h3 className={cn(
                "font-bold rounded-lg",
                activeTab === 'banned' ? "text-white" : isLight ? "text-gray-900" : "text-gray-100"
              )}>
                {t.adminSecurity.bannedIPs}
              </h3>
              <p className={cn(
                "text-xs rounded-lg",
                activeTab === 'banned' ? "text-white/80" : isLight ? "text-gray-600" : "text-gray-400"
              )}>
                {bannedIPs.length} {t.adminSecurity.blocked}
              </p>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "border p-4 cursor-pointer transition-colors rounded-lg",
            activeTab === 'limits'
              ? isLight
                ? "bg-yellow-500 border-yellow-600"
                : "bg-yellow-600 border-yellow-500"
              : isLight
              ? "bg-white border-gray-300 hover:bg-gray-50"
              : "bg-gray-800 border-gray-600 hover:bg-gray-700"
          )}
          onClick={() => setActiveTab('limits')}
        >
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-12 h-12 flex items-center justify-center rounded-lg",
              activeTab === 'limits'
                ? "bg-white/20"
                : isLight
                ? "bg-yellow-500"
                : "bg-yellow-600"
            )}>
              <Activity className={cn(
                "w-6 h-6",
                activeTab === 'limits' ? "text-white" : "text-white"
              )} />
            </div>
            <div>
              <h3 className={cn(
                "font-bold rounded-lg",
                activeTab === 'limits' ? "text-white" : isLight ? "text-gray-900" : "text-gray-100"
              )}>
                {t.adminSecurity.rateLimits}
              </h3>
              <p className={cn(
                "text-xs rounded-lg",
                activeTab === 'limits' ? "text-white/80" : isLight ? "text-gray-600" : "text-gray-400"
              )}>
                {rateLimits.length} {t.adminSecurity.activeLimits}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="min-h-[400px]">
        {loading ? (
          <div className={cn(
            "border p-6 flex items-center justify-center rounded-lg",
            isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
          )}>
            <div className={cn(
              "w-8 h-8 border-2 border-t-transparent animate-spin",
              isLight ? "border-blue-500" : "border-blue-600"
            )}></div>
          </div>
        ) : (
          <>
            {activeTab === 'stats' && (
              <div className="space-y-6 rounded-lg">
                {/* Realtime Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-lg">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleTopIPCardClick("lastHour")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleTopIPCardClick("lastHour");
                      }
                    }}
                    className={cn(
                      "border p-6 rounded-lg transition cursor-pointer",
                      isLight
                        ? "bg-white border-gray-300 hover:border-blue-400"
                        : "bg-gray-800 border-gray-600 hover:border-blue-400/60",
                      topIPRange === "lastHour" ? "ring-2 ring-blue-500" : ""
                    )}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <p className={cn(
                        "text-sm rounded-lg",
                        isLight ? "text-gray-600" : "text-gray-400"
                      )}>
                        {t.adminSecurity.lastHour}
                      </p>
                      <Clock className={cn(
                        "w-4 h-4",
                        isLight ? "text-blue-500" : "text-blue-400"
                      )} />
                    </div>
                    <div className={cn(
                      "text-3xl font-bold rounded-lg",
                      isLight ? "text-gray-900" : "text-gray-100"
                    )}>
                      {realtimeStats?.lastHour || 0}
                    </div>
                  </div>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleTopIPCardClick("last24Hours")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleTopIPCardClick("last24Hours");
                      }
                    }}
                    className={cn(
                      "border p-6 rounded-lg transition cursor-pointer",
                      isLight
                        ? "bg-white border-gray-300 hover:border-green-400"
                        : "bg-gray-800 border-gray-600 hover:border-green-400/60",
                      topIPRange === "last24Hours" ? "ring-2 ring-green-500" : ""
                    )}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <p className={cn(
                        "text-sm rounded-lg",
                        isLight ? "text-gray-600" : "text-gray-400"
                      )}>
                        {t.adminSecurity.last24Hours}
                      </p>
                      <Activity className={cn(
                        "w-4 h-4",
                        isLight ? "text-green-500" : "text-green-400"
                      )} />
                    </div>
                    <div className={cn(
                      "text-3xl font-bold rounded-lg",
                      isLight ? "text-gray-900" : "text-gray-100"
                    )}>
                      {realtimeStats?.last24Hours || 0}
                    </div>
                  </div>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleTopIPCardClick("default")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleTopIPCardClick("default");
                      }
                    }}
                    className={cn(
                      "border p-6 rounded-lg transition cursor-pointer",
                      isLight ? "bg-white border-gray-300 hover:border-purple-400" : "bg-gray-800 border-gray-600 hover:border-purple-400/60",
                      topIPRange === "default" ? "ring-2 ring-purple-500" : ""
                    )}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <p className={cn(
                        "text-sm rounded-lg",
                        isLight ? "text-gray-600" : "text-gray-400"
                      )}>
                        {t.adminSecurity.totalAccess}
                      </p>
                      <Globe className={cn(
                        "w-4 h-4",
                        isLight ? "text-purple-500" : "text-purple-400"
                      )} />
                    </div>
                    <div className={cn(
                      "text-3xl font-bold rounded-lg",
                      isLight ? "text-gray-900" : "text-gray-100"
                    )}>
                      {realtimeStats?.total || 0}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Top Paths */}
                  <div className={cn(
                    "border p-6 rounded-lg",
                    isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
                  )}>
                    <h3 className={cn(
                      "font-bold mb-4 flex items-center gap-2 rounded-lg",
                      isLight ? "text-gray-900" : "text-gray-100"
                    )}>
                      <BarChart2 className={cn(
                        "w-4 h-4",
                        isLight ? "text-blue-500" : "text-blue-400"
                      )} />
                      {t.adminSecurity.topPaths}
                    </h3>
                    <div className="space-y-2 rounded-lg">
                      {stats?.pathStats && stats.pathStats.length > 0 ? (
                        stats.pathStats.slice(0, 8).map((item, i) => (
                          <div
                            key={i}
                            className={cn(
                              "flex items-center justify-between text-sm p-2 border rounded-lg",
                              isLight ? "bg-gray-50 border-gray-200" : "bg-gray-700 border-gray-600"
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className={cn(
                                "w-4 rounded-lg",
                                isLight ? "text-gray-600" : "text-gray-400"
                              )}>
                                {i + 1}
                              </span>
                              <span className={cn(
                                "font-mono truncate px-2 py-0.5 text-xs border rounded-lg",
                                isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
                              )}>
                                {item.path}
                              </span>
                            </div>
                            <span className={cn(
                              "font-medium rounded-lg",
                              isLight ? "text-gray-900" : "text-gray-100"
                            )}>
                              {item.count}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className={cn(
                          "text-center py-8 text-sm rounded-lg",
                          isLight ? "text-gray-500" : "text-gray-400"
                        )}>
                          {t.adminSecurity.noAccessData}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Top IPs */}
                  <div className={cn(
                    "border p-6 rounded-lg",
                    isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
                  )}>
                    <div className="flex items-center gap-3 mb-4">
                      <h3 className={cn(
                        "font-bold flex items-center gap-2 rounded-lg",
                        isLight ? "text-gray-900" : "text-gray-100"
                      )}>
                        <Shield className={cn(
                          "w-4 h-4",
                          isLight ? "text-blue-500" : "text-blue-400"
                        )} />
                        {t.adminSecurity.topIPs}
                      </h3>
                      <span className={cn(
                        "text-xs px-2 py-1 rounded-full border",
                        isLight ? "text-blue-700 bg-blue-50 border-blue-200" : "text-blue-100 bg-blue-900/40 border-blue-700"
                      )}>
                        {topIPRangeLabel}
                      </span>
                      {topIPLoading && (
                        <RefreshCw className={cn(
                          "w-4 h-4 animate-spin",
                          isLight ? "text-blue-500" : "text-blue-400"
                        )} />
                      )}
                    </div>
                    <div className="space-y-2 rounded-lg">
                      {topIPLoading ? (
                        <div className={cn(
                          "flex items-center gap-2 text-sm rounded-lg",
                          isLight ? "text-gray-600" : "text-gray-400"
                        )}>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          {t.adminSecurity.loading}
                        </div>
                      ) : topIPs.length > 0 ? (
                        topIPs.slice(0, 8).map((item, i) => (
                          <div
                            key={item.ip ?? i}
                            className={cn(
                              "flex items-center justify-between text-sm p-2 border rounded-lg",
                              isLight ? "bg-gray-50 border-gray-200" : "bg-gray-700 border-gray-600"
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className={cn(
                                "w-4 rounded-lg",
                                isLight ? "text-gray-600" : "text-gray-400"
                              )}>
                                {i + 1}
                              </span>
                              <span className={cn(
                                "font-mono truncate px-2 py-0.5 text-xs border rounded-lg",
                                isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
                              )}>
                                {item.ip}
                              </span>
                            </div>
                            <span className={cn(
                              "font-medium rounded-lg",
                              isLight ? "text-gray-900" : "text-gray-100"
                            )}>
                              {item.count}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className={cn(
                          "text-center py-8 text-sm rounded-lg",
                          isLight ? "text-gray-500" : "text-gray-400"
                        )}>
                          {t.adminSecurity.noAccessData}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'banned' && (
              <div className={cn(
                "border p-6 rounded-lg",
                isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
              )}>
                <BannedIPManagement bannedIPs={bannedIPs} onRefresh={handleRefresh} />
              </div>
            )}

            {activeTab === 'limits' && (
              <div className={cn(
                "border p-6 rounded-lg",
                isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
              )}>
                <RateLimitManagement rateLimits={rateLimits} onRefresh={handleRefresh} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
