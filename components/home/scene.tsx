'use client';

// Animated-home scene engine — ported from the Claude Design prototype
// (shared/animated-home.jsx). Renders a faceless figure walking in place while the
// world (sky / parallax / weather / outfit) progresses across a day, all driven by a
// single t∈[0,1] mapping 06:00→21:00. Self-contained SVG + inline styles; keyframes
// live in globals.css (ahs*). Kept close to the original so it can be re-synced.

import { useRef, type ReactNode } from 'react';
import {
  clamp,
  lerp,
  lerpHex,
  sample,
  sampleHex,
  sampleNum,
  celestialAt,
  outfitAt,
  formatClock,
  CLOUDS,
  RAIN,
  SKY_BOT,
  SKY_TOP,
  SUN_RAYS,
  TEMP,
  type WornOutfit,
  type SceneWeather,
} from '@/lib/scene-model';
import { FigureBody, STATIC_ANIM, type Anim } from './garments';
import { useWalkDelay } from './useWalkDelay';

// SVG presentation layer for the animated-home scene. All pure model logic (interpolation,
// the day-tour curves, and the real-weather mappers) lives in lib/scene-model.ts; this file is
// just the React/SVG rendering. Keyframes live in globals.css (ahs*).

// Re-export the model pieces other components still import from './scene'.
export {
  clamp,
  formatClock,
  HOUR_START,
  HOUR_END,
  sceneWeatherFromSnapshot,
  outfitFromRecommendation,
  type SceneWeather,
  type WornOutfit,
} from '@/lib/scene-model';

// ── Scene layers ───────────────────────────────────────────────
function Sky({ t }: { t: number }) {
  const top = sampleHex(SKY_TOP, t);
  const bot = sampleHex(SKY_BOT, t);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `linear-gradient(180deg, ${top} 0%, ${bot} 100%)`,
      }}
    />
  );
}

function Celestial({ t, clearFactor }: { t: number; clearFactor?: number }) {
  const c = celestialAt(t);
  const sunColor = sampleHex(
    [
      [0.05, '#FFE8A6'],
      [0.2, '#FFEFC8'],
      [0.6, '#FFCB7A'],
      [0.85, '#E07A4A'],
    ],
    t
  );
  // Overcast/storm sky (clearFactor→0) masks the sun disc; the moon is left untouched.
  const sunOpacity = c.isMoon ? 1 : (clearFactor ?? 1);
  return (
    <div
      style={{
        position: 'absolute',
        left: `${c.x}%`,
        top: `${c.y}%`,
        width: 60,
        height: 60,
        marginLeft: -30,
        marginTop: -30,
        opacity: sunOpacity,
        transition: 'left 60ms linear, top 60ms linear, opacity 0.4s ease',
        pointerEvents: 'none',
      }}
    >
      {c.isMoon ? (
        <svg width="60" height="60" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r="18" fill="#F4EBD6" opacity="0.92" />
          <circle cx="34" cy="27" r="18" fill="#2A2659" />
        </svg>
      ) : (
        <svg width="60" height="60" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r="22" fill={sunColor} opacity="0.35" />
          <circle cx="30" cy="30" r="14" fill={sunColor} />
        </svg>
      )}
    </div>
  );
}

function Clouds({ t, walking, opacity: opacityOverride }: { t: number; walking: boolean; opacity?: number }) {
  const opacity = opacityOverride ?? sampleNum(CLOUDS, t);
  const tint = sampleHex(
    [
      [0.0, '#B59FCC'],
      [0.1, '#FFE6D2'],
      [0.25, '#FFFFFF'],
      [0.55, '#FFF5E0'],
      [0.78, '#F4A982'],
      [1.0, '#3D3A6F'],
    ],
    t
  );
  return (
    <div style={{ position: 'absolute', inset: 0, opacity, pointerEvents: 'none' }}>
      <svg
        width="200%"
        height="100%"
        viewBox="0 0 1400 400"
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: '100%',
          animation: walking ? 'ahsCloudDrift 40s linear infinite' : 'none',
        }}
      >
        <g fill={tint}>
          <ellipse cx="120" cy="80" rx="70" ry="18" />
          <ellipse cx="320" cy="110" rx="90" ry="22" opacity="0.85" />
          <ellipse cx="560" cy="60" rx="55" ry="14" />
          <ellipse cx="800" cy="100" rx="100" ry="20" opacity="0.7" />
          <ellipse cx="1040" cy="70" rx="65" ry="16" />
          <ellipse cx="1240" cy="120" rx="85" ry="22" opacity="0.85" />
        </g>
      </svg>
    </div>
  );
}

function FarHills({ t, walking }: { t: number; walking: boolean }) {
  const hillTint = sampleHex(
    [
      [0.0, '#3D324F'],
      [0.1, '#7A6688'],
      [0.25, '#8AA8B6'],
      [0.55, '#A6997C'],
      [0.8, '#7A4F4A'],
      [1.0, '#1F1B40'],
    ],
    t
  );
  return (
    <div
      style={{ position: 'absolute', left: 0, right: 0, bottom: '24%', height: '40%', pointerEvents: 'none' }}
    >
      <svg
        width="200%"
        height="100%"
        viewBox="0 0 1400 200"
        preserveAspectRatio="xMidYMax slice"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: '100%',
          animation: walking ? 'ahsParallaxSlow 22s linear infinite' : 'none',
        }}
      >
        <path
          d="M0 200 V120 Q90 80 180 105 T360 110 Q450 70 540 100 T720 115 Q810 75 900 100 T1080 110 Q1170 80 1260 102 T1400 115 V200 Z"
          fill={hillTint}
          opacity="0.85"
        />
      </svg>
    </div>
  );
}

function MidBuildings({ t, walking }: { t: number; walking: boolean }) {
  const tint = sampleHex(
    [
      [0.0, '#2A2245'],
      [0.1, '#5D4860'],
      [0.25, '#5E6C77'],
      [0.55, '#7A5C42'],
      [0.8, '#5B3934'],
      [1.0, '#15123A'],
    ],
    t
  );
  const winGlow = clamp((t - 0.7) * 4, 0, 1) * 0.9 + clamp(0.18 - t, 0, 0.18) * 5;
  return (
    <div
      style={{ position: 'absolute', left: 0, right: 0, bottom: '16%', height: '32%', pointerEvents: 'none' }}
    >
      <svg
        width="200%"
        height="100%"
        viewBox="0 0 1400 200"
        preserveAspectRatio="xMidYMax slice"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: '100%',
          animation: walking ? 'ahsParallaxMed 14s linear infinite' : 'none',
        }}
      >
        <g fill={tint}>
          <ellipse cx="80" cy="170" rx="34" ry="42" />
          <rect x="76" y="170" width="8" height="20" />
          <ellipse cx="180" cy="175" rx="26" ry="32" />
          <rect x="177" y="175" width="6" height="15" />
          <rect x="240" y="80" width="60" height="120" rx="2" />
          <rect x="310" y="100" width="40" height="100" rx="2" />
          <rect x="360" y="60" width="70" height="140" rx="2" />
          <path d="M360 60 L395 35 L430 60 Z" />
          <ellipse cx="490" cy="172" rx="38" ry="44" />
          <rect x="486" y="172" width="8" height="20" />
          <rect x="560" y="90" width="55" height="110" rx="2" />
          <rect x="625" y="70" width="80" height="130" rx="2" />
          <rect x="715" y="100" width="45" height="100" rx="2" />
          <ellipse cx="820" cy="170" rx="32" ry="40" />
          <rect x="817" y="170" width="6" height="18" />
          <rect x="880" y="60" width="65" height="140" rx="2" />
          <rect x="955" y="80" width="50" height="120" rx="2" />
          <rect x="1015" y="100" width="40" height="100" rx="2" />
          <path d="M880 60 L912 30 L945 60 Z" />
          <ellipse cx="1110" cy="172" rx="30" ry="38" />
          <rect x="1107" y="172" width="6" height="18" />
          <rect x="1170" y="85" width="58" height="115" rx="2" />
          <rect x="1238" y="65" width="78" height="135" rx="2" />
          <rect x="1325" y="95" width="42" height="105" rx="2" />
        </g>
        <g fill="#FFD27A" opacity={clamp(winGlow, 0, 1)}>
          <rect x="247" y="92" width="6" height="8" />
          <rect x="265" y="92" width="6" height="8" />
          <rect x="283" y="105" width="6" height="8" />
          <rect x="320" y="115" width="5" height="7" />
          <rect x="335" y="130" width="5" height="7" />
          <rect x="375" y="75" width="6" height="8" />
          <rect x="395" y="90" width="6" height="8" />
          <rect x="415" y="75" width="6" height="8" />
          <rect x="568" y="100" width="5" height="7" />
          <rect x="585" y="125" width="5" height="7" />
          <rect x="635" y="85" width="6" height="8" />
          <rect x="660" y="100" width="6" height="8" />
          <rect x="685" y="120" width="6" height="8" />
          <rect x="725" y="110" width="5" height="7" />
          <rect x="888" y="80" width="6" height="8" />
          <rect x="908" y="95" width="6" height="8" />
          <rect x="930" y="110" width="6" height="8" />
          <rect x="965" y="100" width="5" height="7" />
          <rect x="985" y="130" width="5" height="7" />
          <rect x="1180" y="100" width="5" height="7" />
          <rect x="1198" y="125" width="5" height="7" />
          <rect x="1248" y="75" width="6" height="8" />
          <rect x="1268" y="95" width="6" height="8" />
          <rect x="1290" y="115" width="6" height="8" />
        </g>
      </svg>
    </div>
  );
}

function Foreground({ t, walking, wetness }: { t: number; walking: boolean; wetness?: number }) {
  const pathTint = sampleHex(
    [
      [0.0, '#1F1A2E'],
      [0.1, '#5C4A4F'],
      [0.25, '#9F8E7E'],
      [0.55, '#C7A57C'],
      [0.8, '#7E4F3F'],
      [1.0, '#0F0E2A'],
    ],
    t
  );
  const wetSheen = (wetness ?? sampleNum(RAIN, t)) * 0.6;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '18%', pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, ${pathTint} 0%, ${lerpHex(pathTint, '#000000', 0.25)} 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, rgba(255,255,255,${wetSheen * 0.18}) 0%, transparent 35%)`,
          mixBlendMode: 'screen',
        }}
      />
      <svg
        width="200%"
        height="100%"
        viewBox="0 0 1400 100"
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: '100%',
          animation: walking ? 'ahsParallaxFast 4.5s linear infinite' : 'none',
        }}
      >
        {Array.from({ length: 16 }).map((_, i) => (
          <rect
            key={i}
            x={i * 90}
            y={28}
            width="40"
            height="3"
            rx="1.5"
            fill={lerpHex(pathTint, '#FFFFFF', 0.18)}
            opacity="0.6"
          />
        ))}
        <line x1="0" y1="12" x2="1400" y2="12" stroke={lerpHex(pathTint, '#FFFFFF', 0.25)} strokeWidth="1" opacity="0.5" />
      </svg>
    </div>
  );
}

function Rain({
  t,
  walking,
  intensity: intensityOverride,
  animate,
}: {
  t: number;
  walking: boolean;
  intensity?: number;
  animate?: boolean;
}) {
  const intensity = intensityOverride ?? sampleNum(RAIN, t);
  if (intensity < 0.04) return null;
  const falling = animate ?? walking;
  return (
    <div
      style={{ position: 'absolute', inset: 0, opacity: intensity, pointerEvents: 'none', overflow: 'hidden' }}
      aria-hidden
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 390 500"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: 'absolute', inset: 0 }}
      >
        <g stroke="#D0DCE8" strokeWidth="1.2" strokeLinecap="round" opacity="0.7">
          {Array.from({ length: 38 }).map((_, i) => {
            const x = (i * 31) % 390;
            const y = (i * 43) % 500;
            return (
              <line
                key={i}
                x1={x}
                y1={y - 14}
                x2={x - 3}
                y2={y - 2}
                style={{
                  animation: falling ? `ahsRain ${0.55 + (i % 5) * 0.05}s linear infinite` : 'none',
                  animationDelay: `${(i % 7) * -0.08}s`,
                  transformOrigin: 'center',
                }}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}

function SunRays({ t, clearFactor }: { t: number; clearFactor?: number }) {
  // Keep the time-of-day envelope (rays only mid-day); scale by how clear the real sky is.
  const o = sampleNum(SUN_RAYS, t) * (clearFactor ?? 1);
  if (o < 0.04) return null;
  const c = celestialAt(t);
  return (
    <div
      style={{
        position: 'absolute',
        left: `${c.x}%`,
        top: `${c.y}%`,
        width: 320,
        height: 320,
        marginLeft: -160,
        marginTop: -160,
        opacity: o,
        pointerEvents: 'none',
      }}
      aria-hidden
    >
      <svg viewBox="0 0 320 320" width="320" height="320">
        <defs>
          <radialGradient id="ahsRay" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFE8B0" stopOpacity="0.75" />
            <stop offset="60%" stopColor="#FFCB7A" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#FFCB7A" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="160" cy="160" r="160" fill="url(#ahsRay)" />
      </svg>
    </div>
  );
}

// ── Figure ─────────────────────────────────────────────────────
function Figure({ t, walking, outfit }: { t: number; walking: boolean; outfit?: WornOutfit }) {
  const worn = outfit ?? outfitAt(t);
  const anim: Anim = walking
    ? {
        legL: 'ahsLegL 1.1s ease-in-out infinite',
        legR: 'ahsLegR 1.1s ease-in-out infinite',
        armL: 'ahsArmL 1.1s ease-in-out infinite',
        armR: 'ahsArmR 1.1s ease-in-out infinite',
      }
    : STATIC_ANIM;
  const bobDelay = useWalkDelay(walking);
  return (
    <div
      className="ahs-figure-anchor"
      style={{
        position: 'absolute',
        left: '50%',
        bottom: '12%',
        transform: 'translateX(-50%)',
        width: 130,
        height: 220,
        pointerEvents: 'none',
      }}
    >
      <div
        className="ahs-figure-bob"
        style={{
          animation: walking ? 'ahsBob 1.1s ease-in-out infinite' : 'ahsBobAmbient 4s ease-in-out infinite',
          // Anchor the bob to the same walk phase as the limbs (which are phase-corrected too).
          animationDelay: bobDelay,
          position: 'relative',
          width: '100%',
          height: '100%',
        }}
      >
        <svg viewBox="0 0 130 220" width="130" height="220">
          <FigureBody worn={worn} anim={anim} />
        </svg>
        {/* Umbrella — a wide canopy (original size, held high) centred on a straight vertical
            pole. The pole is held at the right hand (x=98) and meets the middle of the canopy,
            so the canopy sits up and to the right. The svg viewport extends past the 130-wide
            figure so the canopy can reach right of it. Wobble rotates about the hand grip. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: worn.umbrella ? 1 : 0,
            transition: 'opacity 0.5s ease',
            transformOrigin: '98px 128px',
            animation: walking ? 'ahsUmbrella 2.4s ease-in-out infinite' : 'none',
          }}
        >
          <svg width="150" height="220" viewBox="0 0 150 220" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
            {/* Canopy — wide, centred on the pole at x=98, lifted clear above the head */}
            <path d="M54 14 Q98 -26 142 14 Z" fill="#A33C3C" stroke="#6E2424" strokeWidth="1.6" />
            <path d="M54 14 Q76 6 98 14 Q120 6 142 14" fill="none" stroke="#6E2424" strokeWidth="0.8" opacity="0.4" />
            <path d="M64 14 Q98 -10 132 14" fill="none" stroke="#6E2424" strokeWidth="0.8" opacity="0.5" />
            {/* Finial */}
            <line x1="98" y1="-6" x2="98" y2="-14" stroke="#6E2424" strokeWidth="1.6" strokeLinecap="round" />
            {/* Straight vertical pole: middle of canopy → right-hand grip */}
            <line x1="98" y1="14" x2="98" y2="128" stroke="#3D2A1F" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ── Feels-like badge ───────────────────────────────────────────
export function FeelsBadge({ t, hidden, overrideTemp }: { t: number; hidden?: boolean; overrideTemp?: number }) {
  const temp = overrideTemp ?? Math.round(sampleNum(TEMP, t));
  const fg = sampleHex(
    [
      [0.0, '#F1E5FF'],
      [0.2, '#1F1A14'],
      [0.8, '#FFFFFF'],
    ],
    t
  );
  const bg = sample<string>(
    [
      [0.0, 'rgba(45,30,75,0.55)'],
      [0.2, 'rgba(255,255,255,0.55)'],
      [0.8, 'rgba(45,30,75,0.55)'],
    ],
    t,
    (a, b, k) => {
      const pa = a.match(/[\d.]+/g)!.map(Number);
      const pb = b.match(/[\d.]+/g)!.map(Number);
      const r = pa.map((v, i) => lerp(v, pb[i], k));
      return `rgba(${Math.round(r[0])},${Math.round(r[1])},${Math.round(r[2])},${r[3].toFixed(2)})`;
    }
  );
  return (
    <div
      style={{
        position: 'absolute',
        top: 44,
        right: 14,
        transform: hidden ? 'translateY(-6px)' : 'translateY(0)',
        opacity: hidden ? 0 : 1,
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        background: bg,
        backdropFilter: 'blur(8px)',
        borderRadius: 14,
        padding: '6px 12px 8px',
        textAlign: 'right',
        color: fg,
        pointerEvents: 'none',
        boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
      }}
    >
      <div style={{ fontSize: 10, opacity: 0.8, letterSpacing: 0.4, fontWeight: 500 }}>FEELS LIKE</div>
      <div style={{ fontSize: 24, fontWeight: 500, lineHeight: 1, marginTop: 2 }}>{temp}°</div>
    </div>
  );
}

function HeroClock({ t, label }: { t: number; label?: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        right: 14,
        fontVariantNumeric: 'tabular-nums',
        fontSize: 24,
        fontWeight: 500,
        color: '#fff',
        letterSpacing: 0.5,
        textShadow: '0 1px 3px rgba(0,0,0,0.35)',
        pointerEvents: 'none',
      }}
    >
      {label ?? formatClock(t)}
    </div>
  );
}

// ── Hero scene — composes everything ───────────────────────────
export function HeroScene({
  t,
  walking,
  onTap,
  clockLabel,
  weather,
  outfit,
  reduced,
  children,
}: {
  t: number;
  walking: boolean;
  onTap?: () => void;
  clockLabel?: string;
  /** Real-weather overlay overrides (resting state). Omit to use the canned day-tour curves. */
  weather?: SceneWeather;
  /** Real recommended outfit for the figure. Omit to use the canned day-tour layering. */
  outfit?: WornOutfit;
  reduced?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      onClick={onTap}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', cursor: 'pointer' }}
    >
      <Sky t={t} />
      <Celestial t={t} clearFactor={weather?.clearFactor} />
      <SunRays t={t} clearFactor={weather?.clearFactor} />
      <Clouds t={t} walking={walking} opacity={weather?.clouds} />
      <FarHills t={t} walking={walking} />
      <MidBuildings t={t} walking={walking} />
      <Foreground t={t} walking={walking} wetness={weather?.rain} />
      <Rain
        t={t}
        walking={walking}
        intensity={weather?.rain}
        animate={weather ? !reduced : undefined}
      />
      <Figure t={t} walking={walking} outfit={outfit} />
      <HeroClock t={t} label={clockLabel} />
      {children}
    </div>
  );
}

// ── Timeline strip ─────────────────────────────────────────────
export function Timeline({
  t,
  prominent,
  onScrub,
}: {
  t: number;
  prominent?: boolean;
  onScrub?: (next: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const scrub = (clientX: number) => {
    if (!onScrub || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    onScrub(clamp(x, 0, 1));
  };
  return (
    <div
      ref={ref}
      data-testid="day-timeline"
      // Pointer events unify mouse, touch and pen. Pointer capture keeps the drag tracking even
      // when the finger leaves the strip; `touchAction: 'none'` stops the browser from claiming
      // the gesture for page scrolling so the slider can actually be dragged on mobile.
      onPointerDown={(e) => {
        if (!onScrub) return;
        const el = ref.current;
        try {
          el?.setPointerCapture(e.pointerId);
        } catch {
          // Some browsers throw if the pointer isn't active; capture is best-effort.
        }
        scrub(e.clientX);
        const move = (ev: PointerEvent) => scrub(ev.clientX);
        const up = (ev: PointerEvent) => {
          try {
            el?.releasePointerCapture(ev.pointerId);
          } catch {
            /* no-op */
          }
          el?.removeEventListener('pointermove', move);
          el?.removeEventListener('pointerup', up);
          el?.removeEventListener('pointercancel', up);
        };
        el?.addEventListener('pointermove', move);
        el?.addEventListener('pointerup', up);
        el?.addEventListener('pointercancel', up);
      }}
      style={{
        position: 'relative',
        height: prominent ? 56 : 36,
        padding: '0 16px',
        transition: 'height 0.25s ease',
        cursor: onScrub ? 'pointer' : 'default',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          top: '50%',
          marginTop: prominent ? -2 : -1.5,
          height: prominent ? 4 : 3,
          borderRadius: 999,
          background: 'var(--md-outline-variant)',
          opacity: prominent ? 1 : 0.7,
          transition: 'all 0.25s ease',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 16,
          top: '50%',
          marginTop: prominent ? -2 : -1.5,
          width: `calc(${t * 100}% - ${t * 32}px)`,
          height: prominent ? 4 : 3,
          borderRadius: 999,
          background: 'var(--md-primary)',
          transition: 'width 0.06s linear, height 0.25s ease',
        }}
      />
      <div style={{ position: 'absolute', left: 16, top: '50%', marginTop: -8, color: 'var(--md-on-surface-variant)', opacity: 0.6 }}>
        <svg width="16" height="16" viewBox="0 0 16 16">
          <circle cx="8" cy="11" r="3" fill="currentColor" />
          <line x1="2" y1="14" x2="14" y2="14" stroke="currentColor" strokeWidth="1.4" />
          <g stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
            <line x1="8" y1="3" x2="8" y2="5" />
            <line x1="3" y1="6" x2="4.5" y2="7" />
            <line x1="13" y1="6" x2="11.5" y2="7" />
          </g>
        </svg>
      </div>
      <div style={{ position: 'absolute', right: 16, top: '50%', marginTop: -8, color: 'var(--md-on-surface-variant)', opacity: 0.6 }}>
        <svg width="16" height="16" viewBox="0 0 16 16">
          <circle cx="8" cy="11" r="3" fill="currentColor" />
          <line x1="2" y1="14" x2="14" y2="14" stroke="currentColor" strokeWidth="1.4" />
          <g stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
            <line x1="8" y1="7" x2="8" y2="5" />
            <line x1="3" y1="9" x2="4.5" y2="8" />
            <line x1="13" y1="9" x2="11.5" y2="8" />
          </g>
        </svg>
      </div>
      <div
        style={{
          position: 'absolute',
          left: `calc(16px + ${t * 100}% - ${t * 32}px - ${prominent ? 10 : 7}px)`,
          top: '50%',
          marginTop: prominent ? -10 : -7,
          width: prominent ? 20 : 14,
          height: prominent ? 20 : 14,
          borderRadius: '50%',
          background: 'var(--md-primary)',
          boxShadow: prominent ? 'var(--md-elev-2)' : 'var(--md-elev-1)',
          border: '2px solid #fff',
          transition: 'all 0.25s ease, left 0.06s linear',
        }}
      />
    </div>
  );
}
