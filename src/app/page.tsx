"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
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

// --- Types ---
interface APIStatus {
  status: string;
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

const cardHoverVariants = {
  hover: {
    y: -8,
    scale: 1.02,
    boxShadow: "0 20px 40px -10px rgba(0,0,0,0.2)",
    transition: {
      type: "spring" as const,
      stiffness: 260,
      damping: 20,
    },
  },
};

// --- Components ---

const GlassCard = ({
  children,
  className,
  hover = true,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}) => {
  return (
    <motion.div
      variants={hover ? cardHoverVariants : undefined}
      whileHover={hover ? "hover" : undefined}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl shadow-lg transition-colors",
        "dark:border-white/10 dark:bg-slate-900/40",
        "before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-500",
        className
      )}
    >
      {/* Noise texture overlay specifically for cards if needed, or rely on global */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-50 mix-blend-overlay" />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
};

const GlassButton = ({
  children,
  onClick,
  primary = false,
  icon: Icon,
  className,
  ...props
}: any) => {
  return (
    <Magnetic>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        className={cn(
          "group flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all shadow-md backdrop-blur-md relative overflow-hidden",
          primary
            ? "bg-primary text-white hover:shadow-primary/40 border border-primary/50"
            : "bg-white/10 hover:bg-white/20 text-foreground border border-white/20 dark:bg-white/5 dark:hover:bg-white/10",
          className
        )}
        {...props}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
        {Icon && <Icon className="w-5 h-5 transition-transform group-hover:rotate-12 group-hover:scale-110" />}
        {children}
      </motion.button>
    </Magnetic>
  );
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

  return (
    <div className="min-h-screen relative overflow-x-hidden selection:bg-primary/30">
      
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

      {/* Navigation */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-white/60 dark:bg-slate-950/60 backdrop-blur-xl supports-[backdrop-filter]:bg-white/20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold shadow-lg shadow-primary/20">
                R
              </div>
              <span className="font-bold text-lg tracking-tight">
                {locale === "zh" ? "随机图片API" : "Random Image API"}
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <Link href="/admin" className="hidden sm:block">
                <GlassButton className="px-4 py-2 text-sm" icon={LayoutDashboard}>
                  {t.home.managementPanel}
                </GlassButton>
              </Link>
              <div className="h-6 w-px bg-foreground/10 mx-1 hidden sm:block" />
              <button
                onClick={toggleLocale}
                className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                title={t.home.toggleLanguage}
              >
                <Languages className="w-5 h-5" />
              </button>
              <button
                onClick={handleThemeToggle}
                className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                title={t.home.toggleTheme}
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
                className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              >
                <Github className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Main Content */}
      <main className="pt-28 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-20"
        >
          {/* Hero Section */}
          <motion.section 
            style={{ y: heroY, opacity: heroOpacity }}
            className="text-center space-y-8 relative z-10"
          >
            <motion.div variants={itemVariants} className="relative inline-block group">
              <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-primary via-secondary to-accent opacity-30 blur-lg group-hover:opacity-50 transition-opacity duration-500" />
              <span className="relative px-4 py-1.5 rounded-full border border-white/20 bg-white/40 dark:bg-black/40 backdrop-blur-md text-sm font-medium text-primary dark:text-white/90 flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                 v1.7.2
              </span>
            </motion.div>
            
            <motion.h1
              variants={itemVariants}
              className="text-5xl sm:text-7xl md:text-8xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-foreground via-foreground/90 to-foreground/50 leading-[1.1] drop-shadow-sm"
            >
              {t.home.title}
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="max-w-2xl mx-auto text-lg sm:text-2xl text-muted-foreground leading-relaxed font-light"
            >
              {t.home.subtitle}
            </motion.p>

            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-6"
            >
              <Link href="/api/docs">
                <GlassButton primary icon={BookOpen} className="min-w-[160px] text-lg">
                  {t.home.apiDocs}
                </GlassButton>
              </Link>
              <Link href="/admin">
                <GlassButton icon={ArrowRight} className="min-w-[160px] text-lg">
                  {t.home.managementPanel}
                </GlassButton>
              </Link>
            </motion.div>

            {/* API Status Indicator */}
            {!loading && apiStatus && (
              <motion.div
                variants={itemVariants}
                className="inline-flex items-center gap-2 px-4 py-2 mt-8 rounded-full bg-white/30 dark:bg-black/20 backdrop-blur-md border border-white/10 shadow-sm"
              >
                <div className="relative flex h-3 w-3">
                  {apiStatus.status === "healthy" && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  )}
                  <span
                    className={cn(
                      "relative inline-flex rounded-full h-3 w-3",
                      apiStatus.status === "healthy"
                        ? "bg-green-500"
                        : "bg-yellow-500"
                    )}
                  ></span>
                </div>
                <span className="text-sm font-medium">
                  {t.home.apiStatus}:{" "}
                  {apiStatus.status === "healthy"
                    ? t.home.statusHealthy
                    : t.home.statusPartial}
                </span>
              </motion.div>
            )}
          </motion.section>

          {/* Interactive Preview Section */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 perspective-1000">
            {/* Image Preview */}
            <motion.div 
              variants={itemVariants} 
              className="h-full"
              whileHover={{ rotateY: -2, rotateX: 2, scale: 1.01 }}
              transition={{ type: "spring", stiffness: 100, damping: 20 }}
            >
              <GlassCard className="h-full p-2 flex flex-col ring-1 ring-white/30 dark:ring-white/10">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-black/5 dark:bg-white/5">
                  {randomImageUrl ? (
                    <>
                      <img
                        key={randomImageUrl}
                        src={randomImageUrl}
                        alt="Random Preview"
                        className={cn(
                          "w-full h-full object-cover transition-all duration-700 ease-out hover:scale-110",
                          imageLoading ? "opacity-0 scale-95 blur-sm" : "opacity-100 scale-100 blur-0"
                        )}
                        onLoad={() => setImageLoading(false)}
                        onError={() => setImageLoading(false)}
                      />
                      {imageLoading && (
                        <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm bg-white/10">
                          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin shadow-lg" />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center">
                      <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
                      <p>{t.home.noImage}</p>
                      <p className="text-sm opacity-70">{t.home.uploadFirst}</p>
                    </div>
                  )}
                  
                  {/* Overlay Actions */}
                  <div className="absolute bottom-4 right-4 flex gap-2">
                     <Magnetic>
                       <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={refreshRandomImage}
                          className="p-3 rounded-full bg-white/80 dark:bg-black/80 backdrop-blur-md shadow-lg text-foreground hover:text-primary transition-colors border border-white/20"
                          title={t.home.refreshImage}
                        >
                          <RefreshCw className={cn("w-5 h-5", imageLoading && "animate-spin")} />
                        </motion.button>
                     </Magnetic>
                  </div>
                </div>
                <div className="p-5 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg">{t.home.randomImagePreview}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">Cloudinary / Telegram Optimized</p>
                  </div>
                  <div className="flex gap-2">
                    <div className="px-2 py-1 rounded-md bg-green-500/10 text-green-600 text-xs font-medium border border-green-500/20">Live</div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>

            {/* Code Snippet */}
            <motion.div 
              variants={itemVariants} 
              className="flex flex-col gap-6"
              whileHover={{ rotateY: 2, rotateX: 2, scale: 1.01 }}
              transition={{ type: "spring", stiffness: 100, damping: 20 }}
            >
              <GlassCard className="p-6 sm:p-8 flex-1 flex flex-col justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-20">
                  <Terminal className="w-32 h-32" />
                </div>
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-xl flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Terminal className="w-5 h-5" />
                      </div>
                      {t.home.basicCall}
                    </h3>
                    <div className="flex gap-2">
                       <div className="flex gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                          <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                          <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
                       </div>
                    </div>
                  </div>
                  
                  <div className="relative group mb-8">
                    <div className="bg-slate-950/80 backdrop-blur-sm rounded-xl p-5 font-mono text-sm text-slate-300 overflow-x-auto border border-white/10 shadow-inner">
                      <div className="flex items-center gap-2">
                        <span className="text-purple-400 font-bold">GET</span>
                        <span className="text-gray-500">→</span>
                        <span className="text-green-400 break-all">{baseUrl}/api/random</span>
                      </div>
                    </div>
                    <button
                      onClick={() => copyToClipboard(`${baseUrl}/api/random`)}
                      className="absolute top-3 right-3 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all opacity-0 group-hover:opacity-100 backdrop-blur-md"
                    >
                      {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="pt-6 border-t border-white/10">
                    <h3 className="font-bold text-xl flex items-center gap-3 mb-6">
                      <div className="p-2 rounded-lg bg-secondary/10 text-secondary">
                        <Settings className="w-5 h-5" />
                      </div>
                      {t.home.htmlUsage}
                    </h3>
                    <div className="relative group">
                      <div className="bg-slate-950/80 backdrop-blur-sm rounded-xl p-5 font-mono text-sm text-slate-300 overflow-x-auto border border-white/10 shadow-inner">
                        <span className="text-blue-400">&lt;img</span>{" "}
                        <span className="text-sky-300">src</span>=
                        <span className="text-orange-300">"{baseUrl}/api/random"</span>{" "}
                        <span className="text-blue-400">/&gt;</span>
                      </div>
                       <button
                        onClick={() => copyToClipboard(`<img src="${baseUrl}/api/random" />`)}
                        className="absolute top-3 right-3 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all opacity-0 group-hover:opacity-100 backdrop-blur-md"
                      >
                        {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          </section>

          {/* Features Grid */}
          <section>
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={containerVariants}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {[
                {
                  icon: Zap,
                  title: t.features.performance.title,
                  desc: t.features.performance.description,
                  color: "text-yellow-500",
                  bg: "bg-yellow-500/10",
                  border: "border-yellow-500/20"
                },
                {
                  icon: CheckCircle2,
                  title: t.features.easyToUse.title,
                  desc: t.features.easyToUse.description,
                  color: "text-green-500",
                  bg: "bg-green-500/10",
                  border: "border-green-500/20"
                },
                {
                  icon: Settings,
                  title: t.features.flexible.title,
                  desc: t.features.flexible.description,
                  color: "text-blue-500",
                  bg: "bg-blue-500/10",
                  border: "border-blue-500/20"
                },
              ].map((feature, index) => (
                <motion.div key={index} variants={itemVariants}>
                  <GlassCard className={cn("p-8 h-full hover:border-opacity-50 transition-colors", feature.border)}>
                    <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-sm", feature.bg)}>
                      <feature.icon className={cn("w-7 h-7", feature.color)} />
                    </div>
                    <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {feature.desc}
                    </p>
                  </GlassCard>
                </motion.div>
              ))}
            </motion.div>
          </section>

          {/* Stats Section */}
          {apiStatus && (
            <section>
               <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 50 }}
                  whileInView={{ opacity: 1, scale: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className="relative"
               >
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 blur-3xl opacity-30 rounded-3xl" />
                  <GlassCard className="p-8 md:p-12 text-center border-primary/10 relative overflow-hidden" hover={false}>
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50" />
                    
                    <h2 className="text-3xl font-bold mb-12 relative inline-block">
                      {t.stats.title}
                      <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-12 h-1 bg-primary rounded-full" />
                    </h2>
                    
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                      <div className="space-y-2">
                        <div className="text-4xl md:text-5xl font-black text-foreground tracking-tight tabular-nums">
                           {apiStatus.stats.totalImages}
                        </div>
                        <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                           {t.stats.totalImages}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-4xl md:text-5xl font-black text-foreground tracking-tight tabular-nums">
                           {apiStatus.stats.totalGroups}
                        </div>
                        <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                           {t.stats.imageGroups}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className={cn("text-4xl md:text-5xl font-black tracking-tight", 
                           apiStatus.services.api.enabled ? "text-green-500" : "text-red-500"
                        )}>
                           {apiStatus.services.api.enabled ? "ON" : "OFF"}
                        </div>
                        <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                           {t.stats.apiStatus}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-4xl md:text-5xl font-black text-foreground tracking-tight">
                           24/7
                        </div>
                        <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
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
      <footer className="border-t border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl mt-12 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} {t.footer.copyright}
            </div>
            <div className="flex items-center gap-6 text-sm font-medium text-muted-foreground">
              <span>{t.footer.author}</span>
              <div className="h-4 w-px bg-foreground/10" />
              <Link
                href="https://github.com/Aierlanta/Cloudinary-photo"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-primary transition-colors"
              >
                <Github className="w-4 h-4" />
                {t.footer.github}
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
