// Date helpers shared by the trip pages. The forecast horizon is today … today+15,
// matching Open-Meteo's free 16-day window (see MAX_FORECAST_DAYS).

import type { Trip } from '@/lib/types';
import { type Locale, LOCALE_TAG } from '@/lib/i18n';

export const TRIP_HORIZON_DAYS = 15;

const pad = (n: number) => String(n).padStart(2, '0');

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

// Compact range label, e.g. "24 Jun – 30 Jun" (or a single date when start === end).
export function rangeLabel(start: string, end: string, locale: Locale = 'en'): string {
  const f = (s: string) =>
    new Date(`${s}T00:00:00`).toLocaleDateString(LOCALE_TAG[locale], {
      day: 'numeric',
      month: 'short',
    });
  return start === end ? f(start) : `${f(start)} – ${f(end)}`;
}

// Count of trips that should light the Trips-nav badge: their weather is now available (the
// date range overlaps the forecast horizon [today, today+15]) but they haven't been opened
// since (seen_at null). This is the "a far-off trip's forecast just arrived" signal.
export function tripsAlertCount(trips: Trip[], todayIso: string): number {
  const horizon = isoDate(addDays(new Date(`${todayIso}T00:00:00`), TRIP_HORIZON_DAYS));
  return trips.filter((t) => !t.seen_at && t.start_date <= horizon && t.end_date >= todayIso)
    .length;
}
