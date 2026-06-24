// A wrapping row of small clothing-item chips (stroke icon + name) for one day's
// recommendation. Shared leaf for the day-list view and the per-day icon strip.

import { Icon } from '@/components/ui/Icon';
import { getItemIcon } from '@/lib/itemIcons';
import { CATEGORIES } from '@/lib/types';
import type { Recommendation } from '@/lib/types';

export default function ItemIconRow({ rec, label }: { rec: Recommendation; label?: string }) {
  const items = CATEGORIES.flatMap((c) => rec.itemsByCategory[c] ?? []);
  if (items.length === 0) {
    return <span className="text-xs text-on-surface-variant">Nothing needed today.</span>;
  }
  return (
    <div className="flex flex-wrap gap-2" role="list" aria-label={label}>
      {items.map((it) => (
        <span
          key={it.id}
          role="listitem"
          className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-low px-2.5 py-1 text-xs text-on-surface"
        >
          <Icon name={getItemIcon(it)} size={14} strokeWidth={1.6} color="var(--md-primary)" />
          {it.name}
        </span>
      ))}
    </div>
  );
}
