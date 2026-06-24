// Day-list view — the non-animated alternative to AnimatedHome. One row per forecast day:
// weekday + weather glyph + high/low (and precip% when notable), then the day's clothing
// items as small icon chips. Read-only; feedback stays on the animated "today" view.

import { Icon } from '@/components/ui/Icon';
import { weatherGlyph } from '@/lib/wmo';
import ItemIconRow from './ItemIconRow';
import { GLYPH_ICON, dayLabel } from './weekday';
import type { DayRecommendation } from '@/lib/types';

export default function DayList({ week }: { week: DayRecommendation[] }) {
  return (
    <div className="flex flex-col gap-2" role="list" aria-label="7-day clothing list">
      {week.map((d, i) => {
        const showPrecip = d.day.precipProb > 20;
        return (
          <div
            key={d.day.date}
            role="listitem"
            className="rounded-2xl border border-outline-variant bg-surface p-4"
          >
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 font-medium text-on-surface">
                <Icon
                  name={GLYPH_ICON[weatherGlyph(d.day.weatherCode)]}
                  size={18}
                  strokeWidth={1.7}
                  color="var(--md-primary)"
                />
                {dayLabel(d.day.date, i)}
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant">
                <span className="font-medium text-on-surface">{Math.round(d.day.tempMaxC)}°</span>
                <span className="opacity-70">{Math.round(d.day.tempMinC)}°</span>
                {showPrecip && (
                  <span className="inline-flex items-center gap-0.5 text-cool">
                    <Icon name="droplet" size={11} strokeWidth={2} />
                    {d.day.precipProb}%
                  </span>
                )}
              </span>
            </div>
            <ItemIconRow rec={d.recommendation} label={`Clothing for ${dayLabel(d.day.date, i)}`} />
          </div>
        );
      })}
    </div>
  );
}
