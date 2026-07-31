"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Heart,
  Image as ImageIcon,
} from "lucide-react";

import { LocaleProvider, useLocale } from "@/hooks/useLocale";
import {
  applyThemeToRoot,
  resolveSiteClientTheme,
  setSiteManualTheme,
  type Theme,
} from "@/lib/adminTheme";
import { cn } from "@/lib/utils";
import { OrnateIcon } from "@/components/ui/ornate-icon";

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
  return <span className={cn(styles.mark, styles.markSpark, className)} aria-hidden />;
}

function Sakura({ className }: { className?: string }) {
  return <span className={cn(styles.mark, styles.markFlower, className)} aria-hidden />;
}

function DoodleHeart({ className }: { className?: string }) {
  return <span className={cn(styles.mark, styles.markHeart, className)} aria-hidden />;
}

function DoodleStar({ className }: { className?: string }) {
  return <span className={cn(styles.mark, styles.markStar, className)} aria-hidden />;
}

function RibbonBow({ className }: { className?: string }) {
  return <span className={cn(styles.bowBadge, className)} aria-hidden />;
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
        <OrnateIcon icon={ImageIcon} tone="pink" size="md" surface="light" className={styles.emptyIcon} />
        <Sakura className={styles.emptyFlower} />
        <OrnateIcon icon={Heart} tone="pink" size="sm" surface="light" className={styles.emptyHeart} />
      </div>
      <p className={styles.emptyTitle}>{title}</p>
      <p className={styles.emptyHint}>{hint}</p>
    </div>
  );
}

interface StatCardProps {
  className: string;
  artworkClass: string;
  value: string;
  label: string;
  decoration: ReactNode;
}

function StatCard({
  className,
  artworkClass,
  value,
  label,
  decoration,
}: StatCardProps) {
  return (
    <div className={cn(styles.statCard, className)}>
      {decoration}
      <span className={cn(styles.statArtwork, artworkClass)} aria-hidden="true" />
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
              className={cn(styles.navButton, styles.artNavButton, styles.docsButton)}
              aria-label={t.home.apiDocs}
            >
              <span className={cn(styles.navArtwork, styles.docsArtwork)} aria-hidden />
              <span className={styles.navLabel}>{t.home.apiDocs}</span>
            </Link>
            <Link
              href="https://github.com/Aierlanta/Cloudinary-photo"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(styles.navButton, styles.artNavButton, styles.githubButton)}
              aria-label="GitHub"
            >
              <span className={cn(styles.navArtwork, styles.githubArtwork)} aria-hidden />
              <span className={styles.navLabel}>GitHub</span>
            </Link>
            <Link
              href="/admin"
              className={cn(styles.navButton, styles.adminButton)}
            >
              <span className={cn(styles.navArtwork, styles.adminArtwork)} aria-hidden />
              <span className={styles.navLabel}>{t.home.managementPanel}</span>
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
                  />
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
                artworkClass={styles.statArtworkPicture}
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
                artworkClass={styles.statArtworkAlbum}
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
                artworkClass={styles.statArtworkShield}
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
              className={styles.footerControlButton}
            >
              <span className={cn(styles.footerArtwork, styles.footerLanguageArtwork)} aria-hidden />
            </button>
            <button
              type="button"
              onClick={handleThemeToggle}
              aria-label={t.home.toggleTheme}
              className={styles.footerControlButton}
            >
              <span
                className={cn(
                  styles.footerArtwork,
                  theme === "dark" ? styles.footerSunArtwork : styles.footerMoonArtwork,
                )}
                aria-hidden
              />
            </button>
            <Link
              href="https://github.com/Aierlanta/Cloudinary-photo"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t.footer.github}
              className={styles.footerControlButton}
            >
              <span className={cn(styles.footerArtwork, styles.footerGithubArtwork)} aria-hidden />
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
