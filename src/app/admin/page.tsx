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
import { useRecentAdminRoutes } from "@/hooks/useAdminHistory";

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
  
  const { routes, isLoaded, routeConfig } = useRecentAdminRoutes();

  const getTrans = (key: string) => {
    const parts = key.split('.');
    let current: any = t;
    for (const part of parts) {
      if (current === undefined || current === null) return key;
      current = current[part];
    }
    return current || key;
  };

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
      <div className="space-y-6 rounded-lg">
        {/* 欢迎标题 */}
        <div className={cn(
          "border p-6 rounded-lg",
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 rounded-lg">
          <div className={cn(
            "border p-6 rounded-lg",
            isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
          )}>
            <div className="flex items-center gap-4 rounded-lg">
              <div className={cn(
                "w-12 h-12 flex items-center justify-center rounded-lg",
                isLight ? "bg-blue-500" : "bg-blue-600"
              )}>
                <ImageIcon className="w-6 h-6 text-white rounded-lg" />
              </div>
              <div>
                <h2 className={cn(
                  "text-sm font-medium mb-1 rounded-lg",
                  isLight ? "text-gray-600" : "text-gray-400"
                )}>
                  {t.adminDashboard.totalImages}
                </h2>
                <p className={cn(
                  "text-2xl font-bold rounded-lg",
                  isLight ? "text-gray-900" : "text-gray-100"
                )}>
                  {loading ? "..." : stats?.totalImages || 0}
                </p>
              </div>
            </div>
          </div>

          <div className={cn(
            "border p-6 rounded-lg",
            isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
          )}>
            <div className="flex items-center gap-4 rounded-lg">
              <div className={cn(
                "w-12 h-12 flex items-center justify-center rounded-lg",
                isLight ? "bg-green-500" : "bg-green-600"
              )}>
                <Layers className="w-6 h-6 text-white rounded-lg" />
              </div>
              <div>
                <h2 className={cn(
                  "text-sm font-medium mb-1 rounded-lg",
                  isLight ? "text-gray-600" : "text-gray-400"
                )}>
                  {t.adminDashboard.groupCount}
                </h2>
                <p className={cn(
                  "text-2xl font-bold rounded-lg",
                  isLight ? "text-gray-900" : "text-gray-100"
                )}>
                  {loading ? "..." : stats?.totalGroups || 0}
                </p>
              </div>
            </div>
          </div>

          <div className={cn(
            "border p-6 rounded-lg",
            isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
          )}>
            <div className="flex items-center gap-4 rounded-lg">
              <div className={cn(
                "w-12 h-12 flex items-center justify-center rounded-lg",
                isLight ? "bg-purple-500" : "bg-purple-600"
              )}>
                <UploadCloud className="w-6 h-6 text-white rounded-lg" />
              </div>
              <div>
                <h2 className={cn(
                  "text-sm font-medium mb-1 rounded-lg",
                  isLight ? "text-gray-600" : "text-gray-400"
                )}>
                  {t.adminDashboard.recentUploads}
                </h2>
                <p className={cn(
                  "text-2xl font-bold rounded-lg",
                  isLight ? "text-gray-900" : "text-gray-100"
                )}>
                  {loading ? "..." : stats?.recentUploads || 0}
                </p>
              </div>
            </div>
          </div>

          <div className={cn(
            "border p-6 rounded-lg",
            isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
          )}>
            <div className="flex items-center gap-4 rounded-lg">
              <div className={cn(
                "w-12 h-12 flex items-center justify-center rounded-lg",
                isLight ? "bg-orange-500" : "bg-orange-600"
              )}>
                <Activity className="w-6 h-6 text-white rounded-lg" />
              </div>
              <div>
                <h2 className={cn(
                  "text-sm font-medium mb-1 rounded-lg",
                  isLight ? "text-gray-600" : "text-gray-400"
                )}>
                  {t.adminDashboard.last24HoursAccessShort}
                </h2>
                <p className={cn(
                  "text-2xl font-bold rounded-lg",
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
          "border p-6 rounded-lg",
          isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
        )}>
          <h2 className={cn(
            "text-lg font-semibold mb-4 rounded-lg",
            isLight ? "text-gray-900" : "text-gray-100"
          )}>
            {t.adminDashboard.accessStats}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-lg">
            <div className={cn(
              "border p-4 rounded-lg",
              isLight ? "bg-gray-50 border-gray-300" : "bg-gray-700 border-gray-600"
            )}>
              <p className={cn(
                "text-sm mb-2 rounded-lg",
                isLight ? "text-gray-600" : "text-gray-400"
              )}>
                {t.adminDashboard.lastHourAccess}
              </p>
              <p className={cn(
                "text-3xl font-bold rounded-lg",
                isLight ? "text-gray-900" : "text-gray-100"
              )}>
                {loading ? "..." : stats?.access?.lastHour || 0}
              </p>
            </div>
            <div className={cn(
              "border p-4 rounded-lg",
              isLight ? "bg-gray-50 border-gray-300" : "bg-gray-700 border-gray-600"
            )}>
              <p className={cn(
                "text-sm mb-2 rounded-lg",
                isLight ? "text-gray-600" : "text-gray-400"
              )}>
                {t.adminDashboard.last24HoursAccess}
              </p>
              <p className={cn(
                "text-3xl font-bold rounded-lg",
                isLight ? "text-gray-900" : "text-gray-100"
              )}>
                {loading ? "..." : stats?.access?.last24Hours || 0}
              </p>
            </div>
            <div className={cn(
              "border p-4 rounded-lg",
              isLight ? "bg-gray-50 border-gray-300" : "bg-gray-700 border-gray-600"
            )}>
              <p className={cn(
                "text-sm mb-2 rounded-lg",
                isLight ? "text-gray-600" : "text-gray-400"
              )}>
                {t.adminDashboard.totalAccess}
              </p>
              <p className={cn(
                "text-3xl font-bold rounded-lg",
                isLight ? "text-gray-900" : "text-gray-100"
              )}>
                {loading ? "..." : stats?.access?.total || 0}
              </p>
            </div>
          </div>
        </div>

        {/* 快速操作 */}
        <div className={cn(
          "border p-6 rounded-lg",
          isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
        )}>
          <h2 className={cn(
            "text-lg font-semibold mb-4 rounded-lg",
            isLight ? "text-gray-900" : "text-gray-100"
          )}>
            {t.adminDashboard.quickActions}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-lg">
            {!isLoaded ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} className={cn(
                  "h-16 border rounded-lg animate-pulse",
                  isLight ? "bg-gray-100 border-gray-200" : "bg-gray-700 border-gray-600"
                )} />
              ))
            ) : (
              routes.map(path => {
                const config = routeConfig[path];
                if (!config) return null;
                const Icon = config.icon;
                
                const colorMap: Record<string, { light: string, dark: string }> = {
                  blue: { light: 'bg-blue-500', dark: 'bg-blue-600' },
                  green: { light: 'bg-green-500', dark: 'bg-green-600' },
                  purple: { light: 'bg-purple-500', dark: 'bg-purple-600' },
                  emerald: { light: 'bg-emerald-500', dark: 'bg-emerald-600' },
                  indigo: { light: 'bg-indigo-500', dark: 'bg-indigo-600' },
                  orange: { light: 'bg-orange-500', dark: 'bg-orange-600' },
                  cyan: { light: 'bg-cyan-500', dark: 'bg-cyan-600' },
                  red: { light: 'bg-red-500', dark: 'bg-red-600' },
                  slate: { light: 'bg-slate-500', dark: 'bg-slate-600' },
                };
                
                const colorClasses = colorMap[config.color || 'blue'] || colorMap.blue;

                return (
                  <Link key={path} href={path} className="block">
                    <div className={cn(
                      "flex items-center gap-3 p-3 border transition-colors rounded-lg",
                      isLight
                        ? "bg-white border-gray-300 hover:bg-gray-50"
                        : "bg-gray-800 border-gray-600 hover:bg-gray-700"
                    )}>
                      <div className={cn(
                        "w-10 h-10 flex items-center justify-center rounded-lg",
                        isLight ? colorClasses.light : colorClasses.dark
                      )}>
                        <Icon className="w-5 h-5 text-white rounded-lg" />
                      </div>
                      <div>
                        <p className={cn(
                          "font-medium rounded-lg",
                          isLight ? "text-gray-900" : "text-gray-100"
                        )}>
                          {getTrans(config.labelKey)}
                        </p>
                        {config.descKey ? (
                          <p className={cn(
                            "text-xs rounded-lg",
                            isLight ? "text-gray-600" : "text-gray-400"
                          )}>
                            {getTrans(config.descKey)}
                          </p>
                        ) : config.defaultDesc ? (
                          <p className={cn(
                            "text-xs rounded-lg",
                            isLight ? "text-gray-600" : "text-gray-400"
                          )}>
                            {config.defaultDesc}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* 健康监控 */}
        <HealthMonitor />
      </div>
    );
}
