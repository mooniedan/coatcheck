// A compact, single-row strip of the selected day's clothing as small garment thumbnails.
// Sits between the week strip and the animated scene — an at-a-glance list of everything to
// wear (including layers the figure hides under its outermost garment).

import { GarmentOnly } from './garments';
import { CATEGORIES } from '@/lib/types';
import type { Recommendation } from '@/lib/types';

export default function DayIconStrip({ rec }: { rec: Recommendation }) {
  const items = CATEGORIES.flatMap((c) => rec.itemsByCategory[c] ?? []);
  if (items.length === 0) return null;
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-1.5"
      role="list"
      aria-label="Clothing for the day"
    >
      {items.map((it) => (
        <div
          key={it.id}
          role="listitem"
          title={it.name}
          aria-label={it.name}
          className="flex h-12 w-12 items-center justify-center rounded-xl border border-outline-variant bg-surface-low"
        >
          <GarmentOnly garmentId={it.id} size={38} />
        </div>
      ))}
    </div>
  );
}
