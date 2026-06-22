import 'server-only';
import { describeWeatherCode, isRainyCode } from './wmo';
import type { DailyForecast, HourForecast, ResolvedLocation, WeatherSnapshot } from './types';

// Server-side Open-Meteo adapter. Free, no API key for non-commercial/dev use. Kept behind
// this stable interface so the provider can be swapped without touching routes or clients.
// WMO weather-code interpretation lives in lib/wmo.ts (shared with the client).

const FORECAST_URL =
  process.env.OPEN_METEO_FORECAST_URL ?? 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_URL =
  process.env.OPEN_METEO_GEOCODING_URL ?? 'https://geocoding-api.open-meteo.com/v1/search';

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
export interface CurrentBlock {
  time: string;
  temperature_2m: number;
  apparent_temperature: number;
  relative_humidity_2m: number;
  precipitation: number;
  precipitation_probability?: number;
  weather_code: number;
  wind_speed_10m: number;
}
export interface DailyBlock {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  apparent_temperature_max: number[];
  apparent_temperature_min: number[];
  precipitation_probability_max: number[];
  wind_speed_10m_max: number[];
  weather_code: number[];
  sunrise: string[];
  sunset: string[];
  daylight_duration: number[];
}
export interface HourlyBlock {
  time: string[];
  temperature_2m: number[];
  apparent_temperature: number[];
  precipitation: number[];
  precipitation_probability: number[];
  weather_code: number[];
  wind_speed_10m: number[];
}

const CURRENT_FIELDS =
  'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m';
const DAILY_FIELDS =
  'temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,wind_speed_10m_max,weather_code,sunrise,sunset,daylight_duration';
const HOURLY_FIELDS =
  'temperature_2m,apparent_temperature,precipitation,precipitation_probability,weather_code,wind_speed_10m';

export function currentToSnapshot(c: CurrentBlock): WeatherSnapshot {
  return {
    feelsLikeC: c.apparent_temperature,
    tempC: c.temperature_2m,
    humidity: c.relative_humidity_2m,
    windKph: c.wind_speed_10m,
    precipitationProbability: c.precipitation_probability ?? 0,
    isRaining: c.precipitation > 0 || isRainyCode(c.weather_code),
    weatherCode: c.weather_code,
    description: describeWeatherCode(c.weather_code),
    observedAt: c.time,
  };
}

/** A daily precip probability at/above which we advise rain gear even if the representative
 * weather code isn't itself a rain code (a single daily code under-reports shower risk). */
const DAILY_RAIN_PROB = 50;

// Bucket the flat hourly arrays into HourForecast[] keyed by local date (YYYY-MM-DD).
export function hourlyByDate(h: HourlyBlock): Map<string, HourForecast[]> {
  const byDate = new Map<string, HourForecast[]>();
  h.time.forEach((time, i) => {
    const code = h.weather_code[i];
    const feelsLikeC = h.apparent_temperature[i];
    const tempC = h.temperature_2m[i];
    const windKph = h.wind_speed_10m[i];
    if (![feelsLikeC, tempC, windKph, code].every(Number.isFinite)) return;
    const date = time.slice(0, 10);
    const hour = Number(time.slice(11, 13));
    const precipProb = h.precipitation_probability[i] ?? 0;
    const entry: HourForecast = {
      time,
      hour,
      feelsLikeC,
      tempC,
      weatherCode: code,
      isRaining: (h.precipitation[i] ?? 0) > 0 || isRainyCode(code),
      precipProb,
      windKph,
    };
    const list = byDate.get(date);
    if (list) list.push(entry);
    else byDate.set(date, [entry]);
  });
  return byDate;
}

export function dailyToForecast(
  d: DailyBlock,
  hoursByDate: Map<string, HourForecast[]> = new Map()
): DailyForecast[] {
  return d.time
    .map((date, i): DailyForecast | null => {
      const code = d.weather_code[i];
      const tempMaxC = d.temperature_2m_max[i];
      const tempMinC = d.temperature_2m_min[i];
      const feelsLikeMaxC = d.apparent_temperature_max[i];
      const feelsLikeMinC = d.apparent_temperature_min[i];
      const windMaxKph = d.wind_speed_10m_max[i];
      // Open-Meteo returns aligned parallel arrays; if a block is short/missing, the indexed
      // value is undefined and would flow through as NaN (→ silently empty outfit). Drop the
      // day instead so the strip omits it rather than showing a broken cell.
      if (
        ![tempMaxC, tempMinC, feelsLikeMaxC, feelsLikeMinC, windMaxKph, code].every(
          Number.isFinite
        )
      ) {
        return null;
      }
      const precipProb = d.precipitation_probability_max[i] ?? 0;
      return {
        date,
        tempMaxC,
        tempMinC,
        feelsLikeMaxC,
        feelsLikeMinC,
        precipProb,
        windMaxKph,
        weatherCode: code,
        description: describeWeatherCode(code),
        // A representative daily code can read "Overcast" on a day with high shower probability,
        // so fall back to the precip probability — otherwise the figure carries no umbrella on a
        // day whose own strip cell shows e.g. 80%.
        isRaining: isRainyCode(code) || precipProb >= DAILY_RAIN_PROB,
        // Daytime high is the "what to wear" signal for a whole-day glance.
        feelsLikeC: feelsLikeMaxC,
        sunrise: d.sunrise?.[i] ?? '',
        sunset: d.sunset?.[i] ?? '',
        // Seconds of daylight; NaN when unknown. ~86400 ⇒ polar day, ~0 ⇒ polar night.
        daylightSeconds: d.daylight_duration?.[i] ?? NaN,
        hours: hoursByDate.get(date) ?? [],
      };
    })
    .filter((day): day is DailyForecast => day !== null);
}

export type LocationQueryError = { error: string; status: number };

/**
 * Resolve a request's `q` / `lat` / `lng` params to a location, with validation. Coordinates
 * must be finite and in range; `q` is length-capped before hitting the geocoder. Returns the
 * resolved location or a `{ error, status }` the caller can hand straight to NextResponse.
 * Shared by the weather and recommendations routes so the branch + validation live in one place.
 */
export async function resolveLocationFromQuery(
  q: string | null,
  lat: string | null,
  lng: string | null
): Promise<ResolvedLocation | LocationQueryError> {
  if (lat && lng) {
    const latN = Number(lat);
    const lngN = Number(lng);
    if (
      !Number.isFinite(latN) ||
      !Number.isFinite(lngN) ||
      latN < -90 ||
      latN > 90 ||
      lngN < -180 ||
      lngN > 180
    ) {
      return { error: 'Invalid coordinates', status: 400 };
    }
    return { name: 'Your location', latitude: latN, longitude: lngN };
  }
  if (q) {
    if (q.length > 120) return { error: 'Query too long', status: 400 };
    const location = await geocode(q);
    if (!location) return { error: 'Location not found', status: 404 };
    return location;
  }
  return { error: 'Provide q or lat/lng', status: 400 };
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
    hourly: HOURLY_FIELDS,
    forecast_days: '7',
    wind_speed_unit: 'kmh',
    timezone: 'auto',
  });
  const res = await fetch(`${FORECAST_URL}?${params}`, { next: { revalidate: 1_800 } });
  if (!res.ok) throw new Error(`Forecast fetch failed: ${res.status}`);
  const data = (await res.json()) as {
    current: CurrentBlock;
    daily: DailyBlock;
    hourly: HourlyBlock;
  };
  const hoursByDate = hourlyByDate(data.hourly);
  return {
    current: currentToSnapshot(data.current),
    week: dailyToForecast(data.daily, hoursByDate),
  };
}
