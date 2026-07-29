"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  Star,
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
    { name: t.adminNav.swarm, href: "/admin/swarm", icon: Network },
    { name: t.adminNav.apiConfig, href: "/admin/config", icon: Settings },
    { name: t.adminNav.status, href: "/admin/status", icon: Activity },
    { name: t.adminNav.logs, href: "/admin/logs", icon: FileText },
    { name: t.adminNav.backup, href: "/admin/backup", icon: Database },
    { name: t.adminNav.security, href: "/admin/security", icon: ShieldAlert },
  ];

  const isLight = theme === "light";

  const brandBadge = (
    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-soft ring-2 ring-white/70 ring-inset shrink-0">
      <Star className="w-5 h-5 text-white" fill="currentColor" />
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar Navigation (Desktop) */}
      <aside className="hidden lg:flex w-64 flex-col h-screen sticky top-0 border-r-2 border-border bg-card">
        <div className="flex flex-col h-full">
          {/* Logo / Brand */}
          <div className="flex items-center gap-3 px-6 py-4 border-b-2 border-dashed border-border">
            {brandBadge}
            <div>
              <h1 className="font-display font-bold text-lg leading-tight">
                {t.adminDashboard.title}
              </h1>
              {systemVersion && (
                <p className="text-xs text-muted-foreground">
                  v{systemVersion}
                </p>
              )}
            </div>
          </div>

          {/* Nav Links */}
          <nav className="flex-1 py-4 px-3 overflow-y-auto">
            <div className="space-y-1.5">
              {navigationItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href} className="block">
                    <div
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-2xl transition-all",
                        isActive
                          ? "bg-primary text-white shadow-soft"
                          : "text-foreground/75 hover:bg-primary/10 hover:text-foreground"
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="font-bold text-sm">{item.name}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Settings & Logout */}
          <div className="p-3 border-t-2 border-dashed border-border grid grid-cols-1 gap-1.5">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-foreground/75 hover:bg-primary/10 hover:text-foreground"
            >
              <Palette className="w-5 h-5" />
              <span className="font-bold text-sm">{t.admin.quickSettings}</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-bold text-sm">{t.adminNav.logout}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Menu Toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={isMobileMenuOpen ? t.common.close : "Menu"}
          className="p-3 rounded-2xl bg-card border-2 border-border shadow-soft text-foreground"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Navigation Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden bg-black/30"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div
            className="w-3/4 max-w-xs h-full border-r-2 border-border bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-3 px-6 py-4 border-b-2 border-dashed border-border">
                {brandBadge}
                <h1 className="font-display font-bold text-lg">{t.adminDashboard.title}</h1>
              </div>

              <nav className="flex-1 py-4 px-3 overflow-y-auto">
                <div className="space-y-1.5">
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
                            "flex items-center gap-3 px-4 py-3 rounded-2xl transition-all",
                            isActive
                              ? "bg-primary text-white shadow-soft"
                              : "text-foreground/75 hover:bg-primary/10 hover:text-foreground"
                          )}
                        >
                          <item.icon className="w-5 h-5" />
                          <span className="font-bold text-sm">{item.name}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </nav>

              <div className="p-3 border-t-2 border-dashed border-border space-y-1.5">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-bold text-sm">{t.adminNav.logout}</span>
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
            <div className="border-2 border-border bg-card p-6 lg:p-8 rounded-3xl shadow-soft">
              <ComponentErrorBoundary componentName="AdminPage">
                {children}
              </ComponentErrorBoundary>
            </div>
          </div>
        </div>
      </main>

      {/* Settings Panel */}
      {isSettingsOpen && (
        <div className="fixed top-4 right-4 z-50 w-[28rem] max-w-[calc(100vw-2rem)] border-2 border-border bg-card p-6 rounded-3xl shadow-lift">
          <div className="flex items-start justify-between mb-4">
            <h3 className="font-display text-lg font-bold">{t.admin.quickSettings}</h3>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              aria-label={t.common.close}
              className="p-1.5 rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary-strong transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <label className="block text-sm font-bold">{t.adminNav.swarm}</label>
                <button
                  type="button"
                  onClick={() => refreshNodeStatuses().catch(() => {})}
                  className="px-3 py-1 border-2 border-border text-xs font-bold rounded-full bg-card hover:border-primary hover:text-primary-strong transition-colors"
                >
                  {t.common.refresh}
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
                    ? 'bg-emerald-400'
                    : status?.status === 'degraded'
                      ? 'bg-amber-400'
                      : status?.status === 'offline'
                        ? 'bg-red-400'
                        : 'bg-gray-300';

                  return (
                    <div
                      key={node.id}
                      className={cn(
                        "border-2 p-3 rounded-2xl",
                        node.id === selectedNodeId
                          ? "border-primary/60 bg-primary/10"
                          : "border-border bg-background"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn("w-2 h-2 rounded-full", statusClass)} />
                            <span className="font-bold text-sm truncate">{node.name}</span>
                            {node.id === selectedNodeId && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-white">
                                默认
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs break-all text-muted-foreground">
                            {node.baseUrl}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {statusLabel}
                            {status?.latencyMs !== undefined ? ` · ${status.latencyMs}ms` : ''}
                            {status?.version ? ` · v${status.version}` : ''}
                          </p>
                        </div>
                        {node.id !== selectedNodeId && (
                          <button
                            type="button"
                            onClick={() => setSelectedNodeId(node.id)}
                            className="shrink-0 px-3 py-1 border-2 border-border text-xs font-bold rounded-full bg-card hover:border-primary hover:text-primary-strong transition-colors"
                          >
                            设为默认
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                当前默认操作节点：{selectedNode.name}。图库和蜂群策略仍按共享数据库聚合展示。
              </p>
            </div>

            {/* Language Toggle */}
            <div>
              <label className="block text-sm font-bold mb-2">{t.admin.toggleLanguage}</label>
              <button
                type="button"
                onClick={toggleLocale}
                className="w-full flex items-center gap-2 px-4 py-2.5 rounded-full border-2 border-border bg-card hover:border-primary transition-colors font-bold text-sm"
              >
                <Globe className="w-4 h-4" />
                <span>{locale === "zh" ? "切换到 English" : "切换到 中文"}</span>
              </button>
            </div>

            {/* Theme Toggle */}
            <div>
              <label className="block text-sm font-bold mb-2">{t.admin.toggleTheme}</label>
              <button
                type="button"
                onClick={handleThemeToggle}
                className="w-full flex items-center gap-2 px-4 py-2.5 rounded-full border-2 border-border bg-card hover:border-primary transition-colors font-bold text-sm"
              >
                {isLight ? (
                  <Moon className="w-4 h-4" />
                ) : (
                  <Sun className="w-4 h-4" />
                )}
                <span>
                  {isLight ? `→ ${t.admin.dark}` : `→ ${t.admin.light}`}
                </span>
              </button>
            </div>

            {isManualTheme && (
              <button
                type="button"
                onClick={handleThemeReset}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full border-2 border-border bg-card hover:border-primary transition-colors font-bold text-sm"
              >
                <span>{t.admin.resetToBrowser}</span>
              </button>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
