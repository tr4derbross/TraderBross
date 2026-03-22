"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE_KEY, LOCALE_STORAGE_KEY, normalizeLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";

type I18nContextValue = {
  locale: Locale;
  dict: Dictionary;
  setLocale: (next: Locale) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const fromStorage = (() => {
      try {
        return window.localStorage.getItem(LOCALE_STORAGE_KEY);
      } catch {
        return null;
      }
    })();
    const fromBrowser = typeof navigator !== "undefined" ? navigator.language : null;
    const next = normalizeLocale(fromStorage || fromBrowser);
    setLocaleState(next);
  }, []);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // ignore
    }
    document.cookie = `${LOCALE_COOKIE_KEY}=${next}; path=/; max-age=31536000; samesite=lax`;
  };

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      dict: getDictionary(locale),
      setLocale,
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within LanguageProvider");
  }
  return ctx;
}

