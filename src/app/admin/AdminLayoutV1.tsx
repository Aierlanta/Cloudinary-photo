"use client";

import { useState } from 'react';
import AdminNavigation from '@/components/admin/AdminNavigation';
import TransparencyControl from '@/components/admin/TransparencyControl';
import { ComponentErrorBoundary } from '@/components/ErrorBoundary';
import { Theme } from '@/lib/adminTheme';

interface AdminLayoutV1Props {
  children: React.ReactNode;
  panelOpacity: number;
  setPanelOpacity: (opacity: number) => void;
  theme: Theme;
  isManualTheme: boolean;
  handleThemeToggle: () => void;
  handleThemeReset: () => void;
  handleLogout: () => void;
  adminVersion: 'v1' | 'v2';
  setAdminVersion: (version: 'v1' | 'v2') => void;
}

export default function AdminLayoutV1({
  children,
  panelOpacity,
  setPanelOpacity,
  theme,
  isManualTheme,
  handleThemeToggle,
  handleThemeReset,
  handleLogout,
  adminVersion,
  setAdminVersion
}: AdminLayoutV1Props) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <TransparencyControl
        opacity={panelOpacity}
        onChange={setPanelOpacity}
        theme={theme}
        isManualTheme={isManualTheme}
        onThemeToggle={handleThemeToggle}
        onThemeReset={handleThemeReset}
        adminVersion={adminVersion}
        setAdminVersion={setAdminVersion}
      />

      <div className="flex">
        <AdminNavigation onLogout={handleLogout} onToggleCollapse={setSidebarCollapsed} />

        <main className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
          <div className="p-6">
            <ComponentErrorBoundary componentName="AdminPage">
              {children}
            </ComponentErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}

