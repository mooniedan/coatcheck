'use client';

// Given a location + an inclusive date range, fetches the forecast (up to 16 days, no hourly)
// and renders one packing card per day — the same garment-thumbnail card as the home List view.
// Date filtering is client-side, so changing the range re-renders without refetching; only a
// location change triggers a new fetch.

import { useEffect, useState } from 'react';
import DayItems from '@/components/home/DayItems';
import { dayLabelFull } from '@/components/home/weekday';
import type {
  ApiError,
  DayRecommendation,
  RecommendationsResponse,
  ResolvedLocation,
} from '@/lib/types';

export default function TripDays({
  location,
  start,
  end,
}: {
  location: ResolvedLocation;
  start: string;
  end: string;
}) {
  const [week, setWeek] = useState<DayRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/recommendations?lat=${location.latitude}&lng=${location.longitude}&days=16`)
      .then((r) => r.json() as Promise<RecommendationsResponse | ApiError>)
      .then((data) => {
        if (cancelled) return;
        if ('error' in data) throw new Error(data.error);
        setWeek(data.week ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [location.latitude, location.longitude]);

  const days = week.filter((d) => d.day.date >= start && d.day.date <= end);

  if (loading) return <p className="text-on-surface-variant">Checking the skies…</p>;
  if (error)
    return (
      <p className="rounded-2xl bg-error-container px-4 py-3 text-on-error-container">{error}</p>
    );
  if (days.length === 0)
    return (
      <p className="rounded-2xl border border-outline-variant bg-surface-low px-4 py-3 text-sm text-on-surface-variant">
        No forecast for those dates yet — pick dates within the next 16 days.
      </p>
    );

  return (
    <div className="flex flex-col gap-3">
      {days.map((d) => (
        <DayItems
          key={d.day.date}
          rec={d.recommendation}
          day={d.day}
          label={dayLabelFull(d.day.date)}
        />
      ))}
    </div>
  );
}
