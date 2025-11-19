"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, useScroll, useTransform } from "framer-motion";
import { 
  LayoutDashboard, 
  Image as ImageIcon, 
  Layers, 
  Settings, 
  Activity, 
  FileText, 
  Database, 
  ShieldAlert, 
  LogOut,
  Menu,
  X
} from "lucide-react";
import { useLocale } from "@/hooks/useLocale";
import { Theme } from "@/lib/adminTheme";
import TransparencyControl from "@/components/admin/TransparencyControl";
import { ComponentErrorBoundary } from "@/components/ErrorBoundary";
import { cn } from "@/lib/utils";
import { GlassCard, GlassButton } from "@/components/ui/glass";

interface AdminLayoutV2Props {
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

// --- Background Components ---
const BackgroundBlobs = () => {
  const { scrollY } = useScroll();
  const bgBlob1Y = useTransform(scrollY, [0, 1000], [0, -200]);
  const bgBlob2Y = useTransform(scrollY, [0, 1000], [0, 200]);

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
      <motion.div 
        style={{ y: bgBlob1Y }}
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3], 
        }}
        transition={{ 
          duration: 8, 
          repeat: Infinity, 
          ease: "easeInOut" 
        }}
        className="absolute -top-[20%] -left-[10%] w-[50vw] h-[50vw] rounded-full bg-primary/20 blur-[100px] mix-blend-multiply filter" 
      />
      <motion.div 
        style={{ y: bgBlob2Y }}
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{ 
          duration: 10, 
          repeat: Infinity, 
          ease: "easeInOut",
          delay: 1
        }}
        className="absolute top-[20%] -right-[10%] w-[40vw] h-[40vw] rounded-full bg-secondary/20 blur-[100px] mix-blend-multiply filter" 
      />
      <div className="absolute bottom-0 left-[20%] w-[30vw] h-[30vw] rounded-full bg-accent/10 blur-[80px] mix-blend-multiply filter" />
    </div>
  );
};

export default function AdminLayoutV2({
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
}: AdminLayoutV2Props) {
  const { t } = useLocale();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigationItems = [
    { name: t.adminNav.dashboard, href: "/admin", icon: LayoutDashboard },
    { name: t.adminNav.images, href: "/admin/images", icon: ImageIcon },
    { name: t.adminNav.groups, href: "/admin/groups", icon: Layers },
    { name: t.adminNav.apiConfig, href: "/admin/config", icon: Settings },
    { name: t.adminNav.status, href: "/admin/status", icon: Activity },
    { name: "Logs", href: "/admin/logs", icon: FileText },
    { name: t.adminNav.backup, href: "/admin/backup", icon: Database }, 
    { name: t.adminNav.security, href: "/admin/security", icon: ShieldAlert },
  ];

  return (
    <div className="admin-v2 min-h-screen relative overflow-hidden selection:bg-primary/30 bg-background/50 text-foreground flex">
      <BackgroundBlobs />

      {/* Transparency Control (Top Right) - Absolute positioned to overlay content */}
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

      {/* Sidebar Navigation (Desktop) */}
      <aside className="hidden lg:flex w-72 flex-col h-screen sticky top-0 p-4 overflow-y-auto z-10">
        <div className="flex flex-col h-full gap-4">
           {/* Logo / Brand */}
          <GlassCard className="flex items-center gap-3 p-4 shrink-0" hover={false}>
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/20 overflow-hidden">
              <Image
                src="/icon.svg"
                alt="Admin Logo"
                width={32}
                height={32}
                className="w-8 h-8"
                priority
              />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">{t.adminDashboard.title}</h1>
              <p className="text-xs text-muted-foreground">v1.7.2</p>
            </div>
          </GlassCard>

          {/* Nav Links */}
          <GlassCard className="p-2 flex-1 overflow-y-auto space-y-1" hover={false}>
            {navigationItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} className="block">
                  <div 
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 relative overflow-hidden group",
                      isActive 
                        ? "bg-primary/20 text-primary shadow-sm font-semibold" 
                        : "hover:bg-white/5 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", isActive && "animate-pulse")} />
                    <span className="relative z-10">{item.name}</span>
                    {isActive && (
                       <motion.div
                         layoutId="activeNavIndicator"
                         className="absolute left-0 top-0 bottom-0 w-1 bg-primary"
                         initial={{ opacity: 0 }}
                         animate={{ opacity: 1 }}
                         exit={{ opacity: 0 }}
                       />
                    )}
                  </div>
                </Link>
              );
            })}
          </GlassCard>
          
          {/* Logout Button */}
          <GlassButton 
            className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-500/10 shrink-0"
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5 mr-2" />
            {t.adminNav.logout}
          </GlassButton>
        </div>
      </aside>

      {/* Mobile Menu Toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
         <GlassButton onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2">
           {isMobileMenuOpen ? <X /> : <Menu />}
         </GlassButton>
      </div>

      {/* Mobile Navigation Overlay */}
      {isMobileMenuOpen && (
         <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md lg:hidden" onClick={() => setIsMobileMenuOpen(false)}>
            <motion.div 
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              className="w-3/4 max-w-xs h-full bg-background/90 backdrop-blur-xl p-6 overflow-y-auto border-r border-white/10"
              onClick={e => e.stopPropagation()}
            >
               <div className="space-y-2">
                         <div className="mb-8 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/20 overflow-hidden">
                              <Image
                                src="/icon.svg"
                                alt="Admin Logo"
                                width={32}
                                height={32}
                                className="w-8 h-8"
                                priority
                              />
                            </div>
                            <h1 className="font-bold text-lg">{t.adminDashboard.title}</h1>
                         </div>
                  
                  {navigationItems.map((item) => (
                    <Link key={item.href} href={item.href} onClick={() => setIsMobileMenuOpen(false)}>
                       <div className={cn("flex items-center gap-3 px-4 py-3 rounded-xl", pathname === item.href ? "bg-primary/20 text-primary" : "hover:bg-white/10")}>
                          <item.icon className="w-5 h-5" />
                          <span>{item.name}</span>
                       </div>
                    </Link>
                  ))}
                  <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-500/10 mt-4">
                     <LogOut className="w-5 h-5" />
                     <span>{t.adminNav.logout}</span>
                  </button>
               </div>
            </motion.div>
         </div>
      )}

      {/* Main Content */}
      <main className="flex-1 h-screen overflow-y-auto overflow-x-hidden relative">
         <div className="min-h-full p-4 lg:p-8 pt-20 lg:pt-8">
           <motion.div
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-[1800px] mx-auto"
           >
              <GlassCard className="min-h-[calc(100vh-4rem)] backdrop-blur-2xl border-white/10 shadow-2xl" noPadding>
                 <div className="p-6 lg:p-8">
                    <ComponentErrorBoundary componentName="AdminPage">
                        {children}
                    </ComponentErrorBoundary>
                 </div>
              </GlassCard>
           </motion.div>
         </div>
      </main>
    </div>
  );
}
