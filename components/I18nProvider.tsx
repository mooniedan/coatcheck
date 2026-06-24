'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  type Locale,
  type TFunction,
  DEFAULT_LOCALE,
  isLocale,
  localeFromBrowser,
  makeT,
} from '@/lib/i18n';
import type { MeResponse } from '@/lib/types';

interface I18nCtx {
  locale: Locale;
  t: TFunction;
  setLocale: (l: Locale) => void;
}

const I18nContext = createContext<I18nCtx>({
  locale: DEFAULT_LOCALE,
  t: makeT(DEFAULT_LOCALE),
  setLocale: () => {},
});

// Resolves the active locale: the signed-in account's saved preference, else the browser
// language, else English. Persists changes to the account (so it follows you on every device
// and future native clients). No URL routing — the locale is a preference, not a path.
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    setLocaleState(localeFromBrowser(navigator.language));
    fetch('/api/me')
      .then((r) => r.json() as Promise<MeResponse>)
      .then((d) => {
        if (isLocale(d.account?.locale)) setLocaleState(d.account.locale);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useMemo(() => makeT(locale), [locale]);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    fetch('/api/locale', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: l }),
    }).catch(() => {});
  };

  return <I18nContext.Provider value={{ locale, t, setLocale }}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
export const useT = () => useI18n().t;
