'use client';

import { useState } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/ui/Toast';
import { IPLocationBadge } from '@/components/admin/IPLocation';

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
  const { t } = useLocale();
  const [showBanDialog, setShowBanDialog] = useState(false);
  const [banIP, setBanIP] = useState('');
  const [banReason, setBanReason] = useState('');
  const [banExpires, setBanExpires] = useState('');
  const [banning, setBanning] = useState(false);
  const { toasts, success, error: showError, warning, removeToast } = useToast();

  const handleBanIP = async () => {
    if (!banIP.trim()) {
      warning(t.adminSecurity.ipAddressPlaceholder);
      return;
    }

    setBanning(true);
    try {
      const response = await fetch('/api/admin/security/banned-ips', {
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
      const response = await fetch('/api/admin/security/banned-ips', {
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
    return new Date(date).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
    <div className="space-y-4">
      {/* 操作按钮 */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold panel-text">
          {t.adminSecurity.bannedIPList}
        </h3>
        <button
          onClick={() => setShowBanDialog(true)}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          {t.adminSecurity.banIP}
        </button>
      </div>

      {/* 封禁IP列表 */}
      {bannedIPs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {t.adminSecurity.noData}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t.adminSecurity.ipAddress}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t.adminSecurity.location}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t.adminSecurity.reason}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t.adminSecurity.bannedAt}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t.adminSecurity.expiresAt}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t.adminSecurity.actions}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {bannedIPs.map((item) => (
                <tr key={item.ip}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono panel-text">
                    {item.ip}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm panel-text">
                    <IPLocationBadge ip={item.ip} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm panel-text">
                    {item.reason || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm panel-text">
                    {formatDate(item.bannedAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm panel-text">
                    {item.expiresAt ? formatDate(item.expiresAt) : t.adminSecurity.permanent}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => handleUnbanIP(item.ip)}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
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

      {/* 封禁IP对话框 */}
      {showBanDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 !mt-0">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold panel-text mb-4">
              {t.adminSecurity.banIPDialog}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium panel-text mb-2">
                  {t.adminSecurity.ipAddress}
                </label>
                <input
                  type="text"
                  value={banIP}
                  onChange={(e) => setBanIP(e.target.value)}
                  placeholder={t.adminSecurity.ipAddressPlaceholder}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 panel-text"
                />
              </div>

              <div>
                <label className="block text-sm font-medium panel-text mb-2">
                  {t.adminSecurity.reason}
                </label>
                <input
                  type="text"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder={t.adminSecurity.reasonPlaceholder}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 panel-text"
                />
              </div>

              <div>
                <label className="block text-sm font-medium panel-text mb-2">
                  {t.adminSecurity.expiresAtLabel}
                </label>
                <input
                  type="datetime-local"
                  value={banExpires}
                  onChange={(e) => setBanExpires(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 panel-text"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowBanDialog(false)}
                disabled={banning}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors panel-text"
              >
                {t.adminSecurity.cancel}
              </button>
              <button
                onClick={handleBanIP}
                disabled={banning}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {banning ? t.adminSecurity.loading : t.adminSecurity.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    <ToastContainer toasts={toasts.map((toast) => ({ ...toast, onClose: removeToast }))} />
    </>
  );
}

