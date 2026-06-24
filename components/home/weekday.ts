// Shared day-cell helpers for the 7-day forecast UIs (WeekStrip + DayList).

import type { IconName } from '@/components/ui/Icon';
import type { GlyphCategory } from '@/lib/wmo';
import { type Locale, LOCALE_TAG } from '@/lib/i18n';

// Map the shared WMO glyph category to this app's stroke-icon set.
export const GLYPH_ICON: Record<GlyphCategory, IconName> = {
  clear: 'sun',
  cloud: 'cloud',
  rain: 'cloudRain',
  snow: 'snowflake',
};

// Short weekday label from an ISO date; index 0 is "Today" (localized via todayLabel).
export function dayLabel(
  date: string,
  index: number,
  locale: Locale = 'en',
  todayLabel = 'Today'
): string {
  if (index === 0) return todayLabel;
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString(LOCALE_TAG[locale], { weekday: 'short' });
}

// Absolute date label (e.g. "Mon 24 Jun") — for the trip view, where days aren't relative
// to today, so "Today/Tue" would be ambiguous across a multi-week range.
export function dayLabelFull(date: string, locale: Locale = 'en'): string {
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString(LOCALE_TAG[locale], { weekday: 'short', day: 'numeric', month: 'short' });
}
