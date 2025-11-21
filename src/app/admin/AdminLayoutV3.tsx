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
} from "lucide-react";
import { useLocale } from "@/hooks/useLocale";
import { Theme } from "@/lib/adminTheme";
import { ComponentErrorBoundary } from "@/components/ErrorBoundary";
import { cn } from "@/lib/utils";

interface AdminLayoutV3Props {
  children: React.ReactNode;
  panelOpacity: number;
  setPanelOpacity: (opacity: number) => void;
  theme: Theme;
  isManualTheme: boolean;
  handleThemeToggle: () => void;
  handleThemeReset: () => void;
  handleLogout: () => void;
}

export default function AdminLayoutV3({
  children,
  theme,
  isManualTheme,
  handleThemeToggle,
  handleThemeReset,
  handleLogout,
}: AdminLayoutV3Props) {
  const { t, locale, toggleLocale } = useLocale();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [systemVersion, setSystemVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadStatus = async () => {
      try {
        const response = await fetch("/api/status");
        if (!response.ok) return;
        const data = await response.json();
        if (data?.success && data.data?.version && !cancelled) {
          setSystemVersion(data.data.version as string);
        }
      } catch {
        // 静默失败
      }
    };

    loadStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  const navigationItems = [
    { name: t.adminNav.dashboard, href: "/admin", icon: LayoutDashboard },
    { name: t.adminNav.upload || "图片上传", href: "/admin/images", icon: Upload },
    { name: t.adminNav.gallery || "图库", href: "/admin/gallery", icon: ImageIcon },
    { name: t.adminNav.groups, href: "/admin/groups", icon: Layers },
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
            <div
              className={cn(
                "w-10 h-10 flex items-center justify-center",
                isLight ? "bg-blue-500" : "bg-blue-600"
              )}
            >
              <Image
                src="/icon.svg"
                alt="Admin Logo"
                width={24}
                height={24}
                className="w-6 h-6"
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
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    isLight ? "bg-blue-500" : "bg-blue-600"
                  )}
                >
                  <Image
                    src="/icon.svg"
                    alt="Admin Logo"
                    width={24}
                    height={24}
                    className="w-6 h-6"
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
                "border p-6 lg:p-8",
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
            "fixed top-4 right-4 z-50 w-80 border p-6",
            isLight
          ? "bg-white border-gray-300"
          : "bg-gray-800 border-gray-600"
          )}
        >
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-lg font-semibold">设置</h3>
            <button
              onClick={() => setIsSettingsOpen(false)}
              className={cn(
                "p-1",
                isLight
                  ? "text-gray-500 hover:bg-gray-100"
                  : "text-gray-400 hover:bg-gray-700"
              )}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Language Toggle */}
            <div>
              <label className="block text-sm font-medium mb-2">语言</label>
              <button
                onClick={toggleLocale}
                className={cn(
                  "w-full flex items-center gap-2 px-4 py-2 transition-colors",
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
                  "w-full flex items-center gap-2 px-4 py-2 transition-colors",
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
                  "w-full flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm",
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

