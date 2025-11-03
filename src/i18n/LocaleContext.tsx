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
  const [locale, setLocale] = useState<Locale>(() => getCurrentLocale());
  const [t, setT] = useState<Translations>(() => getTranslations(getCurrentLocale()));

  const changeLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    setT(getTranslations(newLocale));
    saveLocale(newLocale);
  };

  const toggleLocale = () => {
    const newLocale: Locale = locale === 'zh' ? 'en' : 'zh';
    changeLocale(newLocale);
  };

  return (
    <LocaleContext.Provider value={{ locale, t, changeLocale, toggleLocale }}>
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
