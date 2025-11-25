"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  Image as ImageIcon,
  Zap,
  Settings,
  Moon,
  Sun,
  Github,
  Copy,
  RefreshCw,
  CheckCircle2,
  ArrowRight,
  LayoutDashboard,
  BookOpen,
  Languages,
  Terminal,
  Code,
  ShieldCheck,
  Database,
} from "lucide-react";
import {
  type Theme,
  resolveSiteClientTheme,
  applyThemeToRoot,
  setSiteManualTheme,
} from "@/lib/adminTheme";
import { useLocale, LocaleProvider } from "@/hooks/useLocale";
import { cn } from "@/lib/utils";
import Magnetic from "@/components/ui/magnetic";
import { GlassCard, GlassButton } from "@/components/ui/glass";

// --- Types ---
interface APIStatus {
  status: string;
  version: string;
  services: {
    database: { healthy: boolean };
    cloudinary: { healthy: boolean };
    api: { enabled: boolean };
  };
  stats: {
    totalImages: number;
    totalGroups: number;
  };
}

// --- Animation Variants ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
};

function HomeContent() {
  const { locale, t, toggleLocale } = useLocale();
  const [apiStatus, setApiStatus] = useState<APIStatus | null>(null);
  const [randomImageUrl, setRandomImageUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [baseUrl, setBaseUrl] = useState<string>("");
  const [imageLoading, setImageLoading] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const [isManualTheme, setIsManualTheme] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Parallax Logic
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 500], [0, 150]);
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0]);

  const bgBlob1Y = useTransform(scrollY, [0, 1000], [0, -200]);
  const bgBlob2Y = useTransform(scrollY, [0, 1000], [0, 200]);

  const generateBaseUrl = () => {
    if (typeof window === "undefined") return "";
    return `${window.location.protocol}//${window.location.host}`;
  };

  const generateRandomImageUrl = (baseUrl: string) => {
    return `${baseUrl}/api/random`;
  };

  useEffect(() => {
    setMounted(true);
    
    const pref = resolveSiteClientTheme();
    setTheme(pref.theme);
    setIsManualTheme(pref.isManual);
    applyThemeToRoot(pref.theme);

    const currentBaseUrl = generateBaseUrl();
    setBaseUrl(currentBaseUrl);

    fetch("/api/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setApiStatus(data.data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    if (currentBaseUrl) {
      setRandomImageUrl(generateRandomImageUrl(currentBaseUrl));
    }
  }, []);

  // 在客户端挂载后设置按钮的 title 属性
  useEffect(() => {
    if (!mounted) return;
    
    const langButton = document.querySelector('[data-lang-button]') as HTMLButtonElement;
    const themeButton = document.querySelector('[data-theme-button]') as HTMLButtonElement;
    
    if (langButton) {
      langButton.title = t.home.toggleLanguage;
    }
    if (themeButton) {
      themeButton.title = t.home.toggleTheme;
    }
  }, [mounted, t.home.toggleLanguage, t.home.toggleTheme]);

  useEffect(() => {
    if (typeof window === "undefined" || isManualTheme) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (matches: boolean) => {
      const next: Theme = matches ? "dark" : "light";
      setTheme((prev) => (prev === next ? prev : next));
      applyThemeToRoot(next);
    };
    apply(media.matches);
    const listener = (e: MediaQueryListEvent) => apply(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [isManualTheme]);

  const handleThemeToggle = () => {
    setIsManualTheme(true);
    setTheme((prev) => {
      const next: Theme = prev === "light" ? "dark" : "light";
      applyThemeToRoot(next);
      setSiteManualTheme(next);
      return next;
    });
  };

  const refreshRandomImage = () => {
    setImageLoading(true);
    const url = new URL(randomImageUrl);
    url.searchParams.set("t", Date.now().toString());
    setRandomImageUrl(url.toString());
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const versionLabel = apiStatus?.version;

  return (
    <div className="min-h-screen relative overflow-x-hidden selection:bg-primary/30 font-sans">
      {/* Moving Background Blobs */}
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
            ease: "easeInOut",
          }}
          className="absolute -top-[20%] -left-[10%] w-[60vw] h-[60vw] rounded-full bg-primary/10 blur-[120px] mix-blend-multiply filter"
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
            delay: 1,
          }}
          className="absolute top-[10%] -right-[10%] w-[50vw] h-[50vw] rounded-full bg-secondary/10 blur-[120px] mix-blend-multiply filter"
        />
        <div className="absolute bottom-0 left-[20%] w-[40vw] h-[40vw] rounded-full bg-accent/10 blur-[100px] mix-blend-multiply filter" />
      </div>

      {/* Navigation */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-white/60 dark:bg-slate-950/60 backdrop-blur-2xl supports-[backdrop-filter]:bg-white/10"
      >
        <div className="w-full px-6 lg:px-12">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 flex items-center justify-center">
                <Image src="/icon.png" alt="Logo" width={48} height={48} className="w-full h-full object-contain" />
              </div>
              <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                {t.home.title}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/admin" className="hidden md:block">
                <GlassButton
                  className="px-5 py-2 text-sm rounded-full"
                  icon={LayoutDashboard}
                >
                  <span>{t.home.managementPanel}</span>
                </GlassButton>
              </Link>
              <div className="h-6 w-px bg-foreground/10 mx-2 hidden md:block" />

              <Magnetic>
                <button
                  data-lang-button
                  onClick={toggleLocale}
                  className="p-2.5 rounded-full hover:bg-foreground/5 transition-colors border border-transparent hover:border-white/10"
                >
                  <Languages className="w-5 h-5" />
                </button>
              </Magnetic>

              <Magnetic>
                <button
                  data-theme-button
                  onClick={handleThemeToggle}
                  className="p-2.5 rounded-full hover:bg-foreground/5 transition-colors border border-transparent hover:border-white/10"
                >
                  {theme === "dark" ? (
                    <Sun className="w-5 h-5" />
                  ) : (
                    <Moon className="w-5 h-5" />
                  )}
                </button>
              </Magnetic>

              <Magnetic>
                <Link
                  href="https://github.com/Aierlanta/Cloudinary-photo"
                  target="_blank"
                  className="p-2.5 rounded-full hover:bg-foreground/5 transition-colors border border-transparent hover:border-white/10"
                >
                  <Github className="w-5 h-5" />
                </Link>
              </Magnetic>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Main Content */}
      <main className="pt-32 pb-20 px-4 sm:px-6 lg:px-12 w-full max-w-[1920px] mx-auto">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-32"
        >
          {/* Hero Section */}
          <motion.section
            style={{ y: heroY, opacity: heroOpacity }}
            className="text-center space-y-10 relative z-10 pt-10"
          >
            <motion.div variants={itemVariants} className="flex justify-center">
              <div className="relative group cursor-default">
                <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-primary via-secondary to-accent opacity-40 blur-xl group-hover:opacity-60 transition-opacity duration-500" />
                <div className="relative px-6 py-2 rounded-full border border-white/20 bg-white/40 dark:bg-black/40 backdrop-blur-xl text-sm font-semibold text-foreground flex items-center gap-3 shadow-xl">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                  </span>
                  <span>{versionLabel ? `v${versionLabel} Stable` : "v... Stable"}</span>
                </div>
              </div>
            </motion.div>

            <motion.h1
              variants={itemVariants}
              className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-foreground via-foreground/90 to-foreground/40 leading-[0.9] drop-shadow-sm select-none"
             
            >
              {t.home.title}
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="max-w-3xl mx-auto text-xl sm:text-2xl text-muted-foreground leading-relaxed font-light"
             
            >
              {t.home.subtitle}
            </motion.p>

            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-8"
            >
              <Link href="/api/docs">
                <GlassButton
                  primary
                  icon={BookOpen}
                  className="h-14 px-8 text-lg rounded-2xl shadow-xl shadow-primary/20"
                >
                  <span>{t.home.apiDocs}</span>
                </GlassButton>
              </Link>
              <Link href="/admin">
                <GlassButton
                  icon={ArrowRight}
                  className="h-14 px-8 text-lg rounded-2xl"
                >
                  <span>{t.home.managementPanel}</span>
                </GlassButton>
              </Link>
            </motion.div>

            {/* API Status Indicator */}
            {!loading && apiStatus && (
              <motion.div
                variants={itemVariants}
                className="inline-flex items-center gap-3 px-5 py-2.5 mt-12 rounded-full bg-white/10 dark:bg-black/10 backdrop-blur-md border border-white/5 shadow-sm text-muted-foreground text-sm"
              >
                <div
                  className={cn(
                    "w-2 h-2 rounded-full",
                    apiStatus.status === "healthy"
                      ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                      : "bg-yellow-500"
                  )}
                />
                <span>
                  System Status:{" "}
                  <span
                    className={cn(
                      "font-semibold",
                      apiStatus.status === "healthy"
                        ? "text-green-500"
                        : "text-yellow-500"
                    )}
                  >
                    {apiStatus.status === "healthy"
                      ? "Operational"
                      : "Degraded"}
                  </span>
                </span>
                <span className="w-px h-4 bg-white/10 mx-1" />
                <span>{apiStatus.stats.totalImages} Images Served</span>
              </motion.div>
            )}
          </motion.section>

          {/* Bento Grid Layout for Features & Preview */}
          <section className="w-full max-w-[1700px] mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-[minmax(180px,auto)]">
              {/* Large Preview Card (Col-span-8, Row-span-2) */}
              <motion.div
                variants={itemVariants}
                className="md:col-span-12 lg:col-span-8 row-span-2 h-full min-h-[500px]"
              >
                <GlassCard
                  className="h-full flex flex-col p-0 overflow-hidden group"
                  hover={false}
                >
                  <div className="absolute top-6 left-6 z-20 flex items-center gap-2">
                    <div className="px-3 py-1 rounded-full bg-black/30 backdrop-blur-md text-white text-xs border border-white/10 flex items-center gap-2">
                      <ImageIcon className="w-3 h-3" />
                      Live Preview
                    </div>
                  </div>

                  <div className="relative flex-1 w-full h-full bg-black/5 dark:bg-white/5 overflow-hidden">
                    {randomImageUrl ? (
                      <>
                        <img
                          key={randomImageUrl}
                          src={randomImageUrl}
                          alt="Random Preview"
                          className={cn(
                            "w-full h-full object-cover transition-all duration-1000 ease-out group-hover:scale-105",
                            imageLoading
                              ? "opacity-0 scale-105 blur-xl"
                              : "opacity-100 scale-100 blur-0"
                          )}
                          onLoad={() => setImageLoading(false)}
                          onError={() => setImageLoading(false)}
                        />
                        {imageLoading && (
                          <div className="absolute inset-0 flex items-center justify-center backdrop-blur-md bg-black/20 z-10">
                            <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <ImageIcon className="w-16 h-16 mb-4 opacity-20" />
                        <p>{t.home.noImage}</p>
                      </div>
                    )}

                    <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-32 flex items-end justify-between">
                      <div className="text-white">
                        <h3 className="text-2xl font-bold mb-2">
                          {t.home.randomImagePreview}
                        </h3>
                        <p className="text-white/70 text-sm max-w-md">
                          High-performance random image delivery optimized for
                          speed and reliability.
                        </p>
                      </div>
                      <Magnetic>
                        <button
                          onClick={refreshRandomImage}
                          className="p-4 rounded-full bg-white text-black hover:scale-110 transition-transform shadow-2xl"
                        >
                          <RefreshCw
                            className={cn(
                              "w-6 h-6",
                              imageLoading && "animate-spin"
                            )}
                          />
                        </button>
                      </Magnetic>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>

              {/* Code Snippet Card (Col-span-4, Row-span-2) */}
              <motion.div
                variants={itemVariants}
                className="md:col-span-12 lg:col-span-4 row-span-2"
              >
                <GlassCard
                  className="h-full flex flex-col p-0 overflow-hidden"
                  hover={false}
                >
                  <div className="p-6 border-b border-white/5 bg-white/5 backdrop-blur-md flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                        <Code className="w-5 h-5" />
                      </div>
                      <span className="font-semibold">Quick Start</span>
                    </div>
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                      <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
                    </div>
                  </div>

                  <div className="p-6 flex-1 flex flex-col gap-6 font-mono text-sm bg-slate-950/50">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground uppercase tracking-wider">
                        <span>Endpoint</span>
                        <span className="text-green-500">GET</span>
                      </div>
                      <div className="relative group">
                        <div className="p-4 rounded-xl bg-black/40 border border-white/10 text-slate-300 break-all hover:border-primary/50 transition-colors cursor-text">
                          {baseUrl}/api/random
                        </div>
                        <button
                          onClick={() =>
                            copyToClipboard(`${baseUrl}/api/random`)
                          }
                          className="absolute right-2 top-2 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white opacity-0 group-hover:opacity-100 transition-all"
                        >
                          {copied ? (
                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground uppercase tracking-wider">
                        <span>HTML</span>
                      </div>
                      <div className="relative group">
                        <div className="p-4 rounded-xl bg-black/40 border border-white/10 text-slate-300 break-all hover:border-primary/50 transition-colors">
                          <span className="text-blue-400">&lt;img</span>{" "}
                          <span className="text-sky-300">src</span>=
                          <span className="text-orange-300">
                            "{baseUrl}/api/random"
                          </span>{" "}
                          <span className="text-blue-400">/&gt;</span>
                        </div>
                        <button
                          onClick={() =>
                            copyToClipboard(
                              `<img src="${baseUrl}/api/random" />`
                            )
                          }
                          className="absolute right-2 top-2 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white opacity-0 group-hover:opacity-100 transition-all"
                        >
                          {copied ? (
                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="mt-auto pt-6 border-t border-white/5">
                      <Link
                        href="/api/docs"
                        className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group"
                      >
                        <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                          Read Full Documentation
                        </span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>

              {/* Feature: Performance (Col-span-4) */}
              <motion.div
                variants={itemVariants}
                className="md:col-span-6 lg:col-span-4"
              >
                <GlassCard className="h-full p-8 flex flex-col justify-between hover:border-yellow-500/30 transition-colors group">
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 flex items-center justify-center text-yellow-500 mb-6 group-hover:scale-110 transition-transform duration-300">
                      <Zap className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold mb-3">
                      {t.features.performance.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {t.features.performance.description}
                    </p>
                  </div>
                </GlassCard>
              </motion.div>

              {/* Feature: Easy to Use (Col-span-4) */}
              <motion.div
                variants={itemVariants}
                className="md:col-span-6 lg:col-span-4"
              >
                <GlassCard className="h-full p-8 flex flex-col justify-between hover:border-green-500/30 transition-colors group">
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-500 mb-6 group-hover:scale-110 transition-transform duration-300">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold mb-3">
                      {t.features.easyToUse.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {t.features.easyToUse.description}
                    </p>
                  </div>
                </GlassCard>
              </motion.div>

              {/* Feature: Flexible (Col-span-4) */}
              <motion.div
                variants={itemVariants}
                className="md:col-span-12 lg:col-span-4"
              >
                <GlassCard className="h-full p-8 flex flex-col justify-between hover:border-blue-500/30 transition-colors group">
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 mb-6 group-hover:scale-110 transition-transform duration-300">
                      <Settings className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold mb-3">
                      {t.features.flexible.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {t.features.flexible.description}
                    </p>
                  </div>
                </GlassCard>
              </motion.div>
            </div>
          </section>

          {/* Stats Banner */}
          {apiStatus && (
            <section className="w-full max-w-[1700px] mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <GlassCard
                  className="relative overflow-hidden py-16 px-8"
                  hover={false}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-secondary/5" />
                  <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-12 text-center">
                    <div className="space-y-2">
                      <div className="text-5xl lg:text-6xl font-black tracking-tighter text-foreground">
                        {apiStatus.stats.totalImages}
                      </div>
                      <div className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
                        {t.stats.totalImages}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-5xl lg:text-6xl font-black tracking-tighter text-foreground">
                        {apiStatus.stats.totalGroups}
                      </div>
                      <div className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
                        {t.stats.imageGroups}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div
                        className={cn(
                          "text-5xl lg:text-6xl font-black tracking-tighter",
                          apiStatus.services.api.enabled
                            ? "text-green-500"
                            : "text-red-500"
                        )}
                      >
                        {apiStatus.services.api.enabled ? "100%" : "ERR"}
                      </div>
                      <div className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
                        {t.stats.apiStatus}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-5xl lg:text-6xl font-black tracking-tighter text-foreground">
                        99.9%
                      </div>
                      <div className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
                        {t.stats.serviceTime}
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            </section>
          )}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-white/30 dark:bg-black/30 backdrop-blur-xl relative z-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 flex items-center justify-center">
                <Image src="/icon.png" alt="Logo" width={32} height={32} className="w-full h-full object-contain" />
              </div>
              <div className="text-sm text-muted-foreground">
                &copy; {new Date().getFullYear()} {t.footer.copyright}
              </div>
            </div>

            <div className="flex items-center gap-8 text-sm font-medium text-muted-foreground">
              <span>{t.footer.author}</span>
              <Link
                href="https://github.com/Aierlanta/Cloudinary-photo"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-primary transition-colors"
              >
                <Github className="w-4 h-4" />
                <span>{t.footer.github}</span>
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <LocaleProvider>
      <HomeContent />
    </LocaleProvider>
  );
}
