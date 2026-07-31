"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  Code2,
  Copy,
  FileJson,
  Globe2,
  Image as ImageIcon,
  Info,
  KeyRound,
  Languages,
  ListTree,
  Moon,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Terminal,
} from "lucide-react";
import { useLocale, LocaleProvider } from "@/hooks/useLocale";
import { useTheme } from "@/hooks/useTheme";
import { OrnateIcon, type OrnateIconTone } from "@/components/ui/ornate-icon";
import {
  applyThemeToRoot,
  resolveClientTheme,
  resolveSiteClientTheme,
  setSiteManualTheme,
  type Theme,
} from "@/lib/adminTheme";
import { cn } from "@/lib/utils";
import styles from "./api-docs.module.css";

const docsSectionIds = [
  "quick-start",
  "endpoints",
  "examples",
  "parameters",
  "transparency",
  "response",
  "notices",
] as const;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.48,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
};

interface SectionHeadingProps {
  icon: LucideIcon;
  tone: OrnateIconTone;
  title: string;
  eyebrow?: string;
}

function SectionHeading({ icon, tone, title, eyebrow }: SectionHeadingProps) {
  return (
    <div className={styles.sectionHeading}>
      <OrnateIcon icon={icon} tone={tone} size="sm" />
      <div className={styles.sectionHeadingCopy}>
        {eyebrow && <p className={styles.sectionEyebrow}>{eyebrow}</p>}
        <h2 className={styles.sectionTitle}>{title}</h2>
      </div>
    </div>
  );
}

function PaperCard({
  children,
  className,
  id,
  tone = "paper",
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  tone?: "paper" | "pink" | "lavender" | "mint" | "gold";
}) {
  return (
    <motion.section
      id={id}
      variants={itemVariants}
      data-tone={tone}
      className={cn(styles.paperCard, className)}
    >
      {children}
    </motion.section>
  );
}

function EndpointRow({
  path,
  description,
  tone,
}: {
  path: string;
  description: string;
  tone: "mint" | "lavender";
}) {
  return (
    <div className={styles.endpointRow}>
      <span className={cn(styles.endpointMethod, styles[`endpointMethod${tone}`])}>
        GET
      </span>
      <code className={styles.endpointPath}>{path}</code>
      <span className={styles.endpointDescription}>{description}</span>
      <span className={styles.endpointArrow} aria-hidden="true">
        ›
      </span>
    </div>
  );
}

function APIDocsContent() {
  const { t, locale, toggleLocale } = useLocale();
  const isLight = useTheme();
  const [baseUrl, setBaseUrl] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>(docsSectionIds[0]);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setBaseUrl(`${window.location.protocol}//${window.location.host}`);
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const getHashSection = () => {
      const hash = window.location.hash.replace(/^#/, "");
      return docsSectionIds.includes(hash as (typeof docsSectionIds)[number]) ? hash : null;
    };

    const updateActiveSection = () => {
      const marker = window.scrollY + Math.min(220, window.innerHeight * 0.32);
      let currentSection: (typeof docsSectionIds)[number] = docsSectionIds[0];

      for (const sectionId of docsSectionIds) {
        const section = document.getElementById(sectionId);
        if (section && section.getBoundingClientRect().top + window.scrollY <= marker) {
          currentSection = sectionId;
        }
      }

      setActiveSection(currentSection);
    };

    const handleHashChange = () => {
      const hashSection = getHashSection();
      if (hashSection) setActiveSection(hashSection);
    };

    handleHashChange();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);
    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const adminPreference = resolveClientTheme();
    const sitePreference = resolveSiteClientTheme();
    if (adminPreference.isManual || sitePreference.isManual || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const applySystemTheme = (matches: boolean) => {
      applyThemeToRoot(matches ? "dark" : "light");
    };
    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      applySystemTheme(event.matches);
    };

    applySystemTheme(mediaQuery.matches);
    mediaQuery.addEventListener?.("change", handleSystemThemeChange);
    return () => mediaQuery.removeEventListener?.("change", handleSystemThemeChange);
  }, []);

  const handleThemeToggle = () => {
    const nextTheme: Theme = isLight ? "dark" : "light";
    applyThemeToRoot(nextTheme);
    setSiteManualTheme(nextTheme);
  };

  const handleTocClick = (event: MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    event.preventDefault();
    const section = document.getElementById(sectionId);
    if (!section) return;

    setActiveSection(sectionId);
    window.history.pushState(null, "", `#${sectionId}`);
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.warn("复制失败:", error);
    }
  };

  const CopyButton = ({ text, id }: { text: string; id: string }) => {
    const isCopied = copied === id;

    return (
      <button
        type="button"
        onClick={() => copyToClipboard(text, id)}
        className={cn(styles.copyButton, isCopied && styles.copyButtonCopied)}
        title={t.common.copy}
        aria-label={t.common.copy}
      >
        <OrnateIcon
          icon={isCopied ? CheckCircle2 : Copy}
          tone={isCopied ? "mint" : "lavender"}
          size="sm"
          surface={isLight ? "light" : "dark"}
        />
        <span className={styles.copyButtonLabel}>{t.common.copy}</span>
      </button>
    );
  };

  const UrlLine = ({
    id,
    url,
    label,
    accent,
  }: {
    id: string;
    url: string;
    label?: string;
    accent?: string;
  }) => {
    const fullUrl = `${baseUrl}${url}`;

    return (
      <div className={styles.urlLine}>
        {label && <span className={styles.urlLabel}>{label}</span>}
        <code className={styles.urlCode}>
          {baseUrl}
          <span className={accent ? styles.urlAccent : undefined}>
            {url}
          </span>
        </code>
        {baseUrl && <CopyButton text={fullUrl} id={id} />}
      </div>
    );
  };

  const ExampleUrl = ({
    id,
    label,
    url,
    icon,
  }: {
    id: string;
    label: string;
    url: string;
    icon?: LucideIcon;
  }) => {
    const Icon = icon ?? Code2;

    return (
      <div className={styles.exampleItem}>
        <p className={styles.exampleLabel}>
          <OrnateIcon icon={Icon} tone="lavender" size="sm" surface={isLight ? "light" : "dark"} />
          {label}
        </p>
        <UrlLine id={id} url={url} />
      </div>
    );
  };

  const tocItems: Array<{
    href: string;
    label: string;
    icon: LucideIcon;
  }> = [
    { href: "#quick-start", label: t.apiDocs.title, icon: Sparkles },
    { href: "#endpoints", label: t.apiDocs.apiAccessLinks, icon: Server },
    { href: "#examples", label: t.apiDocs.usageExamples, icon: Terminal },
    { href: "#parameters", label: t.apiDocs.orientationAndSize, icon: SlidersHorizontal },
    { href: "#transparency", label: t.apiDocs.transparencyAdjustment, icon: ImageIcon },
    { href: "#response", label: t.apiDocs.responseFormat, icon: FileJson },
    { href: "#notices", label: t.apiDocs.notice, icon: AlertTriangle },
  ];

  return (
    <div className={styles.page} data-theme={isLight ? "light" : "dark"}>
      <div className={styles.backgroundDecor} aria-hidden="true">
        <span className={styles.decorPink} />
        <span className={styles.decorLavender} />
        <span className={styles.decorGold} />
      </div>

      <motion.nav
        initial={{ y: -28, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
        className={styles.nav}
      >
        <div className={styles.navInner}>
          <Link href="/" className={styles.brand}>
            <span className={styles.logoFrame}>
              <Image
                src="/icon.png"
                alt=""
                width={54}
                height={54}
                className={styles.logoImage}
                priority
              />
            </span>
            <span className={styles.brandCopy}>
              <span className={styles.brandName}>{t.home.brandName}</span>
              <span className={styles.brandCaption}>{t.apiDocs.title}</span>
            </span>
          </Link>

          <div className={styles.navActions}>
            <Link href="/" className={styles.backLink}>
              <OrnateIcon icon={ArrowLeft} tone="lavender" size="sm" surface={isLight ? "light" : "dark"} />
              <span>{t.common.back}</span>
            </Link>
            <button
              type="button"
              onClick={toggleLocale}
              className={styles.localeButton}
              aria-label={t.home.toggleLanguage}
              title={t.home.toggleLanguage}
            >
              <OrnateIcon icon={Languages} tone="mint" size="sm" surface={isLight ? "light" : "dark"} />
              <span className={styles.localeLabel}>{locale.toUpperCase()}</span>
            </button>
            <button
              type="button"
              onClick={handleThemeToggle}
              className={styles.themeButton}
              aria-label={t.home.toggleTheme}
              title={t.home.toggleTheme}
            >
              <OrnateIcon
                icon={isLight ? Moon : Sun}
                tone="amber"
                size="sm"
                surface={isLight ? "light" : "dark"}
              />
              <span className={styles.themeLabel}>{isLight ? t.admin.dark : t.admin.light}</span>
            </button>
          </div>
        </div>
      </motion.nav>

      <main className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.tocCard}>
            <div className={styles.tocHeader}>
              <OrnateIcon icon={ListTree} tone="pink" size="sm" />
              <div className={styles.tocHeaderText}>
                <span>{t.apiDocs.apiAccessLinks}</span>
                <small>{t.apiDocs.title}</small>
              </div>
            </div>

            <nav className={styles.tocNav} aria-label={t.apiDocs.title}>
              {tocItems.map((item) => {
                const sectionId = item.href.slice(1);
                const isActive = activeSection === sectionId;

                return (
                  <a
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "location" : undefined}
                    onClick={(event) => handleTocClick(event, sectionId)}
                    className={cn(styles.tocLink, isActive && styles.tocLinkActive)}
                  >
                    <OrnateIcon
                      icon={item.icon}
                      tone={isActive ? "pink" : "lavender"}
                      size="sm"
                      surface={isLight ? "light" : "dark"}
                      className={styles.tocLinkIcon}
                    />
                    <span>{item.label}</span>
                  </a>
                );
              })}
            </nav>

            <div className={styles.tocFooter}>
              <div className={styles.tocSticker}>
                <OrnateIcon icon={Globe2} tone="mint" size="sm" />
                <span>HTTP</span>
              </div>
              <p>{t.apiDocs.subtitle}</p>
            </div>
          </div>
        </aside>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className={styles.content}
        >
          <motion.section id="quick-start" variants={itemVariants} className={styles.heroPaper}>
            <div className={styles.heroCopy}>
              <p className={styles.heroKicker}>
                <span className={styles.heroKickerIcon}>
                  <OrnateIcon icon={Sparkles} tone="pink" size="sm" surface={isLight ? "light" : "dark"} />
                </span>
                {t.apiDocs.subtitle}
              </p>
              <h1 className={styles.heroTitle}>{t.apiDocs.title}</h1>
              <p className={styles.heroSubtitle}>{t.apiDocs.subtitle}</p>
              <div className={styles.heroMeta}>
                <span className={styles.heroMetaItem}>
                  <OrnateIcon icon={CheckCircle2} tone="mint" size="sm" surface={isLight ? "light" : "dark"} />
                  {t.apiDocs.redirectMode}
                </span>
                <span className={styles.heroMetaItem}>
                  <OrnateIcon icon={CheckCircle2} tone="mint" size="sm" surface={isLight ? "light" : "dark"} />
                  {t.apiDocs.directResponseMode}
                </span>
              </div>
            </div>
            <div className={styles.heroStamp} aria-hidden="true">
              <OrnateIcon icon={Code2} tone="lavender" size="lg" />
              <span className={styles.heroStampText}>API</span>
              <span className={styles.heroStampSmall}>DOCS</span>
            </div>
          </motion.section>

          <PaperCard id="endpoints" tone="mint">
            <SectionHeading
              icon={Server}
              tone="mint"
              eyebrow={t.apiDocs.baseApiAddress}
              title={t.apiDocs.apiAccessLinks}
            />

            <div className={styles.basePanel}>
              <div className={styles.basePanelHeader}>
                <span className={styles.basePanelLabel}>{t.apiDocs.baseApiAddress}</span>
                <span className={styles.liveIndicator}>
                  <span aria-hidden="true" />
                  {t.apiDocs.successResponse}
                </span>
              </div>
              <UrlLine id="base-url" url="/api/random" />
            </div>

            <div className={styles.endpointList}>
              <EndpointRow
                path="/api/random"
                description={t.apiDocs.redirectMode}
                tone="mint"
              />
              <EndpointRow
                path="/api/response"
                description={t.apiDocs.directResponseMode}
                tone="lavender"
              />
            </div>
          </PaperCard>

          <PaperCard id="auth" tone="lavender" className={styles.authCard}>
            <SectionHeading
              icon={KeyRound}
              tone="lavender"
              eyebrow={t.apiDocs.withApiKey}
              title={t.apiDocs.apiKeyAuth}
            />
            <div className={styles.authBody}>
              <p className={styles.authDescription}>{t.apiDocs.apiKeyAuthDesc}</p>
              <UrlLine id="auth-url" url="/api/random?key=your-api-key" accent="pink" />
              <p className={styles.authTip}>
                <OrnateIcon icon={Info} tone="amber" size="sm" surface={isLight ? "light" : "dark"} />
                {t.apiDocs.apiKeyConfigTip}
              </p>
            </div>
          </PaperCard>

          <PaperCard id="examples" tone="pink">
            <SectionHeading
              icon={Terminal}
              tone="pink"
              eyebrow={t.apiDocs.usageExamples}
              title={t.apiDocs.usageExamples}
            />

            <div className={styles.exampleModes}>
              <div className={styles.examplePanel}>
                <div className={styles.exampleHeading}>
                  <span className={styles.exampleKicker}>GET</span>
                  <h3 className={styles.exampleTitle}>{t.apiDocs.redirectMode}</h3>
                </div>
                <UrlLine id="ex-redirect" url="/api/random" />
              </div>
              <div className={cn(styles.examplePanel, styles.examplePanelLavender)}>
                <div className={styles.exampleHeading}>
                  <span className={cn(styles.exampleKicker, styles.exampleKickerLavender)}>
                    GET
                  </span>
                  <h3 className={styles.exampleTitle}>{t.apiDocs.directResponseMode}</h3>
                </div>
                <UrlLine id="ex-json" url="/api/response" />
              </div>
            </div>

            <div className={styles.smallExampleGrid}>
              <ExampleUrl
                id="ex-r18"
                label={t.apiDocs.withParamsR18}
                url="/api/random?r18=true"
                icon={ShieldCheck}
              />
              <ExampleUrl
                id="ex-sfw"
                label={t.apiDocs.withParamsSfw}
                url="/api/random?sfw=true"
                icon={CheckCircle2}
              />
            </div>
          </PaperCard>

          <PaperCard id="parameters" tone="lavender">
            <SectionHeading
              icon={ImageIcon}
              tone="lavender"
              eyebrow={t.apiDocs.outputControlTitle}
              title={t.apiDocs.orientationAndSize}
            />

            <div className={styles.parameterStack}>
              <div className={styles.parameterBlock}>
                <div className={styles.parameterTitleRow}>
                  <OrnateIcon icon={Globe2} tone="mint" size="sm" />
                  <h3 className={styles.parameterTitle}>{t.apiDocs.orientationTitle}</h3>
                </div>
                <p className={styles.parameterText}>{t.apiDocs.orientationDesc}</p>
                <ul className={styles.parameterList}>
                  <li>`orientation` = `landscape` | `portrait` | `square`</li>
                  <li>{t.apiDocs.orientationNote}</li>
                </ul>
                <div className={styles.exampleGrid}>
                  <ExampleUrl
                    id="ori-random"
                    label={t.apiDocs.exampleLandscapeRandom}
                    url="/api/random?orientation=landscape"
                  />
                  <ExampleUrl
                    id="ori-response"
                    label={t.apiDocs.exampleLandscapeResponse}
                    url="/api/response?orientation=landscape"
                  />
                </div>
              </div>

              <div className={styles.parameterBlock}>
                <div className={styles.parameterTitleRow}>
                  <OrnateIcon icon={SlidersHorizontal} tone="pink" size="sm" />
                  <h3 className={styles.parameterTitle}>{t.apiDocs.resizeTitle}</h3>
                </div>
                <p className={styles.parameterText}>{t.apiDocs.resizeDesc}</p>
                <ul className={styles.parameterList}>
                  <li>`width` / `height` {t.apiDocs.resizeWidthHeight}</li>
                  <li>`fit` = `cover` | `contain` ({t.apiDocs.resizeFitDefault})</li>
                </ul>
                <div className={styles.exampleGrid}>
                  <ExampleUrl
                    id="resize-cover"
                    label={t.apiDocs.exampleResizeCover}
                    url="/api/response?width=800&height=600&fit=cover"
                  />
                  <ExampleUrl
                    id="resize-contain"
                    label={t.apiDocs.exampleResizeContain}
                    url="/api/response?width=800&height=600&fit=contain"
                  />
                </div>
              </div>

              <div className={styles.parameterBlock}>
                <div className={styles.parameterTitleRow}>
                  <OrnateIcon icon={FileJson} tone="amber" size="sm" />
                  <h3 className={styles.parameterTitle}>{t.apiDocs.outputControlTitle}</h3>
                </div>
                <p className={styles.parameterText}>{t.apiDocs.outputControlDesc}</p>
                <ul className={styles.parameterList}>
                  <li>{t.apiDocs.outputFormatNote}</li>
                  <li>{t.apiDocs.outputQualityNote}</li>
                  <li>{t.apiDocs.outputDefaultWebpNote}</li>
                  <li>{t.apiDocs.outputOriginNote}</li>
                </ul>
                <div className={styles.exampleGrid}>
                  <ExampleUrl
                    id="output-webp"
                    label={t.apiDocs.exampleFormatWebp}
                    url="/api/random?format=webp"
                  />
                  <ExampleUrl
                    id="output-quality"
                    label={t.apiDocs.exampleQuality80}
                    url="/api/random?quality=0.8"
                  />
                  <ExampleUrl
                    id="output-origin-random"
                    label={t.apiDocs.exampleOriginRandom}
                    url="/api/random?origin=true"
                  />
                  <ExampleUrl
                    id="output-origin-response"
                    label={t.apiDocs.exampleOriginResponse}
                    url="/api/response?origin=true"
                  />
                </div>
              </div>

              <div className={styles.parameterBlock}>
                <div className={styles.parameterTitleRow}>
                  <OrnateIcon icon={Clock} tone="amber" size="sm" />
                  <h3 className={styles.parameterTitle}>{t.apiDocs.timeWeightingTitle}</h3>
                </div>
                <p className={styles.parameterText}>{t.apiDocs.timeWeightingDesc}</p>
                <p className={styles.parameterHint}>{t.apiDocs.timeWeightingEnableNote}</p>
                <ul className={styles.parameterList}>
                  <li>{t.apiDocs.timeWeightingRollingWindow}</li>
                  <li>{t.apiDocs.timeWeightingFixedWindow}</li>
                  <li>{t.apiDocs.timeWeightingWeight}</li>
                  <li>{t.apiDocs.timeWeightingFormula}</li>
                  <li>{t.apiDocs.timeWeightingProbabilityNote}</li>
                  <li>{t.apiDocs.timeWeightingInsideRandom}</li>
                  <li>{t.apiDocs.timeWeightingErrors}</li>
                </ul>
                <div className={styles.timeExamples}>
                  <ExampleUrl
                    id="time-weight-random"
                    label={t.apiDocs.exampleTimeWindowRandom}
                    url="/api/random?timeWindow=7d&timeWeight=3"
                    icon={Clock}
                  />
                  <ExampleUrl
                    id="time-weight-response"
                    label={t.apiDocs.exampleTimeWindowResponse}
                    url="/api/response?timeWindow=24h&timeWeight=5"
                    icon={Clock}
                  />
                  <ExampleUrl
                    id="time-weight-fixed"
                    label={t.apiDocs.exampleFixedTimeWindow}
                    url="/api/random?timeStart=2026-05-01T00%3A00%3A00&timeEnd=2026-05-31T23%3A59%3A59&timeZone=Asia%2FShanghai&timeWeight=4"
                    icon={Clock}
                  />
                </div>
              </div>
            </div>
          </PaperCard>

          <PaperCard id="transparency" tone="mint">
            <SectionHeading
              icon={SlidersHorizontal}
              tone="mint"
              eyebrow={t.apiDocs.parameterDescription}
              title={t.apiDocs.transparencyAdjustment}
            />
            <p className={styles.sectionLead}>{t.apiDocs.transparencyIntro}</p>

            <div className={styles.parameterTable}>
              <div className={styles.parameterTableRow}>
                <code className={styles.parameterName}>opacity</code>
                <div>
                  <p className={styles.parameterDescription}>{t.apiDocs.opacityDesc}</p>
                  <p className={styles.parameterDetail}>{t.apiDocs.opacityDetails}</p>
                </div>
              </div>
              <div className={styles.parameterTableRow}>
                <code className={cn(styles.parameterName, styles.parameterNameLavender)}>
                  bgColor
                </code>
                <div>
                  <p className={styles.parameterDescription}>{t.apiDocs.bgColorDesc}</p>
                  <p className={styles.parameterDetail}>white | black | #hex</p>
                </div>
              </div>
            </div>

            <h3 className={styles.subsectionTitle}>{t.apiDocs.examples}</h3>
            <div className={styles.exampleStack}>
              <ExampleUrl
                id="op-1"
                label={t.apiDocs.opacity50White}
                url="/api/response?opacity=0.5&bgColor=white"
              />
              <ExampleUrl
                id="op-2"
                label={t.apiDocs.opacity80Black}
                url="/api/response?opacity=0.8&bgColor=black"
              />
              <ExampleUrl
                id="op-3"
                label={t.apiDocs.opacity30Custom}
                url="/api/response?opacity=0.3&bgColor=ff6b6b"
              />
            </div>
          </PaperCard>

          <PaperCard id="response" tone="gold">
            <SectionHeading
              icon={FileJson}
              tone="amber"
              eyebrow={t.apiDocs.responseHeaders}
              title={t.apiDocs.responseFormat}
            />

            <div className={styles.responseStack}>
              <div>
                <div className={styles.responseTitleRow}>
                  <span className={cn(styles.statusBadge, styles.statusBadgeSuccess)}>200 OK</span>
                  <h3 className={styles.responseTitle}>{t.apiDocs.successResponse}</h3>
                </div>
                <p className={styles.responseDescription}>{t.apiDocs.successResponseDesc}</p>
                <div className={styles.codePanel}>
                  <div className={styles.codePanelHeader}>
                    <span>{t.apiDocs.responseHeaders}</span>
                    {baseUrl && (
                      <CopyButton
                        text={`${baseUrl}/api/response`}
                        id="response-code"
                      />
                    )}
                  </div>
                  <div className={styles.codeContent}>
                    <p>
                      <span className={styles.codeKey}>Content-Type</span>
                      <span className={styles.codePunctuation}>: </span>
                      image/jpeg, image/png, image/webp
                    </p>
                    <div className={styles.codeDivider} />
                    <p className={styles.codeComment}>{"// Headers"}</p>
                    <p>
                      <span className={styles.codeKey}>X-Image-Id</span>
                      <span className={styles.codePunctuation}>: </span>...
                    </p>
                    <p>
                      <span className={styles.codeKey}>X-Image-Filename</span>
                      <span className={styles.codePunctuation}>: </span>...
                    </p>
                    <p>
                      <span className={styles.codeKey}>X-Response-Time</span>
                      <span className={styles.codePunctuation}>: </span>...ms
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <div className={styles.responseTitleRow}>
                  <span className={cn(styles.statusBadge, styles.statusBadgeError)}>4xx / 5xx</span>
                  <h3 className={styles.responseTitle}>{t.apiDocs.errorResponse}</h3>
                </div>
                <div className={styles.errorGrid}>
                  {[
                    { code: 400, label: t.apiDocs.badRequest, desc: t.apiDocs.badRequestDesc },
                    { code: 403, label: t.apiDocs.forbidden, desc: t.apiDocs.forbiddenDesc },
                    { code: 404, label: t.apiDocs.notFound, desc: t.apiDocs.notFoundDesc },
                    { code: 429, label: t.apiDocs.tooManyRequests, desc: t.apiDocs.tooManyRequestsDesc },
                    { code: 500, label: t.apiDocs.internalError, desc: t.apiDocs.internalErrorDesc },
                  ].map((error) => (
                    <div key={error.code} className={styles.errorItem}>
                      <span className={styles.errorCode}>{error.code}</span>
                      <span>
                        <strong>{error.label}</strong>
                        <small>{error.desc}</small>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </PaperCard>

          <PaperCard id="notices" tone="gold">
            <SectionHeading
              icon={AlertTriangle}
              tone="amber"
              eyebrow={t.apiDocs.notice}
              title={t.apiDocs.notice}
            />
            <div className={styles.noticeList}>
              <div className={styles.noticeItem}>
                <span className={styles.noticeLabel}>{t.apiDocs.rateLimit}</span>
                <span className={styles.noticeDescription}>{t.apiDocs.rateLimitDesc}</span>
              </div>
              <div className={styles.noticeItem}>
                <span className={cn(styles.noticeLabel, styles.noticeLabelLavender)}>{t.apiDocs.cache}</span>
                <span className={styles.noticeDescription}>{t.apiDocs.cacheDesc}</span>
              </div>
              <div className={styles.noticeItem}>
                <span className={cn(styles.noticeLabel, styles.noticeLabelMint)}>{t.apiDocs.https}</span>
                <span className={styles.noticeDescription}>{t.apiDocs.httpsDesc}</span>
              </div>
            </div>
          </PaperCard>
        </motion.div>
      </main>
    </div>
  );
}

export default function APIDocsPage() {
  return (
    <LocaleProvider>
      <APIDocsContent />
    </LocaleProvider>
  );
}
