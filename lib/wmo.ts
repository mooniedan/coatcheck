// Single source of truth for WMO weather-code interpretation (https://open-meteo.com/en/docs).
// Framework-free and NOT server-only, so the server adapter (lib/weather.ts), the scene engine
// (components/home/scene.tsx) and the week strip (components/home/WeekStrip.tsx) all classify
// codes the same way instead of each maintaining its own divergent copy.

const DESCRIPTIONS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  56: 'Freezing drizzle',
  57: 'Freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Rain showers',
  81: 'Rain showers',
  82: 'Violent rain showers',
  85: 'Snow showers',
  86: 'Snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Thunderstorm with hail',
};

// Rain classified by intensity. The union of these is the canonical "is it raining" set.
export const DRIZZLE_CODES = new Set([51, 53, 55, 56, 57]);
export const RAIN_LIGHT_CODES = new Set([61, 66, 80, 81]);
export const RAIN_MODERATE_CODES = new Set([63]);
export const RAIN_HEAVY_CODES = new Set([65, 67, 82, 95, 96, 99]);
export const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);

const RAIN_CODES = new Set<number>([
  ...DRIZZLE_CODES,
  ...RAIN_LIGHT_CODES,
  ...RAIN_MODERATE_CODES,
  ...RAIN_HEAVY_CODES,
]);

export function describeWeatherCode(code: number): string {
  return DESCRIPTIONS[code] ?? 'Unknown';
}

/** Whether a code denotes drizzle/rain/showers/thunderstorm (excludes snow). */
export function isRainyCode(code: number): boolean {
  return RAIN_CODES.has(code);
}

export function isSnowCode(code: number): boolean {
  return SNOW_CODES.has(code);
}

export type RainIntensity = 'none' | 'drizzle' | 'light' | 'moderate' | 'heavy';

/** Coarse rain intensity for driving the rain overlay strength. */
export function rainIntensity(code: number): RainIntensity {
  if (DRIZZLE_CODES.has(code)) return 'drizzle';
  if (RAIN_LIGHT_CODES.has(code)) return 'light';
  if (RAIN_MODERATE_CODES.has(code)) return 'moderate';
  if (RAIN_HEAVY_CODES.has(code)) return 'heavy';
  return 'none';
}

export type GlyphCategory = 'clear' | 'cloud' | 'rain' | 'snow';

/** Semantic glyph bucket for a forecast cell. Consumers map this to their own icon set. */
export function weatherGlyph(code: number): GlyphCategory {
  if (isSnowCode(code)) return 'snow';
  if (isRainyCode(code)) return 'rain';
  if (code === 0 || code === 1) return 'clear';
  return 'cloud';
}
