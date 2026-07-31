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

interface BannedIP {
  ip: string;
  reason?: string;
  bannedAt: Date;
  bannedBy?: string;
  expiresAt?: Date;
}

interface BannedIPManagementProps {
  bannedIPs: BannedIP[];
  onRefresh: () => void;
}

export default function BannedIPManagement({ bannedIPs, onRefresh }: BannedIPManagementProps) {
  const { t, locale } = useLocale();
  const [showBanDialog, setShowBanDialog] = useState(false);
  const [banIP, setBanIP] = useState('');
  const [banReason, setBanReason] = useState('');
  const [banExpires, setBanExpires] = useState('');
  const [banning, setBanning] = useState(false);
  const { toasts, success, error: showError, warning, removeToast } = useToast();
  const { adminFetch } = useAdminApi();

  const handleBanIP = async () => {
    if (!banIP.trim()) {
      warning(t.adminSecurity.ipAddressPlaceholder);
      return;
    }

    setBanning(true);
    try {
      const response = await adminFetch('/api/admin/security/banned-ips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: banIP.trim(),
          reason: banReason.trim() || undefined,
          expiresAt: banExpires ? new Date(banExpires).toISOString() : undefined,
        }),
      });

      if (response.ok) {
        success(t.adminSecurity.banSuccess);
        setShowBanDialog(false);
        setBanIP('');
        setBanReason('');
        setBanExpires('');
        onRefresh();
      } else {
        const data = await response.json();
        showError(t.adminSecurity.banFailed, data.error?.message || t.adminSecurity.unknownError);
      }
    } catch (error) {
      showError(t.adminSecurity.banFailed, String(error));
    } finally {
      setBanning(false);
    }
  };

  const handleUnbanIP = async (ip: string) => {
    if (!confirm(t.adminSecurity.confirmUnban)) {
      return;
    }

    try {
      const response = await adminFetch('/api/admin/security/banned-ips', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip }),
      });

      if (response.ok) {
        success(t.adminSecurity.unbanSuccess);
        onRefresh();
      } else {
        const data = await response.json();
        showError(t.adminSecurity.unbanFailed, data.error?.message || t.adminSecurity.unknownError);
      }
    } catch (error) {
      showError(t.adminSecurity.unbanFailed, String(error));
    }
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
          <h3 className={styles.toolbarTitle}>{t.adminSecurity.bannedIPList}</h3>
          <button
            type="button"
            onClick={() => setShowBanDialog(true)}
            className={cn(styles.btn, styles.btnDanger)}
          >
            {t.adminSecurity.banIP}
          </button>
        </div>

        {bannedIPs.length === 0 ? (
          <div className={styles.empty}>{t.adminSecurity.noData}</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t.adminSecurity.ipAddress}</th>
                  <th>{t.adminSecurity.location}</th>
                  <th>{t.adminSecurity.reason}</th>
                  <th>{t.adminSecurity.bannedAt}</th>
                  <th>{t.adminSecurity.expiresAt}</th>
                  <th>{t.adminSecurity.actions}</th>
                </tr>
              </thead>
              <tbody>
                {bannedIPs.map((item) => (
                  <tr key={item.ip}>
                    <td className="font-mono">{item.ip}</td>
                    <td><IPLocationBadge ip={item.ip} /></td>
                    <td>{item.reason || '-'}</td>
                    <td>{formatDate(item.bannedAt)}</td>
                    <td>{item.expiresAt ? formatDate(item.expiresAt) : t.adminSecurity.permanent}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleUnbanIP(item.ip)}
                        className={styles.linkAction}
                      >
                        {t.adminSecurity.unbanIP}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showBanDialog ? (
          <AdminPortal>
            <div
              className={styles.modalBackdrop}
              role="dialog"
              aria-modal="true"
              onClick={() => !banning && setShowBanDialog(false)}
            >
              <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <h3 className={styles.modalTitle}>{t.adminSecurity.banIPDialog}</h3>

                <div className={styles.field}>
                  <label htmlFor="ban-ip">{t.adminSecurity.ipAddress}</label>
                  <input
                    id="ban-ip"
                    type="text"
                    value={banIP}
                    onChange={(e) => setBanIP(e.target.value)}
                    placeholder={t.adminSecurity.ipAddressPlaceholder}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="ban-reason">{t.adminSecurity.reason}</label>
                  <input
                    id="ban-reason"
                    type="text"
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    placeholder={t.adminSecurity.reasonPlaceholder}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="ban-expires">{t.adminSecurity.expiresAtLabel}</label>
                  <input
                    id="ban-expires"
                    type="datetime-local"
                    value={banExpires}
                    onChange={(e) => setBanExpires(e.target.value)}
                  />
                </div>

                <div className={styles.modalActions}>
                  <button
                    type="button"
                    onClick={() => setShowBanDialog(false)}
                    disabled={banning}
                    className={cn(styles.btn, styles.btnGhost)}
                  >
                    {t.adminSecurity.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={handleBanIP}
                    disabled={banning}
                    className={cn(styles.btn, styles.btnDanger)}
                  >
                    {banning ? t.adminSecurity.loading : t.adminSecurity.confirm}
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
