'use client';

// 7-day forecast strip under the search. Each cell shows the weekday, a weather glyph
// (from the WMO code), the day's high/low, and precip% when notable. Tapping a cell selects
// that day — the home scene then rests on that day's recommendation (see AnimatedHome).

import { Icon } from '@/components/ui/Icon';
import { weatherGlyph } from '@/lib/wmo';
import { GLYPH_ICON, dayLabel } from './weekday';
import { useI18n } from '@/components/I18nProvider';
import { weatherName } from '@/lib/i18n';
import type { DayRecommendation } from '@/lib/types';

export default function WeekStrip({
  week,
  selectedIndex,
  onSelect,
}: {
  week: DayRecommendation[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const { t, locale } = useI18n();
  const label = (date: string, i: number) => dayLabel(date, i, locale, t('day.today'));
  return (
    <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="7-day forecast">
      {week.map((d, i) => {
        const selected = i === selectedIndex;
        const showPrecip = d.day.precipProb > 20;
        return (
          <button
            key={d.day.date}
            type="button"
            aria-pressed={selected}
            aria-label={`${label(d.day.date, i)}: ${weatherName(t, d.day.weatherCode, d.day.description)}, high ${Math.round(
              d.day.tempMaxC
            )}°, low ${Math.round(d.day.tempMinC)}°${
              showPrecip ? `, ${d.day.precipProb}% precipitation` : ''
            }`}
            onClick={() => onSelect(i)}
            className={`flex flex-col items-center gap-1 rounded-2xl border px-1 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              selected
                ? 'border-transparent bg-secondary-container text-on-secondary-container'
                : 'border-outline-variant bg-surface-low text-on-surface-variant hover:bg-surface-high'
            }`}
          >
            <span className="text-[11px] font-medium leading-none">{label(d.day.date, i)}</span>
            <Icon
              name={GLYPH_ICON[weatherGlyph(d.day.weatherCode)]}
              size={20}
              strokeWidth={1.7}
              color={selected ? 'currentColor' : 'var(--md-primary)'}
            />
            <span className="text-xs font-semibold leading-none text-on-surface">
              {Math.round(d.day.tempMaxC)}°
            </span>
            <span className="text-[11px] leading-none opacity-70">
              {Math.round(d.day.tempMinC)}°
            </span>
            <span
              className={`flex items-center gap-0.5 text-[10px] leading-none text-cool ${
                showPrecip ? '' : 'invisible'
              }`}
            >
              <Icon name="droplet" size={9} strokeWidth={2} />
              {d.day.precipProb}%
            </span>
          </button>
        );
      })}
    </div>
  );
}
