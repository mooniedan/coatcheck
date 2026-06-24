// Lightweight i18n core (framework-free). Locale is a per-account preference (no URL routing);
// the client provider resolves it and exposes a t() via useT(). See components/I18nProvider.

import { en, type Messages } from '@/messages/en';
import { nb } from '@/messages/nb';

export type Locale = 'en' | 'nb';
export const LOCALES: Locale[] = ['en', 'nb'];
export const DEFAULT_LOCALE: Locale = 'en';

export const MESSAGES: Record<Locale, Messages> = { en, nb };

export function isLocale(x: unknown): x is Locale {
  return x === 'en' || x === 'nb';
}

// Map a browser language tag (navigator.language / Accept-Language) to a supported locale.
export function localeFromBrowser(lang: string | undefined): Locale {
  const l = (lang ?? '').toLowerCase();
  if (l.startsWith('nb') || l.startsWith('nn') || l.startsWith('no')) return 'nb';
  return DEFAULT_LOCALE;
}

export type TFunction = (key: string, vars?: Record<string, string | number>) => string;

function lookup(messages: unknown, key: string): string | undefined {
  const val = key
    .split('.')
    .reduce<unknown>(
      (o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined),
      messages
    );
  return typeof val === 'string' ? val : undefined;
}

// Build a t(key, vars?) for a locale. Missing keys return the key itself (visible in dev);
// {var} placeholders are interpolated. Falls back to English for a missing translation.
export function makeT(locale: Locale): TFunction {
  return (key, vars) => {
    let s = lookup(MESSAGES[locale], key) ?? lookup(MESSAGES.en, key) ?? key;
    if (vars) for (const k of Object.keys(vars)) s = s.replaceAll(`{${k}}`, String(vars[k]));
    return s;
  };
}

// Localized clothing-item name by catalog id, falling back to the item's stored (English) name.
export function itemName(t: TFunction, item: { id?: string; name: string }): string {
  if (!item.id) return item.name;
  const key = `clothing.${item.id}`;
  const tr = t(key);
  return tr === key ? item.name : tr;
}

// Localized weather description by WMO code, falling back to the supplied (English) description.
export function weatherName(t: TFunction, code: number, fallback: string): string {
  const key = `weather.${code}`;
  const tr = t(key);
  return tr === key ? fallback : tr;
}
