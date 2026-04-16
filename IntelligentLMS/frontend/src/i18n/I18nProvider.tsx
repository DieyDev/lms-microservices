import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { translations, type Lang, type TranslationKey } from './translations';

type I18nContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey, fallback?: string) => string;
};

const STORAGE_KEY = 'lms-lang';

const I18nContext = createContext<I18nContextValue | null>(null);

function getInitialLang(): Lang {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'vi' || saved === 'en') return saved;
  return 'vi';
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => getInitialLang());

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.setAttribute('lang', next);
  }, []);

  const t = useCallback(
    (key: TranslationKey, fallback?: string) => {
      return translations[lang][key] ?? fallback ?? key;
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

