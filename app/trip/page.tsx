'use client';

// Trip planner — pick a place and a date range, get the clothing to pack for each day.
// No animation; each day reuses the home List view's per-day card (DayItems → garment
// thumbnails), stacked vertically. Forecast horizon caps the last selectable date.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import CitySearch from '@/components/CitySearch';
import DayItems from '@/components/home/DayItems';
import { dayLabelFull } from '@/components/home/weekday';
import { Icon } from '@/components/ui/Icon';
import type {
  ApiError,
  DayRecommendation,
  RecommendationsResponse,
  ResolvedLocation,
} from '@/lib/types';

const pad = (n: number) => String(n).padStart(2, '0');
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export default function TripPage() {
  // Selectable window: today … today+15 (Open-Meteo's free 16-day horizon).
  const { todayIso, maxIso } = useMemo(() => {
    const today = new Date();
    return { todayIso: isoDate(today), maxIso: isoDate(addDays(today, 15)) };
  }, []);

  const [location, setLocation] = useState<ResolvedLocation | null>(null);
  const [week, setWeek] = useState<DayRecommendation[]>([]);
  const [start, setStart] = useState(todayIso);
  const [end, setEnd] = useState(isoDate(addDays(new Date(), 6)));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchTrip(params: string, displayLocation?: ResolvedLocation) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/recommendations?${params}&days=16`);
      const data = (await res.json()) as RecommendationsResponse | ApiError;
      if (!res.ok || 'error' in data) {
        throw new Error(('error' in data && data.error) || 'Something went wrong');
      }
      setLocation(displayLocation ?? data.location);
      setWeek(data.week ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setWeek([]);
    } finally {
      setLoading(false);
    }
  }

  const pickLocation = (loc: ResolvedLocation) =>
    fetchTrip(`lat=${loc.latitude}&lng=${loc.longitude}`, loc);
  const searchText = (q: string) => fetchTrip(`q=${encodeURIComponent(q)}`);
  function useMyLocation() {
    if (!navigator.geolocation) {
      setError('Location is not available in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchTrip(`lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`),
      () => setError('Could not get your location')
    );
  }

  // The forecast covers today…today+15; clamp the picked range to what's available.
  const days = week.filter((d) => d.day.date >= start && d.day.date <= end);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-6 sm:py-10">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-medium tracking-tight text-on-surface sm:text-3xl">
          Plan a trip
        </h1>
        <Link href="/" className="text-sm font-medium text-primary hover:underline">
          ← Home
        </Link>
      </header>

      <p className="text-on-surface-variant">
        Where are you going, and when? You’ll get what to pack for each day.
      </p>

      <CitySearch onPick={pickLocation} onSubmitText={searchText} onUseMyLocation={useMyLocation} />

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-on-surface-variant">Start</span>
          <input
            type="date"
            value={start}
            min={todayIso}
            max={maxIso}
            onChange={(e) => {
              const v = e.target.value;
              setStart(v);
              if (v > end) setEnd(v);
            }}
            className="rounded-xl border border-outline-variant bg-surface-lowest px-3 py-2 text-on-surface outline-none focus:border-primary"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-on-surface-variant">End</span>
          <input
            type="date"
            value={end}
            min={start}
            max={maxIso}
            onChange={(e) => setEnd(e.target.value)}
            className="rounded-xl border border-outline-variant bg-surface-lowest px-3 py-2 text-on-surface outline-none focus:border-primary"
          />
        </label>
      </div>

      {loading && <p className="text-on-surface-variant">Checking the skies…</p>}
      {error && (
        <p className="rounded-2xl bg-error-container px-4 py-3 text-on-error-container">{error}</p>
      )}

      {location && !loading && week.length > 0 && (
        <section className="flex flex-col gap-3">
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-on-surface">
            <Icon name="pin" size={15} color="var(--md-primary)" />
            <span className="truncate">
              {[location.name, location.admin1, location.country].filter(Boolean).join(', ')}
            </span>
          </p>
          {days.length === 0 ? (
            <p className="rounded-2xl border border-outline-variant bg-surface-low px-4 py-3 text-sm text-on-surface-variant">
              No forecast for those dates yet — pick dates within the next 16 days.
            </p>
          ) : (
            days.map((d) => (
              <DayItems
                key={d.day.date}
                rec={d.recommendation}
                day={d.day}
                label={dayLabelFull(d.day.date)}
              />
            ))
          )}
        </section>
      )}
    </main>
  );
}
