"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
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
            <span className={styles.dashboardHeroArtwork} aria-hidden="true" />
          </h1>
          <p className={styles.heroSubtitle}>{t.adminDashboard.welcome}</p>
        </div>
      </header>

      <section className={styles.statGrid} aria-label={t.adminDashboard.accessStats}>
        <article className={cn(styles.statCard, styles.tonePink)}>
          <span className={cn(styles.statArtwork, styles.statArtworkPhoto)} aria-hidden="true" />
          <div className={styles.statCopy}>
            <p className={styles.statLabel}>{t.adminDashboard.totalImages}</p>
            <p className={styles.statValue}>{loading ? "…" : stats?.totalImages || 0}</p>
          </div>
        </article>
        <article className={cn(styles.statCard, styles.toneLavender)}>
          <span className={cn(styles.statArtwork, styles.statArtworkFolder)} aria-hidden="true" />
          <div className={styles.statCopy}>
            <p className={styles.statLabel}>{t.adminDashboard.groupCount}</p>
            <p className={styles.statValue}>{loading ? "…" : stats?.totalGroups || 0}</p>
          </div>
        </article>
        <article className={cn(styles.statCard, styles.toneMint)}>
          <span className={cn(styles.statArtwork, styles.statArtworkClock)} aria-hidden="true" />
          <div className={styles.statCopy}>
            <p className={styles.statLabel}>{t.adminDashboard.recentUploads}</p>
            <p className={styles.statValue}>{loading ? "…" : stats?.recentUploads || 0}</p>
          </div>
        </article>
        <article className={cn(styles.statCard, styles.toneAmber)}>
          <span className={cn(styles.statArtwork, styles.statArtworkShield)} aria-hidden="true" />
          <div className={styles.statCopy}>
            <p className={styles.statLabel}>{t.adminDashboard.last24HoursAccessShort}</p>
            <p className={styles.statValue}>{loading ? "…" : stats?.access?.last24Hours || 0}</p>
          </div>
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
              <span className={cn(
                styles.statusPill,
                styles.miniStatus,
                stats?.backup?.isDatabaseHealthy === false ? styles.statusPillDanger : styles.statusPillHealthy
              )}>
                <span className={styles.statusPillArtwork} aria-hidden="true" />
                <span>{t.adminUi.databaseHealth}</span>
              </span>
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
              <span className={cn(styles.actionArtwork, styles.actionArtworkUpload)} aria-hidden="true" />
              <span><p className={styles.actionTitle}>{t.adminDashboard.uploadImage}</p></span>
              <span className={cn(styles.actionArrow, styles.actionArrowPink)} aria-hidden="true" />
            </Link>
            <Link href="/admin/groups" className={cn(styles.actionLink, styles.actionLavender)}>
              <span className={cn(styles.actionArtwork, styles.actionArtworkFolder)} aria-hidden="true" />
              <span><p className={styles.actionTitle}>{t.adminDashboard.manageGroups}</p></span>
              <span className={cn(styles.actionArrow, styles.actionArrowLavender)} aria-hidden="true" />
            </Link>
            <Link href="/admin/status" className={cn(styles.actionLink, styles.actionMint)}>
              <span className={cn(styles.actionArtwork, styles.actionArtworkApi)} aria-hidden="true" />
              <span><p className={styles.actionTitle}>{t.adminUi.viewApiStatus}</p></span>
              <span className={cn(styles.actionArrow, styles.actionArrowMint)} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className={cn(styles.panel, styles.healthPanel)}>
          <h2 className={styles.panelTitle}>{t.adminUi.databaseHealth}</h2>
          <span className={styles.healthArtwork} aria-hidden="true" />
          <span className={cn(
            styles.statusPill,
            styles.healthStatus,
            stats?.backup?.isDatabaseHealthy === false ? styles.statusPillDanger : styles.statusPillHealthy
          )}>
            <span className={styles.statusPillArtwork} aria-hidden="true" />
            <span>{stats?.backup?.isDatabaseHealthy === false ? t.adminBackup.abnormal : t.adminBackup.healthy}</span>
          </span>
          <dl className={styles.healthFacts}>
            <div><dt>{t.adminStatus.responseTime}</dt><dd>{loading ? "…" : `${summaryLatency}ms`}</dd></div>
            <div><dt>{t.adminBackup.backupCount}</dt><dd>{loading ? "…" : stats?.backup?.backupCount || 0}</dd></div>
            <div><dt>{t.adminDashboard.last24HoursAccessShort}</dt><dd>{loading ? "…" : stats?.access?.last24Hours || 0}</dd></div>
          </dl>
        </div>
      </section>
    </div>
  );
}
