'use client';

// Given a location + an inclusive date range, fetches the forecast (up to 16 days, no hourly)
// and renders one packing card per day — the same garment-thumbnail card as the home List view.
// Dates beyond the forecast horizon are allowed; those are surfaced as a "not available yet"
// banner rather than blocked. Date filtering is client-side, so changing the range re-renders
// without refetching; only a location change triggers a new fetch.

import { useEffect, useRef, useState } from 'react';
import DayItems from '@/components/home/DayItems';
import { dayLabelFull } from '@/components/home/weekday';
import { isoDate, addDays, rangeLabel } from './dates';
import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/components/I18nProvider';
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
  onAvailability,
}: {
  location: ResolvedLocation;
  start: string;
  end: string;
  /** Notified when the available-days status settles (true once any in-range day has a forecast). */
  onAvailability?: (hasAvailableDays: boolean) => void;
}) {
  const { t, locale } = useI18n();
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
  const lastForecast = week.length ? week[week.length - 1].day.date : null;

  // Report availability up to the parent (used to mark a trip "seen" only once its weather lands).
  const reported = useRef<boolean | null>(null);
  const hasDays = days.length > 0;
  useEffect(() => {
    if (loading) return;
    if (reported.current === hasDays) return;
    reported.current = hasDays;
    onAvailability?.(hasDays);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasDays, loading]);

  if (loading) return <p className="text-on-surface-variant">{t('loading')}</p>;
  if (error)
    return (
      <p className="rounded-2xl bg-error-container px-4 py-3 text-on-error-container">{error}</p>
    );

  // Portion of the range that's past the forecast horizon (no data yet).
  const tailFrom =
    lastForecast && end > lastForecast
      ? isoDate(addDays(new Date(`${lastForecast}T00:00:00`), 1))
      : null;
  const unavailableFrom = tailFrom && tailFrom > start ? tailFrom : tailFrom ? start : null;

  return (
    <div className="flex flex-col gap-3">
      {days.map((d) => (
        <DayItems
          key={d.day.date}
          rec={d.recommendation}
          day={d.day}
          label={dayLabelFull(d.day.date, locale)}
        />
      ))}

      {unavailableFrom && (
        <p className="flex items-start gap-2 rounded-2xl border border-outline-variant bg-surface-low px-4 py-3 text-sm text-on-surface-variant">
          <Icon name="clock" size={16} color="var(--md-primary)" strokeWidth={1.8} />
          <span>
            {hasDays
              ? t('trip.unavailableSome', { range: rangeLabel(unavailableFrom, end, locale) })
              : t('trip.unavailableAll')}
          </span>
        </p>
      )}
    </div>
  );
}
