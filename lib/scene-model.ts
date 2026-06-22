// Pure model behind the animated-home scene. Framework-free (no React/DOM) so it can be
// unit-tested and reused. The SVG presentation layer lives in components/home/scene.tsx and
// imports from here. Two groups: (1) the illustrative "day tour" driven by t∈[0,1] mapping
// 06:00→21:00, and (2) the real-weather mappers that derive the resting scene from the live
// Open-Meteo snapshot + the actual recommendation.

import { isSnowCode, rainIntensity, type RainIntensity } from './wmo';
import { recommend } from './recommend';
import { DEFAULT_CATALOG } from './catalog';
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

// ── Worn outfit (recommendation → what the figure renders) ─────
// The figure shows the single OUTERMOST garment per body region (a coat over a sweater shows the
// coat); hidden layers surface in the exploded view + a layer indicator. Garment ids ARE the
// catalog item ids (lib/catalog.ts). Pure + framework-free so native clients reuse it verbatim.
export interface WornOutfit {
  torso: string | null; // outerwear if any, else the warmest top
  legs: string | null; // the most-covering recommended bottom
  head: string | null; // 'beanie'
  face: string | null; // 'sunglasses'
  neck: string | null; // 'scarf'
  hands: string | null; // 'gloves'
  umbrella: boolean;
  /** Recommended garments in a stacked region (tops+outerwear, bottoms) beyond the one drawn. */
  hiddenLayers: number;
  /** Total recommended items — the layer-indicator label / explode count. */
  itemCount: number;
}

// Outermost-wins priorities (first id present wins).
const TORSO_OUTER = ['heavy_coat', 'raincoat', 'light_jacket', 'windbreaker'];
const TORSO_TOP = ['thermal_top', 'sweater', 'long_sleeve', 'tshirt', 'tank']; // warmest → lightest
const LEG_PRIORITY = ['trousers', 'thermal_leggings', 'shorts'];

function firstPresent(order: string[], present: Set<string>): string | null {
  for (const id of order) if (present.has(id)) return id;
  return null;
}

// Map the actual recommendation → the single outermost garment per region.
export function outfitFromRecommendation(rec: Recommendation): WornOutfit {
  const byCat = rec.itemsByCategory;
  const idsIn = (items?: { id: string }[]) => new Set((items ?? []).map((i) => i.id));
  const tops = idsIn(byCat.Tops);
  const bottoms = idsIn(byCat.Bottoms);
  const outer = idsIn(byCat.Outerwear);
  const acc = idsIn(byCat.Accessories);

  const torso = firstPresent(TORSO_OUTER, outer) ?? firstPresent(TORSO_TOP, tops) ?? 'tshirt';
  const legs = firstPresent(LEG_PRIORITY, bottoms) ?? 'trousers';

  const hiddenLayers = Math.max(0, tops.size + outer.size - 1) + Math.max(0, bottoms.size - 1);
  const itemCount = tops.size + bottoms.size + outer.size + acc.size;

  return {
    torso,
    legs,
    head: acc.has('beanie') ? 'beanie' : null,
    face: acc.has('sunglasses') ? 'sunglasses' : null,
    neck: acc.has('scarf') ? 'scarf' : null,
    hands: acc.has('gloves') ? 'gloves' : null,
    umbrella: acc.has('umbrella'),
    hiddenLayers,
    itemCount,
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

// Day-tour fallback (no hourly data): synthesize a recommendation from the canned temperature /
// rain curves so the figure renders through the same path as the real, data-backed scene.
export function outfitAt(t: number): WornOutfit {
  const feelsLikeC = tempAt(t);
  const isRaining = sampleNum(RAIN, t) > 0.35;
  const snapshot: WeatherSnapshot = {
    feelsLikeC,
    tempC: feelsLikeC,
    humidity: 60,
    windKph: 6,
    precipitationProbability: isRaining ? 80 : 10,
    isRaining,
    weatherCode: isRaining ? 61 : 1,
    description: '',
    observedAt: '',
  };
  return outfitFromRecommendation(recommend(snapshot, DEFAULT_CATALOG));
}

// ── Hour ↔ slider mapping (real, data-backed day) ──────────────
// Parse the local hour-of-day (fractional) from an ISO "YYYY-MM-DDTHH:MM" timestamp.
export function parseLocalHour(iso: string): number {
  if (!iso || iso.length < 16) return NaN;
  return Number(iso.slice(11, 13)) + Number(iso.slice(14, 16)) / 60;
}

// Map a clock hour (0–23) onto the sky model's t (06:00→21:00 ⇒ 0→1), clamped. Fallback when
// real sun times aren't available; prefer skyTAt() which uses the actual sunrise/sunset.
export function hourToSkyT(hour: number): number {
  return clamp((hour - HOUR_START) / (HOUR_END - HOUR_START), 0, 1);
}

// Polar-day/night detection from Open-Meteo's daily daylight_duration (seconds). NaN ⇒ unknown
// (treated as a normal day).
const SECONDS_POLAR_DAY = 86_000; // ≈ 24h of daylight (midnight sun)
const SECONDS_POLAR_NIGHT = 600; // ≈ no daylight (polar night)
export function isPolarDay(daylightSeconds: number): boolean {
  return Number.isFinite(daylightSeconds) && daylightSeconds >= SECONDS_POLAR_DAY;
}
export function isPolarNight(daylightSeconds: number): boolean {
  return Number.isFinite(daylightSeconds) && daylightSeconds <= SECONDS_POLAR_NIGHT;
}

// The slider's hour window for a day, anchored to real sunrise/sunset (whole hours). Polar
// day/night make sunrise/sunset degenerate (sunset rolls to the next day, etc.), so scrub the
// whole 24h instead. Falls back to 06:00–21:00 when sun times are missing.
export function dayWindow(
  sunrise: string,
  sunset: string,
  daylightSeconds = NaN
): { start: number; end: number } {
  if (isPolarDay(daylightSeconds) || isPolarNight(daylightSeconds)) return { start: 0, end: 23 };
  const s = parseLocalHour(sunrise);
  const e = parseLocalHour(sunset);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return { start: HOUR_START, end: HOUR_END };
  const start = clamp(Math.floor(s), 0, 23);
  const end = clamp(Math.ceil(e), start + 1, 23);
  return { start, end };
}

// Sky-arc anchors (see SKY_TOP/SKY_BOT): 0 deep night · 0.08 dawn · 0.45 solar noon (brightest)
// · 0.82 dusk · 1 deep night.
const T_DAWN = 0.08;
const T_NOON = 0.45;
const T_DUSK = 0.82;
const TWILIGHT_H = 1.5; // hours of dawn/dusk ramp around sunrise/sunset

// Map a real local hour to the sky arc using the day's actual sunrise/sunset (and daylight
// duration for the polar cases). This is what makes the light/dark reflect reality: the sky is
// only dark when the sun is actually down — high latitudes and midnight sun included.
export function skyTAt(
  hour: number,
  sunriseHour: number,
  sunsetHour: number,
  daylightSeconds = NaN
): number {
  // Cosine phase: 1 at solar noon (≈12), -1 at solar midnight.
  const phase = (h: number) => Math.cos(((h - 12) / 12) * Math.PI) * 0.5 + 0.5;

  if (isPolarNight(daylightSeconds)) {
    // Always dark; a faint lift toward solar noon so it isn't pitch black.
    return 0.05 * phase(hour);
  }
  if (isPolarDay(daylightSeconds)) {
    // Always light; bright at noon, golden-low at midnight — never reaches the night colours.
    return 0.2 + (T_NOON - 0.2) * phase(hour);
  }

  const sr = Number.isFinite(sunriseHour) ? sunriseHour : HOUR_START;
  const ss = Number.isFinite(sunsetHour) ? sunsetHour : HOUR_END;
  const noon = (sr + ss) / 2;
  if (hour <= sr) {
    // Pre-dawn: ramp from deep night up to dawn over the last TWILIGHT_H hours before sunrise.
    return clamp(((hour - (sr - TWILIGHT_H)) / TWILIGHT_H) * T_DAWN, 0, T_DAWN);
  }
  if (hour <= noon) {
    return lerp(T_DAWN, T_NOON, (hour - sr) / Math.max(0.001, noon - sr));
  }
  if (hour <= ss) {
    return lerp(T_NOON, T_DUSK, (hour - noon) / Math.max(0.001, ss - noon));
  }
  // Post-sunset: ramp from dusk down to deep night over TWILIGHT_H hours.
  return clamp(T_DUSK + ((hour - ss) / TWILIGHT_H) * (1 - T_DUSK), T_DUSK, 1);
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
