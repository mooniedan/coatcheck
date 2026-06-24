// A wrapping row of small garment thumbnails for one day's recommendation — each item
// rendered as just the clothing article (no figure), cropped and scaled to a square.

'use client';

import { GarmentOnly } from './garments';
import { useT } from '@/components/I18nProvider';
import { itemName } from '@/lib/i18n';
import { CATEGORIES } from '@/lib/types';
import type { Recommendation } from '@/lib/types';

export default function GarmentThumbs({ rec, label }: { rec: Recommendation; label?: string }) {
  const t = useT();
  const items = CATEGORIES.flatMap((c) => rec.itemsByCategory[c] ?? []);
  if (items.length === 0) {
    return <span className="text-xs text-on-surface-variant">Nothing needed today.</span>;
  }
  return (
    <div className="flex flex-wrap gap-2" role="list" aria-label={label}>
      {items.map((it) => (
        <div
          key={it.id}
          role="listitem"
          className="flex w-[76px] flex-col items-center gap-1 rounded-2xl border border-outline-variant bg-surface-low px-1 pb-2 pt-2"
        >
          <div className="flex h-[56px] items-center justify-center">
            <GarmentOnly garmentId={it.id} size={52} />
          </div>
          <span className="text-center text-[11px] leading-tight text-on-surface">
            {itemName(t, it)}
          </span>
        </div>
      ))}
    </div>
  );
}
