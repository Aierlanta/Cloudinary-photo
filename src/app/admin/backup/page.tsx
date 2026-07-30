'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/useToast';
import { useLocale } from '@/hooks/useLocale';
import { ToastContainer } from '@/components/ui/Toast';
import { cn } from '@/lib/utils'
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
  History,
  Flower2,
} from 'lucide-react'
import { useAdminApi } from '@/lib/admin-api-client'
import styles from '../admin-pages.module.css'

interface BackupStatus {
  lastBackupTime: string | null;
  lastBackupSuccess: boolean;
  lastBackupError?: string;
  backupCount: number;
  isAutoBackupEnabled: boolean;
  isDatabaseHealthy: boolean;
  isBackupDatabaseHealthy?: boolean;
  backupDatabaseConfigured?: boolean;
  activeSnapshotId?: string;
  lastBackupDurationMs?: number;
  lastBackupTableCount?: number;
  lastBackupRowCount?: number;
  lastBackupFailedTables?: Array<{
    tableName: string;
    error?: string;
  }>;
}

export default function BackupPage() {
  const { t, locale } = useLocale();
  const { adminFetch } = useAdminApi();
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

  const formatShanghaiTime = (timeString: string | null): string => {
    if (!timeString) return t.adminBackup.neverBackedUp;

    try {
      const date = new Date(timeString);
      return date.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch {
      return timeString;
    }
  };

  const fetchBackupStatus = useCallback(async () => {
    try {
      const response = await adminFetch('/api/admin/backup/status');
      const data = await response.json();

      if (data.success) {
        setBackupStatus(data.data);
      } else {
        showError(tRef.current.adminBackup.getStatusFailed);
      }
    } catch {
      showError(tRef.current.adminBackup.networkError);
    } finally {
      setLoading(false);
    }
  }, [adminFetch, showError]);

  const createBackup = async () => {
    setIsCreatingBackup(true);

    try {
      const response = await adminFetch('/api/admin/backup/create', {
        method: 'POST'
      });
      const data = await response.json();

      if (data.success) {
        showSuccess(t.adminBackup.backupCreated);
        await fetchBackupStatus();
      } else {
        showError(data.message || t.adminBackup.backupCreateFailed);
      }
    } catch {
      showError(t.adminBackup.networkError);
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const restoreBackup = async () => {
    if (!confirm(t.adminBackup.restoreConfirm)) {
      return;
    }

    setIsRestoring(true);

    try {
      const response = await adminFetch('/api/admin/backup/restore', {
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
    } catch {
      showError(t.adminBackup.networkError);
    } finally {
      setIsRestoring(false);
    }
  };

  const initializeBackupDatabase = async () => {
    setIsInitializing(true);

    try {
      const response = await adminFetch('/api/admin/backup/init', {
        method: 'POST'
      });
      const data = await response.json();

      if (data.success) {
        showSuccess(t.adminBackup.backupDbInitialized);
      } else {
        showError(data.message || t.adminBackup.backupDbInitFailed);
      }
    } catch {
      showError(t.adminBackup.networkError);
    } finally {
      setIsInitializing(false);
    }
  };

  const updateAutoBackupSetting = async (enabled: boolean) => {
    try {
      const response = await adminFetch('/api/admin/backup/settings', {
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
    } catch {
      showError(t.adminBackup.networkError);
    }
  };

  useEffect(() => {
    fetchBackupStatus();
  }, [fetchBackupStatus]);

  if (loading) {
    return (
      <div className={`${styles.page} admin-backup-page`}>
        <div className={cn(styles.panel, 'flex items-center justify-center h-64')}>
          <div className="w-8 h-8 border-2 border-primary border-t-transparent animate-spin rounded-full" />
        </div>
      </div>
    );
  }

  const backupHistory = backupStatus?.lastBackupTime
    ? [{
        id: backupStatus.activeSnapshotId || backupStatus.lastBackupTime,
        name: backupStatus.activeSnapshotId || `backup-${backupStatus.lastBackupTime.slice(0, 10)}.snapshot`,
        time: formatShanghaiTime(backupStatus.lastBackupTime),
        status: backupStatus.lastBackupSuccess ? 'success' : 'failed',
        size: backupStatus.lastBackupRowCount ? `${backupStatus.lastBackupRowCount.toLocaleString()} ${t.adminUi.rows}` : t.adminUi.activeSnapshot,
      }]
    : [];

  return (
    <div className={`${styles.page} admin-backup-page`}>
      <header className={styles.hero}>
        <div>
          <h1 className={styles.heroTitle}>
            <span>{t.adminNav.backup}</span>
            <Flower2 className={styles.heroIcon} aria-hidden />
          </h1>
          <p className={styles.heroSubtitle}>{t.adminBackup.description}</p>
        </div>
        <div className={styles.heroActions}>
          <button
            type="button"
            onClick={createBackup}
            disabled={isCreatingBackup}
            className={cn(styles.btn, styles.btnPink)}
          >
            <Play className="w-4 h-4" />
            {isCreatingBackup ? t.adminBackup.creating : t.adminBackup.createBackup}
          </button>
        </div>
      </header>

      <ToastContainer toasts={toasts.map(toast => ({ ...toast, onClose: removeToast }))} />

      <section className={styles.statGrid} aria-label={t.adminNav.backup}>
        <article className={cn(styles.statCard, styles.toneMint)}>
          <p className={styles.statLabel}>{t.adminBackup.autoBackupSettings}</p>
          <p className={styles.statValue} style={{ fontSize: '1.35rem' }}>
            {backupStatus?.isAutoBackupEnabled ? t.adminStatus.enabled : t.adminStatus.disabled}
          </p>
          <div className="relative z-[1] mt-3">
            <label className="admin-backup-auto-toggle" aria-label={t.adminBackup.enableAutoBackup}>
              <input
                type="checkbox"
                checked={backupStatus?.isAutoBackupEnabled || false}
                onChange={(event) => updateAutoBackupSetting(event.target.checked)}
              />
              <span />
            </label>
          </div>
          <Settings className={styles.statIcon} aria-hidden />
        </article>

        <article className={cn(styles.statCard, styles.toneLavender)}>
          <p className={styles.statLabel}>{t.adminBackup.lastBackupTime}</p>
          <p className={styles.statValue} style={{ fontSize: '1.05rem', lineHeight: 1.25 }}>
            {formatShanghaiTime(backupStatus?.lastBackupTime ?? null)}
          </p>
          <Clock className={styles.statIcon} aria-hidden />
        </article>

        <article className={cn(styles.statCard, styles.toneAmber)}>
          <p className={styles.statLabel}>{t.adminBackup.backupCount}</p>
          <p className={styles.statValue} style={{ fontSize: '1.35rem' }}>
            {backupStatus?.backupCount || 0}
          </p>
          <History className={styles.statIcon} aria-hidden />
        </article>

        <article className={cn(styles.statCard, styles.tonePink)}>
          <p className={styles.statLabel}>{t.adminStatus.database}</p>
          <p className={styles.statValue} style={{ fontSize: '1.35rem' }}>{backupStatus?.isDatabaseHealthy ? t.adminStatus.healthy : t.adminUi.check}</p>
          {backupStatus?.isDatabaseHealthy ? <CheckCircle className={styles.statIcon} aria-hidden /> : <AlertTriangle className={styles.statIcon} aria-hidden />}
        </article>
      </section>

      <section className="admin-backup-action-row" aria-label={t.adminBackup.backupOperations}>
        <button type="button" className={cn(styles.btn, styles.btnPink)} onClick={createBackup} disabled={isCreatingBackup}>
          <Play aria-hidden /> {isCreatingBackup ? t.adminBackup.creating : t.adminBackup.createBackup}
        </button>
        <button type="button" className={cn(styles.btn, styles.btnLavender)} onClick={initializeBackupDatabase} disabled={isInitializing}>
          <Database aria-hidden /> {isInitializing ? t.adminBackup.initializing : t.adminBackup.initializeBackupDb}
        </button>
        <button type="button" className={cn(styles.btn, styles.btnGhost)} onClick={fetchBackupStatus}>
          <RefreshCw aria-hidden /> {t.common.refresh}
        </button>
      </section>

      <section className="admin-backup-history" aria-label={t.adminUi.backupHistory}>
        <h2>{t.adminUi.backupHistory}</h2>
        <div className="admin-backup-table-wrap">
          <table>
            <thead><tr><th>{t.adminUi.file}</th><th>{t.adminUi.size}</th><th>{t.adminUi.time}</th><th>{t.adminStatus.status}</th><th>{t.adminConfig.actions}</th></tr></thead>
            <tbody>
              {backupHistory.length ? backupHistory.map((backup) => (
                <tr key={backup.id}>
                  <td>{backup.name}</td><td>{backup.size}</td><td>{backup.time}</td>
                  <td><span className={backup.status === 'success' ? styles.pillMint : styles.pillPink}>{backup.status === 'success' ? t.adminBackup.success : t.adminBackup.failed}</span></td>
                  <td><button type="button" onClick={restoreBackup} disabled={isRestoring}>{isRestoring ? t.adminBackup.restoring : t.adminBackup.restoreFromBackup}</button></td>
                </tr>
              )) : <tr><td colSpan={5} className="admin-backup-empty">{t.adminUi.noBackupsYet}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="admin-backup-settings">
      <section className={styles.panel}>
        <div className="relative z-[1] flex items-center justify-between gap-3 mb-4 flex-wrap">
          <h2 className={styles.panelTitle} style={{ marginBottom: 0 }}>{t.adminUi.snapshotStatus}</h2>
          <span
            className={cn(
              styles.pill,
              backupStatus?.backupDatabaseConfigured && backupStatus?.isBackupDatabaseHealthy
                ? styles.pillMint
                : styles.pillPink
            )}
          >
            {t.adminUi.backupStore}{backupStatus?.isBackupDatabaseHealthy ? t.adminStatus.healthy : `${t.adminStatus.abnormal}/${t.adminStatus.notConfigured}`}
          </span>
        </div>
        <div className={cn(styles.miniGrid)} style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          <div className={styles.miniCard}>
            <p className={styles.miniLabel}>{t.adminUi.activeSnapshot}</p>
            <p className={cn(styles.mono, 'mt-2 break-all')} title={backupStatus?.activeSnapshotId}>
              {backupStatus?.activeSnapshotId || t.adminUi.notAvailable}
            </p>
          </div>
          <div className={styles.miniCard}>
            <p className={styles.miniLabel}>{t.adminUi.tableCount}</p>
            <p className={styles.miniValue}>{backupStatus?.lastBackupTableCount ?? 0}</p>
          </div>
          <div className={styles.miniCard}>
            <p className={styles.miniLabel}>{t.adminUi.rowCount}</p>
            <p className={styles.miniValue}>{backupStatus?.lastBackupRowCount ?? 0}</p>
          </div>
          <div className={styles.miniCard}>
            <p className={styles.miniLabel}>{t.adminUi.duration}</p>
            <p className={styles.miniValue} style={{ fontSize: '1.35rem' }}>
              {backupStatus?.lastBackupDurationMs != null ? `${backupStatus.lastBackupDurationMs}ms` : t.adminUi.notAvailable}
            </p>
          </div>
        </div>
        {backupStatus?.lastBackupFailedTables && backupStatus.lastBackupFailedTables.length > 0 && (
          <div className="relative z-[1] mt-4 p-3 rounded-2xl border-2 border-red-300/60 bg-red-50/80 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200">
            <p className="font-bold mb-2">{t.adminUi.failedTables}</p>
            <ul className="space-y-1">
              {backupStatus.lastBackupFailedTables.map((table) => (
                <li key={table.tableName} className="truncate" title={table.error}>
                  {table.tableName}: {table.error || `${t.adminUi.unknown}${t.adminUi.error}`}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className={styles.split}>
        <article className={styles.panel}>
          <h2 className={cn(styles.panelTitle, 'flex items-center gap-2')}>
            <Settings className="w-5 h-5 text-primary" />
            {t.adminBackup.backupOperations}
          </h2>
          <div className={cn(styles.miniCard, 'relative z-[1]')}>
            <div className="flex justify-between items-start gap-3 mb-4">
              <div>
                <h3 className="font-extrabold m-0">{t.adminBackup.restoreFromBackup}</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-0">{t.adminBackup.restoreWarning}</p>
              </div>
              <span className="w-10 h-10 rounded-2xl bg-amber-400 flex items-center justify-center text-white shrink-0">
                <RotateCcw className="w-5 h-5" />
              </span>
            </div>
            <button
              type="button"
              onClick={restoreBackup}
              disabled={isRestoring}
              className={cn(styles.btn, styles.btnLavender, 'w-full justify-center')}
            >
              {isRestoring ? t.adminBackup.restoring : t.adminBackup.restoreFromBackup}
            </button>
          </div>
        </article>

        <article className={styles.panel}>
          <h2 className={cn(styles.panelTitle, 'flex items-center gap-2')}>
            <Database className="w-5 h-5 text-primary" />
            {t.adminBackup.autoBackupSettings}
          </h2>
          <div className={cn(styles.miniCard, 'relative z-[1] flex items-center justify-between gap-4')}>
            <div>
              <h3 className="font-extrabold m-0">{t.adminBackup.enableAutoBackup}</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-0">{t.adminBackup.autoBackupDescription}</p>
            </div>
            <label className="relative inline-block w-12 h-6 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={backupStatus?.isAutoBackupEnabled || false}
                onChange={(e) => updateAutoBackupSetting(e.target.checked)}
                className="sr-only"
              />
              <span
                className={cn(
                  'absolute inset-0 rounded-full transition-colors',
                  backupStatus?.isAutoBackupEnabled ? 'bg-primary' : 'bg-muted'
                )}
              />
              <span
                className={cn(
                  'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white border border-border transition-transform',
                  backupStatus?.isAutoBackupEnabled && 'translate-x-6'
                )}
              />
            </label>
          </div>
        </article>
      </section>
      </div>
    </div>
  );
}
