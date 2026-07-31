"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Image as ImageIcon,
  Upload,
  Layers,
  Settings as SettingsIcon,
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
  Network,
  Sparkles,
} from "lucide-react";
import { useLocale } from "@/hooks/useLocale";
import { Theme } from "@/lib/adminTheme";
import { ComponentErrorBoundary } from "@/components/ErrorBoundary";
import { cn } from "@/lib/utils";
import { getNodeDisplayName, useAdminApi } from "@/lib/admin-api-client";
import styles from "./admin-shell.module.css";
import mascotStyles from "./sidebar-mascot.module.css";

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

function RibbonBow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 168 92" className={className} aria-hidden>
      <g stroke="#fff0df" strokeWidth="7" strokeLinejoin="round">
        <path d="M75 41C54 10 19 5 11 22 4 38 35 56 72 51Z" fill="#ff7198" />
        <path d="M93 41c21-31 56-36 64-19 7 16-24 34-61 29Z" fill="#ff7198" />
        <path d="M70 49 49 84l34-17 2-21Z" fill="#f05c8a" />
        <path d="m98 49 21 35-34-17-2-21Z" fill="#f05c8a" />
        <rect x="72" y="33" width="24" height="24" rx="8" fill="#ff9cb6" />
      </g>
      <g fill="none" stroke="#b73d67" strokeWidth="2.2" strokeLinejoin="round">
        <path d="M75 41C54 10 19 5 11 22 4 38 35 56 72 51Z" />
        <path d="M93 41c21-31 56-36 64-19 7 16-24 34-61 29Z" />
        <path d="M70 49 49 84l34-17 2-21Z" />
        <path d="m98 49 21 35-34-17-2-21Z" />
        <rect x="72" y="33" width="24" height="24" rx="8" />
      </g>
      <path d="M79 39c4-2 8-2 12 0" fill="none" stroke="#fff0df" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function isNavActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin" || pathname === "/admin/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminLayoutV3({
  children,
  panelOpacity,
  setPanelOpacity,
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
    refreshNodeStatuses,
  } = useAdminApi();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    if (!isSettingsOpen) return;
    refreshNodeStatuses().catch(() => {});
  }, [isSettingsOpen, refreshNodeStatuses]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isSettingsOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsSettingsOpen(false);
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isSettingsOpen]);

  const isLight = theme === "light";
  const systemVersion = initialVersion;
  const routeKey = pathname === "/admin"
    ? "dashboard"
    : pathname.split("/")[2] || "dashboard";

  const navigationItems = [
    { name: t.adminNav.dashboard, href: "/admin", icon: LayoutDashboard },
    { name: t.adminNav.upload, href: "/admin/images", icon: Upload },
    { name: t.adminNav.gallery, href: "/admin/gallery", icon: ImageIcon },
    { name: t.adminNav.groups, href: "/admin/groups", icon: Layers },
    { name: t.adminNav.swarm, href: "/admin/swarm", icon: Network },
    { name: t.adminNav.apiConfig, href: "/admin/config", icon: SettingsIcon },
    { name: t.adminNav.status, href: "/admin/status", icon: Activity },
    { name: t.adminNav.logs, href: "/admin/logs", icon: FileText },
    { name: t.adminNav.backup, href: "/admin/backup", icon: Database },
    { name: t.adminNav.security, href: "/admin/security", icon: ShieldAlert },
  ];

  const renderNav = (onNavigate?: () => void) => (
    <nav className={styles.nav} aria-label={t.adminUi.navigation}>
      {navigationItems.map((item) => {
        const active = isNavActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(styles.navItem, active && styles.navItemActive)}
            aria-current={active ? "page" : undefined}
          >
            <item.icon aria-hidden />
            <span>{item.name}</span>
            <Sparkles className={styles.navSpark} aria-hidden />
          </Link>
        );
      })}
    </nav>
  );

  const openSettings = (compact = false) => {
    setIsSettingsOpen(true);
    if (compact) setIsMobileMenuOpen(false);
  };

  const sidebarNotes: Record<string, { eyebrow?: string; title: string; body: string }> = {
    images: { title: t.adminUi.imagesNoteTitle, body: t.adminUi.imagesNoteBody },
    gallery: { eyebrow: t.adminUi.galleryNoteEyebrow, title: t.adminUi.galleryNoteTitle, body: t.adminUi.galleryNoteBody },
    groups: { title: t.adminUi.groupsNoteTitle, body: t.adminUi.groupsNoteBody },
    swarm: { title: t.adminUi.swarmNoteTitle, body: t.adminUi.swarmNoteBody },
    config: { title: t.adminUi.configNoteTitle, body: t.adminUi.configNoteBody },
    status: { title: t.adminUi.statusNoteTitle, body: t.adminUi.statusNoteBody },
    logs: { title: t.adminUi.logsNoteTitle, body: t.adminUi.logsNoteBody },
    backup: { title: t.adminUi.backupNoteTitle, body: t.adminUi.backupNoteBody },
    security: { title: t.adminUi.securityNoteTitle, body: t.adminUi.securityNoteBody },
  };

  const renderSidebarNote = () => {
    const note = sidebarNotes[routeKey];
    if (!note) return null;
    return (
      <div className={cn(styles.sidebarNote, mascotStyles.note)}>
        <div className={mascotStyles.figure} aria-hidden>
          <Image
            src="/admin/sidebar-mascot.png"
            alt=""
            width={156}
            height={234}
            className={mascotStyles.image}
            sizes="78px"
          />
        </div>
        <div className={mascotStyles.copy}>
          {note.eyebrow ? <span className={mascotStyles.eyebrow}>{note.eyebrow}</span> : null}
          <strong className={mascotStyles.title}>{note.title}</strong>
          <p className={mascotStyles.body}>{note.body}</p>
        </div>
      </div>
    );
  };

  const renderSidebarFooter = (compact = false) => (
    <div className={styles.sidebarFooter}>
      {compact ? (
        <button
          type="button"
          className={cn(styles.sideAction, isSettingsOpen && styles.sideActionActive)}
          onClick={() => openSettings(true)}
          aria-expanded={isSettingsOpen}
        >
          <SettingsIcon aria-hidden />
          <span>{t.admin.quickSettings}</span>
        </button>
      ) : null}
      <button
        type="button"
        className={cn(styles.sideAction, styles.logout)}
        onClick={handleLogout}
      >
        <LogOut aria-hidden />
        <span>{t.adminNav.logout}</span>
        {!compact ? <span aria-hidden>♡</span> : null}
      </button>
    </div>
  );

  return (
    <div
      className={cn(
        styles.shell,
        theme === "dark" ? styles.shellDark : styles.shellLight,
      )}
      data-admin-route={routeKey}
      data-settings-open={isSettingsOpen ? "true" : "false"}
    >
      <div className={styles.atmosphere} aria-hidden>
        <span className={styles.spark}>✦</span>
        <span className={styles.spark}>✧</span>
        <span className={styles.spark}>♡</span>
        <span className={styles.spark}>❀</span>
        <span className={styles.spark}>✿</span>
      </div>

      {!isSettingsOpen ? (
        <button
          type="button"
          className={styles.mobileToggle}
          aria-label={isMobileMenuOpen ? t.common.close : t.adminUi.menu}
          aria-expanded={isMobileMenuOpen}
          onClick={() => setIsMobileMenuOpen((open) => !open)}
        >
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      ) : null}

      <aside className={styles.sidebar} aria-label={t.adminUi.navigation}>
        <div className={styles.lace} aria-hidden>
          <span className={styles.laceHeart}>♡</span>
        </div>
        <Link href="/" className={styles.brand} aria-label="Random Image API home">
          <span className={styles.medallion}>
            <Image
              src="/icon.png"
              alt=""
              width={104}
              height={104}
              className={styles.medallionLogo}
              priority
            />
          </span>
          <span className={styles.brandName}>Random Image API</span>
          {systemVersion ? <span className={styles.brandVersion}>v{systemVersion}</span> : null}
        </Link>
        {renderNav()}
        {renderSidebarNote()}
        {routeKey === "dashboard" ? renderSidebarFooter() : null}
        <button
          type="button"
          className={styles.settingsFab}
          onClick={() => openSettings(false)}
          aria-label={t.admin.quickSettings}
          aria-expanded={isSettingsOpen}
          title={t.admin.quickSettings}
        >
          <SettingsIcon aria-hidden />
        </button>
      </aside>

      {isMobileMenuOpen ? (
        <>
          <button
            type="button"
            className={styles.mobileBackdrop}
            aria-label={t.common.close}
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <aside className={styles.mobileDrawer} aria-label={t.adminUi.navigation}>
            <div className={styles.lace} aria-hidden>
              <span className={styles.laceHeart}>♡</span>
            </div>
            <Link
              href="/"
              className={styles.brand}
              aria-label="Random Image API home"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <span className={styles.medallion}>
                <Image
                  src="/icon.png"
                  alt=""
                  width={104}
                  height={104}
                  className={styles.medallionLogo}
                  priority
                />
              </span>
              <span className={styles.brandName}>Random Image API</span>
            </Link>
            {renderNav(() => setIsMobileMenuOpen(false))}
            {renderSidebarFooter(true)}
          </aside>
        </>
      ) : null}

      <div className={styles.workspace}>
        <main
          className={styles.panel}
          style={{
            "--admin-panel-opacity": Math.max(0.55, Math.min(1, panelOpacity)),
          } as CSSProperties}
        >
          <div className={styles.washiDots} aria-hidden />
          <div className={styles.washiStripes} aria-hidden />
          <RibbonBow className={styles.bow} />
          <div className={styles.panelInner}>
            <ComponentErrorBoundary componentName="AdminPage">
              {children}
            </ComponentErrorBoundary>
          </div>
        </main>
      </div>

      {isSettingsOpen ? (
        <>
          <button
            type="button"
            className={styles.settingsBackdrop}
            aria-label={t.common.close}
            onClick={() => setIsSettingsOpen(false)}
          />
          <aside className={styles.settingsCard} role="dialog" aria-modal="true" aria-label={t.admin.quickSettings}>
            <div className={styles.settingsHeader}>
              <div>
                <span className={styles.settingsEyebrow}>{t.adminUi.settingsEyebrow}</span>
                <h3 className={styles.settingsTitle}>{t.admin.quickSettings}</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                aria-label={t.common.close}
                className={styles.settingsClose}
              >
                <X />
              </button>
            </div>

            <div className={styles.settingsBody}>
              <section className={styles.settingsSection}>
              <div className="flex items-center justify-between gap-3 mb-2">
                <label className={styles.settingsLabel} style={{ marginBottom: 0 }}>
                  {t.adminNav.swarm}
                </label>
                <button
                  type="button"
                  onClick={() => refreshNodeStatuses().catch(() => {})}
                  className={styles.settingsButton}
                  style={{ width: "auto" }}
                >
                  {t.common.refresh}
                </button>
              </div>
              <div className={styles.nodeList}>
                {nodes.map((node) => {
                  const status = nodeStatuses[node.id];
                  const statusLabel =
                    status?.status === "online"
                      ? t.adminUi.online
                      : status?.status === "degraded"
                        ? t.adminUi.degraded
                        : status?.status === "offline"
                          ? t.adminUi.offline
                          : t.adminUi.unknown;
                  const statusClass =
                    status?.status === "online"
                      ? "bg-emerald-400"
                      : status?.status === "degraded"
                        ? "bg-amber-400"
                        : status?.status === "offline"
                          ? "bg-red-400"
                          : "bg-gray-300";

                  return (
                    <div
                      key={node.id}
                      className={cn(
                        styles.nodeCard,
                        node.id === selectedNodeId && styles.nodeCardActive,
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn("w-2 h-2 rounded-full", statusClass)} />
                            <span className="font-bold text-sm truncate">{getNodeDisplayName(node, t.adminUi.currentNode)}</span>
                            {node.id === selectedNodeId ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-white">
                                {t.adminUi.defaultNode}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs break-all text-muted-foreground">
                            {node.baseUrl}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {statusLabel}
                            {status?.latencyMs !== undefined ? ` · ${status.latencyMs}ms` : ""}
                            {status?.version ? ` · v${status.version}` : ""}
                          </p>
                        </div>
                        {node.id !== selectedNodeId ? (
                          <button
                            type="button"
                            onClick={() => setSelectedNodeId(node.id)}
                            className={styles.settingsButton}
                            style={{ width: "auto", flexShrink: 0 }}
                          >
                            {t.adminUi.setDefaultNode}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className={cn(styles.hint, "mt-2")}>
                {t.adminUi.currentDefaultNode.replace("{name}", getNodeDisplayName(selectedNode, t.adminUi.currentNode))} {t.adminUi.currentDefaultNodeHint}
              </p>
              </section>

              <section className={cn(styles.settingsSection, styles.opacityRow)}>
                <div className={styles.settingLine}>
                  <label className={styles.settingsLabel} htmlFor="admin-panel-opacity">
                    {t.admin.panelOpacity}
                  </label>
                  <output>{Math.round(panelOpacity * 100)}%</output>
                </div>
                <input
                  id="admin-panel-opacity"
                  type="range"
                  min={0.55}
                  max={1}
                  step={0.05}
                  value={panelOpacity}
                  onChange={(event) => setPanelOpacity(Number(event.target.value))}
                />
                <p className={styles.hint}>{t.admin.opacityDescription}</p>
              </section>

              <section className={styles.settingsSection}>
                <label className={styles.settingsLabel}>{t.admin.toggleLanguage}</label>
                <button type="button" onClick={toggleLocale} className={styles.settingsButton}>
                  <Globe className="w-4 h-4" />
                  <span>{locale === "zh" ? t.adminUi.switchToEnglish : t.adminUi.switchToChinese}</span>
                </button>
              </section>

              <section className={styles.settingsSection}>
                <label className={styles.settingsLabel}>{t.admin.toggleTheme}</label>
                <button type="button" onClick={handleThemeToggle} className={styles.settingsButton}>
                  {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  <span>{isLight ? `→ ${t.admin.dark}` : `→ ${t.admin.light}`}</span>
                </button>
              </section>

              {isManualTheme ? (
                <button type="button" onClick={handleThemeReset} className={styles.settingsButton}>
                  <span>{t.admin.resetToBrowser}</span>
                </button>
              ) : null}

              <button
                type="button"
                onClick={handleLogout}
                className={cn(styles.settingsButton, styles.settingsLogout)}
              >
                <LogOut className="w-4 h-4" />
                <span>{t.adminNav.logout}</span>
              </button>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
