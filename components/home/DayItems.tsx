'use client';

// Single-day clothing summary — the list alternative to the animated scene for the
// currently selected day. Same data as AnimatedHome (the selected day's recommendation),
// shown as a flat list of items instead of a scrubbable timeline.

import { useMemo } from 'react';
import { Icon } from '@/components/ui/Icon';
import { weatherGlyph } from '@/lib/wmo';
import { dayClothing } from '@/lib/scene-model';
import GarmentThumbs from './GarmentThumbs';
import OutfitFeedback from './OutfitFeedback';
import { GLYPH_ICON } from './weekday';
import { useT } from '@/components/I18nProvider';
import { weatherName } from '@/lib/i18n';
import type { DailyForecast, Recommendation, ResolvedLocation, Verdict } from '@/lib/types';

export default function DayItems({
  rec,
  day,
  location,
  label,
  comfortOffsetC = 0,
  signedIn = false,
  isToday = false,
  onFeedback,
  feedbackMsg,
}: {
  rec: Recommendation;
  day: DailyForecast | null;
  /** Shown as a pin line under the day header. Omit on the trip page (location is in the header). */
  location?: ResolvedLocation;
  label: string;
  /** Wearer comfort offset, so the day's clothing union matches the scrubbable scene's hours. */
  comfortOffsetC?: number;
  /** Feedback is offered only to a signed-in wearer on today (matches the scene view). */
  signedIn?: boolean;
  isToday?: boolean;
  onFeedback?: (verdict: Verdict, wornItemIds?: string[]) => void;
  feedbackMsg?: string | null;
}) {
  const t = useT();
  const code = day?.weatherCode ?? rec.weather.weatherCode;
  const precip = day?.precipProb ?? rec.weather.precipitationProbability;
  const description = weatherName(t, code, day?.description ?? rec.weather.description);

  // The list spans the whole day, not just the representative hour — so a garment the scene
  // only shows at, say, a warm afternoon hour (shorts) still appears here.
  const dayRec = useMemo(
    () => dayClothing(rec, day, comfortOffsetC),
    [rec, day, comfortOffsetC]
  );

  return (
    <div className="rounded-[28px] border border-outline-variant bg-surface p-5 shadow-[var(--md-elev-1)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-lg font-medium text-on-surface">
          <Icon
            name={GLYPH_ICON[weatherGlyph(code)]}
            size={22}
            strokeWidth={1.7}
            color="var(--md-primary)"
          />
          {label}
        </span>
        <span className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant">
          {day && (
            <>
              <span className="font-medium text-on-surface">{Math.round(day.tempMaxC)}°</span>
              <span className="opacity-70">{Math.round(day.tempMinC)}°</span>
            </>
          )}
          {precip > 20 && (
            <span className="inline-flex items-center gap-0.5 text-cool">
              <Icon name="droplet" size={11} strokeWidth={2} />
              {precip}%
            </span>
          )}
        </span>
      </div>
      <p className="mb-4 inline-flex min-w-0 items-center gap-1.5 text-sm text-on-surface-variant">
        {location && <Icon name="pin" size={14} color="var(--md-primary)" />}
        <span className="truncate">
          {location
            ? `${[location.name, location.admin1, location.country].filter(Boolean).join(', ')} · ${description}`
            : description}
        </span>
      </p>
      <GarmentThumbs rec={dayRec} label={`Clothing for ${label}`} />
      {signedIn && isToday && onFeedback && (
        <div className="-mx-5 mt-4 border-t border-outline-variant pt-1">
          <OutfitFeedback rec={rec} onFeedback={onFeedback} message={feedbackMsg} />
        </div>
      )}
    </div>
  );
}
