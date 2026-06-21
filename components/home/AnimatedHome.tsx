'use client';

// Animated walking-figure home — adapts the Claude Design prototype's LivePanel to the
// real web app. Auto-plays a ~6s "day tour" on mount, then rests at the user's real local
// time with the real feels-like temperature; tap the figure to explode the real recommended
// outfit; tap the scene to reveal a scrubable timeline.

import { useEffect, useRef, useState } from 'react';
import {
  HeroScene,
  FeelsBadge,
  Timeline,
  clamp,
  formatClock,
  HOUR_START,
  HOUR_END,
} from './scene';
import { Icon } from '@/components/ui/Icon';
import { getItemIcon } from '@/lib/itemIcons';
import type { Category, ClothingItem, Recommendation, ResolvedLocation, Verdict } from '@/lib/types';

const CATEGORIES: Category[] = ['Tops', 'Bottoms', 'Outerwear', 'Accessories'];

// Browser local time → t (06:00→21:00 maps onto 0..1), clamped.
function nowToT() {
  const d = new Date();
  const h = d.getHours() + d.getMinutes() / 60;
  return clamp((h - HOUR_START) / (HOUR_END - HOUR_START), 0, 1);
}
function nowClock() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

type Phase = 'tour' | 'rest' | 'scrub';

export default function AnimatedHome({
  location,
  rec,
  signedIn,
  onFeedback,
  feedbackMsg,
}: {
  location: ResolvedLocation;
  rec: Recommendation;
  signedIn: boolean;
  onFeedback: (v: Verdict) => void;
  feedbackMsg: string | null;
}) {
  const [phase, setPhase] = useState<Phase>('tour');
  const [t, setT] = useState(0);
  const [controls, setControls] = useState(false);
  const [paused, setPaused] = useState(false);
  const [exploded, setExploded] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [lastInteract, setLastInteract] = useState(0);

  const tourStart = useRef<number | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    setReduced(
      typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }, []);

  // Auto-play tour: 0→1 over 6s, then settle to the real local time.
  useEffect(() => {
    if (phase !== 'tour') return;
    if (reduced) {
      setT(nowToT());
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
        setT(nowToT());
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, reduced]);

  // Auto-fade controls 3s after the last interaction.
  useEffect(() => {
    if (!controls) return;
    const id = setTimeout(() => setControls(false), 3000);
    return () => clearTimeout(id);
  }, [controls, lastInteract, t]);

  const onSceneTap = () => {
    if (phase === 'tour') return;
    setControls(true);
    setLastInteract(Date.now());
  };
  const onScrub = (next: number) => {
    setT(next);
    setControls(true);
    setLastInteract(Date.now());
    setPhase('scrub');
  };

  const walking = !reduced && phase === 'tour';
  const restingTemp = phase === 'rest' ? Math.round(rec.weather.feelsLikeC) : undefined;
  const clockLabel = phase === 'rest' ? nowClock() : undefined;

  const items: ClothingItem[] = CATEGORIES.flatMap((c) => rec.itemsByCategory[c] ?? []);

  return (
    <div className="overflow-hidden rounded-[28px] border border-outline-variant bg-surface shadow-[var(--md-elev-2)]">
      {/* Hero scene */}
      <div className="relative" style={{ height: 'clamp(380px, 56vh, 520px)' }}>
        <div className="absolute inset-0">
          <HeroScene t={t} walking={walking && !exploded} onTap={onSceneTap} clockLabel={clockLabel}>
            <FeelsBadge t={t} hidden={controls || exploded} overrideTemp={exploded ? undefined : restingTemp} />
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

        {/* Play/pause when controls are prominent */}
        {controls && !exploded && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setPaused(!paused);
              setLastInteract(Date.now());
            }}
            aria-label={paused ? 'Play' : 'Pause'}
            style={{
              position: 'absolute',
              left: '50%',
              bottom: 16,
              transform: 'translateX(-50%)',
              width: 44,
              height: 44,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(255,255,255,0.92)',
              color: 'var(--md-on-surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: 'var(--md-elev-2)',
              animation: 'ccFadeIn 0.25s ease',
              zIndex: 5,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              {paused ? (
                <path d="M8 5v14l11-7z" />
              ) : (
                <g>
                  <rect x="6" y="5" width="4" height="14" />
                  <rect x="14" y="5" width="4" height="14" />
                </g>
              )}
            </svg>
          </button>
        )}
      </div>

      {/* Timeline + feedback */}
      <div className="border-t border-outline-variant bg-surface pt-2">
        <div className="flex items-center justify-between px-4 pb-1">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-on-surface">
            <Icon name="pin" size={15} color="var(--md-primary)" />
            {location.name}
            {location.admin1 ? `, ${location.admin1}` : ''}
          </span>
          <span className="text-xs text-on-surface-variant">{rec.weather.description}</span>
        </div>
        <Timeline t={t} prominent={controls} onScrub={onScrub} />
        <FeedbackRow onFeedback={onFeedback} disabled={!signedIn} />
        {!signedIn ? (
          <p className="px-5 pb-4 text-sm text-on-surface-variant">Sign in to add feedback.</p>
        ) : feedbackMsg ? (
          <p className="px-5 pb-4 text-sm text-on-surface-variant">{feedbackMsg}</p>
        ) : null}
      </div>
    </div>
  );
}

// ── Feedback row — icon tones (snowflake / sun / check) ────────
function FeedbackRow({ onFeedback, disabled }: { onFeedback: (v: Verdict) => void; disabled?: boolean }) {
  const items = [
    { id: 'too_cold' as const, icon: 'snowflake' as const, label: 'Too cold', tone: 'cool' },
    { id: 'too_hot' as const, icon: 'sun' as const, label: 'Too hot', tone: 'warm' },
    { id: 'just_right' as const, icon: 'check' as const, label: 'Perfect', tone: 'just' },
  ];
  const tones: Record<string, string> = {
    cool: 'bg-cool-container text-cool',
    warm: 'bg-warm-container text-warm',
    just: 'bg-just-container text-just',
  };
  return (
    <div className="flex gap-2.5 px-5 pb-4 pt-2">
      {items.map((it) => (
        <button
          key={it.id}
          aria-label={it.label}
          disabled={disabled}
          onClick={() => onFeedback(it.id)}
          className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-transparent text-sm font-medium transition-shadow ${tones[it.tone]} ${
            disabled ? 'cursor-not-allowed opacity-40' : 'hover:shadow-[var(--md-elev-1)]'
          }`}
        >
          <Icon name={it.icon} size={20} strokeWidth={1.8} />
          <span className="hidden sm:inline">{it.label}</span>
        </button>
      ))}
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
