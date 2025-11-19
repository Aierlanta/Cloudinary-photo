"use client";

import { useState, useEffect } from "react";
import HealthMonitor from "@/components/admin/HealthMonitor";
import { useLocale } from "@/hooks/useLocale";
import { useAdminVersion } from "@/contexts/AdminVersionContext";
import { GlassCard } from "@/components/ui/glass";
import {
  Image as ImageIcon,
  Layers,
  UploadCloud,
  Activity,
  Database,
  Plus,
  Settings,
  ShieldAlert,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

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
  const { version } = useAdminVersion();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await fetch("/api/admin/stats");
        if (response.ok) {
          const data = await response.json();
          setStats(data.data);
        } else {
          console.error("加载统计数据失败:", response.statusText);
        }
      } catch (error) {
        console.error("加载统计数据失败:", error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  if (version === 'v2') {
    return (
      <div className="space-y-8">
        {/* 欢迎标题 (V2) */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            {t.adminDashboard.title}
          </h1>
          <p className="text-muted-foreground">
            {t.adminDashboard.welcome}
          </p>
        </div>

        {/* Dashboard Grid (V2) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           
           {/* Left Column: Stats & Charts */}
           <div className="lg:col-span-2 space-y-8">
              {/* Quick Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <GlassCard className="relative overflow-hidden flex flex-col items-center justify-center p-4 text-center gap-2 group" hover>
                  <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">{loading ? "..." : stats?.totalImages || 0}</h3>
                    <p className="text-xs font-medium text-muted-foreground">{t.adminDashboard.totalImages}</p>
                  </div>
                </GlassCard>

                <GlassCard className="relative overflow-hidden flex flex-col items-center justify-center p-4 text-center gap-2 group" hover>
                  <div className="p-3 rounded-2xl bg-green-500/10 text-green-500 group-hover:scale-110 transition-transform">
                    <Layers className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">{loading ? "..." : stats?.totalGroups || 0}</h3>
                    <p className="text-xs font-medium text-muted-foreground">{t.adminDashboard.groupCount}</p>
                  </div>
                </GlassCard>

                <GlassCard className="relative overflow-hidden flex flex-col items-center justify-center p-4 text-center gap-2 group" hover>
                  <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-500 group-hover:scale-110 transition-transform">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">{loading ? "..." : stats?.recentUploads || 0}</h3>
                    <p className="text-xs font-medium text-muted-foreground">{t.adminDashboard.recentUploads}</p>
                  </div>
                </GlassCard>

                <GlassCard className="relative overflow-hidden flex flex-col items-center justify-center p-4 text-center gap-2 group" hover>
                  <div className="p-3 rounded-2xl bg-orange-500/10 text-orange-500 group-hover:scale-110 transition-transform">
                    <Activity className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">{loading ? "..." : stats?.access?.last24Hours || 0}</h3>
                    <p className="text-xs font-medium text-muted-foreground">24h Access</p>
                  </div>
                </GlassCard>
              </div>

              {/* Access Stats Large Card */}
              <GlassCard className="min-h-[300px] flex flex-col">
                <div className="flex items-center justify-between mb-8">
                   <h2 className="text-lg font-semibold flex items-center gap-2">
                     <Activity className="w-5 h-5 text-primary" />
                     {t.adminDashboard.accessStats}
                   </h2>
                   <select className="bg-white/5 border border-white/10 rounded-lg text-xs px-2 py-1 outline-none focus:border-primary">
                      <option className="bg-gray-900">Last 24 Hours</option>
                      <option className="bg-gray-900">Last 7 Days</option>
                   </select>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
                  <div className="p-6 rounded-2xl bg-gradient-to-br from-white/5 to-transparent border border-white/5 flex flex-col justify-between">
                    <div>
                       <p className="text-sm text-muted-foreground mb-1">{t.adminDashboard.lastHourAccess}</p>
                       <p className="text-4xl font-bold tracking-tight">{loading ? "..." : stats?.access?.lastHour || 0}</p>
                    </div>
                    <div className="mt-4 h-1 w-full bg-white/10 rounded-full overflow-hidden">
                       <div className="h-full bg-blue-500 w-[40%]" />
                    </div>
                  </div>
                  <div className="p-6 rounded-2xl bg-gradient-to-br from-white/5 to-transparent border border-white/5 flex flex-col justify-between">
                    <div>
                       <p className="text-sm text-muted-foreground mb-1">{t.adminDashboard.last24HoursAccess}</p>
                       <p className="text-4xl font-bold tracking-tight">{loading ? "..." : stats?.access?.last24Hours || 0}</p>
                    </div>
                    <div className="mt-4 h-1 w-full bg-white/10 rounded-full overflow-hidden">
                       <div className="h-full bg-green-500 w-[65%]" />
                    </div>
                  </div>
                  <div className="p-6 rounded-2xl bg-gradient-to-br from-white/5 to-transparent border border-white/5 flex flex-col justify-between">
                    <div>
                       <p className="text-sm text-muted-foreground mb-1">{t.adminDashboard.totalAccess}</p>
                       <p className="text-4xl font-bold tracking-tight">{loading ? "..." : stats?.access?.total || 0}</p>
                    </div>
                    <div className="mt-4 h-1 w-full bg-white/10 rounded-full overflow-hidden">
                       <div className="h-full bg-purple-500 w-[80%]" />
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Health Monitor Area */}
              <HealthMonitor />
           </div>

           {/* Right Column: Actions & Status */}
           <div className="space-y-8">
              {/* Quick Actions */}
              <GlassCard>
                 <h2 className="text-lg font-semibold mb-6">{t.adminDashboard.quickActions}</h2>
                 <div className="space-y-3">
                    <Link href="/admin/images" className="block">
                       <div className="group flex items-center gap-4 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5 hover:border-white/10">
                          <div className="p-2.5 rounded-lg bg-blue-500/20 text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                             <Plus className="w-5 h-5" />
                          </div>
                          <div>
                             <p className="font-medium">{t.adminDashboard.uploadImage}</p>
                             <p className="text-xs text-muted-foreground">Add new content</p>
                          </div>
                       </div>
                    </Link>

                    <Link href="/admin/groups" className="block">
                       <div className="group flex items-center gap-4 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5 hover:border-white/10">
                          <div className="p-2.5 rounded-lg bg-green-500/20 text-green-500 group-hover:bg-green-500 group-hover:text-white transition-colors">
                             <Layers className="w-5 h-5" />
                          </div>
                          <div>
                             <p className="font-medium">{t.adminDashboard.manageGroups}</p>
                             <p className="text-xs text-muted-foreground">Organize collections</p>
                          </div>
                       </div>
                    </Link>

                    <Link href="/admin/config" className="block">
                       <div className="group flex items-center gap-4 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5 hover:border-white/10">
                          <div className="p-2.5 rounded-lg bg-purple-500/20 text-purple-500 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                             <Settings className="w-5 h-5" />
                          </div>
                          <div>
                             <p className="font-medium">{t.adminDashboard.apiConfig}</p>
                             <p className="text-xs text-muted-foreground">System settings</p>
                          </div>
                       </div>
                    </Link>
                    
                    <Link href="/admin/backup" className="block">
                       <div className="group flex items-center gap-4 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5 hover:border-white/10">
                          <div className="p-2.5 rounded-lg bg-emerald-500/20 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                             <Database className="w-5 h-5" />
                          </div>
                          <div>
                             <p className="font-medium">{t.adminDashboard.backupManagement}</p>
                             <p className="text-xs text-muted-foreground">Data safety</p>
                          </div>
                       </div>
                    </Link>

                    <a href="/api/random" target="_blank" className="block">
                       <div className="group flex items-center gap-4 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5 hover:border-white/10">
                          <div className="p-2.5 rounded-lg bg-orange-500/20 text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                             <ExternalLink className="w-5 h-5" />
                          </div>
                          <div>
                             <p className="font-medium">{t.adminDashboard.testAPI}</p>
                             <p className="text-xs text-muted-foreground">Live preview</p>
                          </div>
                       </div>
                    </a>
                 </div>
              </GlassCard>

              {/* System Health Status Tiny Card */}
              <GlassCard className={loading ? "opacity-50" : ""}>
                 <h2 className="text-lg font-semibold mb-4">System Status</h2>
                 <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                       <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-sm font-medium text-emerald-500">Database</span>
                       </div>
                       <span className="text-xs text-emerald-400">Operational</span>
                    </div>
                     <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                       <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-sm font-medium text-emerald-500">API Service</span>
                       </div>
                       <span className="text-xs text-emerald-400">Operational</span>
                    </div>
                 </div>
              </GlassCard>
           </div>
        </div>
      </div>
    );
  }

  // --- V1 Layout (Classic) ---
  return (
    <div className="space-y-6">
      {/* 欢迎标题 */}
      <div className="transparent-panel rounded-lg p-6 shadow-lg">
        <h1 className="text-3xl font-bold panel-text mb-2">
          {t.adminDashboard.title}
        </h1>
        <p className="text-gray-600 dark:text-gray-300 panel-text">
          {t.adminDashboard.welcome}
        </p>
      </div>

      {/* 快速统计 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="transparent-panel rounded-lg p-6 shadow-lg">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-500 bg-opacity-20">
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-lg font-semibold panel-text">
                {t.adminDashboard.totalImages}
              </h2>
              <p className="text-2xl font-bold text-blue-600 panel-text">
                {loading ? "..." : stats?.totalImages || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="transparent-panel rounded-lg p-6 shadow-lg">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-500 bg-opacity-20">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-lg font-semibold panel-text">
                {t.adminDashboard.groupCount}
              </h2>
              <p className="text-2xl font-bold text-green-600 panel-text">
                {loading ? "..." : stats?.totalGroups || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="transparent-panel rounded-lg p-6 shadow-lg">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-500 bg-opacity-20">
              <svg
                className="w-8 h-8 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-lg font-semibold panel-text">
                {t.adminDashboard.recentUploads}
              </h2>
              <p className="text-2xl font-bold text-purple-600 panel-text">
                {loading ? "..." : stats?.recentUploads || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="transparent-panel rounded-lg p-6 shadow-lg">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-orange-500 bg-opacity-20">
              <svg
                className="w-8 h-8 text-orange-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-lg font-semibold panel-text">
                {t.adminDashboard.last24HoursAccess}
              </h2>
              <p className="text-2xl font-bold text-orange-600 panel-text">
                {loading ? "..." : stats?.access?.last24Hours || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 访问统计详情 */}
      <div className="transparent-panel rounded-lg p-6 shadow-lg">
        <h2 className="text-xl font-bold panel-text mb-4">
          {t.adminDashboard.accessStats}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 panel-text">
              {t.adminDashboard.lastHourAccess}
            </p>
            <p className="text-2xl font-bold panel-text mt-2">
              {loading ? "..." : stats?.access?.lastHour || 0}
            </p>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 panel-text">
              {t.adminDashboard.last24HoursAccess}
            </p>
            <p className="text-2xl font-bold panel-text mt-2">
              {loading ? "..." : stats?.access?.last24Hours || 0}
            </p>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 panel-text">
              {t.adminDashboard.totalAccess}
            </p>
            <p className="text-2xl font-bold panel-text mt-2">
              {loading ? "..." : stats?.access?.total || 0}
            </p>
          </div>
        </div>

        <div className="transparent-panel rounded-lg p-6 shadow-lg">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-emerald-500 bg-opacity-20">
              <svg
                className="w-8 h-8 text-emerald-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-lg font-semibold panel-text">
                {t.adminDashboard.databaseBackup}
              </h2>
              <div className="flex items-center gap-2">
                <p className="text-sm panel-text">
                  {loading
                    ? "..."
                    : stats?.backup.lastBackupTime ||
                      t.adminDashboard.neverBackedUp}
                </p>
                {!loading && stats?.backup.isDatabaseHealthy && (
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                )}
                {!loading && !stats?.backup.isDatabaseHealthy && (
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 快速操作 */}
      <div className="transparent-panel rounded-lg p-6 shadow-lg">
        <h2 className="text-xl font-semibold panel-text mb-4">
          {t.adminDashboard.quickActions}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <a
            href="/admin/images"
            className="flex items-center p-4 bg-blue-500 bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-all duration-200"
          >
            <svg
              className="w-6 h-6 text-blue-600 mr-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            <span className="font-medium panel-text">
              {t.adminDashboard.uploadImage}
            </span>
          </a>

          <a
            href="/admin/groups"
            className="flex items-center p-4 bg-green-500 bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-all duration-200"
          >
            <svg
              className="w-6 h-6 text-green-600 mr-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <span className="font-medium panel-text">
              {t.adminDashboard.manageGroups}
            </span>
          </a>

          <a
            href="/admin/config"
            className="flex items-center p-4 bg-purple-500 bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-all duration-200"
          >
            <svg
              className="w-6 h-6 text-purple-600 mr-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span className="font-medium panel-text">
              {t.adminDashboard.apiConfig}
            </span>
          </a>

          <a
            href="/admin/backup"
            className="flex items-center p-4 bg-emerald-500 bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-all duration-200"
          >
            <svg
              className="w-6 h-6 text-emerald-600 mr-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
              />
            </svg>
            <span className="font-medium panel-text">
              {t.adminDashboard.backupManagement}
            </span>
          </a>

          <a
            href="/api/random"
            target="_blank"
            className="flex items-center p-4 bg-orange-500 bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-all duration-200"
          >
            <svg
              className="w-6 h-6 text-orange-600 mr-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            <span className="font-medium panel-text">
              {t.adminDashboard.testAPI}
            </span>
          </a>
        </div>
      </div>

      {/* 系统健康监控 */}
      <HealthMonitor />
    </div>
  );
}
