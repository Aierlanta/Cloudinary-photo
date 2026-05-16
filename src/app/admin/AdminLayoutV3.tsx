"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Image as ImageIcon,
  Upload,
  Layers,
  Settings,
  Activity,
  FileText,
  Database,
  ShieldAlert,
  LogOut,
  Menu,
  X,
  Moon,
  Sun,
  Globe,
  Palette,
  Network,
} from "lucide-react";
import { useLocale } from "@/hooks/useLocale";
import { Theme } from "@/lib/adminTheme";
import { ComponentErrorBoundary } from "@/components/ErrorBoundary";
import { cn } from "@/lib/utils";
import { useAdminApi } from "@/lib/admin-api-client";

interface AdminLayoutV3Props {
  children: React.ReactNode;
  panelOpacity: number;
  setPanelOpacity: (opacity: number) => void;
  theme: Theme;
  isManualTheme: boolean;
  initialVersion: string | null;
  handleThemeToggle: () => void;
  handleThemeReset: () => void;
  handleLogout: () => void;
}

export default function AdminLayoutV3({
  children,
  theme,
  isManualTheme,
  initialVersion,
  handleThemeToggle,
  handleThemeReset,
  handleLogout,
}: AdminLayoutV3Props) {
  const { t, locale, toggleLocale } = useLocale();
  const {
    nodes,
    selectedNodeId,
    setSelectedNodeId,
    selectedNode,
    nodeStatuses,
    refreshNodeStatuses
  } = useAdminApi();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    if (!isSettingsOpen) {
      return;
    }
    refreshNodeStatuses().catch(() => {});
  }, [isSettingsOpen, refreshNodeStatuses]);

  const systemVersion = initialVersion;

  const navigationItems = [
    { name: t.adminNav.dashboard, href: "/admin", icon: LayoutDashboard },
    { name: t.adminNav.upload || "图片上传", href: "/admin/images", icon: Upload },
    { name: t.adminNav.gallery || "图库", href: "/admin/gallery", icon: ImageIcon },
    { name: t.adminNav.groups, href: "/admin/groups", icon: Layers },
    { name: "蜂群", href: "/admin/swarm", icon: Network },
    { name: t.adminNav.apiConfig, href: "/admin/config", icon: Settings },
    { name: t.adminNav.status, href: "/admin/status", icon: Activity },
    { name: "Logs", href: "/admin/logs", icon: FileText },
    { name: t.adminNav.backup, href: "/admin/backup", icon: Database },
    { name: t.adminNav.security, href: "/admin/security", icon: ShieldAlert },
  ];

  const isLight = theme === "light";

  return (
    <div
      className={cn(
        "min-h-screen flex",
        isLight
          ? "bg-gray-50 text-gray-900"
          : "bg-gray-900 text-gray-100"
      )}
    >
      {/* Sidebar Navigation (Desktop) */}
      <aside
        className={cn(
          "hidden lg:flex w-64 flex-col h-screen sticky top-0 border-r",
          isLight
          ? "bg-white border-gray-300"
          : "bg-gray-800 border-gray-600"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo / Brand */}
          <div
            className={cn(
              "flex items-center gap-3 px-6 py-4 border-b",
              isLight ? "border-gray-300" : "border-gray-600"
            )}
          >
            <div className="w-10 h-10 flex items-center justify-center">
              <Image
                src="/icon.png"
                alt="Admin Logo"
                width={36}
                height={36}
                className="w-9 h-9"
                priority
              />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">
                {t.adminDashboard.title}
              </h1>
              {systemVersion && (
                <p
                  className={cn(
                    "text-xs",
                    isLight ? "text-gray-500" : "text-gray-400"
                  )}
                >
                  v{systemVersion}
                </p>
              )}
            </div>
          </div>

          {/* Nav Links */}
          <nav className="flex-1 py-4 px-3 overflow-y-auto">
            <div className="space-y-0.5">
              {navigationItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href} className="block">
                    <div
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 transition-colors",
                        isActive
                          ? isLight
                            ? "bg-blue-500 text-white"
                            : "bg-blue-600 text-white"
                          : isLight
                          ? "text-gray-700 hover:bg-gray-100"
                          : "text-gray-300 hover:bg-gray-700"
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="font-medium">{item.name}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Settings & Logout */}
          <div
            className={cn(
              "p-3 border-t grid grid-cols-1 gap-1",
              isLight ? "border-gray-300" : "border-gray-600"
            )}
          >
            {/* Settings Button */}
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 transition-colors",
                isLight
                  ? "text-gray-700 hover:bg-gray-100"
                  : "text-gray-300 hover:bg-gray-700"
              )}
            >
              <Palette className="w-5 h-5" />
              <span className="font-medium">设置</span>
            </button>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 transition-colors",
                isLight
                  ? "text-red-600 hover:bg-red-50"
                  : "text-red-400 hover:bg-red-900/20"
              )}
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">{t.adminNav.logout}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Menu Toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={cn(
            "p-3",
            isLight
              ? "bg-white text-gray-700 border border-gray-200"
              : "bg-gray-800 text-gray-300 border border-gray-700"
          )}
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Navigation Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div
            className={cn(
              "w-3/4 max-w-xs h-full border-r",
              isLight
          ? "bg-white border-gray-300"
          : "bg-gray-800 border-gray-600"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col h-full">
              <div
                className={cn(
                  "flex items-center gap-3 px-6 py-4 border-b",
                  isLight ? "border-gray-300" : "border-gray-600"
                )}
              >
                <div className="w-10 h-10 flex items-center justify-center">
                  <Image
                    src="/icon.png"
                    alt="Admin Logo"
                    width={36}
                    height={36}
                    className="w-9 h-9"
                    priority
                  />
                </div>
                <h1 className="font-bold text-lg">{t.adminDashboard.title}</h1>
              </div>

              <nav className="flex-1 py-4 px-3 overflow-y-auto">
                <div className="space-y-0.5">
                  {navigationItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <div
                          className={cn(
                            "flex items-center gap-3 px-4 py-3 transition-colors",
                            isActive
                              ? isLight
                                ? "bg-blue-500 text-white"
                                : "bg-blue-600 text-white"
                              : isLight
                              ? "text-gray-700 hover:bg-gray-100"
                              : "text-gray-300 hover:bg-gray-700"
                          )}
                        >
                          <item.icon className="w-5 h-5" />
                          <span className="font-medium">{item.name}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </nav>

              <div
                className={cn(
                  "p-3 border-t space-y-1",
                  isLight ? "border-gray-300" : "border-gray-600"
                )}
              >
                <button
                  onClick={handleLogout}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 transition-colors",
                    isLight
                      ? "text-red-600 hover:bg-red-50"
                      : "text-red-400 hover:bg-red-900/20"
                  )}
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium">{t.adminNav.logout}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 h-screen overflow-y-auto overflow-x-hidden">
        <div className="min-h-full p-4 lg:p-8 pt-20 lg:pt-8">
          <div className="max-w-[1800px] mx-auto">
            <div
              className={cn(
                "border p-6 lg:p-8 rounded-lg",
                isLight
                  ? "bg-white border-gray-300"
                  : "bg-gray-800 border-gray-600"
              )}
            >
              <ComponentErrorBoundary componentName="AdminPage">
                {children}
              </ComponentErrorBoundary>
            </div>
          </div>
        </div>
      </main>

      {/* Settings Panel */}
      {isSettingsOpen && (
        <div
          className={cn(
            "fixed top-4 right-4 z-50 w-[28rem] max-w-[calc(100vw-2rem)] border p-6 rounded-lg",
            isLight
          ? "bg-white border-gray-300"
          : "bg-gray-800 border-gray-600"
          )}
        >
          <div className="flex items-start justify-between mb-4 rounded-lg">
            <h3 className="text-lg font-semibold">设置</h3>
            <button
              onClick={() => setIsSettingsOpen(false)}
              className={cn(
                "p-1 rounded-lg",
                isLight
                  ? "text-gray-500 hover:bg-gray-100"
                  : "text-gray-400 hover:bg-gray-700"
              )}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <label className="block text-sm font-medium">蜂群节点总览</label>
                <button
                  onClick={() => refreshNodeStatuses().catch(() => {})}
                  className={cn(
                    "px-2 py-1 border text-xs rounded-lg",
                    isLight
                      ? "bg-gray-50 border-gray-300 hover:bg-gray-100 text-gray-700"
                      : "bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-200"
                  )}
                >
                  刷新
                </button>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {nodes.map((node) => {
                  const status = nodeStatuses[node.id];
                  const statusLabel = status?.status === 'online'
                    ? '在线'
                    : status?.status === 'degraded'
                      ? '降级'
                      : status?.status === 'offline'
                        ? '离线'
                        : '未知';
                  const statusClass = status?.status === 'online'
                    ? 'bg-green-500'
                    : status?.status === 'degraded'
                      ? 'bg-yellow-500'
                      : status?.status === 'offline'
                        ? 'bg-red-500'
                        : 'bg-gray-400';

                  return (
                    <div
                      key={node.id}
                      className={cn(
                        "border p-3 rounded-lg",
                        node.id === selectedNodeId
                          ? isLight
                            ? "border-blue-400 bg-blue-50"
                            : "border-blue-500 bg-blue-900/20"
                          : isLight
                            ? "border-gray-300 bg-gray-50"
                            : "border-gray-600 bg-gray-700"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn("w-2 h-2 rounded-full", statusClass)} />
                            <span className="font-medium text-sm truncate">{node.name}</span>
                            {node.id === selectedNodeId && (
                              <span className={cn(
                                "text-[10px] px-1.5 py-0.5 border rounded",
                                isLight ? "border-blue-300 text-blue-700" : "border-blue-500 text-blue-200"
                              )}>
                                默认操作
                              </span>
                            )}
                          </div>
                          <p className={cn("mt-1 text-xs break-all", isLight ? "text-gray-500" : "text-gray-400")}>
                            {node.baseUrl}
                          </p>
                          <p className={cn("mt-1 text-xs", isLight ? "text-gray-500" : "text-gray-400")}>
                            {statusLabel}
                            {status?.latencyMs !== undefined ? ` · ${status.latencyMs}ms` : ''}
                            {status?.version ? ` · v${status.version}` : ''}
                          </p>
                        </div>
                        {node.id !== selectedNodeId && (
                          <button
                            onClick={() => setSelectedNodeId(node.id)}
                            className={cn(
                              "shrink-0 px-2 py-1 border text-xs rounded-lg",
                              isLight
                                ? "bg-white border-gray-300 hover:bg-gray-100 text-gray-700"
                                : "bg-gray-800 border-gray-600 hover:bg-gray-700 text-gray-200"
                            )}
                          >
                            设为默认
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className={cn("mt-2 text-xs", isLight ? "text-gray-500" : "text-gray-400")}>
                当前默认操作节点：{selectedNode.name}。图库和蜂群策略仍按共享数据库聚合展示。
              </p>
            </div>

            {/* Language Toggle */}
            <div>
              <label className="block text-sm font-medium mb-2">语言</label>
              <button
                onClick={toggleLocale}
                className={cn(
                  "w-full flex items-center gap-2 px-4 py-2 transition-colors rounded-lg",
                  isLight
                    ? "bg-gray-100 hover:bg-gray-200 text-gray-700"
                    : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                )}
              >
                <Globe className="w-4 h-4" />
                <span>{locale === "zh" ? "切换到 English" : "切换到 中文"}</span>
              </button>
            </div>

            {/* Theme Toggle */}
            <div>
              <label className="block text-sm font-medium mb-2">主题</label>
              <button
                onClick={handleThemeToggle}
                className={cn(
                  "w-full flex items-center gap-2 px-4 py-2 transition-colors rounded-lg",
                  isLight
                    ? "bg-gray-100 hover:bg-gray-200 text-gray-700"
                    : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                )}
              >
                {isLight ? (
                  <Moon className="w-4 h-4" />
                ) : (
                  <Sun className="w-4 h-4" />
                )}
                <span>
                  {isLight ? "切换到深色模式" : "切换到浅色模式"}
                </span>
              </button>
            </div>

            {isManualTheme && (
              <button
                onClick={handleThemeReset}
                className={cn(
                  "w-full flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm rounded-lg",
                  isLight
                    ? "bg-gray-100 hover:bg-gray-200 text-gray-700"
                    : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                )}
              >
                <span>恢复跟随系统</span>
              </button>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

