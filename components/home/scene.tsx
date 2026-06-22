'use client';

// Animated-home scene engine — ported from the Claude Design prototype
// (shared/animated-home.jsx). Renders a faceless figure walking in place while the
// world (sky / parallax / weather / outfit) progresses across a day, all driven by a
// single t∈[0,1] mapping 06:00→21:00. Self-contained SVG + inline styles; keyframes
// live in globals.css (ahs*). Kept close to the original so it can be re-synced.

import { useRef, type ReactNode } from 'react';
import { isSnowCode, rainIntensity, type RainIntensity } from '@/lib/wmo';
import type { Recommendation, WeatherSnapshot } from '@/lib/types';

// ── Interpolation helpers ──────────────────────────────────────
export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
export function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
function smooth(t: number) {
  return t * t * (3 - 2 * t);
}
function lerpHex(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ra = (pa >> 16) & 255,
    ga = (pa >> 8) & 255,
    ba = pa & 255;
  const rb = (pb >> 16) & 255,
    gb = (pb >> 8) & 255,
    bb = pb & 255;
  const r = Math.round(lerp(ra, rb, t));
  const g = Math.round(lerp(ga, gb, t));
  const b2 = Math.round(lerp(ba, bb, t));
  return '#' + ((r << 16) | (g << 8) | b2).toString(16).padStart(6, '0');
}
// Sample a stops array at t. Each stop is [t, value]; lerps between neighbours.
function sample<T>(stops: [number, T][], t: number, lerpFn: (a: T, b: T, k: number) => T): T {
  if (t <= stops[0][0]) return stops[0][1];
  if (t >= stops[stops.length - 1][0]) return stops[stops.length - 1][1];
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, v0] = stops[i];
    const [t1, v1] = stops[i + 1];
    if (t >= t0 && t <= t1) {
      const k = smooth((t - t0) / (t1 - t0));
      return lerpFn(v0, v1, k);
    }
  }
  return stops[stops.length - 1][1];
}
const sampleNum = (stops: [number, number][], t: number) => sample(stops, t, lerp);
const sampleHex = (stops: [number, string][], t: number) => sample(stops, t, lerpHex);

// ── Day model ──────────────────────────────────────────────────
export const HOUR_START = 6;
export const HOUR_END = 21;
export function tToHour(t: number) {
  return HOUR_START + t * (HOUR_END - HOUR_START);
}
export function formatClock(t: number) {
  const h = tToHour(t);
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

const SKY_TOP: [number, string][] = [
  [0.0, '#3D2B5C'],
  [0.08, '#E8A99A'],
  [0.22, '#9DB7CC'],
  [0.45, '#D7C68A'],
  [0.62, '#E89466'],
  [0.82, '#B26447'],
  [1.0, '#2A2659'],
];
const SKY_BOT: [number, string][] = [
  [0.0, '#6E4D7F'],
  [0.08, '#FBD2BF'],
  [0.22, '#E0EDF4'],
  [0.45, '#FBE4B6'],
  [0.62, '#FCC59C'],
  [0.82, '#E89D70'],
  [1.0, '#4B3B7C'],
];
const TEMP: [number, number][] = [
  [0.0, 3],
  [0.07, 4],
  [0.2, 7],
  [0.4, 11],
  [0.6, 18],
  [0.8, 13],
  [1.0, 10],
];
const RAIN: [number, number][] = [
  [0.0, 0.85],
  [0.07, 0.95],
  [0.16, 0.7],
  [0.24, 0.2],
  [0.3, 0.0],
  [1.0, 0.0],
];
const SUN_RAYS: [number, number][] = [
  [0.0, 0.0],
  [0.45, 0.0],
  [0.6, 0.55],
  [0.78, 0.35],
  [0.9, 0.0],
];
const CLOUDS: [number, number][] = [
  [0.0, 0.7],
  [0.2, 0.85],
  [0.4, 0.5],
  [0.6, 0.25],
  [0.8, 0.4],
  [1.0, 0.6],
];

export type Outfit = Record<string, number>;

// Outfit layer visibility 0..1, keyed by t. Essentials always on; the rest crossfade.
export function outfitAt(t: number): Outfit {
  const midMorning = clamp(1 - (t - 0.42) * 10, 0, 1);
  const midDusk = clamp((t - 0.78) * 6, 0, 1);
  return {
    base: 1,
    mid: Math.max(midMorning, midDusk),
    shell: clamp(1 - (t - 0.18) * 10, 0, 1),
    bottoms: 1,
    footwear: 1,
    scarf: clamp(1 - (t - 0.3) * 8, 0, 1),
    umbrella: clamp(1 - (t - 0.22) * 12, 0, 1),
    beanie: clamp(1 - (t - 0.25) * 8, 0, 1),
    sunglasses: clamp((t - 0.5) * 8, 0, 1) * clamp(1 - (t - 0.8) * 10, 0, 1),
  };
}

export function celestialAt(t: number) {
  const isMoon = t > 0.85;
  if (isMoon) {
    const k = (t - 0.85) / 0.15;
    return { isMoon: true, x: lerp(15, 70, k), y: lerp(40, 18, k) };
  }
  const k = clamp((t - 0.05) / 0.8, 0, 1);
  const x = lerp(8, 92, k);
  const y = 70 - Math.sin(k * Math.PI) * 55;
  return { isMoon: false, x, y };
}

export function tempAt(t: number) {
  return Math.round(sampleNum(TEMP, t));
}

// ── Real-weather overrides ─────────────────────────────────────
// The day model above drives the illustrative "day tour". For the resting state we instead
// derive the scene from the live Open-Meteo snapshot + the actual recommendation, so the
// painted weather and the figure's layers match what the user is being told.

export interface SceneWeather {
  /** Rain overlay + wet-path sheen, 0..1. */
  rain: number;
  /** Cloud-cover opacity, 0..1. */
  clouds: number;
  /** Clear-sky factor (0 overcast … 1 clear); multiplies the time-of-day sun-ray envelope. */
  clearFactor: number;
}

// Base rain-overlay strength per intensity bucket (before the probability nudge).
const RAIN_BASE: Record<RainIntensity, number> = {
  none: 0,
  drizzle: 0.35,
  light: 0.6,
  moderate: 0.72,
  heavy: 0.92,
};

// Map a live weather snapshot → scene overlay levels. Rain/snow classification comes from
// lib/wmo (shared); the cloud/clear-sky levels are scene-specific visual tuning.
export function sceneWeatherFromSnapshot(w: WeatherSnapshot): SceneWeather {
  const code = w.weatherCode;

  let clouds: number;
  let clearFactor: number;
  if (code === 0) {
    clouds = 0.12;
    clearFactor = 1;
  } else if (code === 1) {
    clouds = 0.3;
    clearFactor = 0.78;
  } else if (code === 2) {
    clouds = 0.5;
    clearFactor = 0.42;
  } else {
    // 3 overcast, 45/48 fog, all precip/snow/storm → heavy cover, no direct sun
    clouds = code === 3 ? 0.82 : 0.9;
    clearFactor = 0;
  }

  let rain = 0;
  if (w.isRaining && !isSnowCode(code)) {
    rain = RAIN_BASE[rainIntensity(code)] || 0.5;
    // nudge by probability around a 60% pivot
    rain = clamp(rain + (w.precipitationProbability - 60) / 400, 0.25, 0.95);
  } else if (!isSnowCode(code) && w.precipitationProbability >= 60) {
    rain = 0.2; // likely soon, hint at it
  }

  return { rain, clouds, clearFactor };
}

// Map the actual recommendation → which figure layers are worn. Essentials (base/bottoms/
// footwear) always on; the rest reflect the recommended items by id.
export function outfitFromRecommendation(rec: Recommendation): Outfit {
  const ids = new Set(Object.values(rec.itemsByCategory).flat().map((i) => i.id));
  const has = (id: string) => ids.has(id);
  const outerwear = rec.itemsByCategory.Outerwear ?? [];
  return {
    base: 1,
    bottoms: 1,
    footwear: 1,
    mid: has('sweater') || has('thermal_top') ? 1 : 0,
    shell: outerwear.length > 0 ? 1 : 0,
    scarf: has('scarf') ? 1 : 0,
    beanie: has('beanie') ? 1 : 0,
    umbrella: has('umbrella') || has('raincoat') ? 1 : 0,
    sunglasses: has('sunglasses') ? 1 : 0,
  };
}

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
const SKIN = '#E2B89A';
const HAIR = '#3D2A1F';

function Figure({ t, walking, outfit }: { t: number; walking: boolean; outfit?: Outfit }) {
  const o = outfit ?? outfitAt(t);
  const legL = walking ? 'ahsLegL 1.1s ease-in-out infinite' : 'none';
  const legR = walking ? 'ahsLegR 1.1s ease-in-out infinite' : 'none';
  const armL = walking ? 'ahsArmL 1.1s ease-in-out infinite' : 'none';
  const armR = walking ? 'ahsArmR 1.1s ease-in-out infinite' : 'none';
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
          position: 'relative',
          width: '100%',
          height: '100%',
        }}
      >
        <svg viewBox="0 0 130 220" width="130" height="220">
          <ellipse cx="65" cy="216" rx="34" ry="4" fill="#000" opacity="0.15" />
          {/* Bottoms */}
          <g style={{ opacity: o.bottoms, transition: 'opacity 0.4s ease' }}>
            <g style={{ animation: legL, transformOrigin: '60px 130px' }}>
              <path d="M55 130 Q53 165 50 198 L62 198 Q60 165 62 130 Z" fill="#3A4E66" />
            </g>
            <g style={{ animation: legR, transformOrigin: '70px 130px' }}>
              <path d="M68 130 Q70 165 68 198 L80 198 Q77 165 75 130 Z" fill="#3A4E66" />
            </g>
          </g>
          {/* Footwear */}
          <g style={{ opacity: o.footwear, transition: 'opacity 0.4s ease' }}>
            <g style={{ animation: legL, transformOrigin: '60px 130px' }}>
              <ellipse cx="56" cy="206" rx="9" ry="5" fill="#1F1A14" />
            </g>
            <g style={{ animation: legR, transformOrigin: '70px 130px' }}>
              <ellipse cx="74" cy="206" rx="9" ry="5" fill="#1F1A14" />
            </g>
          </g>
          {/* Base layer */}
          <g style={{ opacity: o.base * 0.95, transition: 'opacity 0.45s ease' }}>
            <path d="M40 78 Q35 95 38 130 L92 130 Q95 95 90 78 Q85 70 75 68 L55 68 Q45 70 40 78 Z" fill="#C8B89E" />
            <g style={{ animation: armL, transformOrigin: '40px 80px' }}>
              <path d="M40 78 Q30 95 28 120 L36 122 Q40 100 44 82 Z" fill="#C8B89E" />
            </g>
            <g style={{ animation: armR, transformOrigin: '90px 80px' }}>
              <path d="M90 78 Q100 95 102 120 L94 122 Q90 100 86 82 Z" fill="#C8B89E" />
            </g>
          </g>
          {/* Mid: jumper */}
          <g style={{ opacity: o.mid, transition: 'opacity 0.5s ease' }}>
            <path d="M38 80 Q33 100 35 132 L95 132 Q97 100 92 80 Q86 72 75 70 L55 70 Q44 72 38 80 Z" fill="#6A5D2E" />
            <g style={{ animation: armL, transformOrigin: '38px 80px' }}>
              <path d="M38 80 Q28 100 26 122 L36 124 Q38 102 42 84 Z" fill="#6A5D2E" />
            </g>
            <g style={{ animation: armR, transformOrigin: '92px 80px' }}>
              <path d="M92 80 Q102 100 104 122 L94 124 Q92 102 88 84 Z" fill="#6A5D2E" />
            </g>
          </g>
          {/* Shell */}
          <g style={{ opacity: o.shell, transition: 'opacity 0.55s ease' }}>
            <path d="M34 82 Q28 108 31 138 L99 138 Q102 108 96 82 Q88 72 75 70 L55 70 Q42 72 34 82 Z" fill="#8E4B2C" />
            <path d="M65 78 L65 130" stroke="#5C2E16" strokeWidth="1.5" opacity="0.7" />
            <path d="M50 74 Q65 60 80 74" fill="none" stroke="#5C2E16" strokeWidth="2" opacity="0.4" />
            <g style={{ animation: armL, transformOrigin: '34px 80px' }}>
              <path d="M34 82 Q24 105 22 126 L34 128 Q36 105 40 86 Z" fill="#8E4B2C" />
            </g>
            <g style={{ animation: armR, transformOrigin: '96px 80px' }}>
              <path d="M96 82 Q106 105 108 126 L96 128 Q94 105 90 86 Z" fill="#8E4B2C" />
            </g>
          </g>
          {/* Scarf */}
          <g style={{ opacity: o.scarf, transition: 'opacity 0.5s ease' }}>
            <path d="M48 64 Q42 72 46 80 L60 78 L60 90 L70 90 L70 78 L84 80 Q88 72 82 64 Z" fill="#77584C" />
            <rect x="60" y="78" width="10" height="22" fill="#77584C" />
          </g>
          {/* Head / hair */}
          <g>
            <ellipse cx="65" cy="50" rx="16" ry="18" fill={SKIN} />
            <path d="M50 42 Q48 28 65 26 Q82 28 80 42 Q82 50 78 56 Q76 46 65 44 Q54 46 52 56 Q48 50 50 42 Z" fill={HAIR} />
          </g>
          {/* Beanie */}
          <g style={{ opacity: o.beanie, transition: 'opacity 0.5s ease' }}>
            <path d="M48 44 Q46 28 65 26 Q84 28 82 44 Q82 50 78 52 L52 52 Q48 50 48 44 Z" fill="#3C6E8A" />
            <rect x="49" y="48" width="32" height="5" fill="#2F5A72" />
          </g>
          {/* Sunglasses */}
          <g style={{ opacity: o.sunglasses, transition: 'opacity 0.5s ease' }}>
            <rect x="53" y="47" width="9" height="6" rx="2" fill="#1F1A14" />
            <rect x="68" y="47" width="9" height="6" rx="2" fill="#1F1A14" />
            <line x1="62" y1="50" x2="68" y2="50" stroke="#1F1A14" strokeWidth="1" />
          </g>
          {/* Hands */}
          <g style={{ animation: armL, transformOrigin: '34px 80px' }}>
            <circle cx="32" cy="128" r="5.5" fill={SKIN} />
          </g>
          <g style={{ animation: armR, transformOrigin: '96px 80px' }}>
            <circle cx="98" cy="128" r="5.5" fill={SKIN} />
          </g>
        </svg>
        {/* Umbrella — a wide canopy (original size, held high) centred on a straight vertical
            pole. The pole is held at the right hand (x=98) and meets the middle of the canopy,
            so the canopy sits up and to the right. The svg viewport extends past the 130-wide
            figure so the canopy can reach right of it. Wobble rotates about the hand grip. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: o.umbrella,
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
  outfit?: Outfit;
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
      onMouseDown={(e) => {
        scrub(e.clientX);
        const move = (ev: MouseEvent) => scrub(ev.clientX);
        const up = () => {
          window.removeEventListener('mousemove', move);
          window.removeEventListener('mouseup', up);
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
      }}
      style={{
        position: 'relative',
        height: prominent ? 56 : 36,
        padding: '0 16px',
        transition: 'height 0.25s ease',
        cursor: onScrub ? 'pointer' : 'default',
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
