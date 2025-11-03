import { zh } from './locales/zh';
import { en } from './locales/en';
import type { Locale, Translations } from './types';

const LOCALE_STORAGE_KEY = 'app-locale';

// 所有支持的语言
export const locales = {
  zh,
  en,
} as const;

/**
 * 检测浏览器语言并返回对应的 locale
 * 中文/简体中文/繁体中文 -> zh
 * 其他 -> en
 */
export function detectBrowserLocale(): Locale {
  if (typeof window === 'undefined') {
    return 'en';
  }

  const browserLang = navigator.language.toLowerCase();
  
  // 检测是否为中文（zh, zh-cn, zh-tw, zh-hk 等）
  if (browserLang.startsWith('zh')) {
    return 'zh';
  }

  return 'en';
}

/**
 * 从 localStorage 获取保存的语言偏好
 */
export function getSavedLocale(): Locale | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved === 'zh' || saved === 'en') {
      return saved;
    }
  } catch (error) {
    console.error('Failed to get saved locale:', error);
  }

  return null;
}

/**
 * 保存语言偏好到 localStorage
 */
export function saveLocale(locale: Locale): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch (error) {
    console.error('Failed to save locale:', error);
  }
}

/**
 * 获取当前应该使用的 locale
 * 优先使用保存的偏好，否则使用浏览器语言
 */
export function getCurrentLocale(): Locale {
  const saved = getSavedLocale();
  if (saved) {
    return saved;
  }

  return detectBrowserLocale();
}

/**
 * 获取翻译文本
 */
export function getTranslations(locale: Locale): Translations {
  return locales[locale];
}

// 导出类型
export type { Locale, Translations };
