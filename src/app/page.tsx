"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
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
  Code,
  Heart,
  Star,
  Sparkles,
  Ribbon,
} from "lucide-react";
import {
  type Theme,
  resolveSiteClientTheme,
  applyThemeToRoot,
  setSiteManualTheme,
} from "@/lib/adminTheme";
import { useLocale, LocaleProvider } from "@/hooks/useLocale";
import { cn } from "@/lib/utils";
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
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
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
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const pref = resolveSiteClientTheme();
    setTheme(pref.theme);
    setIsManualTheme(pref.isManual);
    applyThemeToRoot(pref.theme);

    const currentBaseUrl =
      typeof window === "undefined"
        ? ""
        : `${window.location.protocol}//${window.location.host}`;
    setBaseUrl(currentBaseUrl);

    fetch("/api/status?mode=summary")
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data?.success) {
          setApiStatus(data.data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    if (currentBaseUrl) {
      setRandomImageUrl(`${currentBaseUrl}/api/random`);
    }
  }, []);

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

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

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

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.warn("复制失败:", error);
    }
  };

  const versionLabel = apiStatus?.version;

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-polka font-body">
      {/* 漂浮的小装饰（Galgame 氛围） */}
      <div className="pointer-events-none fixed inset-0 z-0 hidden md:block" aria-hidden>
        <Heart className="absolute top-[18%] left-[6%] w-8 h-8 text-primary/50 animate-float-soft" fill="currentColor" />
        <Star className="absolute top-[30%] right-[8%] w-7 h-7 text-secondary/60 animate-sparkle" fill="currentColor" />
        <Sparkles className="absolute bottom-[24%] left-[10%] w-7 h-7 text-primary-strong/40 animate-sparkle" />
        <Heart className="absolute bottom-[16%] right-[6%] w-6 h-6 text-accent/60 animate-float-soft" fill="currentColor" />
        <Star className="absolute top-[62%] left-[3%] w-5 h-5 text-primary/40 animate-sparkle" fill="currentColor" />
      </div>

      {/* 蕾丝缎带导航 */}
      <motion.header
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 left-0 right-0 z-50"
      >
        <div className="bg-card/95 backdrop-blur border-b-2 border-border">
          <div className="w-full px-4 sm:px-6 lg:px-12">
            <div className="flex items-center justify-between h-20">
              <Link href="/" className="flex items-center gap-3 group">
                <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center shadow-soft ring-2 ring-white/70 ring-inset group-hover:rotate-12 transition-transform">
                  <Star className="w-5 h-5 text-white" fill="currentColor" />
                </div>
                <span className="font-display font-bold text-xl tracking-tight text-primary-strong">
                  {t.home.title}
                </span>
              </Link>
              <div className="flex items-center gap-2.5">
                <Link href="/admin" className="hidden md:block">
                  <GlassButton primary className="px-5 py-2 text-sm" icon={LayoutDashboard}>
                    <span>{t.home.managementPanel}</span>
                  </GlassButton>
                </Link>

                <button
                  type="button"
                  onClick={toggleLocale}
                  aria-label={t.home.toggleLanguage}
                  className="p-2.5 rounded-full bg-card border-2 border-border hover:border-primary hover:text-primary-strong transition-colors"
                >
                  <Languages className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={handleThemeToggle}
                  aria-label={t.home.toggleTheme}
                  className="p-2.5 rounded-full bg-card border-2 border-border hover:border-primary hover:text-primary-strong transition-colors"
                >
                  {theme === "dark" ? (
                    <Sun className="w-5 h-5" />
                  ) : (
                    <Moon className="w-5 h-5" />
                  )}
                </button>

                <Link
                  href="https://github.com/Aierlanta/Cloudinary-photo"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t.footer.github}
                  className="p-2.5 rounded-full bg-card border-2 border-border hover:border-primary hover:text-primary-strong transition-colors"
                >
                  <Github className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
        {/* 缎带下摆 scallop 花边 */}
        <div className="lace-edge h-3 w-full opacity-95" aria-hidden />
      </motion.header>

      {/* Main Content */}
      <main className="relative z-10 pt-36 pb-20 px-4 sm:px-6 lg:px-12 w-full max-w-[1200px] mx-auto">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-24"
        >
          {/* Hero Section */}
          <motion.section className="text-center space-y-8 relative pt-6">
            <motion.div variants={itemVariants} className="flex justify-center">
              <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-card border-2 border-border shadow-soft text-sm font-bold text-foreground">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent"></span>
                </span>
                <span>{versionLabel ? `v${versionLabel}` : "v..."}</span>
                <Heart className="w-3.5 h-3.5 text-primary-strong" fill="currentColor" />
              </div>
            </motion.div>

            <motion.div variants={itemVariants} className="relative inline-block">
              {/* 标题周围漂浮的小装饰 */}
              <Heart className="hidden sm:block absolute -left-14 top-2 w-8 h-8 text-primary animate-float-soft" fill="currentColor" aria-hidden />
              <Star className="hidden sm:block absolute -right-12 -top-4 w-7 h-7 text-secondary animate-sparkle" fill="currentColor" aria-hidden />
              <Sparkles className="hidden sm:block absolute -right-16 bottom-4 w-6 h-6 text-primary-strong/70 animate-sparkle" aria-hidden />
              <Star className="hidden sm:block absolute -left-10 bottom-0 w-5 h-5 text-accent animate-sparkle" fill="currentColor" aria-hidden />
              <motion.h1
                className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight text-foreground leading-[1.15] select-none"
              >
                {t.home.heroTaglineA}
                <span className="relative inline-block text-primary-strong">
                  <span className="absolute inset-x-[-0.15em] inset-y-[0.05em] -z-10 rounded-[0.6em] bg-primary/20 -rotate-1" aria-hidden />
                  {t.home.heroTaglineHighlight}
                  <Heart className="absolute -top-4 -right-6 w-6 h-6 text-primary animate-sparkle" fill="currentColor" aria-hidden />
                </span>
                {t.home.heroTaglineB}
              </motion.h1>
            </motion.div>

            <motion.p
              variants={itemVariants}
              className="max-w-2xl mx-auto text-lg sm:text-xl text-muted-foreground leading-relaxed"
            >
              {t.home.subtitle}
            </motion.p>

            {/* 端点 chip */}
            {baseUrl && (
              <motion.div variants={itemVariants} className="flex justify-center pt-2">
                <div className="inline-flex items-center gap-3 pl-5 pr-2.5 py-2.5 rounded-full bg-card border-2 border-primary/60 shadow-soft">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-accent/25 text-emerald-600 dark:text-emerald-300">
                    GET
                  </span>
                  <code className="font-mono text-sm sm:text-base text-foreground">
                    {baseUrl}/api/random
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(`${baseUrl}/api/random`)}
                    aria-label={t.common.copy}
                    className="p-2 rounded-full bg-primary text-white hover:bg-primary-strong transition-colors shadow-soft"
                  >
                    {copied ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:flex-row items-center justify-center gap-5 pt-4"
            >
              <Link href="/api/docs">
                <GlassButton primary icon={BookOpen} className="h-14 px-8 text-lg">
                  <span>{t.home.apiDocs}</span>
                </GlassButton>
              </Link>
              <Link href="/admin">
                <GlassButton icon={ArrowRight} className="h-14 px-8 text-lg">
                  <span>{t.home.managementPanel}</span>
                </GlassButton>
              </Link>
            </motion.div>

            {/* API 状态 */}
            {!loading && apiStatus && (
              <motion.div
                variants={itemVariants}
                className="inline-flex items-center gap-3 px-5 py-2.5 mt-6 rounded-full bg-card border-2 border-border shadow-soft text-muted-foreground text-sm"
              >
                <div
                  className={cn(
                    "w-2 h-2 rounded-full",
                    apiStatus.status === "healthy"
                      ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                      : "bg-amber-400"
                  )}
                />
                <span>
                  {t.home.apiStatus}:{" "}
                  <span
                    className={cn(
                      "font-bold",
                      apiStatus.status === "healthy"
                        ? "text-emerald-500"
                        : "text-amber-500"
                    )}
                  >
                    {apiStatus.status === "healthy"
                      ? t.home.statusHealthy
                      : t.home.statusPartial}
                  </span>
                </span>
                <span className="w-px h-4 bg-border mx-1" />
                <span>
                  {apiStatus.stats.totalImages} {t.stats.totalImages}
                </span>
              </motion.div>
            )}
          </motion.section>

          {/* CG 收集卡：预览 + 对话框 */}
          <motion.section variants={itemVariants} className="w-full max-w-4xl mx-auto">
            <div className="cg-frame relative p-3 sm:p-4">
              {/* 和纸胶带 */}
              <div className="washi -top-3 left-8 -rotate-6 z-20" aria-hidden />
              <div className="washi washi-lavender -top-3 right-8 rotate-6 z-20" aria-hidden />
              {/* 蝴蝶结 */}
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-20 w-10 h-10 rounded-full bg-card border-2 border-border shadow-soft flex items-center justify-center">
                <Ribbon className="w-5 h-5 text-primary-strong" />
              </div>

              <div className="relative rounded-2xl overflow-hidden bg-secondary/10 min-h-[320px] sm:min-h-[420px] flex items-center justify-center">
                {randomImageUrl ? (
                  <>
                    <img
                      key={randomImageUrl}
                      src={randomImageUrl}
                      alt={t.home.randomImagePreview}
                      className={cn(
                        "w-full h-full object-cover absolute inset-0 transition-all duration-700 ease-out",
                        imageLoading
                          ? "opacity-0 scale-105 blur-lg"
                          : "opacity-100 scale-100 blur-0"
                      )}
                      onLoad={() => setImageLoading(false)}
                      onError={() => setImageLoading(false)}
                    />
                    {imageLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-card/60 z-10">
                        <div className="w-14 h-14 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
                    <ImageIcon className="w-16 h-16 mb-4 opacity-30" />
                    <p className="font-bold">{t.home.noImage}</p>
                    <p className="text-sm mt-1">{t.home.uploadFirst}</p>
                  </div>
                )}

                {/* 刷新按钮 */}
                {randomImageUrl && (
                  <button
                    type="button"
                    onClick={refreshRandomImage}
                    aria-label={t.home.refreshImage}
                    className="absolute bottom-4 right-4 z-20 p-4 rounded-full bg-primary text-white shadow-lift hover:bg-primary-strong hover:scale-110 transition-all"
                  >
                    <RefreshCw
                      className={cn("w-6 h-6", imageLoading && "animate-spin")}
                    />
                  </button>
                )}
              </div>

              {/* 对话框 */}
              <div className="relative mt-4">
                <div className="dialogue-box relative px-6 py-5 sm:px-8">
                  <div className="name-plate absolute -top-3.5 left-6 px-4 py-1 text-xs font-bold tracking-wider uppercase">
                    Preview
                  </div>
                  <p className="text-base sm:text-lg font-bold text-foreground pt-1">
                    {t.home.randomImagePreview}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t.home.quickExperience} — <span className="font-mono-chip">/api/random</span>
                  </p>
                </div>
              </div>
            </div>
          </motion.section>

          {/* API 调用示例：对话框式卡片 */}
          <motion.section variants={itemVariants} className="w-full max-w-4xl mx-auto">
            <div className="dialogue-box relative overflow-hidden">
              <div className="flex items-center justify-between px-6 sm:px-8 py-5 border-b-2 border-dashed border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary/25 flex items-center justify-center text-purple-500 dark:text-purple-300">
                    <Code className="w-5 h-5" />
                  </div>
                  <span className="font-display font-bold text-lg">
                    {t.home.apiCallExample}
                  </span>
                </div>
                <div className="flex gap-1.5" aria-hidden>
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <div className="w-3 h-3 rounded-full bg-secondary" />
                  <div className="w-3 h-3 rounded-full bg-accent" />
                </div>
              </div>

              <div className="p-6 sm:p-8 space-y-6">
                {[
                  {
                    label: t.home.basicCall,
                    tag: "GET",
                    code: `${baseUrl}/api/random`,
                    copyText: `${baseUrl}/api/random`,
                  },
                  {
                    label: t.home.htmlUsage,
                    tag: "HTML",
                    code: `<img src="${baseUrl}/api/random" />`,
                    copyText: `<img src="${baseUrl}/api/random" />`,
                  },
                  {
                    label: "timeWindow",
                    tag: "7d",
                    code: `${baseUrl}/api/random?timeWindow=7d&timeWeight=3`,
                    copyText: `${baseUrl}/api/random?timeWindow=7d&timeWeight=3`,
                  },
                ].map((snippet) => (
                  <div key={snippet.label} className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      <span>{snippet.label}</span>
                      <span className="text-primary-strong">{snippet.tag}</span>
                    </div>
                    <div className="relative group">
                      <div className="px-4 py-3.5 rounded-2xl bg-background border-2 border-border font-mono-chip text-sm text-foreground break-all group-hover:border-primary/60 transition-colors">
                        {snippet.code}
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(snippet.copyText)}
                        aria-label={t.common.copy}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-primary/15 text-primary-strong hover:bg-primary hover:text-white transition-all sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        {copied ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}

                <Link
                  href="/api/docs"
                  className="flex items-center justify-between px-5 py-4 rounded-2xl bg-primary/10 hover:bg-primary/20 transition-colors group"
                >
                  <span className="font-bold text-primary-strong">
                    {t.home.apiDocs}
                  </span>
                  <ArrowRight className="w-4 h-4 text-primary-strong group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          </motion.section>

          {/* 特性：三枚软糖卡片 */}
          <motion.section variants={itemVariants} className="w-full max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  icon: Zap,
                  title: t.features.performance.title,
                  description: t.features.performance.description,
                  blob: "bg-primary/20 text-primary-strong",
                },
                {
                  icon: CheckCircle2,
                  title: t.features.easyToUse.title,
                  description: t.features.easyToUse.description,
                  blob: "bg-accent/25 text-emerald-500",
                },
                {
                  icon: Settings,
                  title: t.features.flexible.title,
                  description: t.features.flexible.description,
                  blob: "bg-secondary/25 text-purple-500 dark:text-purple-300",
                },
              ].map((feature) => (
                <GlassCard key={feature.title} className="h-full p-7 text-center group">
                  <div
                    className={cn(
                      "w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-5 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-300",
                      feature.blob
                    )}
                  >
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-display text-lg font-bold mb-2.5">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </GlassCard>
              ))}
            </div>
          </motion.section>

          {/* 统计：独立软糖芯片 */}
          {apiStatus && (
            <motion.section
              variants={itemVariants}
              className="w-full max-w-5xl mx-auto"
            >
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                {[
                  {
                    value: apiStatus.stats.totalImages,
                    label: t.stats.totalImages,
                    icon: ImageIcon,
                    blob: "bg-primary/20 text-primary-strong",
                  },
                  {
                    value: apiStatus.stats.totalGroups,
                    label: t.stats.imageGroups,
                    icon: Star,
                    blob: "bg-secondary/25 text-purple-500 dark:text-purple-300",
                  },
                  {
                    value: apiStatus.services.api.enabled ? "100%" : "ERR",
                    label: t.stats.apiStatus,
                    icon: Zap,
                    blob: apiStatus.services.api.enabled
                      ? "bg-accent/25 text-emerald-500"
                      : "bg-red-100 text-red-400",
                  },
                  {
                    value: "99.9%",
                    label: t.stats.serviceTime,
                    icon: Heart,
                    blob: "bg-amber-100 text-amber-500 dark:bg-amber-400/20",
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-card border-2 border-border rounded-3xl shadow-soft px-5 py-6 flex flex-col items-center gap-3 text-center hover:-translate-y-1 hover:shadow-lift transition-all"
                  >
                    <div
                      className={cn(
                        "w-11 h-11 rounded-full flex items-center justify-center",
                        stat.blob
                      )}
                    >
                      <stat.icon className="w-5 h-5" />
                    </div>
                    <div className="font-display text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
                      {stat.value}
                    </div>
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </motion.section>
          )}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 mt-4">
        <div className="lace-edge h-3 w-full rotate-180 opacity-95" aria-hidden />
        <div className="bg-card/95 backdrop-blur border-t-2 border-border">
          <div className="max-w-5xl mx-auto px-6 lg:px-8 py-10">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <Star className="w-4 h-4 text-white" fill="currentColor" />
                </div>
                <div className="text-sm text-muted-foreground">
                  &copy; {new Date().getFullYear()} {t.footer.copyright}
                </div>
              </div>

              <div className="flex items-center gap-8 text-sm font-bold text-muted-foreground">
                <span>{t.footer.author}</span>
                <Link
                  href="https://github.com/Aierlanta/Cloudinary-photo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-primary-strong transition-colors"
                >
                  <Github className="w-4 h-4" />
                  <span>{t.footer.github}</span>
                </Link>
              </div>
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
