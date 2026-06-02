import { useEffect, useState } from 'react';
import { Shield, Plus, Save, Trash2 } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/ui/Toast';
import { useAdminApi } from '@/lib/admin-api-client';
import { cn } from '@/lib/utils';

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

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) => (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 rounded-lg transition-colors',
        checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
      )}
      aria-pressed={checked}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-lg bg-white transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5'
        )}
      />
    </button>
  );

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold panel-text flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-500" />
              {t.adminSecurity.riskControl}
            </h3>
            {config?.guardTriggeredReason && (
              <p className="text-xs text-yellow-600 dark:text-yellow-300 mt-1">
                {config.guardTriggeredReason}
              </p>
            )}
          </div>
          <button
            onClick={saveConfig}
            disabled={savingConfig}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {savingConfig ? t.adminSecurity.loading : t.adminSecurity.save}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="font-semibold panel-text">{t.adminSecurity.guardStatus}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t.adminSecurity.guardStatusDesc}</p>
              </div>
              <Toggle checked={form.guardEnabled} onChange={(value) => updateForm({ guardEnabled: value })} />
            </div>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="font-semibold panel-text">{t.adminSecurity.autoGuard}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t.adminSecurity.autoGuardDesc}</p>
              </div>
              <Toggle checked={form.guardAutoEnabled} onChange={(value) => updateForm({ guardAutoEnabled: value })} />
            </div>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="font-semibold panel-text">{t.adminSecurity.whitelistOnlyMode}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t.adminSecurity.whitelistOnlyModeDesc}</p>
              </div>
              <Toggle checked={form.whitelistOnlyEnabled} onChange={(value) => updateForm({ whitelistOnlyEnabled: value })} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-sm font-medium panel-text mb-2">{t.adminSecurity.guardWindowMinutes}</span>
            <input
              type="number"
              min={1}
              value={form.guardTriggerWindowMinutes}
              onChange={(event) => updateForm({ guardTriggerWindowMinutes: event.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 panel-text"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium panel-text mb-2">{t.adminSecurity.guardUniqueIpThreshold}</span>
            <input
              type="number"
              min={1}
              value={form.guardTriggerUniqueIpThreshold}
              onChange={(event) => updateForm({ guardTriggerUniqueIpThreshold: event.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 panel-text"
            />
          </label>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold panel-text">{t.adminSecurity.whitelist}</h4>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {whitelist.filter((entry) => entry.isEnabled).length} / {whitelist.length}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
            <input
              value={newCidr}
              onChange={(event) => setNewCidr(event.target.value)}
              placeholder={t.adminSecurity.whitelistCidrPlaceholder}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 panel-text"
            />
            <input
              value={newNote}
              onChange={(event) => setNewNote(event.target.value)}
              placeholder={t.adminSecurity.whitelistNotePlaceholder}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 panel-text"
            />
            <button
              onClick={addWhitelistEntry}
              disabled={addingEntry}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {t.adminSecurity.addWhitelist}
            </button>
          </div>

          {whitelist.length === 0 ? (
            <div className="text-center py-10 text-gray-500">{t.adminSecurity.noData}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t.adminSecurity.whitelistCidr}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t.adminSecurity.note}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t.adminSecurity.status}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t.adminSecurity.actions}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {whitelist.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-mono panel-text">{entry.cidr}</td>
                      <td className="px-4 py-3 text-sm panel-text">{entry.note || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm panel-text">
                        {entry.isEnabled ? t.adminSecurity.enabled : t.adminSecurity.disabled}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => toggleWhitelistEntry(entry)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            {entry.isEnabled ? t.adminSecurity.disable : t.adminSecurity.enable}
                          </button>
                          <button
                            onClick={() => deleteWhitelistEntry(entry)}
                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
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
