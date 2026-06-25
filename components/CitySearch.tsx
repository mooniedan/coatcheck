'use client';

// Accessible city autocomplete. As you type it queries /api/geocode (debounced) and shows
// disambiguated candidates (name · region, country) so you can confirm the right place and
// avoid silent wrong-city matches on typos/ambiguous names. Picking a result hands back the
// exact coordinates; pressing Enter on free text still submits the typed query (top match).

import { useEffect, useRef, useState } from 'react';
import { useT } from '@/components/I18nProvider';
import type { GeocodeResponse, ResolvedLocation } from '@/lib/types';

// Regional-indicator flag emoji from an ISO-3166 alpha-2 code.
function flagOf(cc?: string): string {
  if (!cc || cc.length !== 2 || !/^[a-zA-Z]{2}$/.test(cc)) return '🌍';
  const base = 0x1f1e6;
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => base + c.charCodeAt(0) - 65));
}

function describe(loc: ResolvedLocation): string {
  return [loc.admin1, loc.country].filter(Boolean).join(', ');
}

export default function CitySearch({
  onPick,
  onSubmitText,
  onUseMyLocation,
  submitLabel,
}: {
  onPick: (loc: ResolvedLocation) => void;
  onSubmitText: (query: string) => void;
  onUseMyLocation: () => void;
  submitLabel?: string;
}) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ResolvedLocation[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1); // -1 = nothing highlighted → Enter submits text

  const pickingRef = useRef(false); // suppress the fetch triggered by setting the picked name
  const submittingRef = useRef(false); // a search was submitted — don't pop the dropdown back open
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced geocode lookup. Aborts in-flight requests so out-of-order responses can't win.
  useEffect(() => {
    if (pickingRef.current) {
      pickingRef.current = false;
      return;
    }
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = (await res.json()) as GeocodeResponse;
        if (submittingRef.current) return; // a submit landed first — keep the dropdown closed
        setResults(data.results ?? []);
        setActive(-1);
        setOpen((data.results ?? []).length > 0);
      } catch {
        /* aborted or network error — ignore */
      }
    }, 250);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [query]);

  // Close the dropdown when focus leaves the search box.
  useEffect(() => {
    function onDocPointer(e: PointerEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onDocPointer);
    return () => document.removeEventListener('pointerdown', onDocPointer);
  }, []);

  const pick = (loc: ResolvedLocation) => {
    pickingRef.current = true;
    submittingRef.current = true;
    setQuery(loc.name);
    setResults([]);
    setOpen(false);
    setActive(-1);
    onPick(loc);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (open && active >= 0 && results[active]) {
      pick(results[active]);
      return;
    }
    if (query.trim()) {
      submittingRef.current = true;
      setOpen(false);
      setResults([]);
      onSubmitText(query.trim());
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a <= 0 ? results.length - 1 : a - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
      <div ref={boxRef} className="relative flex-1">
        <input
          value={query}
          onChange={(e) => {
            pickingRef.current = false;
            submittingRef.current = false;
            setQuery(e.target.value);
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={t('search.placeholder')}
          role="combobox"
          aria-expanded={open}
          aria-controls="city-suggestions"
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `city-opt-${active}` : undefined}
          autoComplete="off"
          className="w-full rounded-full border border-outline-variant bg-surface-lowest px-5 py-3 text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/70 focus:border-primary"
        />
        {open && results.length > 0 && (
          <ul
            id="city-suggestions"
            role="listbox"
            className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-outline-variant bg-surface py-1 shadow-[var(--md-elev-2)]"
          >
            {results.map((loc, i) => (
              <li
                key={`${loc.latitude},${loc.longitude}`}
                id={`city-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                // pointerdown (not click) so it fires before the input's blur/outside-close.
                onPointerDown={(e) => {
                  e.preventDefault();
                  pick(loc);
                }}
                className={`flex cursor-pointer items-center gap-2.5 px-4 py-2.5 text-left ${
                  i === active ? 'bg-secondary-container text-on-secondary-container' : ''
                }`}
              >
                <span aria-hidden className="text-base leading-none">
                  {flagOf(loc.countryCode)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-on-surface">
                    {loc.name}
                  </span>
                  {describe(loc) && (
                    <span className="block truncate text-xs text-on-surface-variant">
                      {describe(loc)}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 rounded-full bg-primary px-6 py-3 font-medium text-on-primary shadow-[var(--md-elev-1)] transition-opacity hover:opacity-90 sm:flex-none"
        >
          {submitLabel ?? t('search.check')}
        </button>
        <button
          type="button"
          onClick={onUseMyLocation}
          className="inline-flex items-center gap-1.5 rounded-full bg-surface-high px-4 py-3 font-medium text-on-surface transition-colors hover:bg-surface-highest"
        >
          <span aria-hidden>📍</span> {t('search.me')}
        </button>
      </div>
    </form>
  );
}
