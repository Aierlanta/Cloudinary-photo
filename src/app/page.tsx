"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Image as ImageIcon,
  Zap,
  Moon,
  Sun,
  Github,
  Copy,
  CheckCircle2,
  Layers,
  Languages,
  Heart,
  Star,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import {
  type Theme,
  resolveSiteClientTheme,
  applyThemeToRoot,
  setSiteManualTheme,
} from "@/lib/adminTheme";
import { useLocale, LocaleProvider } from "@/hooks/useLocale";
import { cn } from "@/lib/utils";

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
      staggerChildren: 0.12,
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

/** 粉色蝴蝶结（CG 卡顶部装饰） */
function Bow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 26" className={className} aria-hidden>
      <path
        d="M24 13C17 3 4 4.5 5.5 13C4 21.5 17 23 24 13C31 3 44 4.5 42.5 13C44 21.5 31 23 24 13Z"
        fill="var(--primary)"
      />
      <circle cx="24" cy="13" r="4.5" fill="var(--primary-strong)" />
    </svg>
  );
}

function HomeContent() {
  const { t, toggleLocale } = useLocale();
  const [apiStatus, setApiStatus] = useState<APIStatus | null>(null);
  const [randomImageUrl, setRandomImageUrl] = useState<string>("");
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
      .catch(console.error);

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

  const copyEndpoint = async () => {
    if (!baseUrl) return;
    try {
      await navigator.clipboard.writeText(`${baseUrl}/api/random`);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.warn("复制失败:", error);
    }
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-polka font-body">
      {/* 背景漂浮小装饰 */}
      <div className="pointer-events-none fixed inset-0 z-0 hidden md:block" aria-hidden>
        <Sparkles className="absolute top-[22%] left-[8%] w-6 h-6 text-primary/40 animate-sparkle" />
        <Sparkles className="absolute top-[60%] right-[6%] w-5 h-5 text-secondary/50 animate-sparkle" />
      </div>

      {/* 蕾丝缎带导航 */}
      <motion.header
        initial={{ y: -60 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-50"
      >
        <div className="bg-card/95 backdrop-blur">
          <div className="w-full max-w-6xl mx-auto px-4 sm:px-8">
            <div className="flex items-center justify-between h-16">
              <Link href="/" className="flex items-center gap-2.5 group">
                <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow-soft ring-2 ring-white/70 ring-inset group-hover:rotate-12 transition-transform">
                  <Star className="w-5 h-5 text-white" fill="currentColor" />
                </div>
                <span className="font-display font-bold text-lg tracking-tight text-primary-strong">
                  {t.home.title}
                </span>
              </Link>
              <nav className="flex items-center gap-1 sm:gap-2">
                <Link
                  href="/api/docs"
                  className="px-3.5 py-2 rounded-full text-sm font-bold text-foreground/70 hover:text-primary-strong hover:bg-primary/10 transition-colors"
                >
                  {t.home.apiDocs}
                </Link>
                <Link
                  href="https://github.com/Aierlanta/Cloudinary-photo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-full text-sm font-bold text-foreground/70 hover:text-primary-strong hover:bg-primary/10 transition-colors"
                >
                  GitHub
                </Link>
                <Link
                  href="/admin"
                  className="ml-1 px-5 py-2 rounded-full bg-primary text-white text-sm font-bold shadow-soft ring-2 ring-white/70 ring-inset hover:bg-primary-strong transition-colors"
                >
                  {t.home.managementPanel}
                </Link>
              </nav>
            </div>
          </div>
        </div>
        {/* 粉色蕾丝花边下摆 */}
        <div className="lace-edge h-4 w-full" aria-hidden />
      </motion.header>

      {/* Main Content */}
      <main className="relative z-10 px-4 sm:px-6 w-full max-w-4xl mx-auto">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="pt-12 sm:pt-16 pb-16 space-y-10"
        >
          {/* Hero：标语 + 端点 chip */}
          <motion.section className="text-center space-y-7">
            <motion.div variants={itemVariants} className="relative inline-block">
              <Heart className="hidden sm:block absolute -left-16 top-3 w-8 h-8 text-primary animate-float-soft" fill="currentColor" aria-hidden />
              <Star className="hidden sm:block absolute -right-14 -top-5 w-7 h-7 text-secondary animate-sparkle" fill="currentColor" aria-hidden />
              <Sparkles className="hidden sm:block absolute -right-20 bottom-3 w-6 h-6 text-primary-strong/70 animate-sparkle" aria-hidden />
              <Star className="hidden sm:block absolute -left-12 bottom-1 w-5 h-5 text-accent animate-sparkle" fill="currentColor" aria-hidden />
              <motion.h1 className="font-display text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-foreground leading-[1.15] select-none">
                {t.home.heroTaglineA}
                <span className="relative inline-block text-primary-strong">
                  {t.home.heroTaglineHighlight}
                  <Heart className="absolute -top-4 -right-6 w-6 h-6 text-primary animate-sparkle" fill="currentColor" aria-hidden />
                </span>
                {t.home.heroTaglineB}
              </motion.h1>
            </motion.div>

            {/* 端点 chip */}
            {baseUrl && (
              <motion.div variants={itemVariants} className="flex justify-center">
                <button
                  type="button"
                  onClick={copyEndpoint}
                  aria-label={t.common.copy}
                  className="group inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-card border-2 border-primary/60 shadow-soft font-mono text-sm sm:text-base text-foreground hover:border-primary-strong hover:shadow-lift transition-all"
                >
                  <span className="font-bold text-primary-strong">GET</span>
                  <span>{baseUrl}/api/random</span>
                  {copied ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-muted-foreground group-hover:text-primary-strong transition-colors" />
                  )}
                </button>
              </motion.div>
            )}
          </motion.section>

          {/* CG 收集卡 */}
          <motion.section variants={itemVariants}>
            <div className="cg-frame relative p-3 sm:p-4">
              {/* 和纸胶带 */}
              <div className="washi -top-3 left-10 -rotate-6 z-20" aria-hidden />
              <div className="washi washi-lavender -top-3 right-10 rotate-6 z-20" aria-hidden />
              {/* 蝴蝶结 */}
              <Bow className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-20 w-14 drop-shadow-sm" />

              <div className="relative rounded-3xl overflow-hidden bg-secondary/10 min-h-[320px] sm:min-h-[420px] flex items-center justify-center">
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
              <div className="relative mt-4 mb-1">
                <div className="dialogue-box relative px-6 py-5">
                  <div className="name-plate absolute -top-3.5 left-6 px-4 py-1 text-xs font-bold tracking-wider uppercase">
                    Preview
                  </div>
                  <p className="text-base sm:text-lg font-bold text-foreground pt-1 flex items-center gap-2">
                    {t.home.dialogueText}
                    <Heart className="w-4 h-4 text-primary shrink-0" fill="currentColor" />
                  </p>
                </div>
              </div>
            </div>
          </motion.section>

          {/* 统计：三枚软糖芯片 */}
          {apiStatus && (
            <motion.section variants={itemVariants}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {[
                  {
                    value: apiStatus.stats.totalImages,
                    label: t.stats.totalImages,
                    icon: ImageIcon,
                    chip: "bg-primary/10 border-primary/30",
                    blob: "bg-primary/25 text-primary-strong",
                    num: "text-primary-strong",
                  },
                  {
                    value: apiStatus.stats.totalGroups,
                    label: t.stats.imageGroups,
                    icon: Layers,
                    chip: "bg-secondary/10 border-secondary/30",
                    blob: "bg-secondary/25 text-purple-500 dark:text-purple-300",
                    num: "text-purple-500 dark:text-purple-300",
                  },
                  {
                    value: "99.9%",
                    label: t.stats.serviceTime,
                    icon: Zap,
                    chip: "bg-accent/10 border-accent/30",
                    blob: "bg-accent/25 text-emerald-500",
                    num: "text-emerald-500",
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className={cn(
                      "border-2 rounded-3xl shadow-soft px-5 py-6 flex flex-col items-center gap-2.5 text-center hover:-translate-y-1 hover:shadow-lift transition-all",
                      stat.chip
                    )}
                  >
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center",
                        stat.blob
                      )}
                    >
                      <stat.icon className="w-5 h-5" />
                    </div>
                    <div className={cn("font-display text-4xl font-bold tracking-tight", stat.num)}>
                      {stat.value}
                    </div>
                    <div className="text-xs font-bold text-muted-foreground">
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
      <footer className="relative z-10">
        <div className="lace-edge h-4 w-full rotate-180" aria-hidden />
        <div className="bg-card/95 backdrop-blur">
          <div className="max-w-4xl mx-auto px-6 lg:px-8 py-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-5">
              <div className="text-sm text-muted-foreground">
                &copy; {new Date().getFullYear()} {t.footer.copyright}
              </div>

              <div className="flex items-center gap-2.5">
                <span className="text-sm font-bold text-muted-foreground mr-2">
                  {t.footer.author}
                </span>
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
