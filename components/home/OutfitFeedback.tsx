'use client';

// Per-article feedback for today's outfit, shared by both Today views (scene + list). The wearer
// can tune what they'd actually wear — add, remove, or switch any garment — then say how it felt.
// Editing the outfit is the strong learning signal (see docs/feedback-learning.md): the edited set
// is sent as `wornItemIds` and the engine infers the wearer's comfort from it. An unedited verdict
// falls back to the coarse ±step. Feedback is offered for today only, to a signed-in wearer.

import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useT } from '@/components/I18nProvider';
import { itemName } from '@/lib/i18n';
import { getItemIcon } from '@/lib/itemIcons';
import { DEFAULT_CATALOG } from '@/lib/catalog';
import { CATEGORIES } from '@/lib/types';
import type { Recommendation, Verdict } from '@/lib/types';

function recommendedIds(rec: Recommendation): string[] {
  return CATEGORIES.flatMap((c) => (rec.itemsByCategory[c] ?? []).map((i) => i.id));
}

export default function OutfitFeedback({
  rec,
  onFeedback,
  message,
}: {
  rec: Recommendation;
  onFeedback: (verdict: Verdict, wornItemIds?: string[]) => void;
  /** Post-submit status (e.g. "Thanks — noted for next time."). */
  message?: string | null;
}) {
  const tr = useT();
  const recommended = recommendedIds(rec);
  const recKey = [...recommended].sort().join(',');

  const [set, setSet] = useState<Set<string>>(() => new Set(recommended));
  const [expanded, setExpanded] = useState(false);

  // Re-seed when the recommendation changes (profile/day swap) so edits don't leak across outfits.
  const seededRef = useRef(recKey);
  useEffect(() => {
    if (seededRef.current !== recKey) {
      seededRef.current = recKey;
      setSet(new Set(recommended));
      setExpanded(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recKey]);

  const changed =
    set.size !== recommended.length || recommended.some((id) => !set.has(id));

  const toggle = (id: string) =>
    setSet((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // Only send the edited set when the wearer actually changed something — otherwise a bare verdict
  // (e.g. "too hot" on the untouched recommendation) should take the coarse-step path, not "learn"
  // that the recommended outfit was correct.
  const submit = (verdict: Verdict) => onFeedback(verdict, changed ? [...set] : undefined);

  const verdicts: { id: Verdict; icon: IconName; label: string; tone: 'cool' | 'warm' | 'just' }[] = [
    { id: 'too_cold', icon: 'snowflake', label: tr('feedback.tooCold'), tone: 'cool' },
    { id: 'just_right', icon: 'check', label: tr('feedback.perfect'), tone: 'just' },
    { id: 'too_hot', icon: 'sun', label: tr('feedback.tooHot'), tone: 'warm' },
  ];
  const tone: Record<string, string> = {
    cool: 'bg-cool-container text-cool',
    warm: 'bg-warm-container text-warm',
    just: 'bg-just-container text-just',
  };

  return (
    <div className="flex flex-col gap-2.5 px-5 pb-4 pt-2">
      <div className="flex gap-2.5">
        {verdicts.map((v) => (
          <button
            key={v.id}
            aria-label={v.label}
            onClick={() => submit(v.id)}
            className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-transparent text-sm font-medium transition-shadow hover:shadow-[var(--md-elev-1)] ${tone[v.tone]}`}
          >
            <Icon name={v.icon} size={20} strokeWidth={1.8} />
            <span className="hidden sm:inline">{v.label}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="inline-flex items-center gap-1.5 self-start rounded-full px-2 py-1 text-sm font-medium text-primary transition-colors hover:bg-surface-high"
      >
        <Icon name="swap" size={15} strokeWidth={1.8} />
        {tr('feedback.adjust')}
        {changed && (
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
        )}
      </button>

      {expanded && (
        <div className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-surface-low p-4">
          <p className="text-xs text-on-surface-variant">{tr('feedback.adjustHint')}</p>
          {CATEGORIES.map((cat) => {
            const catItems = DEFAULT_CATALOG.filter((i) => i.category === cat);
            if (catItems.length === 0) return null;
            return (
              <div key={cat}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-primary">
                  {tr(`category.${cat}`)}
                </p>
                <div className="flex flex-wrap gap-2">
                  {catItems.map((item) => {
                    const on = set.has(item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => toggle(item.id)}
                        aria-pressed={on}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                          on
                            ? 'border-transparent bg-secondary-container text-on-secondary-container'
                            : 'border-outline-variant text-on-surface-variant hover:bg-surface-high'
                        }`}
                      >
                        <Icon name={getItemIcon(item)} size={15} strokeWidth={1.6} />
                        {itemName(tr, item)}
                        {on && <Icon name="close" size={13} strokeWidth={2} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {message && <p className="text-sm text-on-surface-variant">{message}</p>}
    </div>
  );
}
