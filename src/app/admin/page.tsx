"use client";

import { useState, useEffect } from "react";
import HealthMonitor from "@/components/admin/HealthMonitor";
import { useLocale } from "@/hooks/useLocale";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
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
  const isLight = useTheme();
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

  // --- V3 Layout (Flat Design) ---
  return (
      <div className="space-y-6">
        {/* 欢迎标题 */}
        <div className={cn(
          "border p-6",
          isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
        )}>
          <h1 className={cn(
            "text-3xl font-bold mb-2",
            isLight ? "text-gray-900" : "text-gray-100"
          )}>
            {t.adminDashboard.title}
          </h1>
          <p className={isLight ? "text-gray-600" : "text-gray-400"}>
            {t.adminDashboard.welcome}
          </p>
        </div>

        {/* 快速统计 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={cn(
            "border p-6",
            isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
          )}>
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 flex items-center justify-center",
                isLight ? "bg-blue-500" : "bg-blue-600"
              )}>
                <ImageIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className={cn(
                  "text-sm font-medium mb-1",
                  isLight ? "text-gray-600" : "text-gray-400"
                )}>
                  {t.adminDashboard.totalImages}
                </h2>
                <p className={cn(
                  "text-2xl font-bold",
                  isLight ? "text-gray-900" : "text-gray-100"
                )}>
                  {loading ? "..." : stats?.totalImages || 0}
                </p>
              </div>
            </div>
          </div>

          <div className={cn(
            "border p-6",
            isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
          )}>
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 flex items-center justify-center",
                isLight ? "bg-green-500" : "bg-green-600"
              )}>
                <Layers className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className={cn(
                  "text-sm font-medium mb-1",
                  isLight ? "text-gray-600" : "text-gray-400"
                )}>
                  {t.adminDashboard.groupCount}
                </h2>
                <p className={cn(
                  "text-2xl font-bold",
                  isLight ? "text-gray-900" : "text-gray-100"
                )}>
                  {loading ? "..." : stats?.totalGroups || 0}
                </p>
              </div>
            </div>
          </div>

          <div className={cn(
            "border p-6",
            isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
          )}>
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 flex items-center justify-center",
                isLight ? "bg-purple-500" : "bg-purple-600"
              )}>
                <UploadCloud className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className={cn(
                  "text-sm font-medium mb-1",
                  isLight ? "text-gray-600" : "text-gray-400"
                )}>
                  {t.adminDashboard.recentUploads}
                </h2>
                <p className={cn(
                  "text-2xl font-bold",
                  isLight ? "text-gray-900" : "text-gray-100"
                )}>
                  {loading ? "..." : stats?.recentUploads || 0}
                </p>
              </div>
            </div>
          </div>

          <div className={cn(
            "border p-6",
            isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
          )}>
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 flex items-center justify-center",
                isLight ? "bg-orange-500" : "bg-orange-600"
              )}>
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className={cn(
                  "text-sm font-medium mb-1",
                  isLight ? "text-gray-600" : "text-gray-400"
                )}>
                  24h Access
                </h2>
                <p className={cn(
                  "text-2xl font-bold",
                  isLight ? "text-gray-900" : "text-gray-100"
                )}>
                  {loading ? "..." : stats?.access?.last24Hours || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 访问统计 */}
        <div className={cn(
          "border p-6",
          isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
        )}>
          <h2 className={cn(
            "text-lg font-semibold mb-4",
            isLight ? "text-gray-900" : "text-gray-100"
          )}>
            {t.adminDashboard.accessStats}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={cn(
              "border p-4",
              isLight ? "bg-gray-50 border-gray-300" : "bg-gray-700 border-gray-600"
            )}>
              <p className={cn(
                "text-sm mb-2",
                isLight ? "text-gray-600" : "text-gray-400"
              )}>
                {t.adminDashboard.lastHourAccess}
              </p>
              <p className={cn(
                "text-3xl font-bold",
                isLight ? "text-gray-900" : "text-gray-100"
              )}>
                {loading ? "..." : stats?.access?.lastHour || 0}
              </p>
            </div>
            <div className={cn(
              "border p-4",
              isLight ? "bg-gray-50 border-gray-300" : "bg-gray-700 border-gray-600"
            )}>
              <p className={cn(
                "text-sm mb-2",
                isLight ? "text-gray-600" : "text-gray-400"
              )}>
                {t.adminDashboard.last24HoursAccess}
              </p>
              <p className={cn(
                "text-3xl font-bold",
                isLight ? "text-gray-900" : "text-gray-100"
              )}>
                {loading ? "..." : stats?.access?.last24Hours || 0}
              </p>
            </div>
            <div className={cn(
              "border p-4",
              isLight ? "bg-gray-50 border-gray-300" : "bg-gray-700 border-gray-600"
            )}>
              <p className={cn(
                "text-sm mb-2",
                isLight ? "text-gray-600" : "text-gray-400"
              )}>
                {t.adminDashboard.totalAccess}
              </p>
              <p className={cn(
                "text-3xl font-bold",
                isLight ? "text-gray-900" : "text-gray-100"
              )}>
                {loading ? "..." : stats?.access?.total || 0}
              </p>
            </div>
          </div>
        </div>

        {/* 快速操作 */}
        <div className={cn(
          "border p-6",
          isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
        )}>
          <h2 className={cn(
            "text-lg font-semibold mb-4",
            isLight ? "text-gray-900" : "text-gray-100"
          )}>
            {t.adminDashboard.quickActions}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Link href="/admin/images" className="block">
              <div className={cn(
                "flex items-center gap-3 p-3 border transition-colors",
                isLight
                  ? "bg-white border-gray-300 hover:bg-gray-50"
                  : "bg-gray-800 border-gray-600 hover:bg-gray-700"
              )}>
                <div className={cn(
                  "w-10 h-10 flex items-center justify-center",
                  isLight ? "bg-blue-500" : "bg-blue-600"
                )}>
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className={cn(
                    "font-medium",
                    isLight ? "text-gray-900" : "text-gray-100"
                  )}>
                    {t.adminDashboard.uploadImage}
                  </p>
                  <p className={cn(
                    "text-xs",
                    isLight ? "text-gray-600" : "text-gray-400"
                  )}>
                    Add new content
                  </p>
                </div>
              </div>
            </Link>

            <Link href="/admin/groups" className="block">
              <div className={cn(
                "flex items-center gap-3 p-3 border transition-colors",
                isLight
                  ? "bg-white border-gray-300 hover:bg-gray-50"
                  : "bg-gray-800 border-gray-600 hover:bg-gray-700"
              )}>
                <div className={cn(
                  "w-10 h-10 flex items-center justify-center",
                  isLight ? "bg-green-500" : "bg-green-600"
                )}>
                  <Layers className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className={cn(
                    "font-medium",
                    isLight ? "text-gray-900" : "text-gray-100"
                  )}>
                    {t.adminDashboard.manageGroups}
                  </p>
                  <p className={cn(
                    "text-xs",
                    isLight ? "text-gray-600" : "text-gray-400"
                  )}>
                    Organize collections
                  </p>
                </div>
              </div>
            </Link>

            <Link href="/admin/config" className="block">
              <div className={cn(
                "flex items-center gap-3 p-3 border transition-colors",
                isLight
                  ? "bg-white border-gray-300 hover:bg-gray-50"
                  : "bg-gray-800 border-gray-600 hover:bg-gray-700"
              )}>
                <div className={cn(
                  "w-10 h-10 flex items-center justify-center",
                  isLight ? "bg-purple-500" : "bg-purple-600"
                )}>
                  <Settings className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className={cn(
                    "font-medium",
                    isLight ? "text-gray-900" : "text-gray-100"
                  )}>
                    {t.adminDashboard.apiConfig}
                  </p>
                  <p className={cn(
                    "text-xs",
                    isLight ? "text-gray-600" : "text-gray-400"
                  )}>
                    System settings
                  </p>
                </div>
              </div>
            </Link>

            <Link href="/admin/backup" className="block">
              <div className={cn(
                "flex items-center gap-3 p-3 border transition-colors",
                isLight
                  ? "bg-white border-gray-300 hover:bg-gray-50"
                  : "bg-gray-800 border-gray-600 hover:bg-gray-700"
              )}>
                <div className={cn(
                  "w-10 h-10 flex items-center justify-center",
                  isLight ? "bg-emerald-500" : "bg-emerald-600"
                )}>
                  <Database className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className={cn(
                    "font-medium",
                    isLight ? "text-gray-900" : "text-gray-100"
                  )}>
                    {t.adminDashboard.backupManagement}
                  </p>
                  <p className={cn(
                    "text-xs",
                    isLight ? "text-gray-600" : "text-gray-400"
                  )}>
                    Data safety
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* 健康监控 */}
        <HealthMonitor />
      </div>
    );
}
