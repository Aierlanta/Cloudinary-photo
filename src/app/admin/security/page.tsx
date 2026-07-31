"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useLocale } from "@/hooks/useLocale";
import { cn } from "@/lib/utils";
import BannedIPManagement from "@/components/admin/BannedIPManagement";
import RateLimitManagement from "@/components/admin/RateLimitManagement";
import RiskControlManagement from "@/components/admin/RiskControlManagement";
import {
  Shield,
  Ban,
  Activity,
  Clock,
  Globe,
  KeyRound,
  BarChart2,
  RefreshCw,
  Eye,
  Trash2,
  X,
} from "lucide-react";
import { IPLocationBadge } from "@/components/admin/IPLocation";
import { useAdminApi } from "@/lib/admin-api-client";
import AdminPortal from "@/components/admin/AdminPortal";
import styles from "../admin-pages.module.css";
import securityStyles from "./security.module.css";

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

interface SecurityConfig {
  id: string;
  guardEnabled: boolean;
  guardAutoEnabled: boolean;
  guardTriggerWindowMinutes: number;
  guardTriggerUniqueIpThreshold: number;
  whitelistOnlyEnabled: boolean;
  guardTriggeredAt?: Date | string | null;
  guardTriggeredReason?: string | null;
}

interface IPWhitelistEntry {
  id: string;
  cidr: string;
  note?: string | null;
  isEnabled: boolean;
  createdAt: Date | string;
}

type TopIPRange = "default" | "lastHour" | "last24Hours";

const TOP_IP_RANGE_TO_HOURS: Record<TopIPRange, number | null> = {
  default: null,
  lastHour: 1,
  last24Hours: 24,
};

export default function SecurityManagement() {
  const { t } = useLocale();
  const { adminFetch } = useAdminApi();
  const [activeTab, setActiveTab] = useState<"stats" | "risk" | "banned" | "limits" | "locations">("limits");
  const [showRateSettings, setShowRateSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const statsRef = useRef<AccessStats | null>(null);
  const topIPRangeRef = useRef<TopIPRange>("default");

  const [stats, setStats] = useState<AccessStats | null>(null);
  const [realtimeStats, setRealtimeStats] = useState<RealtimeStats | null>(null);
  const [topIPs, setTopIPs] = useState<AccessStats["topIPs"]>([]);
  const [topIPRange, setTopIPRange] = useState<TopIPRange>("default");
  const [topIPLoading, setTopIPLoading] = useState(false);

  const [bannedIPs, setBannedIPs] = useState<BannedIP[]>([]);
  const [rateLimits, setRateLimits] = useState<RateLimit[]>([]);
  const [riskConfig, setRiskConfig] = useState<SecurityConfig | null>(null);
  const [whitelist, setWhitelist] = useState<IPWhitelistEntry[]>([]);

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
      const response = await adminFetch(`/api/admin/security/stats?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setTopIPs(data.data.stats.topIPs ?? []);
      }
    } catch (error) {
      console.error("加载Top IP列表失败:", error);
    } finally {
      setTopIPLoading(false);
    }
  }, [adminFetch]);

  const loadOverview = useCallback(async (range: TopIPRange = topIPRangeRef.current) => {
    try {
      const response = await adminFetch("/api/admin/security/overview");
      if (response.ok) {
        const data = await response.json();
        const nextStats = data.data?.stats ?? null;
        statsRef.current = nextStats;
        setStats(nextStats);
        setRealtimeStats(data.data?.realtime ?? null);
        setBannedIPs(data.data?.bannedIPs ?? []);
        setRateLimits(data.data?.rateLimits ?? []);
        setRiskConfig(data.data?.riskControl?.config ?? null);
        setWhitelist(data.data?.riskControl?.whitelist ?? []);
        await refreshTopIPs(range, nextStats);
        setTopIPRange(range);
        topIPRangeRef.current = range;
      }
    } catch (error) {
      console.error("加载安全概览失败:", error);
    }
  }, [adminFetch, refreshTopIPs]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await loadOverview();
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [loadOverview]);

  const handleRefresh = () => {
    loadOverview(topIPRangeRef.current);
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

  const tabs = [
    {
      id: "limits" as const,
      label: t.adminUi.rateLimit,
      meta: `${rateLimits.length} ${t.adminSecurity.activeLimits}`,
      icon: Activity,
    },
    {
      id: "banned" as const,
      label: t.adminUi.ipBan,
      meta: `${bannedIPs.length} ${t.adminSecurity.blocked}`,
      icon: Ban,
    },
    {
      id: "risk" as const,
      label: t.adminUi.riskIps,
      meta:
        riskConfig?.guardEnabled || riskConfig?.whitelistOnlyEnabled
          ? t.adminSecurity.enabled
          : t.adminSecurity.disabled,
      icon: Shield,
    },
    {
      id: "stats" as const,
      label: t.adminUi.accessControl,
      meta: `${realtimeStats?.total || 0} ${t.adminSecurity.requests}`,
      icon: BarChart2,
    },
    {
      id: "locations" as const,
      label: t.adminUi.ipLocation,
      meta: `${topIPs.length} ${t.adminUi.locations}`,
      icon: Globe,
    },
  ];

  return (
    <div className={`${styles.page} admin-security-page`}>
      <header className={styles.hero}>
        <div>
          <h1 className={styles.heroTitle}>
            <span>{t.adminUi.securityCenter}</span>
            <Shield className={styles.heroIcon} aria-hidden />
          </h1>
          <p className={styles.heroSubtitle}>{t.adminUi.securityOverview}</p>
        </div>
        <div className={styles.heroActions}>
          <button
            type="button"
            onClick={handleRefresh}
            className={cn(styles.btn, styles.btnPink)}
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            {t.common.refresh}
          </button>
        </div>
      </header>

      <section className="admin-security-overview" aria-label={t.adminUi.securityOverview}>
        <h2>{t.adminUi.securityOverview}</h2>
        <div>
          <article className="is-safe"><Shield aria-hidden /><span>{t.adminUi.riskLevel}</span><strong>{t.adminUi.low}</strong></article>
          <article className="is-pink"><Ban aria-hidden /><span>{t.adminSecurity.bannedIPs}</span><strong>{bannedIPs.length}</strong></article>
          <article className="is-amber"><KeyRound aria-hidden /><span>{t.adminUi.failedAuthsToday}</span><strong>{rateLimits.length}</strong></article>
          <article className="is-lavender"><Eye aria-hidden /><span>{t.adminUi.suspicious24h}</span><strong>{stats?.uniqueIPCount || 0}</strong></article>
        </div>
      </section>

      <nav className={styles.tabs} aria-label={t.adminNav.security}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(styles.tab, active && styles.tabActive)}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span className={cn(styles.pill, active ? styles.pillPink : styles.pillLavender)}>
                {tab.meta}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="admin-security-content">
        {loading ? (
          <div className={cn(styles.panel, "flex items-center justify-center h-48")}>
            <div className="w-8 h-8 border-2 border-primary border-t-transparent animate-spin rounded-full" />
          </div>
        ) : (
          <>
            {activeTab === "stats" && (
              <div className={styles.page} style={{ gap: 16 }}>
                <section className={styles.metrics} aria-label={t.adminSecurity.statsOverview}>
                  <button
                    type="button"
                    onClick={() => handleTopIPCardClick("lastHour")}
                    className={cn(
                      styles.statCard,
                      styles.toneLavender,
                      "text-left w-full cursor-pointer",
                      topIPRange === "lastHour" && "ring-2 ring-primary"
                    )}
                  >
                    <p className={styles.statLabel}>{t.adminSecurity.lastHour}</p>
                    <p className={styles.statValue}>{realtimeStats?.lastHour || 0}</p>
                    <Clock className={styles.statIcon} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTopIPCardClick("last24Hours")}
                    className={cn(
                      styles.statCard,
                      styles.toneMint,
                      "text-left w-full cursor-pointer",
                      topIPRange === "last24Hours" && "ring-2 ring-primary"
                    )}
                  >
                    <p className={styles.statLabel}>{t.adminSecurity.last24Hours}</p>
                    <p className={styles.statValue}>{realtimeStats?.last24Hours || 0}</p>
                    <Activity className={styles.statIcon} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTopIPCardClick("default")}
                    className={cn(
                      styles.statCard,
                      styles.tonePink,
                      "text-left w-full cursor-pointer",
                      topIPRange === "default" && "ring-2 ring-primary"
                    )}
                  >
                    <p className={styles.statLabel}>{t.adminSecurity.totalAccess}</p>
                    <p className={styles.statValue}>{realtimeStats?.total || 0}</p>
                    <Globe className={styles.statIcon} aria-hidden />
                  </button>
                </section>

                <section className={styles.split}>
                  <article className={styles.panel}>
                    <h2 className={cn(styles.panelTitle, "flex items-center gap-2")}>
                      <BarChart2 className="w-4 h-4 text-primary" />
                      {t.adminSecurity.topPaths}
                    </h2>
                    <div className="relative z-[1] space-y-2">
                      {stats?.pathStats && stats.pathStats.length > 0 ? (
                        stats.pathStats.slice(0, 8).map((item, i) => (
                          <div
                            key={`${item.path}-${i}`}
                            className={cn(styles.miniCard, "flex items-center justify-between gap-3")}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-muted-foreground font-bold w-4">{i + 1}</span>
                              <span className={cn(styles.mono, "truncate")} title={item.path}>
                                {item.path}
                              </span>
                            </div>
                            <span className="font-extrabold shrink-0">{item.count}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-sm text-muted-foreground">
                          {t.adminSecurity.noAccessData}
                        </div>
                      )}
                    </div>
                  </article>

                  <article className={styles.panel}>
                    <div className="relative z-[1] flex items-center gap-3 mb-4 flex-wrap">
                      <h2 className={cn(styles.panelTitle, "flex items-center gap-2 m-0")}>
                        <Shield className="w-4 h-4 text-primary" />
                        {t.adminSecurity.topIPs}
                      </h2>
                      <span className={cn(styles.pill, styles.pillLavender)}>{topIPRangeLabel}</span>
                      {topIPLoading && (
                        <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                      )}
                    </div>
                    <div className="relative z-[1] space-y-2">
                      {topIPLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          {t.adminSecurity.loading}
                        </div>
                      ) : topIPs.length > 0 ? (
                        topIPs.slice(0, 8).map((item, i) => (
                          <div
                            key={item.ip ?? i}
                            className={cn(styles.miniCard, "flex items-center justify-between gap-3")}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <span className="text-muted-foreground font-bold w-4 shrink-0">{i + 1}</span>
                              <span className={cn(styles.mono, "shrink-0")}>{item.ip}</span>
                              <IPLocationBadge ip={item.ip} compact />
                            </div>
                            <span className="font-extrabold shrink-0 ml-2">{item.count}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-sm text-muted-foreground">
                          {t.adminSecurity.noAccessData}
                        </div>
                      )}
                    </div>
                  </article>
                </section>
              </div>
            )}

            {activeTab === "risk" && (
              <section className={styles.panel}>
                <div className="relative z-[1]">
                  <RiskControlManagement
                    config={riskConfig}
                    whitelist={whitelist}
                    onRefresh={handleRefresh}
                  />
                </div>
              </section>
            )}

            {activeTab === "banned" && (
              <section className={styles.panel}>
                <div className="relative z-[1]">
                  <BannedIPManagement bannedIPs={bannedIPs} onRefresh={handleRefresh} />
                </div>
              </section>
            )}

            {activeTab === "limits" && (
              <section className="admin-security-rate-reference">
                <h2>{t.adminUi.rateLimitRules}</h2>
                <div className="admin-security-rate-table">
                  <table>
                    <thead><tr><th>{t.adminUi.rule}</th><th>{t.adminUi.limit}</th><th>{t.adminStatus.status}</th><th>{t.adminConfig.actions}</th></tr></thead>
                    <tbody>
                      {[
                        [t.adminUi.apiRequests, '/api/random', '60 / min'],
                        [t.adminUi.uploadImages, '/api/upload', '30 / min'],
                        [t.adminUi.authAttempts, '/api/auth/login', '10 / min'],
                        [t.adminUi.groupOperations, '/api/groups/*', '20 / min'],
                      ].map(([name, path, limit]) => (
                        <tr key={path}>
                          <td><strong>{name}</strong><small>{path}</small></td>
                          <td><code>{limit}</code></td>
                          <td><span className="admin-security-switch"><i /> {t.adminSecurity.enabled}</span></td>
                          <td>
                            <button type="button" onClick={() => setShowRateSettings(true)}>{t.common.edit}</button>
                            <button type="button" className="admin-security-delete-action" aria-label={t.adminUi.manageRateLimitDeletion} onClick={() => setShowRateSettings(true)}><Trash2 aria-hidden /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p><Activity aria-hidden /> {t.adminUi.rateLimitHint}</p>
              </section>
            )}

            {activeTab === "locations" && (
              <section className={styles.panel}>
                <h2 className={cn(styles.panelTitle, "flex items-center gap-2")}>
                  <Globe className="w-4 h-4 text-primary" />
                  {t.adminUi.locations}
                </h2>
                <div className="relative z-[1] space-y-2">
                  {topIPs.length > 0 ? topIPs.map((item) => (
                    <div key={item.ip} className={cn(styles.miniCard, "flex items-center justify-between gap-3")}>
                      <span className={cn(styles.mono, "shrink-0")}>{item.ip}</span>
                      <IPLocationBadge ip={item.ip} compact />
                      <strong className="ml-auto shrink-0">{item.count}</strong>
                    </div>
                  )) : (
                    <div className="py-8 text-center text-sm text-muted-foreground">{t.adminUi.noIpLocationData}</div>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {showRateSettings ? (
        <AdminPortal>
          <div
            className={securityStyles.rateDialog}
            role="dialog"
            aria-modal="true"
            onClick={() => setShowRateSettings(false)}
          >
            <div
              className={securityStyles.rateDialogPanel}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className={securityStyles.closeBtn}
                aria-label={t.adminUi.closeRateSettings}
                onClick={() => setShowRateSettings(false)}
              >
                <X aria-hidden />
              </button>
              <RateLimitManagement rateLimits={rateLimits} onRefresh={handleRefresh} />
            </div>
          </div>
        </AdminPortal>
      ) : null}
    </div>
  );
}
