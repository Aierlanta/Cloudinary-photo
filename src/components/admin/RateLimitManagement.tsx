'use client';

import { useState } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/ui/Toast';

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
  const { t } = useLocale();
  const [showSetDialog, setShowSetDialog] = useState(false);
  const [ip, setIP] = useState('');
  const [maxRequests, setMaxRequests] = useState('60');
  const [windowMs, setWindowMs] = useState('60000');
  const [maxTotal, setMaxTotal] = useState('');
  const [setting, setSetting] = useState(false);
  const { toasts, success, error: showError, warning, removeToast } = useToast();

  const handleSetRateLimit = async () => {
    if (!ip.trim() || !maxRequests || !windowMs) {
      warning('表单未完成', '请填写必填字段');
      return;
    }

    setSetting(true);
    try {
      const response = await fetch('/api/admin/security/rate-limits', {
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
        showError(`设置失败`, data.error?.message || '未知错误');
      }
    } catch (error) {
      showError('设置失败', String(error));
    } finally {
      setSetting(false);
    }
  };

  const handleRemoveRateLimit = async (ip: string) => {
    if (!confirm(t.adminSecurity.confirmRemoveRateLimit)) {
      return;
    }

    try {
      const response = await fetch('/api/admin/security/rate-limits', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip }),
      });

      if (response.ok) {
        success(t.adminSecurity.removeRateLimitSuccess);
        onRefresh();
      } else {
        const data = await response.json();
        showError('删除失败', data.error?.message || '未知错误');
      }
    } catch (error) {
      showError('删除失败', String(error));
    }
  };

  const formatWindowMs = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${ms / 1000}s`;
    if (ms < 3600000) return `${ms / 60000}min`;
    return `${ms / 3600000}h`;
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
          {t.adminSecurity.rateLimitList}
        </h3>
        <button
          onClick={() => setShowSetDialog(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          {t.adminSecurity.setRateLimit}
        </button>
      </div>

      {/* 速率限制列表 */}
      {rateLimits.length === 0 ? (
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
                  {t.adminSecurity.maxRequests}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t.adminSecurity.windowMs}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t.adminSecurity.maxTotal}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  创建时间
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t.adminSecurity.actions}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {rateLimits.map((item) => (
                <tr key={item.ip}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono panel-text">
                    {item.ip}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm panel-text">
                    {item.maxRequests}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm panel-text">
                    {formatWindowMs(item.windowMs)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm panel-text">
                    {item.maxTotal || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm panel-text">
                    {formatDate(item.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => handleRemoveRateLimit(item.ip)}
                      className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
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

      {/* 设置速率限制对话框 */}
      {showSetDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 !mt-0">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold panel-text mb-4">
              {t.adminSecurity.setRateLimitDialog}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium panel-text mb-2">
                  {t.adminSecurity.ipAddress} *
                </label>
                <input
                  type="text"
                  value={ip}
                  onChange={(e) => setIP(e.target.value)}
                  placeholder={t.adminSecurity.ipAddressPlaceholder}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 panel-text"
                />
              </div>

              <div>
                <label className="block text-sm font-medium panel-text mb-2">
                  {t.adminSecurity.maxRequests} *
                </label>
                <input
                  type="number"
                  value={maxRequests}
                  onChange={(e) => setMaxRequests(e.target.value)}
                  placeholder={t.adminSecurity.maxRequestsPlaceholder}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 panel-text"
                />
              </div>

              <div>
                <label className="block text-sm font-medium panel-text mb-2">
                  {t.adminSecurity.windowMs} *
                </label>
                <input
                  type="number"
                  value={windowMs}
                  onChange={(e) => setWindowMs(e.target.value)}
                  placeholder={t.adminSecurity.windowMsPlaceholder}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 panel-text"
                />
              </div>

              <div>
                <label className="block text-sm font-medium panel-text mb-2">
                  {t.adminSecurity.maxTotal}
                </label>
                <input
                  type="number"
                  value={maxTotal}
                  onChange={(e) => setMaxTotal(e.target.value)}
                  placeholder={t.adminSecurity.maxTotalPlaceholder}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 panel-text"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowSetDialog(false)}
                disabled={setting}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors panel-text"
              >
                {t.adminSecurity.cancel}
              </button>
              <button
                onClick={handleSetRateLimit}
                disabled={setting}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {setting ? t.adminSecurity.loading : t.adminSecurity.confirm}
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

