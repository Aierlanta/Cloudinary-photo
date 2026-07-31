"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Database,
  FileText,
  Image as ImageIcon,
  Layers,
  LayoutDashboard,
  LogOut,
  Network,
  Settings,
  ShieldAlert,
  Upload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLocale } from "@/hooks/useLocale";
import { OrnateIcon } from "@/components/ui/ornate-icon";

interface AdminNavigationProps {
  onLogout: () => void;
  onToggleCollapse?: (collapsed: boolean) => void;
}

export default function AdminNavigation({ onLogout, onToggleCollapse }: AdminNavigationProps) {
  const { t } = useLocale();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navigationItems: Array<{ name: string; href: string; icon: LucideIcon; tone: "pink" | "lavender" | "mint" | "amber" }> = [
    { name: t.adminNav.dashboard, href: "/admin", icon: LayoutDashboard, tone: "pink" },
    { name: t.adminNav.upload, href: "/admin/images", icon: Upload, tone: "mint" },
    { name: t.adminNav.gallery, href: "/admin/gallery", icon: ImageIcon, tone: "pink" },
    { name: t.adminNav.groups, href: "/admin/groups", icon: Layers, tone: "lavender" },
    { name: t.adminNav.swarm, href: "/admin/swarm", icon: Network, tone: "mint" },
    { name: t.adminNav.apiConfig, href: "/admin/config", icon: Settings, tone: "lavender" },
    { name: t.adminNav.status, href: "/admin/status", icon: Activity, tone: "mint" },
    { name: t.adminNav.logs, href: "/admin/logs", icon: FileText, tone: "lavender" },
    { name: t.adminNav.backup, href: "/admin/backup", icon: Database, tone: "amber" },
    { name: t.adminNav.security, href: "/admin/security", icon: ShieldAlert, tone: "pink" },
  ];

  const toggleCollapsed = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    onToggleCollapse?.(next);
  };

  return (
    <nav
      className={`fixed left-0 top-0 h-full transparent-panel shadow-lg transition-all duration-300 z-40 ${
        isCollapsed ? "w-16" : "w-64"
      }`}
      aria-label={t.adminUi.navigation}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          {!isCollapsed && <h2 className="text-lg font-semibold panel-text">{t.adminDashboard.title}</h2>}
          <button
            type="button"
            onClick={toggleCollapsed}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label={t.adminUi.navigation}
          >
            <OrnateIcon icon={isCollapsed ? ChevronRight : ChevronLeft} tone="lavender" size="sm" />
          </button>
        </div>

        <div className="flex-1 py-4">
          <ul className="space-y-2 px-3">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center px-3 py-2 rounded-lg transition-colors ${
                      isActive
                        ? "bg-pink-500 bg-opacity-20 text-pink-600 dark:text-pink-300"
                        : "hover:bg-gray-100 dark:hover:bg-gray-800 panel-text"
                    }`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <OrnateIcon icon={item.icon} tone={isActive ? "cream" : item.tone} size="sm" />
                    {!isCollapsed && <span className="ml-3 font-medium">{item.name}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onLogout}
            className={`flex items-center w-full px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 dark:hover:bg-opacity-20 rounded-lg transition-colors ${
              isCollapsed ? "justify-center" : ""
            }`}
          >
            <OrnateIcon icon={LogOut} tone="pink" size="sm" />
            {!isCollapsed && <span className="ml-3 font-medium">{t.adminNav.logout}</span>}
          </button>
        </div>
      </div>
    </nav>
  );
}
