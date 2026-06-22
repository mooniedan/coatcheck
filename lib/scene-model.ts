// Pure model behind the animated-home scene. Framework-free (no React/DOM) so it can be
// unit-tested and reused. The SVG presentation layer lives in components/home/scene.tsx and
// imports from here. Two groups: (1) the illustrative "day tour" driven by t∈[0,1] mapping
// 06:00→21:00, and (2) the real-weather mappers that derive the resting scene from the live
// Open-Meteo snapshot + the actual recommendation.

import { isSnowCode, rainIntensity, type RainIntensity } from './wmo';
import type { Recommendation, WeatherSnapshot } from './types';

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
export function lerpHex(a: string, b: string, t: number) {
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
export function sample<T>(stops: [number, T][], t: number, lerpFn: (a: T, b: T, k: number) => T): T {
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
export const sampleNum = (stops: [number, number][], t: number) => sample(stops, t, lerp);
export const sampleHex = (stops: [number, string][], t: number) => sample(stops, t, lerpHex);

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

export const SKY_TOP: [number, string][] = [
  [0.0, '#3D2B5C'],
  [0.08, '#E8A99A'],
  [0.22, '#9DB7CC'],
  [0.45, '#D7C68A'],
  [0.62, '#E89466'],
  [0.82, '#B26447'],
  [1.0, '#2A2659'],
];
export const SKY_BOT: [number, string][] = [
  [0.0, '#6E4D7F'],
  [0.08, '#FBD2BF'],
  [0.22, '#E0EDF4'],
  [0.45, '#FBE4B6'],
  [0.62, '#FCC59C'],
  [0.82, '#E89D70'],
  [1.0, '#4B3B7C'],
];
export const TEMP: [number, number][] = [
  [0.0, 3],
  [0.07, 4],
  [0.2, 7],
  [0.4, 11],
  [0.6, 18],
  [0.8, 13],
  [1.0, 10],
];
export const RAIN: [number, number][] = [
  [0.0, 0.85],
  [0.07, 0.95],
  [0.16, 0.7],
  [0.24, 0.2],
  [0.3, 0.0],
  [1.0, 0.0],
];
export const SUN_RAYS: [number, number][] = [
  [0.0, 0.0],
  [0.45, 0.0],
  [0.6, 0.55],
  [0.78, 0.35],
  [0.9, 0.0],
];
export const CLOUDS: [number, number][] = [
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

// ── Hour ↔ slider mapping (real, data-backed day) ──────────────
// Parse the local hour-of-day (fractional) from an ISO "YYYY-MM-DDTHH:MM" timestamp.
export function parseLocalHour(iso: string): number {
  if (!iso || iso.length < 16) return NaN;
  return Number(iso.slice(11, 13)) + Number(iso.slice(14, 16)) / 60;
}

// Map a clock hour (0–23) onto the sky model's t (06:00→21:00 ⇒ 0→1), clamped. Lets the real
// selected hour drive the dawn/day/dusk visuals.
export function hourToSkyT(hour: number): number {
  return clamp((hour - HOUR_START) / (HOUR_END - HOUR_START), 0, 1);
}

// The slider's hour window for a day, anchored to real sunrise/sunset (whole hours). Falls
// back to the canned 06:00–21:00 band when sun times are missing.
export function dayWindow(sunrise: string, sunset: string): { start: number; end: number } {
  const s = parseLocalHour(sunrise);
  const e = parseLocalHour(sunset);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return { start: HOUR_START, end: HOUR_END };
  const start = clamp(Math.floor(s), 0, 23);
  const end = clamp(Math.ceil(e), start + 1, 23);
  return { start, end };
}

// ── Real-weather overrides ─────────────────────────────────────
// For the resting state we derive the scene from the live snapshot + the actual recommendation,
// so the painted weather and the figure's layers match what the user is being told.

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
