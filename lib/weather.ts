import 'server-only';
import type { DailyForecast, ResolvedLocation, WeatherSnapshot } from './types';

// Server-side Open-Meteo adapter. Free, no API key for non-commercial/dev use. Kept behind
// this stable interface so the provider can be swapped without touching routes or clients.

const FORECAST_URL =
  process.env.OPEN_METEO_FORECAST_URL ?? 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_URL =
  process.env.OPEN_METEO_GEOCODING_URL ?? 'https://geocoding-api.open-meteo.com/v1/search';

// Minimal WMO weather-code → label map (https://open-meteo.com/en/docs).
const WMO: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  80: 'Rain showers',
  81: 'Rain showers',
  82: 'Violent rain showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Thunderstorm with hail',
};

const RAIN_CODES = new Set([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99]);

export function describeWeatherCode(code: number): string {
  return WMO[code] ?? 'Unknown';
}

/** Whether a WMO weather code denotes drizzle/rain/showers/thunderstorm. */
export function isRainyCode(code: number): boolean {
  return RAIN_CODES.has(code);
}

/** Resolve a free-text place query to coordinates (first match). */
export async function geocode(query: string): Promise<ResolvedLocation | null> {
  const url = `${GEOCODING_URL}?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
  const res = await fetch(url, { next: { revalidate: 86_400 } });
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
  const data = (await res.json()) as {
    results?: Array<{
      name: string;
      latitude: number;
      longitude: number;
      country?: string;
      admin1?: string;
    }>;
  };
  const hit = data.results?.[0];
  if (!hit) return null;
  return {
    name: hit.name,
    latitude: hit.latitude,
    longitude: hit.longitude,
    country: hit.country,
    admin1: hit.admin1,
  };
}

// Shapes of the Open-Meteo response blocks we request.
interface CurrentBlock {
  time: string;
  temperature_2m: number;
  apparent_temperature: number;
  relative_humidity_2m: number;
  precipitation: number;
  precipitation_probability?: number;
  weather_code: number;
  wind_speed_10m: number;
}
interface DailyBlock {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  apparent_temperature_max: number[];
  apparent_temperature_min: number[];
  precipitation_probability_max: number[];
  wind_speed_10m_max: number[];
  weather_code: number[];
}

const CURRENT_FIELDS =
  'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m';
const DAILY_FIELDS =
  'temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,wind_speed_10m_max,weather_code';

function currentToSnapshot(c: CurrentBlock): WeatherSnapshot {
  return {
    feelsLikeC: c.apparent_temperature,
    tempC: c.temperature_2m,
    humidity: c.relative_humidity_2m,
    windKph: c.wind_speed_10m,
    precipitationProbability: c.precipitation_probability ?? 0,
    isRaining: c.precipitation > 0 || RAIN_CODES.has(c.weather_code),
    weatherCode: c.weather_code,
    description: describeWeatherCode(c.weather_code),
    observedAt: c.time,
  };
}

function dailyToForecast(d: DailyBlock): DailyForecast[] {
  return d.time.map((date, i) => {
    const code = d.weather_code[i];
    return {
      date,
      tempMaxC: d.temperature_2m_max[i],
      tempMinC: d.temperature_2m_min[i],
      feelsLikeMaxC: d.apparent_temperature_max[i],
      feelsLikeMinC: d.apparent_temperature_min[i],
      precipProb: d.precipitation_probability_max[i] ?? 0,
      windMaxKph: d.wind_speed_10m_max[i],
      weatherCode: code,
      description: describeWeatherCode(code),
      isRaining: RAIN_CODES.has(code),
      // Daytime high is the "what to wear" signal for a whole-day glance.
      feelsLikeC: d.apparent_temperature_max[i],
    };
  });
}

/** Current conditions for a coordinate. Cached for 30 minutes per location. */
export async function getWeather(latitude: number, longitude: number): Promise<WeatherSnapshot> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: CURRENT_FIELDS,
    wind_speed_unit: 'kmh',
    timezone: 'auto',
  });
  const res = await fetch(`${FORECAST_URL}?${params}`, { next: { revalidate: 1_800 } });
  if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`);
  const data = (await res.json()) as { current: CurrentBlock };
  return currentToSnapshot(data.current);
}

/**
 * Current conditions + a 7-day daily forecast in a single Open-Meteo call. Used by the
 * home page so the "today" recommendation and the week strip share one cached request.
 * Cached for 30 minutes per location.
 */
export async function getForecast(
  latitude: number,
  longitude: number
): Promise<{ current: WeatherSnapshot; week: DailyForecast[] }> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: CURRENT_FIELDS,
    daily: DAILY_FIELDS,
    forecast_days: '7',
    wind_speed_unit: 'kmh',
    timezone: 'auto',
  });
  const res = await fetch(`${FORECAST_URL}?${params}`, { next: { revalidate: 1_800 } });
  if (!res.ok) throw new Error(`Forecast fetch failed: ${res.status}`);
  const data = (await res.json()) as { current: CurrentBlock; daily: DailyBlock };
  return { current: currentToSnapshot(data.current), week: dailyToForecast(data.daily) };
}
