// Shared day-cell helpers for the 7-day forecast UIs (WeekStrip + DayList).

import type { IconName } from '@/components/ui/Icon';
import type { GlyphCategory } from '@/lib/wmo';

// Map the shared WMO glyph category to this app's stroke-icon set.
export const GLYPH_ICON: Record<GlyphCategory, IconName> = {
  clear: 'sun',
  cloud: 'cloud',
  rain: 'cloudRain',
  snow: 'snowflake',
};

// Short weekday label from an ISO date; index 0 is always "Today".
export function dayLabel(date: string, index: number): string {
  if (index === 0) return 'Today';
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}
