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
  // 优化：使用单一 state 对象，只调用一次 getCurrentLocale，避免重复的 localStorage 读取
  const [state, setState] = useState<{ locale: Locale; t: Translations }>(() => {
    const currentLocale = getCurrentLocale();
    return {
      locale: currentLocale,
      t: getTranslations(currentLocale),
    };
  });

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
