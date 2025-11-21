'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getCurrentLocale, getTranslations, saveLocale, type Locale, type Translations } from '@/i18n';

interface LocaleContextType {
  locale: Locale;
  t: Translations;
  changeLocale: (newLocale: Locale) => void;
  toggleLocale: () => void;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export function LocaleProvider({ children }: { children: ReactNode }) {
  // ❗ SSR 阶段固定英文，避免 hydration mismatch
  const [state, setState] = useState<{ locale: Locale; t: Translations }>({
    locale: 'en',
    t: getTranslations('en'),
  });

  // ❗ hydration 之后才切换到真实语言
  useEffect(() => {
    const realLocale = getCurrentLocale(); // localStorage + 浏览器语言

    setState({
      locale: realLocale,
      t: getTranslations(realLocale),
    });
  }, []);

  const changeLocale = (newLocale: Locale) => {
    setState({
      locale: newLocale,
      t: getTranslations(newLocale),
    });
    saveLocale(newLocale);
  };

  const toggleLocale = () => {
    const newLocale: Locale = state.locale === 'zh' ? 'en' : 'zh';
    changeLocale(newLocale);
  };

  return (
    <LocaleContext.Provider value={{ locale: state.locale, t: state.t, changeLocale, toggleLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (context === undefined) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
}
