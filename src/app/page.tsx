"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  type Theme,
  resolveSiteClientTheme,
  getClientSystemTheme,
  applyThemeToRoot,
  setSiteManualTheme,
  clearSiteManualTheme,
} from "@/lib/adminTheme";
import { useLocale, LocaleProvider } from "@/hooks/useLocale";

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

function HomeContent() {
  const { locale, t, toggleLocale } = useLocale();
  const [apiStatus, setApiStatus] = useState<APIStatus | null>(null);
  const [randomImageUrl, setRandomImageUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [baseUrl, setBaseUrl] = useState<string>("");
  const [imageLoading, setImageLoading] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const [isManualTheme, setIsManualTheme] = useState(false);

  // 生成完整的基础URL
  const generateBaseUrl = () => {
    if (typeof window === "undefined") return "";
    return `${window.location.protocol}//${window.location.host}`;
  };

  // 生成随机图片URL
  const generateRandomImageUrl = (baseUrl: string) => {
    return `${baseUrl}/api/random`;
  };

  useEffect(() => {
    // 初始化站点主题（半小时手动选择 / 否则跟随系统）
    const pref = resolveSiteClientTheme();
    setTheme(pref.theme);
    setIsManualTheme(pref.isManual);
    applyThemeToRoot(pref.theme);

    // 设置基础URL
    const currentBaseUrl = generateBaseUrl();
    setBaseUrl(currentBaseUrl);

    // 加载API状态
    fetch("/api/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setApiStatus(data.data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    // 生成随机图片URL
    if (currentBaseUrl) {
      setRandomImageUrl(generateRandomImageUrl(currentBaseUrl));
    }
  }, []);

  // 非手动模式下，跟随系统主题切换
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
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    }
    media.addListener(listener);
    return () => media.removeListener(listener);
  }, [isManualTheme]);

  const handleThemeToggle = () => {
    setIsManualTheme(true);
    setTheme((prev) => {
      const next: Theme = prev === "light" ? "dark" : "light";
      applyThemeToRoot(next);
      setSiteManualTheme(next); // 30分钟有效期在工具默认
      return next;
    });
  };

  // 可选：当用户长时间停留或决定回到系统模式时调用。此处不放按钮，仅保留API以便未来使用。
  const resetToSystemTheme = () => {
    setIsManualTheme(false);
    clearSiteManualTheme();
    const sys = getClientSystemTheme();
    setTheme(sys);
    applyThemeToRoot(sys);
  };

  const refreshRandomImage = () => {
    // 刷新整个页面来获取新的随机图片
    window.location.reload();
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--background)", color: "var(--foreground)" }}
    >
      {/* 导航栏 - 布鲁塔主义风格 */}
      <nav
        className="brutalist-border-thick"
        style={{ borderTop: "none", borderLeft: "none", borderRight: "none" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="brutalist-text-large">
              {locale === "zh" ? "随机图片API" : "RANDOM IMAGE API"}
            </h1>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Link
                href="/admin"
                className="brutalist-button text-xs sm:text-sm px-3 py-2 sm:px-4 sm:py-2"
              >
                {t.home.managementPanel}
              </Link>
              <Link
                href="/api/docs"
                className="brutalist-button text-xs sm:text-sm px-3 py-2 sm:px-4 sm:py-2"
              >
                {t.home.apiDocs}
              </Link>
              <button
                onClick={toggleLocale}
                title={t.home.toggleLanguage}
                aria-label={t.home.toggleLanguage}
                className="brutalist-button text-xs sm:text-sm px-3 py-2 sm:px-4 sm:py-2 min-w-[60px]"
              >
                {locale === "zh" ? "EN" : "中文"}
              </button>
              <button
                onClick={handleThemeToggle}
                title={t.home.toggleTheme}
                aria-label={t.home.toggleTheme}
                className="brutalist-button text-xs sm:text-sm px-3 py-2 sm:px-4 sm:py-2"
              >
                {theme === "dark" ? "☀" : "☾"}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* 主标题区域 - 布鲁塔主义风格 */}
        <div className="brutalist-box p-6 sm:p-12 mb-8 sm:mb-12 text-center">
          <h1 className="brutalist-text-huge mb-4 sm:mb-6">{t.home.title}</h1>
          <p
            className="brutalist-text-medium mb-6 sm:mb-8 max-w-4xl mx-auto leading-relaxed"
            style={{ fontWeight: 400, textTransform: "none" }}
          >
            {t.home.subtitle}
          </p>

          {/* API状态指示器 */}
          {!loading && apiStatus && (
            <div className="brutalist-box inline-flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-4">
              <div
                className="w-4 h-4 sm:w-6 sm:h-6 brutalist-border"
                style={{
                  background:
                    apiStatus.status === "healthy"
                      ? "var(--foreground)"
                      : "var(--background)",
                }}
              ></div>
              <span className="brutalist-text-medium text-xs sm:text-base">
                {t.home.apiStatus}:{" "}
                {apiStatus.status === "healthy"
                  ? t.home.statusHealthy
                  : t.home.statusPartial}
              </span>
            </div>
          )}
        </div>

        {/* 快速体验区域 - 布鲁塔主义网格 */}
        <div className="brutalist-grid grid-cols-1 lg:grid-cols-2 mb-8 sm:mb-12">
          {/* 左侧：随机图片预览 */}
          <div className="p-6 sm:p-8">
            <h2 className="brutalist-text-large mb-6">
              {t.home.randomImagePreview}
            </h2>
            <div className="brutalist-box p-4 mb-6 relative min-h-[300px] sm:min-h-[400px]">
              {randomImageUrl ? (
                <img
                  src={randomImageUrl}
                  alt={t.home.randomImagePreview}
                  className="w-full h-full object-cover"
                  style={{ minHeight: "250px" }}
                  onLoad={() => setImageLoading(false)}
                  onError={() => {
                    console.error("图片加载失败:", randomImageUrl);
                    setImageLoading(false);
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center min-h-[250px]">
                  <div className="text-center">
                    <p className="brutalist-text-medium mb-2">
                      {t.home.noImage}
                    </p>
                    <p className="text-sm" style={{ fontWeight: 400 }}>
                      {t.home.uploadFirst}
                    </p>
                  </div>
                </div>
              )}

              {imageLoading && (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ background: "var(--background)" }}
                >
                  <div className="text-center">
                    <div className="brutalist-box w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 animate-pulse"></div>
                    <p className="brutalist-text-medium">{t.common.loading}</p>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={refreshRandomImage}
              disabled={imageLoading}
              className="brutalist-button w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {imageLoading ? t.common.loading : t.home.refreshImage}
            </button>
          </div>

          {/* 右侧：API调用示例 */}
          <div className="p-6 sm:p-8">
            <h2 className="brutalist-text-large mb-6">
              {t.home.apiCallExample}
            </h2>
            <div className="space-y-6">
              <div>
                <label className="brutalist-text-medium block mb-3 text-sm sm:text-base">
                  {t.home.basicCall}
                </label>
                <div className="brutalist-box p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <code
                    className="flex-1 text-xs sm:text-sm break-all"
                    style={{ fontFamily: "monospace", fontWeight: 400 }}
                  >
                    GET {baseUrl}/api/random
                  </code>
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(`${baseUrl}/api/random`)
                    }
                    className="brutalist-button text-xs px-3 py-2 w-full sm:w-auto"
                    title={t.common.copy}
                  >
                    {t.common.copy}
                  </button>
                </div>
              </div>

              <div>
                <label className="brutalist-text-medium block mb-3 text-sm sm:text-base">
                  {t.home.htmlUsage}
                </label>
                <div className="brutalist-box p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <code
                    className="flex-1 text-xs sm:text-sm break-all"
                    style={{ fontFamily: "monospace", fontWeight: 400 }}
                  >
                    {`<img src="${baseUrl}/api/random" />`}
                  </code>
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(
                        `<img src="${baseUrl}/api/random" />`
                      )
                    }
                    className="brutalist-button text-xs px-3 py-2 w-full sm:w-auto"
                    title={t.common.copy}
                  >
                    {t.common.copy}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 功能特性 - 布鲁塔主义网格 */}
        <div className="brutalist-grid grid-cols-1 md:grid-cols-3 mb-8 sm:mb-12">
          <div className="p-6 sm:p-8">
            <div
              className="brutalist-box w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center mb-6"
              style={{ background: "var(--foreground)" }}
            >
              <span
                className="text-3xl sm:text-4xl"
                style={{ color: "var(--background)" }}
              >
                ⚡
              </span>
            </div>
            <h3 className="brutalist-text-large text-base sm:text-xl mb-4">
              {t.features.performance.title}
            </h3>
            <p
              className="text-sm sm:text-base"
              style={{ fontWeight: 400, textTransform: "none" }}
            >
              {t.features.performance.description}
            </p>
          </div>

          <div className="p-6 sm:p-8">
            <div
              className="brutalist-box w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center mb-6"
              style={{ background: "var(--foreground)" }}
            >
              <span
                className="text-3xl sm:text-4xl"
                style={{ color: "var(--background)" }}
              >
                ✓
              </span>
            </div>
            <h3 className="brutalist-text-large text-base sm:text-xl mb-4">
              {t.features.easyToUse.title}
            </h3>
            <p
              className="text-sm sm:text-base"
              style={{ fontWeight: 400, textTransform: "none" }}
            >
              {t.features.easyToUse.description}
            </p>
          </div>

          <div className="p-6 sm:p-8">
            <div
              className="brutalist-box w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center mb-6"
              style={{ background: "var(--foreground)" }}
            >
              <span
                className="text-3xl sm:text-4xl"
                style={{ color: "var(--background)" }}
              >
                ⚙
              </span>
            </div>
            <h3 className="brutalist-text-large text-base sm:text-xl mb-4">
              {t.features.flexible.title}
            </h3>
            <p
              className="text-sm sm:text-base"
              style={{ fontWeight: 400, textTransform: "none" }}
            >
              {t.features.flexible.description}
            </p>
          </div>
        </div>

        {/* 统计信息 - 布鲁塔主义网格 */}
        {apiStatus && (
          <div className="brutalist-box p-6 sm:p-12 text-center">
            <h2 className="brutalist-text-large mb-8 sm:mb-12">
              {t.stats.title}
            </h2>
            <div className="brutalist-grid grid-cols-2 lg:grid-cols-4">
              <div className="p-6 sm:p-8">
                <div className="brutalist-text-huge text-3xl sm:text-5xl mb-2 sm:mb-4">
                  {apiStatus.stats.totalImages}
                </div>
                <div className="brutalist-text-medium text-xs sm:text-sm">
                  {t.stats.totalImages}
                </div>
              </div>
              <div className="p-6 sm:p-8">
                <div className="brutalist-text-huge text-3xl sm:text-5xl mb-2 sm:mb-4">
                  {apiStatus.stats.totalGroups}
                </div>
                <div className="brutalist-text-medium text-xs sm:text-sm">
                  {t.stats.imageGroups}
                </div>
              </div>
              <div className="p-6 sm:p-8">
                <div className="brutalist-text-huge text-3xl sm:text-5xl mb-2 sm:mb-4">
                  {apiStatus.services.api.enabled
                    ? t.stats.enabled
                    : t.stats.disabled}
                </div>
                <div className="brutalist-text-medium text-xs sm:text-sm">
                  {t.stats.apiStatus}
                </div>
              </div>
              <div className="p-6 sm:p-8">
                <div className="brutalist-text-huge text-3xl sm:text-5xl mb-2 sm:mb-4">
                  24/7
                </div>
                <div className="brutalist-text-medium text-xs sm:text-sm">
                  {t.stats.serviceTime}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 页脚 - 布鲁塔主义风格 */}
      <footer
        className="brutalist-border-thick mt-8 sm:mt-16"
        style={{
          borderBottom: "none",
          borderLeft: "none",
          borderRight: "none",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="text-center">
            <p className="brutalist-text-medium text-xs sm:text-sm mb-2">
              &copy; {new Date().getFullYear()} {t.footer.copyright}
            </p>
            <p className="text-xs sm:text-sm" style={{ fontWeight: 400 }}>
              {t.footer.author} |{" "}
              <a
                href="https://github.com/Aierlanta/Cloudinary-photo"
                target="_blank"
                rel="noopener noreferrer"
                className="brutalist-text-medium underline hover:no-underline"
                style={{ textDecoration: "underline" }}
              >
                {t.footer.github}
              </a>
            </p>
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
