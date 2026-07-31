'use client';

import { useState } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/ui/Toast';
import { IPLocationBadge } from '@/components/admin/IPLocation';
import { useAdminApi } from '@/lib/admin-api-client';
import AdminPortal from '@/components/admin/AdminPortal';
import { cn } from '@/lib/utils';
import styles from '@/app/admin/security/security.module.css';

interface RateLimit {
  ip: string;
  maxRequests: number;
  windowMs: number;
  maxTotal?: number;
  createdAt: Date;
}

interface RateLimitManagementProps {
  rateLimits: RateLimit[];
  onRefresh: () => void;
}

export default function RateLimitManagement({ rateLimits, onRefresh }: RateLimitManagementProps) {
  const { t, locale } = useLocale();
  const [showSetDialog, setShowSetDialog] = useState(false);
  const [ip, setIP] = useState('');
  const [maxRequests, setMaxRequests] = useState('60');
  const [windowMs, setWindowMs] = useState('60000');
  const [maxTotal, setMaxTotal] = useState('');
  const [setting, setSetting] = useState(false);
  const { toasts, success, error: showError, warning, removeToast } = useToast();
  const { adminFetch } = useAdminApi();

  const handleSetRateLimit = async () => {
    if (!ip.trim() || !maxRequests || !windowMs) {
      warning(t.adminSecurity.incompleteForm, t.adminSecurity.incompleteFormMessage);
      return;
    }

    setSetting(true);
    try {
      const response = await adminFetch('/api/admin/security/rate-limits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: ip.trim(),
          maxRequests: parseInt(maxRequests),
          windowMs: parseInt(windowMs),
          maxTotal: maxTotal ? parseInt(maxTotal) : undefined,
        }),
      });

      if (response.ok) {
        success(t.adminSecurity.setRateLimitSuccess);
        setShowSetDialog(false);
        setIP('');
        setMaxRequests('60');
        setWindowMs('60000');
        setMaxTotal('');
        onRefresh();
      } else {
        const data = await response.json();
        showError(t.adminSecurity.setFailed, data.error?.message || t.adminSecurity.unknownError);
      }
    } catch (error) {
      showError(t.adminSecurity.setFailed, String(error));
    } finally {
      setSetting(false);
    }
  };

  const handleRemoveRateLimit = async (ip: string) => {
    if (!confirm(t.adminSecurity.confirmRemoveRateLimit)) {
      return;
    }

    try {
      const response = await adminFetch('/api/admin/security/rate-limits', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip }),
      });

      if (response.ok) {
        success(t.adminSecurity.removeRateLimitSuccess);
        onRefresh();
      } else {
        const data = await response.json();
        showError(t.adminSecurity.removeFailed, data.error?.message || t.adminSecurity.unknownError);
      }
    } catch (error) {
      showError(t.adminSecurity.removeFailed, String(error));
    }
  };

  const formatWindowMs = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${ms / 1000}s`;
    if (ms < 3600000) return `${ms / 60000} ${t.adminStatus.minutes}`;
    return `${ms / 3600000} ${t.adminStatus.hours}`;
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <div>
        <div className={styles.toolbar}>
          <h3 className={styles.toolbarTitle}>{t.adminSecurity.rateLimitList}</h3>
          <button
            type="button"
            onClick={() => setShowSetDialog(true)}
            className={cn(styles.btn, styles.btnPink)}
          >
            {t.adminSecurity.setRateLimit}
          </button>
        </div>

        {rateLimits.length === 0 ? (
          <div className={styles.empty}>{t.adminSecurity.noData}</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t.adminSecurity.ipAddress}</th>
                  <th>{t.adminSecurity.location}</th>
                  <th>{t.adminSecurity.maxRequests}</th>
                  <th>{t.adminSecurity.windowMs}</th>
                  <th>{t.adminSecurity.maxTotal}</th>
                  <th>{t.adminGroups.createdAt}</th>
                  <th>{t.adminSecurity.actions}</th>
                </tr>
              </thead>
              <tbody>
                {rateLimits.map((item) => (
                  <tr key={item.ip}>
                    <td className="font-mono">{item.ip}</td>
                    <td><IPLocationBadge ip={item.ip} /></td>
                    <td>{item.maxRequests}</td>
                    <td>{formatWindowMs(item.windowMs)}</td>
                    <td>{item.maxTotal || '-'}</td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleRemoveRateLimit(item.ip)}
                        className={styles.linkDanger}
                      >
                        {t.adminSecurity.removeRateLimit}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showSetDialog ? (
          <AdminPortal>
            <div
              className={styles.modalBackdrop}
              role="dialog"
              aria-modal="true"
              onClick={() => !setting && setShowSetDialog(false)}
            >
              <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <h3 className={styles.modalTitle}>{t.adminSecurity.setRateLimitDialog}</h3>

                <div className={styles.field}>
                  <label htmlFor="rate-ip">{t.adminSecurity.ipAddress} *</label>
                  <input
                    id="rate-ip"
                    type="text"
                    value={ip}
                    onChange={(e) => setIP(e.target.value)}
                    placeholder={t.adminSecurity.ipAddressPlaceholder}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="rate-max">{t.adminSecurity.maxRequests} *</label>
                  <input
                    id="rate-max"
                    type="number"
                    value={maxRequests}
                    onChange={(e) => setMaxRequests(e.target.value)}
                    placeholder={t.adminSecurity.maxRequestsPlaceholder}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="rate-window">{t.adminSecurity.windowMs} *</label>
                  <input
                    id="rate-window"
                    type="number"
                    value={windowMs}
                    onChange={(e) => setWindowMs(e.target.value)}
                    placeholder={t.adminSecurity.windowMsPlaceholder}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="rate-total">{t.adminSecurity.maxTotal}</label>
                  <input
                    id="rate-total"
                    type="number"
                    value={maxTotal}
                    onChange={(e) => setMaxTotal(e.target.value)}
                    placeholder={t.adminSecurity.maxTotalPlaceholder}
                  />
                </div>

                <div className={styles.modalActions}>
                  <button
                    type="button"
                    onClick={() => setShowSetDialog(false)}
                    disabled={setting}
                    className={cn(styles.btn, styles.btnGhost)}
                  >
                    {t.adminSecurity.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={handleSetRateLimit}
                    disabled={setting}
                    className={cn(styles.btn, styles.btnPink)}
                  >
                    {setting ? t.adminSecurity.loading : t.adminSecurity.confirm}
                  </button>
                </div>
              </div>
            </div>
          </AdminPortal>
        ) : null}
      </div>
      <ToastContainer toasts={toasts.map((toast) => ({ ...toast, onClose: removeToast }))} />
    </>
  );
}
