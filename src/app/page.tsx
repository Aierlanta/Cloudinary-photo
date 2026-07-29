"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Image as ImageIcon,
  Github,
  Copy,
  CheckCircle2,
  Languages,
  Heart,
  Star,
  Sparkles,
  RefreshCw,
  BookOpen,
  Flower2,
  ShieldCheck,
  Moon,
  Sun,
  FolderKanban,
} from "lucide-react";
import {
  type Theme,
  resolveSiteClientTheme,
  applyThemeToRoot,
  setSiteManualTheme,
} from "@/lib/adminTheme";
import { useLocale, LocaleProvider } from "@/hooks/useLocale";
import { cn } from "@/lib/utils";

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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.11,
      delayChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.65,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
};

/** 手绘感四角星 */
function DoodleStar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M12 1.2 14.1 8.7 21.8 10.8 14.1 12.9 12 20.4 9.9 12.9 2.2 10.8 9.9 8.7Z" />
    </svg>
  );
}

/** 五瓣樱花——参考图 PREVIEW 两侧的花 */
function Sakura({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <g fill="currentColor">
        <ellipse cx="16" cy="7.2" rx="4.2" ry="5.6" />
        <ellipse cx="16" cy="7.2" rx="4.2" ry="5.6" transform="rotate(72 16 16)" />
        <ellipse cx="16" cy="7.2" rx="4.2" ry="5.6" transform="rotate(144 16 16)" />
        <ellipse cx="16" cy="7.2" rx="4.2" ry="5.6" transform="rotate(216 16 16)" />
        <ellipse cx="16" cy="7.2" rx="4.2" ry="5.6" transform="rotate(288 16 16)" />
        <circle cx="16" cy="16" r="3.2" fill="#ffe8f2" />
        <circle cx="16" cy="16" r="1.5" fill="#ffb3d4" />
      </g>
    </svg>
  );
}

function FloatingDecor() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <Heart className="absolute top-[14%] left-[6%] w-5 h-5 text-primary/55 animate-float-soft" fill="currentColor" />
      <DoodleStar className="absolute top-[18%] right-[9%] w-6 h-6 text-secondary/60 animate-sparkle" />
      <Sparkles className="absolute top-[42%] left-[4%] w-5 h-5 text-primary-strong/45 animate-sparkle" />
      <Sakura className="absolute top-[55%] right-[5%] w-6 h-6 text-primary/50 animate-drift" />
      <DoodleStar className="absolute bottom-[22%] left-[10%] w-4 h-4 text-accent/65 animate-wiggle" />
      <Heart className="absolute bottom-[18%] right-[12%] w-4 h-4 text-primary/45 animate-float-soft" fill="currentColor" />
      <Flower2 className="absolute top-[70%] left-[3%] w-5 h-5 text-secondary/45 animate-drift" />
      <Star
        className="absolute top-[28%] left-[14%] w-3.5 h-3.5 animate-sparkle hidden md:block"
        fill="currentColor"
        style={{ color: "var(--logo-yellow)" }}
      />
      <DoodleStar className="absolute top-[8%] left-[40%] w-3 h-3 text-primary/40 animate-sparkle hidden sm:block" />
      <Heart className="absolute top-[12%] right-[28%] w-3.5 h-3.5 text-secondary/45 animate-float-soft hidden sm:block" fill="currentColor" />
      <Sakura className="absolute top-[36%] right-[16%] w-4 h-4 text-primary/35 animate-wiggle hidden md:block" />
      <DoodleStar className="absolute bottom-[32%] right-[22%] w-3.5 h-3.5 text-primary/30 animate-sparkle hidden md:block" />
    </div>
  );
}

function EmptyPreview({
  title,
  hint,
}: {
  title: string;
  hint: string;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#ffe4f0] via-[#fff6ee] to-[#e8ddff]">
      <div className="relative">
        <div className="w-20 h-20 rounded-[1.75rem] bg-white/80 border-2 border-primary/30 shadow-soft flex items-center justify-center">
          <ImageIcon className="w-9 h-9 text-primary/70" />
        </div>
        <Sakura className="absolute -top-2 -right-3 w-6 h-6 text-primary animate-sparkle" />
        <Heart className="absolute -bottom-1 -left-2 w-4 h-4 text-primary-strong animate-float-soft" fill="currentColor" />
      </div>
      <p className="font-display font-bold text-foreground/80">{title}</p>
      <p className="text-sm text-muted-foreground px-6 text-center">{hint}</p>
    </div>
  );
}

function HomeContent() {
  const { t, toggleLocale } = useLocale();
  const [apiStatus, setApiStatus] = useState<APIStatus | null>(null);
  const [randomImageUrl, setRandomImageUrl] = useState<string>("");
  const [imageFailed, setImageFailed] = useState(false);
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
      setImageLoading(true);
      setImageFailed(false);
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
    if (!baseUrl) return;
    setImageLoading(true);
    setImageFailed(false);
    const url = new URL(`${baseUrl}/api/random`);
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

  const totalImages = apiStatus?.stats.totalImages ?? 0;
  const totalGroups = apiStatus?.stats.totalGroups ?? 0;
  const showImage = Boolean(randomImageUrl) && !imageFailed;

  return (
    <div className="min-h-[100dvh] relative overflow-x-hidden bg-polka font-body flex flex-col">
      <FloatingDecor />

      <motion.header
        initial={{ y: -48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-50"
      >
        <div className="bg-card/95 backdrop-blur-sm">
          <div className="w-full max-w-5xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between h-[4.25rem]">
              <Link href="/" className="flex items-center gap-2.5 group min-w-0">
                <div
                  className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-soft ring-[3px] ring-white/90 group-hover:rotate-12 transition-transform"
                  aria-hidden
                >
                  <Star
                    className="w-5 h-5"
                    style={{ color: "var(--logo-yellow)" }}
                    fill="currentColor"
                  />
                </div>
                <span className="font-display font-bold text-[1.05rem] sm:text-xl tracking-tight brand-outline truncate">
                  {t.home.brandName}
                </span>
              </Link>

              <nav className="flex items-center gap-1.5 sm:gap-2.5">
                <Link href="/api/docs" className="nav-chip" aria-label={t.home.apiDocs}>
                  <BookOpen className="w-3.5 h-3.5 opacity-80" />
                  <span className="hidden sm:inline">{t.home.apiDocs}</span>
                </Link>
                <Link
                  href="https://github.com/Aierlanta/Cloudinary-photo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nav-chip"
                  aria-label="GitHub"
                >
                  <Github className="w-3.5 h-3.5 opacity-80" />
                  <span className="hidden sm:inline">GitHub</span>
                </Link>
                <Link href="/admin" className="nav-chip nav-chip-admin">
                  <Sakura className="w-3.5 h-3.5" />
                  <span>{t.home.managementPanel}</span>
                </Link>
              </nav>
            </div>
          </div>
        </div>
        <div className="lace-edge h-3.5 w-full" aria-hidden />
      </motion.header>

      <main className="relative z-10 px-4 sm:px-6 w-full max-w-3xl mx-auto flex-1">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="pt-10 sm:pt-14 pb-12 space-y-9"
        >
          <motion.section variants={itemVariants} className="text-center space-y-6">
            <div className="relative inline-block px-10 sm:px-14">
              <Heart
                className="absolute left-0 top-1/2 -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 text-primary animate-float-soft"
                fill="currentColor"
                aria-hidden
              />
              <Heart
                className="absolute right-0 top-1/2 -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 text-primary animate-float-soft"
                fill="currentColor"
                aria-hidden
                style={{ animationDelay: "0.8s" }}
              />
              <h1 className="font-display text-[2.35rem] sm:text-5xl md:text-[3.35rem] font-bold tracking-tight text-foreground leading-[1.2] select-none">
                {t.home.heroTaglineA}
                <span className="text-primary-strong">{t.home.heroTaglineHighlight}</span>
                {t.home.heroTaglineB}
              </h1>
            </div>

            {baseUrl && (
              <div className="flex justify-center">
                <div className="motion-lines inline-flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={copyEndpoint}
                    aria-label={t.common.copy}
                    className="endpoint-pill"
                  >
                    <span className="font-bold text-primary-strong">GET</span>
                    <span>/api/random</span>
                    {copied ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </motion.section>

          <motion.section variants={itemVariants} className="px-1 sm:px-4">
            <div className="scallop-shell">
              <div className="scallop-frame">
                <div className="washi-dot -top-2.5 left-5 sm:left-9 -rotate-[18deg]" aria-hidden />
                <div className="washi-dot -bottom-2.5 right-5 sm:right-9 rotate-[16deg]" aria-hidden />

                <div className="photo-well">
                  {showImage ? (
                    <>
                      <img
                        key={randomImageUrl}
                        src={randomImageUrl}
                        alt={t.home.randomImagePreview}
                        className={cn(
                          "absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-out",
                          imageLoading
                            ? "opacity-0 scale-105 blur-lg"
                            : "opacity-100 scale-100 blur-0"
                        )}
                        onLoad={() => setImageLoading(false)}
                        onError={() => {
                          setImageLoading(false);
                          setImageFailed(true);
                        }}
                      />
                      {imageLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-card/55 z-10">
                          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                        </div>
                      )}
                    </>
                  ) : (
                    <EmptyPreview title={t.home.noImage} hint={t.home.uploadFirst} />
                  )}

                  <div className="absolute bottom-[3.75rem] sm:bottom-[4.25rem] left-3 sm:left-4 z-20">
                    <span className="preview-badge">
                      <Sakura className="w-3.5 h-3.5" />
                      {t.home.previewBadge}
                      <Sakura className="w-3.5 h-3.5" />
                    </span>
                  </div>

                  <div className="absolute bottom-3 left-3 right-3 sm:left-4 sm:right-4 z-20">
                    <div className="caption-strip px-4 py-2.5 sm:px-5 sm:py-3 flex items-center justify-between gap-3">
                      <p className="text-sm sm:text-[0.95rem] font-bold text-foreground flex items-center gap-1.5 min-w-0">
                        <span className="truncate">{t.home.dialogueText}</span>
                        <Heart
                          className="w-3.5 h-3.5 text-primary shrink-0"
                          fill="currentColor"
                          aria-hidden
                        />
                      </p>
                      <button
                        type="button"
                        onClick={refreshRandomImage}
                        aria-label={t.home.refreshImage}
                        className="shrink-0 p-2 rounded-full bg-primary/15 text-primary-strong hover:bg-primary hover:text-white transition-colors"
                      >
                        <RefreshCw
                          className={cn("w-4 h-4", imageLoading && "animate-spin")}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          <motion.section variants={itemVariants}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
              <div className="stat-candy stat-candy-pink">
                <Sakura className="absolute top-2 left-3 w-4 h-4 text-primary/55 animate-sparkle" />
                <Sakura className="absolute top-3 right-4 w-3.5 h-3.5 text-primary/40 animate-drift" />
                <div className="mx-auto mb-2 w-11 h-11 rounded-2xl bg-primary/20 text-primary-strong flex items-center justify-center">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div className="font-display text-3xl sm:text-4xl font-bold text-primary-strong tracking-tight">
                  {totalImages.toLocaleString()}
                </div>
                <div className="mt-1 text-xs font-bold text-muted-foreground tracking-wide">
                  {t.home.statImages}
                </div>
              </div>

              <div className="stat-candy stat-candy-purple">
                <DoodleStar className="absolute top-2.5 left-3.5 w-4 h-4 text-secondary/60 animate-sparkle" />
                <DoodleStar className="absolute bottom-3 right-3 w-3.5 h-3.5 text-secondary/50 animate-wiggle" />
                <div className="mx-auto mb-2 w-11 h-11 rounded-2xl bg-secondary/25 text-[#8b6fd4] dark:text-secondary flex items-center justify-center">
                  <FolderKanban className="w-5 h-5" />
                </div>
                <div className="font-display text-3xl sm:text-4xl font-bold text-[#8b6fd4] dark:text-secondary tracking-tight">
                  {totalGroups.toLocaleString()}
                </div>
                <div className="mt-1 text-xs font-bold text-muted-foreground tracking-wide">
                  {t.home.statGroups}
                </div>
              </div>

              <div className="stat-candy stat-candy-mint">
                <Sparkles className="absolute top-2.5 right-3.5 w-4 h-4 text-accent/75 animate-sparkle" />
                <Sparkles className="absolute bottom-3 left-3 w-3.5 h-3.5 text-accent/60 animate-drift" />
                <div className="mx-auto mb-2 w-11 h-11 rounded-2xl bg-accent/25 text-emerald-600 dark:text-accent flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="font-display text-3xl sm:text-4xl font-bold text-emerald-600 dark:text-accent tracking-tight">
                  99.9%
                </div>
                <div className="mt-1 text-xs font-bold text-muted-foreground tracking-wide">
                  {t.home.statUptime}
                </div>
              </div>
            </div>
          </motion.section>
        </motion.div>
      </main>

      <footer className="relative z-10 mt-auto">
        <div className="lace-edge h-3.5 w-full rotate-180" aria-hidden />
        <div className="bg-card/95 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto px-6 py-7">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground text-center md:text-left">
                &copy; {new Date().getFullYear()} {t.footer.copyright}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-muted-foreground mr-1">
                  {t.footer.author}
                </span>
                <button
                  type="button"
                  onClick={toggleLocale}
                  aria-label={t.home.toggleLanguage}
                  className="p-2.5 rounded-full border border-[var(--nav-outline)] hover:border-primary hover:text-primary-strong transition-colors"
                  style={{ background: "var(--nav-beige)" }}
                >
                  <Languages className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={handleThemeToggle}
                  aria-label={t.home.toggleTheme}
                  className="p-2.5 rounded-full border border-[var(--nav-outline)] hover:border-primary hover:text-primary-strong transition-colors"
                  style={{ background: "var(--nav-beige)" }}
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
                  className="p-2.5 rounded-full border border-[var(--nav-outline)] hover:border-primary hover:text-primary-strong transition-colors"
                  style={{ background: "var(--nav-beige)" }}
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
