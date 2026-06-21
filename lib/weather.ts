import 'server-only';
import type { ResolvedLocation, WeatherSnapshot } from './types';

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

/** Current conditions for a coordinate. Cached for 30 minutes per location. */
export async function getWeather(latitude: number, longitude: number): Promise<WeatherSnapshot> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current:
      'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m',
    wind_speed_unit: 'kmh',
    timezone: 'auto',
  });
  const res = await fetch(`${FORECAST_URL}?${params}`, { next: { revalidate: 1_800 } });
  if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`);
  const data = (await res.json()) as {
    current: {
      time: string;
      temperature_2m: number;
      apparent_temperature: number;
      relative_humidity_2m: number;
      precipitation: number;
      precipitation_probability?: number;
      weather_code: number;
      wind_speed_10m: number;
    };
  };
  const c = data.current;
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
