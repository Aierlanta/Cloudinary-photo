"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Image as ImageIcon,
  Folder,
  UploadCloud,
  Activity,
  Flower2,
} from "lucide-react";
import Link from "next/link";
import { useAdminApi } from "@/lib/admin-api-client";
import { useLocale } from "@/hooks/useLocale";
import styles from "./admin-pages.module.css";

interface Stats {
  totalImages: number;
  totalGroups: number;
  recentUploads: number;
  backup: {
    lastBackupTime: string | null;
    lastBackupSuccess: boolean;
    backupCount: number;
    isAutoBackupEnabled: boolean;
    isDatabaseHealthy: boolean;
  };
  access: {
    lastHour: number;
    last24Hours: number;
    total: number;
  };
}

export default function AdminDashboard() {
  const { t } = useLocale();
  const { adminFetch, selectedNodeId } = useAdminApi();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLatency, setSummaryLatency] = useState(0);

  useEffect(() => {
    const loadStats = async () => {
      const startedAt = performance.now();
      try {
        const response = await adminFetch("/api/admin/summary");
        if (response.ok) {
          const data = await response.json();
          setStats(data.data?.stats ?? null);
        } else {
          console.error("加载统计数据失败:", response.statusText);
        }
      } catch (error) {
        console.error("加载统计数据失败:", error);
      } finally {
        setSummaryLatency(Math.max(1, Math.round(performance.now() - startedAt)));
        setLoading(false);
      }
    };

    loadStats();
  }, [adminFetch, selectedNodeId]);

  return (
    <div className={cn(styles.page, styles.dashboardPage)}>
      <header className={cn(styles.hero, styles.dashboardHero)}>
        <div>
          <h1 className={styles.heroTitle}>
            <span>{t.adminNav.dashboard}</span>
            <Flower2 className={styles.heroIcon} aria-hidden />
          </h1>
          <p className={styles.heroSubtitle}>{t.adminDashboard.welcome}</p>
        </div>
      </header>

      <section className={styles.statGrid} aria-label={t.adminDashboard.accessStats}>
        <article className={cn(styles.statCard, styles.tonePink)}>
          <p className={styles.statLabel}>{t.adminDashboard.totalImages}</p>
          <p className={styles.statValue}>{loading ? "…" : stats?.totalImages || 0}</p>
          <ImageIcon className={styles.statIcon} aria-hidden />
        </article>
        <article className={cn(styles.statCard, styles.toneLavender)}>
          <p className={styles.statLabel}>{t.adminNav.groups}</p>
          <p className={styles.statValue}>{loading ? "…" : stats?.totalGroups || 0}</p>
          <Folder className={styles.statIcon} aria-hidden />
        </article>
        <article className={cn(styles.statCard, styles.toneMint)}>
          <p className={styles.statLabel}>{t.adminNav.upload}</p>
          <p className={styles.statValue}>{loading ? "…" : stats?.recentUploads || 0}</p>
          <UploadCloud className={styles.statIcon} aria-hidden />
        </article>
        <article className={cn(styles.statCard, styles.toneAmber)}>
          <p className={styles.statLabel}>{t.adminDashboard.last24HoursAccessShort}</p>
          <p className={styles.statValue}>{loading ? "…" : stats?.access?.last24Hours || 0}</p>
          <Activity className={styles.statIcon} aria-hidden />
        </article>
      </section>

      <section className={styles.split}>
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>{t.adminDashboard.accessStats}</h2>
          <div className={styles.miniGrid}>
            <div className={styles.miniCard}>
              <p className={styles.miniLabel}>{t.adminUi.successRate}</p>
              <p className={styles.miniValue}>
                {loading ? "…" : stats?.backup?.isDatabaseHealthy ? "100%" : "0%"}
              </p>
              <p className={cn(styles.miniTrend, styles.trendUp)}>↑ {t.adminUi.databaseHealth}</p>
            </div>
            <div className={styles.miniCard}>
              <p className={styles.miniLabel}>{t.adminStatus.responseTime}</p>
              <p className={styles.miniValue}>{loading ? "…" : `${summaryLatency}ms`}</p>
              <p className={cn(styles.miniTrend, styles.trendUp)}>↓ {t.adminUi.liveRequest}</p>
            </div>
            <div className={styles.miniCard}>
              <p className={styles.miniLabel}>{t.adminDashboard.last24HoursAccessShort}</p>
              <p className={styles.miniValue}>{loading ? "…" : stats?.access?.last24Hours || 0}</p>
              <p className={cn(styles.miniTrend, styles.trendUp)}>↑ {t.adminUi.liveTraffic}</p>
            </div>
          </div>
        </div>

        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>{t.adminDashboard.quickActions}</h2>
          <div className={styles.actionGrid}>
            <Link href="/admin/images" className={cn(styles.actionLink, styles.actionPink)}>
              <span className={styles.actionIcon}><UploadCloud /></span>
              <span><p className={styles.actionTitle}>{t.adminDashboard.uploadImage}</p></span>
            </Link>
            <Link href="/admin/groups" className={cn(styles.actionLink, styles.actionLavender)}>
              <span className={styles.actionIcon}><Folder /></span>
              <span><p className={styles.actionTitle}>{t.adminDashboard.manageGroups}</p></span>
            </Link>
            <Link href="/admin/status" className={cn(styles.actionLink, styles.actionMint)}>
              <span className={styles.actionIcon}><Activity /></span>
              <span><p className={styles.actionTitle}>{t.adminUi.viewApiStatus}</p></span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
