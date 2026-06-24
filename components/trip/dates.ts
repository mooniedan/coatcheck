// Date helpers shared by the trip pages. The selectable window is today … today+15,
// matching Open-Meteo's free 16-day forecast horizon (see MAX_FORECAST_DAYS).

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
export function rangeLabel(start: string, end: string): string {
  const f = (s: string) =>
    new Date(`${s}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return start === end ? f(start) : `${f(start)} – ${f(end)}`;
}
