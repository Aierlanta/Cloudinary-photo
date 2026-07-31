import { useEffect, useState } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/ui/Toast';
import { useAdminApi } from '@/lib/admin-api-client';
import { cn } from '@/lib/utils';
import styles from '@/app/admin/security/security.module.css';

interface SecurityConfig {
  id: string;
  guardEnabled: boolean;
  guardAutoEnabled: boolean;
  guardTriggerWindowMinutes: number;
  guardTriggerUniqueIpThreshold: number;
  whitelistOnlyEnabled: boolean;
  guardTriggeredAt?: string | Date | null;
  guardTriggeredReason?: string | null;
}

interface IPWhitelistEntry {
  id: string;
  cidr: string;
  note?: string | null;
  isEnabled: boolean;
  createdAt: string | Date;
}

interface RiskControlManagementProps {
  config: SecurityConfig | null;
  whitelist: IPWhitelistEntry[];
  onRefresh: () => void;
}

export default function RiskControlManagement({ config, whitelist, onRefresh }: RiskControlManagementProps) {
  const { t } = useLocale();
  const { adminFetch } = useAdminApi();
  const { toasts, success, error: showError, warning, removeToast } = useToast();
  const [savingConfig, setSavingConfig] = useState(false);
  const [addingEntry, setAddingEntry] = useState(false);
  const [form, setForm] = useState({
    guardEnabled: false,
    guardAutoEnabled: false,
    guardTriggerWindowMinutes: '5',
    guardTriggerUniqueIpThreshold: '50',
    whitelistOnlyEnabled: false
  });
  const [newCidr, setNewCidr] = useState('');
  const [newNote, setNewNote] = useState('');

  useEffect(() => {
    if (!config) return;
    setForm({
      guardEnabled: config.guardEnabled,
      guardAutoEnabled: config.guardAutoEnabled,
      guardTriggerWindowMinutes: String(config.guardTriggerWindowMinutes),
      guardTriggerUniqueIpThreshold: String(config.guardTriggerUniqueIpThreshold),
      whitelistOnlyEnabled: config.whitelistOnlyEnabled
    });
  }, [config]);

  const updateForm = (patch: Partial<typeof form>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const saveConfig = async () => {
    const guardTriggerWindowMinutes = Number.parseInt(form.guardTriggerWindowMinutes, 10);
    const guardTriggerUniqueIpThreshold = Number.parseInt(form.guardTriggerUniqueIpThreshold, 10);
    if (!Number.isFinite(guardTriggerWindowMinutes) || guardTriggerWindowMinutes < 1) {
      warning(t.adminSecurity.guardWindowInvalid);
      return;
    }
    if (!Number.isFinite(guardTriggerUniqueIpThreshold) || guardTriggerUniqueIpThreshold < 1) {
      warning(t.adminSecurity.guardThresholdInvalid);
      return;
    }

    setSavingConfig(true);
    try {
      const response = await adminFetch('/api/admin/security/risk-control', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guardEnabled: form.guardEnabled,
          guardAutoEnabled: form.guardAutoEnabled,
          guardTriggerWindowMinutes,
          guardTriggerUniqueIpThreshold,
          whitelistOnlyEnabled: form.whitelistOnlyEnabled
        })
      });
      if (!response.ok) {
        const data = await response.json();
        showError(t.adminSecurity.riskControlSaveFailed, data.error?.message || t.adminSecurity.unknownError);
        return;
      }
      success(t.adminSecurity.riskControlSaveSuccess);
      onRefresh();
    } catch (error) {
      showError(t.adminSecurity.riskControlSaveFailed, String(error));
    } finally {
      setSavingConfig(false);
    }
  };

  const addWhitelistEntry = async () => {
    if (!newCidr.trim()) {
      warning(t.adminSecurity.whitelistCidrPlaceholder);
      return;
    }

    setAddingEntry(true);
    try {
      const response = await adminFetch('/api/admin/security/risk-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cidr: newCidr.trim(),
          note: newNote.trim() || undefined,
          isEnabled: true
        })
      });
      if (!response.ok) {
        const data = await response.json();
        showError(t.adminSecurity.whitelistAddFailed, data.error?.message || t.adminSecurity.unknownError);
        return;
      }
      success(t.adminSecurity.whitelistAddSuccess);
      setNewCidr('');
      setNewNote('');
      onRefresh();
    } catch (error) {
      showError(t.adminSecurity.whitelistAddFailed, String(error));
    } finally {
      setAddingEntry(false);
    }
  };

  const toggleWhitelistEntry = async (entry: IPWhitelistEntry) => {
    try {
      const response = await adminFetch('/api/admin/security/risk-control', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: entry.id,
          isEnabled: !entry.isEnabled
        })
      });
      if (!response.ok) {
        const data = await response.json();
        showError(t.adminSecurity.whitelistUpdateFailed, data.error?.message || t.adminSecurity.unknownError);
        return;
      }
      success(t.adminSecurity.whitelistUpdateSuccess);
      onRefresh();
    } catch (error) {
      showError(t.adminSecurity.whitelistUpdateFailed, String(error));
    }
  };

  const deleteWhitelistEntry = async (entry: IPWhitelistEntry) => {
    if (!confirm(t.adminSecurity.confirmDeleteWhitelist)) {
      return;
    }
    try {
      const response = await adminFetch('/api/admin/security/risk-control', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entry.id })
      });
      if (!response.ok) {
        const data = await response.json();
        showError(t.adminSecurity.whitelistDeleteFailed, data.error?.message || t.adminSecurity.unknownError);
        return;
      }
      success(t.adminSecurity.whitelistDeleteSuccess);
      onRefresh();
    } catch (error) {
      showError(t.adminSecurity.whitelistDeleteFailed, String(error));
    }
  };

  const Toggle = ({
    checked,
    onChange,
    label
  }: {
    checked: boolean;
    onChange: (value: boolean) => void;
    label: string;
  }) => (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(styles.toggle, checked && styles.toggleOn)}
      aria-pressed={checked}
      aria-label={label}
    >
      <span className={styles.toggleKnob} />
    </button>
  );

  return (
    <>
      <div>
        <div className={styles.toolbar}>
          <div>
            <h3 className={cn(styles.toolbarTitle, 'flex items-center gap-2')}>
              <span className="admin-security-artwork admin-security-artworkShield admin-security-inline-artwork" aria-hidden="true" />
              {t.adminSecurity.riskControl}
            </h3>
            {config?.guardTriggeredReason ? (
              <p className={styles.cardDesc}>{config.guardTriggeredReason}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={saveConfig}
            disabled={savingConfig}
            className={cn(styles.btn, styles.btnPink)}
          >
            <span className="admin-security-action-artwork securityActionArrow" aria-hidden="true" />
            {savingConfig ? t.adminSecurity.loading : t.adminSecurity.save}
          </button>
        </div>

        <div className={styles.cardGrid}>
          <div className={styles.card}>
            <div>
              <h4 className={styles.cardTitle}>{t.adminSecurity.guardStatus}</h4>
              <p className={styles.cardDesc}>{t.adminSecurity.guardStatusDesc}</p>
            </div>
            <Toggle
              checked={form.guardEnabled}
              onChange={(value) => updateForm({ guardEnabled: value })}
              label={t.adminSecurity.guardStatus}
            />
          </div>
          <div className={styles.card}>
            <div>
              <h4 className={styles.cardTitle}>{t.adminSecurity.autoGuard}</h4>
              <p className={styles.cardDesc}>{t.adminSecurity.autoGuardDesc}</p>
            </div>
            <Toggle
              checked={form.guardAutoEnabled}
              onChange={(value) => updateForm({ guardAutoEnabled: value })}
              label={t.adminSecurity.autoGuard}
            />
          </div>
          <div className={styles.card}>
            <div>
              <h4 className={styles.cardTitle}>{t.adminSecurity.whitelistOnlyMode}</h4>
              <p className={styles.cardDesc}>{t.adminSecurity.whitelistOnlyModeDesc}</p>
            </div>
            <Toggle
              checked={form.whitelistOnlyEnabled}
              onChange={(value) => updateForm({ whitelistOnlyEnabled: value })}
              label={t.adminSecurity.whitelistOnlyMode}
            />
          </div>
        </div>

        <div className={cn(styles.formGrid, 'mt-4')}>
          <div className={styles.field}>
            <label htmlFor="guard-window">{t.adminSecurity.guardWindowMinutes}</label>
            <input
              id="guard-window"
              type="number"
              min={1}
              value={form.guardTriggerWindowMinutes}
              onChange={(event) => updateForm({ guardTriggerWindowMinutes: event.target.value })}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="guard-threshold">{t.adminSecurity.guardUniqueIpThreshold}</label>
            <input
              id="guard-threshold"
              type="number"
              min={1}
              value={form.guardTriggerUniqueIpThreshold}
              onChange={(event) => updateForm({ guardTriggerUniqueIpThreshold: event.target.value })}
            />
          </div>
        </div>

        <div className={styles.sectionDivider}>
          <div className={styles.toolbar}>
            <h4 className={styles.toolbarTitle}>{t.adminSecurity.whitelist}</h4>
            <span className={styles.cardDesc}>
              {whitelist.filter((entry) => entry.isEnabled).length} / {whitelist.length}
            </span>
          </div>

          <div className={styles.whitelistRow}>
            <input
              value={newCidr}
              onChange={(event) => setNewCidr(event.target.value)}
              placeholder={t.adminSecurity.whitelistCidrPlaceholder}
              className={styles.input}
            />
            <input
              value={newNote}
              onChange={(event) => setNewNote(event.target.value)}
              placeholder={t.adminSecurity.whitelistNotePlaceholder}
              className={styles.input}
            />
            <button
              type="button"
              onClick={addWhitelistEntry}
              disabled={addingEntry}
              className={cn(styles.btn, styles.btnLavender)}
            >
              <span className="admin-security-action-artwork securityActionKey" aria-hidden="true" />
              {t.adminSecurity.addWhitelist}
            </button>
          </div>

          {whitelist.length === 0 ? (
            <div className={styles.empty}>{t.adminSecurity.noData}</div>
          ) : (
            <div className={cn(styles.tableWrap, 'mt-4')}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t.adminSecurity.whitelistCidr}</th>
                    <th>{t.adminSecurity.note}</th>
                    <th>{t.adminSecurity.status}</th>
                    <th>{t.adminSecurity.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {whitelist.map((entry) => (
                    <tr key={entry.id}>
                      <td className="font-mono">{entry.cidr}</td>
                      <td>{entry.note || '-'}</td>
                      <td>{entry.isEnabled ? t.adminSecurity.enabled : t.adminSecurity.disabled}</td>
                      <td>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleWhitelistEntry(entry)}
                            className={styles.linkAction}
                          >
                            {entry.isEnabled ? t.adminSecurity.disable : t.adminSecurity.enable}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteWhitelistEntry(entry)}
                            className={cn(styles.linkDanger, 'inline-flex items-center gap-1')}
                          >
                            <span className="admin-security-action-artwork securityActionTrash" aria-hidden="true" />
                            {t.adminSecurity.delete}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <ToastContainer toasts={toasts.map((toast) => ({ ...toast, onClose: removeToast }))} />
    </>
  );
}
