'use client';

// Animated walking-figure home — adapts the Claude Design prototype's LivePanel to the
// real web app. Auto-plays a ~6s "day tour" on mount, then rests at the user's real local
// time with the real feels-like temperature; tap the figure to explode the real recommended
// outfit; tap the scene to reveal a scrubable timeline.

import { useEffect, useMemo, useRef, useState } from 'react';
import { HeroScene, FeelsBadge, Timeline } from './scene';
import {
  clamp,
  HOUR_START,
  HOUR_END,
  sceneWeatherFromSnapshot,
  outfitFromRecommendation,
  hourToSkyT,
  dayWindow,
} from '@/lib/scene-model';
import { recommend } from '@/lib/recommend';
import { describeWeatherCode } from '@/lib/wmo';
import { Icon } from '@/components/ui/Icon';
import { getItemIcon } from '@/lib/itemIcons';
import { DEFAULT_CATALOG } from '@/lib/catalog';
import { CATEGORIES } from '@/lib/types';
import type {
  ClothingItem,
  DailyForecast,
  Recommendation,
  ResolvedLocation,
  Verdict,
  WeatherSnapshot,
} from '@/lib/types';

const pad = (n: number) => String(n).padStart(2, '0');

// Fallback clock (only used when no hourly data is available).
function nowClock() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// The slider's hour window for a day, anchored to real sunrise/sunset.
function windowFor(day: DailyForecast | null) {
  const win = day ? dayWindow(day.sunrise, day.sunset) : { start: HOUR_START, end: HOUR_END };
  return { ...win, span: Math.max(1, win.end - win.start) };
}

// Slider position (0..1) → the whole hour it points at, within the window.
function hourAt(t: number, win: { start: number; end: number; span: number }) {
  return clamp(Math.round(win.start + t * win.span), win.start, win.end);
}

// Where the slider should rest when a day loads: the current hour for today, else the warmest
// hour of the day (the "what to wear" peak). Returns a slider position (0..1).
function defaultPosition(day: DailyForecast | null, isToday: boolean): number {
  const win = windowFor(day);
  let hour: number;
  if (isToday) {
    hour = new Date().getHours();
  } else if (day && day.hours.length) {
    let best = win.start;
    let bestFeels = -Infinity;
    for (const h of day.hours) {
      if (h.hour < win.start || h.hour > win.end) continue;
      if (h.feelsLikeC > bestFeels) {
        bestFeels = h.feelsLikeC;
        best = h.hour;
      }
    }
    hour = best;
  } else {
    hour = 12;
  }
  return (clamp(hour, win.start, win.end) - win.start) / win.span;
}

type Phase = 'tour' | 'rest' | 'scrub';

export default function AnimatedHome({
  location,
  rec,
  day = null,
  comfortOffsetC = 0,
  isToday = true,
  signedIn,
  onFeedback,
  feedbackMsg,
}: {
  location: ResolvedLocation;
  rec: Recommendation;
  /** The selected day's hour-by-hour forecast (drives the scrubbable scene). */
  day?: DailyForecast | null;
  /** The wearer's comfort offset, so per-hour outfits recompute client-side as you scrub. */
  comfortOffsetC?: number;
  /** False when a future forecast day is being previewed — feedback is for today only. */
  isToday?: boolean;
  signedIn: boolean;
  onFeedback: (v: Verdict, wornItemIds?: string[]) => void;
  feedbackMsg: string | null;
}) {
  const [phase, setPhase] = useState<Phase>('tour');
  const [t, setT] = useState(0);
  const [controls, setControls] = useState(false);
  const [exploded, setExploded] = useState(false);
  const [, setClockTick] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [lastInteract, setLastInteract] = useState(0);

  // Optional "what felt comfortable?" follow-up after a too_cold / too_hot verdict.
  const [comfortFor, setComfortFor] = useState<Verdict | null>(null);
  const [worn, setWorn] = useState<string[]>([]);

  const handleVerdict = (v: Verdict) => {
    if (v === 'just_right') {
      onFeedback('just_right');
      return;
    }
    // Offer the comfort picker before recording a mismatch.
    setComfortFor(v);
    setWorn([]);
  };
  const closeComfort = () => {
    setComfortFor(null);
    setWorn([]);
  };

  const tourStart = useRef<number | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    setReduced(
      typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }, []);

  // Auto-play tour: sweep the day window 0→1 over 6s, then settle to the resting hour.
  useEffect(() => {
    if (phase !== 'tour') return;
    if (reduced) {
      setT(defaultPosition(day, isToday));
      setPhase('rest');
      return;
    }
    const step = (ts: number) => {
      if (!tourStart.current) tourStart.current = ts;
      const k = clamp((ts - tourStart.current) / 6000, 0, 1);
      setT(k);
      if (k < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setPhase('rest');
        setT(defaultPosition(day, isToday));
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, reduced]);

  // When the selected day changes (strip tap), settle the slider at that day's resting hour.
  useEffect(() => {
    if (phase === 'tour') return;
    setT(defaultPosition(day, isToday));
    setPhase('rest');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day?.date]);

  // Auto-fade controls 3s after the last interaction. `lastInteract` re-arms the timer; `t`
  // must NOT be a dep or it re-arms every animation frame while scrubbing.
  useEffect(() => {
    if (!controls) return;
    const id = setTimeout(() => setControls(false), 3000);
    return () => clearTimeout(id);
  }, [controls, lastInteract]);

  // Keep the resting clock live (it's derived from wall-clock time, which doesn't re-render).
  useEffect(() => {
    if (phase !== 'rest') return;
    const id = setInterval(() => setClockTick((c) => c + 1), 30_000);
    return () => clearInterval(id);
  }, [phase]);

  const onSceneTap = () => {
    if (phase === 'tour') return;
    setControls(true);
    setLastInteract(Date.now());
  };
  const win = windowFor(day);
  const selectedHour = hourAt(t, win);

  const onScrub = (next: number) => {
    // Snap to whole hours: the slider only lands on real hourly data points.
    const hour = hourAt(next, win);
    setT((hour - win.start) / win.span);
    setControls(true);
    setLastInteract(Date.now());
    setPhase('scrub');
  };

  // Derive the selected hour's real weather + outfit (recomputed only when the hour changes).
  // This drives the whole scene — tour, rest and scrub — whenever hourly data is available;
  // otherwise we fall back to the day-level recommendation.
  const hourView = useMemo(() => {
    const hours = day?.hours ?? [];
    if (hours.length === 0) return null;
    const hd = hours.find((h) => h.hour === selectedHour) ?? hours[selectedHour];
    if (!hd) return null;
    const snapshot: WeatherSnapshot = {
      feelsLikeC: hd.feelsLikeC,
      tempC: hd.tempC,
      humidity: 0,
      windKph: hd.windKph,
      precipitationProbability: hd.precipProb,
      isRaining: hd.isRaining,
      weatherCode: hd.weatherCode,
      description: describeWeatherCode(hd.weatherCode),
      observedAt: hd.time,
    };
    const hourRec = recommend(snapshot, DEFAULT_CATALOG, { offsetC: comfortOffsetC });
    return {
      weather: sceneWeatherFromSnapshot(snapshot),
      outfit: outfitFromRecommendation(hourRec),
      feels: Math.round(snapshot.feelsLikeC),
      description: snapshot.description,
      rec: hourRec,
    };
  }, [day?.date, day?.hours, selectedHour, comfortOffsetC]);

  const useHour = hourView !== null;
  const walking = !reduced && phase === 'tour';
  // The figure/sky read the real selected hour when we have it; the slider position (t) stays
  // in window space, so the sky is driven by hour-of-day, not the raw slider value.
  const skyT = useHour ? hourToSkyT(selectedHour) : t;
  const badgeTemp = useHour
    ? hourView.feels
    : phase === 'rest'
      ? Math.round(rec.weather.feelsLikeC)
      : undefined;
  const clockLabel = useHour ? `${pad(selectedHour)}:00` : phase === 'rest' ? nowClock() : undefined;
  const sceneWeather = useHour
    ? hourView.weather
    : phase === 'rest'
      ? sceneWeatherFromSnapshot(rec.weather)
      : undefined;
  const sceneOutfit = useHour
    ? hourView.outfit
    : phase === 'rest'
      ? outfitFromRecommendation(rec)
      : undefined;
  const description = useHour ? hourView.description : rec.weather.description;

  // Feedback is about what you actually wore today, so it's only live on today's view.
  const feedbackEnabled = signedIn && isToday;

  const items: ClothingItem[] = CATEGORIES.flatMap(
    (c) => (useHour ? hourView.rec : rec).itemsByCategory[c] ?? []
  );

  return (
    <div className="overflow-hidden rounded-[28px] border border-outline-variant bg-surface shadow-[var(--md-elev-2)]">
      {/* Hero scene */}
      <div className="relative" style={{ height: 'clamp(380px, 56vh, 520px)' }}>
        <div className="absolute inset-0">
          <HeroScene
            t={skyT}
            walking={walking && !exploded}
            onTap={onSceneTap}
            clockLabel={clockLabel}
            weather={sceneWeather}
            outfit={sceneOutfit}
            reduced={reduced}
          >
            <FeelsBadge t={skyT} hidden={exploded} overrideTemp={exploded ? undefined : badgeTemp} />
          </HeroScene>
        </div>

        {/* Tap target over the figure → exploded view */}
        {!exploded && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExploded(true);
              setControls(false);
            }}
            aria-label="Show outfit details"
            style={{
              position: 'absolute',
              left: '50%',
              bottom: '8%',
              transform: 'translateX(-50%)',
              width: 140,
              height: 230,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              zIndex: 4,
            }}
          />
        )}

        {exploded && <ExplodedOutfit items={items} onClose={() => setExploded(false)} />}
      </div>

      {/* Timeline + feedback */}
      <div className="border-t border-outline-variant bg-surface pt-2">
        <div className="flex items-center justify-between px-4 pb-1">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-on-surface">
            <Icon name="pin" size={15} color="var(--md-primary)" />
            {location.name}
            {location.admin1 ? `, ${location.admin1}` : ''}
          </span>
          <span className="text-xs text-on-surface-variant">{description}</span>
        </div>
        <Timeline t={t} prominent={controls} onScrub={onScrub} />
        <FeedbackRow onFeedback={handleVerdict} disabled={!feedbackEnabled} active={comfortFor} />
        {feedbackEnabled && comfortFor ? (
          <ComfortPicker
            verdict={comfortFor}
            worn={worn}
            onToggle={(id) =>
              setWorn((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]))
            }
            onSave={() => {
              onFeedback(comfortFor, worn);
              closeComfort();
            }}
            onSkip={() => {
              onFeedback(comfortFor);
              closeComfort();
            }}
          />
        ) : !signedIn ? (
          <p className="px-5 pb-4 text-sm text-on-surface-variant">Sign in to add feedback.</p>
        ) : !isToday ? (
          <p className="px-5 pb-4 text-sm text-on-surface-variant">
            Feedback applies to today&apos;s outfit.
          </p>
        ) : feedbackMsg ? (
          <p className="px-5 pb-4 text-sm text-on-surface-variant">{feedbackMsg}</p>
        ) : null}
      </div>
    </div>
  );
}

// ── Feedback row — icon tones (snowflake / sun / check) ────────
function FeedbackRow({
  onFeedback,
  disabled,
  active,
}: {
  onFeedback: (v: Verdict) => void;
  disabled?: boolean;
  active?: Verdict | null;
}) {
  const items = [
    { id: 'too_cold' as const, icon: 'snowflake' as const, label: 'Too cold', tone: 'cool' },
    { id: 'too_hot' as const, icon: 'sun' as const, label: 'Too hot', tone: 'warm' },
    { id: 'just_right' as const, icon: 'check' as const, label: 'Perfect', tone: 'just' },
  ];
  const tones: Record<string, { cls: string; ring: string }> = {
    cool: { cls: 'bg-cool-container text-cool', ring: 'border-cool' },
    warm: { cls: 'bg-warm-container text-warm', ring: 'border-warm' },
    just: { cls: 'bg-just-container text-just', ring: 'border-just' },
  };
  return (
    <div className="flex gap-2.5 px-5 pb-4 pt-2">
      {items.map((it) => {
        const tone = tones[it.tone];
        const isActive = active === it.id;
        return (
          <button
            key={it.id}
            aria-label={it.label}
            disabled={disabled}
            onClick={() => onFeedback(it.id)}
            className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border-2 text-sm font-medium transition-shadow ${tone.cls} ${
              isActive ? tone.ring : 'border-transparent'
            } ${disabled ? 'cursor-not-allowed opacity-40' : 'hover:shadow-[var(--md-elev-1)]'}`}
          >
            <Icon name={it.icon} size={20} strokeWidth={1.8} />
            <span className="hidden sm:inline">{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Comfort picker — "what did you wear that felt comfortable?" ──
function ComfortPicker({
  verdict,
  worn,
  onToggle,
  onSave,
  onSkip,
}: {
  verdict: Verdict;
  worn: string[];
  onToggle: (id: string) => void;
  onSave: () => void;
  onSkip: () => void;
}) {
  const direction = verdict === 'too_cold' ? 'warmer' : 'cooler';
  return (
    <div className="mx-5 mb-4 rounded-2xl border border-outline-variant bg-surface-low p-4">
      <p className="text-sm font-medium text-on-surface">
        What did you wear that felt comfortable?
      </p>
      <p className="mt-0.5 text-xs text-on-surface-variant">
        Optional — tells Coat Check what actually felt right ({direction} than suggested) next time
        it&apos;s like this.
      </p>
      <div className="mt-3 flex flex-col gap-3">
        {CATEGORIES.map((cat) => {
          const catItems = DEFAULT_CATALOG.filter((i) => i.category === cat);
          if (catItems.length === 0) return null;
          return (
            <div key={cat}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-primary">
                {cat}
              </p>
              <div className="flex flex-wrap gap-2">
                {catItems.map((item) => {
                  const on = worn.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => onToggle(item.id)}
                      aria-pressed={on}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                        on
                          ? 'border-transparent bg-secondary-container text-on-secondary-container'
                          : 'border-outline-variant text-on-surface-variant hover:bg-surface-high'
                      }`}
                    >
                      <Icon name={getItemIcon(item)} size={15} strokeWidth={1.6} />
                      {item.name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          onClick={onSkip}
          className="rounded-full px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-high"
        >
          Skip
        </button>
        <button
          onClick={onSave}
          disabled={worn.length === 0}
          className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-on-primary shadow-[var(--md-elev-1)] transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </div>
  );
}

// ── Exploded outfit overlay — real recommended items splayed out ──
function ExplodedOutfit({ items, onClose }: { items: ClothingItem[]; onClose: () => void }) {
  const left = items.filter((_, i) => i % 2 === 0);
  const right = items.filter((_, i) => i % 2 === 1);
  const distribute = (n: number, i: number) => {
    const top = 14,
      bottom = 84;
    if (n <= 1) return (top + bottom) / 2;
    return top + ((bottom - top) * i) / (n - 1);
  };

  return (
    <div
      className="absolute inset-0"
      style={{ animation: 'ccFadeIn 0.32s cubic-bezier(0.2,0,0.1,1) both', zIndex: 20 }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,10,25,0.5)', pointerEvents: 'none' }} />

      {/* Leader lines from the figure to each chip */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }}
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        {left.map((it, i) => (
          <line
            key={'l' + it.id}
            x1={38}
            y1={distribute(left.length, i)}
            x2={45}
            y2={distribute(left.length, i)}
            stroke="rgba(255,255,255,0.7)"
            strokeWidth="0.18"
            strokeDasharray="0.7 0.7"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {right.map((it, i) => (
          <line
            key={'r' + it.id}
            x1={62}
            y1={distribute(right.length, i)}
            x2={55}
            y2={distribute(right.length, i)}
            stroke="rgba(255,255,255,0.7)"
            strokeWidth="0.18"
            strokeDasharray="0.7 0.7"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {left.map((it, i) => (
        <ExpChip key={it.id} item={it} side="left" y={distribute(left.length, i)} />
      ))}
      {right.map((it, i) => (
        <ExpChip key={it.id} item={it} side="right" y={distribute(right.length, i)} />
      ))}

      {/* Caption pill */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 14,
          transform: 'translateX(-50%)',
          padding: '6px 14px',
          borderRadius: 999,
          background: 'rgba(255,255,255,0.95)',
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--md-on-surface)',
          boxShadow: 'var(--md-elev-1)',
          whiteSpace: 'nowrap',
          zIndex: 11,
        }}
      >
        What am I wearing? · {items.length} item{items.length === 1 ? '' : 's'}
      </div>

      {/* Back + close */}
      <button
        onClick={onClose}
        aria-label="Back to scene"
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          height: 36,
          borderRadius: 18,
          border: 'none',
          background: 'rgba(255,255,255,0.95)',
          color: 'var(--md-on-surface)',
          padding: '0 14px 0 8px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          cursor: 'pointer',
          boxShadow: 'var(--md-elev-1)',
          fontSize: 13,
          fontWeight: 500,
          zIndex: 11,
        }}
      >
        <Icon name="arrowBack" size={18} strokeWidth={2} />
        Back
      </button>
      <button
        onClick={onClose}
        aria-label="Close outfit details"
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(255,255,255,0.95)',
          color: 'var(--md-on-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: 'var(--md-elev-1)',
          zIndex: 11,
        }}
      >
        <Icon name="close" size={18} strokeWidth={2} />
      </button>
    </div>
  );
}

function ExpChip({ item, side, y }: { item: ClothingItem; side: 'left' | 'right'; y: number }) {
  return (
    <div
      role="group"
      aria-label={item.name}
      style={{
        position: 'absolute',
        ...(side === 'left' ? { left: 8 } : { right: 8 }),
        top: `${y}%`,
        transform: 'translateY(-50%)',
        background: 'rgba(255,255,255,0.97)',
        borderRadius: 12,
        padding: '6px 8px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        boxShadow: 'var(--md-elev-2)',
        maxWidth: 168,
        minWidth: 132,
        zIndex: 10,
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: 7,
          background: 'var(--md-primary-container)',
          color: 'var(--md-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name={getItemIcon(item)} size={15} strokeWidth={1.5} />
      </div>
      <div style={{ flex: '0 1 auto', minWidth: 0, lineHeight: 1.1 }}>
        <div
          style={{
            fontSize: 11.5,
            color: 'var(--md-on-surface)',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {item.name}
        </div>
      </div>
      <button
        aria-label={`Swap ${item.name}`}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--md-primary)',
          fontSize: 10.5,
          fontWeight: 600,
          padding: '0 2px',
          letterSpacing: 0.2,
          flexShrink: 0,
        }}
      >
        Swap
      </button>
    </div>
  );
}
