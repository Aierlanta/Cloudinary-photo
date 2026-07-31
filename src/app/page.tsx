"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BookOpen,
  Github,
  Heart,
  Image as ImageIcon,
  Languages,
  Moon,
  Sun,
} from "lucide-react";

import { LocaleProvider, useLocale } from "@/hooks/useLocale";
import {
  applyThemeToRoot,
  resolveSiteClientTheme,
  setSiteManualTheme,
  type Theme,
} from "@/lib/adminTheme";
import { cn } from "@/lib/utils";

import styles from "./home.module.css";

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
      staggerChildren: 0.1,
      delayChildren: 0.06,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.64,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
};

function FourPointStar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path
        d="M16 1.8c1.5 8.2 3.9 10.6 12.2 12.2C19.9 15.5 17.5 18 16 26.2 14.5 18 12.1 15.5 3.8 14 12.1 12.4 14.5 10 16 1.8Z"
        fill="currentColor"
      />
    </svg>
  );
}

function Sakura({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <g fill="currentColor">
        <ellipse cx="16" cy="7.2" rx="4.2" ry="5.6" />
        <ellipse
          cx="16"
          cy="7.2"
          rx="4.2"
          ry="5.6"
          transform="rotate(72 16 16)"
        />
        <ellipse
          cx="16"
          cy="7.2"
          rx="4.2"
          ry="5.6"
          transform="rotate(144 16 16)"
        />
        <ellipse
          cx="16"
          cy="7.2"
          rx="4.2"
          ry="5.6"
          transform="rotate(216 16 16)"
        />
        <ellipse
          cx="16"
          cy="7.2"
          rx="4.2"
          ry="5.6"
          transform="rotate(288 16 16)"
        />
        <circle cx="16" cy="16" r="3.1" fill="#fff5f2" />
        <circle cx="16" cy="16" r="1.45" fill="#ff9fbd" />
      </g>
    </svg>
  );
}

function DoodleHeart({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 52" className={className} aria-hidden>
      <path
        d="M28 45.2C22.7 39.8 7.3 31.7 5.9 17.9 5.1 9.7 10.2 5 16.5 5c5.2 0 9.1 3.1 11.5 7.1C30.4 8.1 34.3 5 39.5 5c6.3 0 11.4 4.7 10.6 12.9C48.7 31.7 33.3 39.8 28 45.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M27.8 39.1C23.6 35.2 11.7 28.1 10.4 18.4c-.8-5.9 2.7-9.2 7-9.2 4.7 0 8.2 3.9 10.4 7.8 2.2-3.9 5.8-7.8 10.5-7.8 4.3 0 7.8 3.3 7 9.2-1.3 9.7-13.2 16.8-17.5 20.7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity=".65"
      />
    </svg>
  );
}

function DoodleStar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 52 52" className={className} aria-hidden>
      <path
        d="m26 4.8 6.1 12.4 13.7 2-9.9 9.7 2.3 13.6L26 36.1l-12.2 6.4 2.3-13.6-9.9-9.7 13.7-2L26 4.8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m26 10.9 4.3 8.8 9.7 1.4-7 6.8 1.7 9.6-8.7-4.6-8.7 4.6 1.7-9.6-7-6.8 9.7-1.4 4.3-8.8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity=".55"
      />
    </svg>
  );
}

function PictureStatIcon() {
  return (
    <svg viewBox="0 0 58 58" aria-hidden>
      <rect
        x="8"
        y="9"
        width="42"
        height="40"
        rx="5"
        fill="#fff7f5"
        stroke="currentColor"
        strokeWidth="2.8"
      />
      <circle cx="20" cy="21" r="4.3" fill="#ffd5df" />
      <path
        d="m12.5 43 11.8-12 8.1 7 5.5-5.5L46 43Z"
        fill="#ff9cb4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FolderStarIcon() {
  return (
    <svg viewBox="0 0 64 58" aria-hidden>
      <path
        d="M7 15.5h18l5.2 5H57v28H7Z"
        fill="#b898e4"
        stroke="#7650ad"
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
      <path
        d="M7 15.5v-5h17l5.2 5H57v5H30.2l-5.2-5Z"
        fill="#d4bff0"
        stroke="#7650ad"
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
      <path
        d="m39 27.2 2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8Z"
        fill="#ffd36a"
        stroke="#8b68be"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShieldBadgeIcon() {
  return (
    <svg viewBox="0 0 60 64" aria-hidden>
      <path
        d="M30 4.5 51 12v17.5c0 14.8-9.1 24.4-21 30-11.9-5.6-21-15.2-21-30V12Z"
        fill="#6dcbb6"
        stroke="#218f7b"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M30 11.5 44 16v13.1c0 10.2-5.7 17.2-14 21.6-8.3-4.4-14-11.4-14-21.6V16Z"
        fill="#a9e2d5"
        stroke="#f8fffd"
        strokeWidth="2"
      />
      <path
        d="m22.8 30.8 4.8 4.7 9.9-10"
        fill="none"
        stroke="#fff"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RibbonBow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 150 82" className={className} aria-hidden>
      <g stroke="#b95b72" strokeWidth="2.2" strokeLinejoin="round">
        <path d="M67 37C50 11 19 5 12 18 5 32 31 50 64 47Z" fill="#ff9fba" />
        <path d="M83 37c17-26 48-32 55-19 7 14-19 32-52 29Z" fill="#ff9fba" />
        <path d="M61 44 43 76l30-15 2-18Z" fill="#ef87aa" />
        <path d="m89 44 18 32-30-15-2-18Z" fill="#ef87aa" />
        <rect x="64" y="30" width="22" height="22" rx="7" fill="#ffbfd0" />
        <path
          d="M21 20c12 0 25 7 38 19M129 20c-12 0-25 7-38 19"
          fill="none"
          opacity=".55"
        />
      </g>
      <path
        d="M70 35c3-2 7-2 10 0"
        fill="none"
        stroke="#fff7f8"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FloatingDecor() {
  return (
    <div className={styles.decorLayer} aria-hidden>
      <FourPointStar className={cn(styles.decor, styles.decorPinkSpark)} />
      <DoodleStar className={cn(styles.decor, styles.decorGoldStarLeft)} />
      <FourPointStar className={cn(styles.decor, styles.decorGoldSpark)} />
      <FourPointStar className={cn(styles.decor, styles.decorLavenderSpark)} />
      <FourPointStar
        className={cn(styles.decor, styles.decorLavenderSparkTopRight)}
      />
      <FourPointStar
        className={cn(styles.decor, styles.decorCoralSparkRight)}
      />
      <DoodleStar className={cn(styles.decor, styles.decorGoldStarRight)} />
      <FourPointStar
        className={cn(styles.decor, styles.decorPeachSparkRight)}
      />
      <FourPointStar className={cn(styles.decor, styles.decorMintSpark)} />
      <FourPointStar
        className={cn(styles.decor, styles.decorGoldSparkBottom)}
      />
      <FourPointStar
        className={cn(styles.decor, styles.decorPinkSparkBottom)}
      />
      <DoodleHeart className={cn(styles.decor, styles.decorHeartRight)} />
      <DoodleHeart className={cn(styles.decor, styles.decorHeartRightSmall)} />
      <Sakura className={cn(styles.decor, styles.decorFlowerLeft)} />
      <Sakura className={cn(styles.decor, styles.decorFlowerRight)} />
    </div>
  );
}

function EmptyPreview({ title, hint }: { title: string; hint: string }) {
  return (
    <div className={styles.emptyPreview}>
      <div className={styles.emptyIconWrap}>
        <ImageIcon className={styles.emptyIcon} />
        <Sakura className={styles.emptyFlower} />
        <Heart className={styles.emptyHeart} fill="currentColor" />
      </div>
      <p className={styles.emptyTitle}>{title}</p>
      <p className={styles.emptyHint}>{hint}</p>
    </div>
  );
}

interface StatCardProps {
  className: string;
  icon: ReactNode;
  value: string;
  label: string;
  decoration: ReactNode;
}

function StatCard({
  className,
  icon,
  value,
  label,
  decoration,
}: StatCardProps) {
  return (
    <div className={cn(styles.statCard, className)}>
      {decoration}
      <div className={styles.statIcon}>{icon}</div>
      <div className={styles.statCopy}>
        <div className={styles.statValue}>{value}</div>
        <div className={styles.statLabel}>{label}</div>
      </div>
    </div>
  );
}

function HomeContent() {
  const { t, toggleLocale } = useLocale();
  const [apiStatus, setApiStatus] = useState<APIStatus | null>(null);
  const [randomImageUrl, setRandomImageUrl] = useState("");
  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [theme, setTheme] = useState<Theme>("light");
  const [isManualTheme, setIsManualTheme] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const preference = resolveSiteClientTheme();
    setTheme(preference.theme);
    setIsManualTheme(preference.isManual);
    applyThemeToRoot(preference.theme);

    const currentBaseUrl = `${window.location.protocol}//${window.location.host}`;
    setBaseUrl(currentBaseUrl);

    fetch("/api/status?mode=summary")
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((data) => {
        if (data?.success) setApiStatus(data.data);
      })
      .catch(console.error);

    setImageLoading(true);
    setImageFailed(false);
    setRandomImageUrl(`${currentBaseUrl}/api/random`);
  }, []);

  useEffect(() => {
    if (isManualTheme) return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (matches: boolean) => {
      const nextTheme: Theme = matches ? "dark" : "light";
      setTheme((previous) => (previous === nextTheme ? previous : nextTheme));
      applyThemeToRoot(nextTheme);
    };

    apply(media.matches);
    const listener = (event: MediaQueryListEvent) => apply(event.matches);
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
    setTheme((previous) => {
      const nextTheme: Theme = previous === "light" ? "dark" : "light";
      applyThemeToRoot(nextTheme);
      setSiteManualTheme(nextTheme);
      return nextTheme;
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
    <div className={styles.root}>
      <FloatingDecor />

      <motion.header
        initial={{ y: -42, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.58, ease: [0.16, 1, 0.3, 1] }}
        className={styles.header}
      >
        <FourPointStar className={styles.headerStarLeft} />
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brandLink}>
            <span className={styles.logoMedallion}>
              <span className={styles.logoStitch}>
                <Image
                  src="/icon.png"
                  alt=""
                  width={72}
                  height={72}
                  className={styles.logoImage}
                  priority
                />
              </span>
            </span>
            <span className={styles.brandName}>{t.home.brandName}</span>
            <FourPointStar className={styles.headerStarBrand} />
          </Link>

          <nav className={styles.navigation} aria-label="Primary">
            <Link
              href="/api/docs"
              className={styles.navButton}
              aria-label={t.home.apiDocs}
            >
              <BookOpen aria-hidden />
              <span>{t.home.apiDocs}</span>
            </Link>
            <Link
              href="https://github.com/Aierlanta/Cloudinary-photo"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.navButton}
              aria-label="GitHub"
            >
              <Github aria-hidden />
              <span>GitHub</span>
            </Link>
            <Link
              href="/admin"
              className={cn(styles.navButton, styles.adminButton)}
            >
              <Sakura className={styles.adminFlower} />
              <span>{t.home.managementPanel}</span>
            </Link>
          </nav>
        </div>
      </motion.header>

      <main className={styles.main}>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className={styles.stage}
        >
          <motion.section variants={itemVariants} className={styles.hero}>
            <div className={styles.heroTitleRow}>
              <DoodleHeart
                className={cn(styles.heroHeart, styles.heroHeartLeft)}
              />
              <h1 className={styles.heroTitle}>
                {t.home.heroTaglineA}
                <span>{t.home.heroTaglineHighlight}</span>
                {t.home.heroTaglineB}
              </h1>
              <DoodleHeart
                className={cn(styles.heroHeart, styles.heroHeartRight)}
              />
            </div>

            {baseUrl && (
              <div className={styles.endpointRow}>
                <button
                  type="button"
                  className={styles.endpointButton}
                  onClick={copyEndpoint}
                  aria-label={t.common.copy}
                >
                  <strong>GET</strong>
                  <span>/api/random</span>
                </button>
                <span className={styles.srOnly} aria-live="polite">
                  {copied ? "Copied" : ""}
                </span>
              </div>
            )}
          </motion.section>

          <motion.section
            variants={itemVariants}
            className={styles.previewSection}
          >
            <div className={styles.scrapbookShell}>
              <div className={styles.frame}>
                <div className={styles.washiDots} aria-hidden />
                <div className={styles.washiStripes} aria-hidden />
                <RibbonBow className={styles.bow} />

                <div className={styles.photoWell}>
                  {showImage ? (
                    <>
                      <img
                        key={randomImageUrl}
                        src={randomImageUrl}
                        alt={t.home.randomImagePreview}
                        className={cn(
                          styles.previewImage,
                          imageLoading
                            ? styles.previewImageLoading
                            : styles.previewImageReady,
                        )}
                        onLoad={() => setImageLoading(false)}
                        onError={() => {
                          setImageLoading(false);
                          setImageFailed(true);
                        }}
                      />
                      {imageLoading && (
                        <div className={styles.loadingOverlay}>
                          <div className={styles.spinner} />
                        </div>
                      )}
                    </>
                  ) : (
                    <EmptyPreview
                      title={t.home.noImage}
                      hint={t.home.uploadFirst}
                    />
                  )}
                </div>

                <div className={styles.captionBox}>
                  <span className={styles.previewBadge}>
                    <Sakura />
                    {t.home.previewBadge}
                    <Sakura />
                  </span>
                  <p>{t.home.dialogueText}</p>
                  <button
                    type="button"
                    onClick={refreshRandomImage}
                    aria-label={t.home.refreshImage}
                    className={styles.refreshHeart}
                  >
                    <Heart fill="currentColor" />
                  </button>
                </div>
              </div>
            </div>
          </motion.section>

          <motion.section
            variants={itemVariants}
            className={styles.statsSection}
          >
            <div className={styles.statsGrid}>
              <StatCard
                className={styles.statPink}
                icon={<PictureStatIcon />}
                value={totalImages.toLocaleString()}
                label={t.home.statImages}
                decoration={
                  <>
                    <Sakura
                      className={cn(styles.statDecor, styles.statDecorPinkOne)}
                    />
                    <Sakura
                      className={cn(styles.statDecor, styles.statDecorPinkTwo)}
                    />
                  </>
                }
              />
              <StatCard
                className={styles.statPurple}
                icon={<FolderStarIcon />}
                value={totalGroups.toLocaleString()}
                label={t.home.statGroups}
                decoration={
                  <>
                    <FourPointStar
                      className={cn(
                        styles.statDecor,
                        styles.statDecorPurpleOne,
                      )}
                    />
                    <FourPointStar
                      className={cn(
                        styles.statDecor,
                        styles.statDecorPurpleTwo,
                      )}
                    />
                  </>
                }
              />
              <StatCard
                className={styles.statMint}
                icon={<ShieldBadgeIcon />}
                value="99.9%"
                label={t.home.statUptime}
                decoration={
                  <>
                    <FourPointStar
                      className={cn(styles.statDecor, styles.statDecorMintOne)}
                    />
                    <FourPointStar
                      className={cn(styles.statDecor, styles.statDecorMintTwo)}
                    />
                  </>
                }
              />
            </div>
          </motion.section>
        </motion.div>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <p>
            &copy; {new Date().getFullYear()} {t.footer.copyright}
          </p>
          <div className={styles.footerActions}>
            <span>{t.footer.author}</span>
            <button
              type="button"
              onClick={toggleLocale}
              aria-label={t.home.toggleLanguage}
            >
              <Languages />
            </button>
            <button
              type="button"
              onClick={handleThemeToggle}
              aria-label={t.home.toggleTheme}
            >
              {theme === "dark" ? <Sun /> : <Moon />}
            </button>
            <Link
              href="https://github.com/Aierlanta/Cloudinary-photo"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t.footer.github}
            >
              <Github />
            </Link>
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
