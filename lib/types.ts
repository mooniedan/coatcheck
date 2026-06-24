// Shared domain types for Coat Check. Kept framework-free so the same types serve
// the web app, the Route Handler API, and future native mobile clients.

export type Cohort = 'alpha' | 'beta' | 'ga';

export type Category = 'Tops' | 'Bottoms' | 'Outerwear' | 'Accessories';

/** Canonical category order — single source of truth for iteration and display. */
export const CATEGORIES: Category[] = ['Tops', 'Bottoms', 'Outerwear', 'Accessories'];

export type Verdict = 'too_cold' | 'too_hot' | 'just_right';

export interface ClothingItem {
  id: string;
  name: string;
  category: Category;
  /** Inclusive lower bound of the effective feels-like band this item suits (°C). */
  minTempC: number;
  /** Inclusive upper bound of the effective feels-like band this item suits (°C). */
  maxTempC: number;
  /** Only recommend when it is raining. */
  requiresRain?: boolean;
  /** Only recommend when wind exceeds the windy threshold. */
  requiresWind?: boolean;
  icon?: string;
}

export interface WeatherSnapshot {
  feelsLikeC: number;
  tempC: number;
  humidity: number;
  windKph: number;
  precipitationProbability: number;
  isRaining: boolean;
  /** Open-Meteo WMO weather code. */
  weatherCode: number;
  description: string;
  observedAt: string;
}

export interface ResolvedLocation {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  /** ISO-3166 alpha-2 country code (for a flag glyph). */
  countryCode?: string;
  admin1?: string;
}

/**
 * Per-profile learned comfort. `offsetC` shifts how cold the wearer feels relative to the
 * raw "feels like": positive means they run cold (treat the weather as colder → warmer
 * clothes). Updated by feedback. See lib/thresholds.ts.
 */
export interface ComfortModel {
  offsetC: number;
}

export interface Recommendation {
  effectiveTempC: number;
  weather: WeatherSnapshot;
  itemsByCategory: Record<Category, ClothingItem[]>;
}

/** One hour of the forecast. Derived from Open-Meteo's `hourly` block. */
export interface HourForecast {
  /** ISO local timestamp (YYYY-MM-DDTHH:00). */
  time: string;
  /** Local hour of day, 0–23. */
  hour: number;
  feelsLikeC: number;
  tempC: number;
  weatherCode: number;
  isRaining: boolean;
  precipProb: number;
  windKph: number;
}

/** One day of the forecast strip. Derived from Open-Meteo's `daily` block. */
export interface DailyForecast {
  /** ISO date (YYYY-MM-DD), local to the location. */
  date: string;
  tempMaxC: number;
  tempMinC: number;
  feelsLikeMaxC: number;
  feelsLikeMinC: number;
  /** Max precipitation probability across the day (%). */
  precipProb: number;
  /** Max wind across the day (kph). */
  windMaxKph: number;
  weatherCode: number;
  description: string;
  /** Whether the day's weather code denotes rain/showers/storm. */
  isRaining: boolean;
  /**
   * Representative "what to wear" feels-like for the day — the daytime high
   * (apparent_temperature_max). Used to run the recommendation engine per day.
   */
  feelsLikeC: number;
  /** Local sunrise/sunset ISO timestamps for this day (anchors the hour slider + sky). */
  sunrise: string;
  sunset: string;
  /** Seconds of daylight; NaN when unknown. ~86400 ⇒ polar day, ~0 ⇒ polar night. */
  daylightSeconds: number;
  /** Hour-by-hour forecast for this day (used to scrub the scene across the day). */
  hours: HourForecast[];
}

/** A day paired with its precomputed clothing recommendation. */
export interface DayRecommendation {
  day: DailyForecast;
  recommendation: Recommendation;
}

// ── API response contracts (shared client ↔ route handlers) ────────────────
// Define the wire shapes once so the client doesn't read fields off `any`. Profile/account
// use the snake_case DB column names as actually returned by the handlers.

export interface Profile {
  id: string;
  display_name: string;
  relationship: string;
  comfort_model?: ComfortModel;
}

export interface Account {
  id: string;
  email: string | null;
  cohort: Cohort;
  /** The account's saved "home" location — the open-on-launch fallback when GPS isn't readable. */
  home_location?: ResolvedLocation | null;
}

export interface ApiError {
  error: string;
}

export interface MeResponse {
  user: { id: string; email: string | null; role?: string } | null;
  account: Account | null;
  profiles: Profile[];
  /** 'active' = an invited tester; 'waitlisted' = signed in but not yet allow-listed. */
  status?: 'active' | 'waitlisted';
  warning?: string;
}

export interface RecommendationsResponse {
  location: ResolvedLocation;
  recommendation: Recommendation;
  week: DayRecommendation[];
  /**
   * The wearer's resolved comfort offset (°C), so the client can recompute the per-hour
   * outfit as the slider scrubs without a round-trip. Mirrors the offset the server used.
   */
  comfortOffsetC: number;
}

/** A saved trip: a place + an inclusive date range. Clothing per day is derived live. */
export interface Trip {
  id: string;
  location: ResolvedLocation;
  /** Inclusive ISO dates (YYYY-MM-DD). */
  start_date: string;
  end_date: string;
  created_at?: string;
}

export interface TripsResponse {
  trips: Trip[];
}

export interface TripResponse {
  trip: Trip;
}

export interface ProfilesResponse {
  profiles: Profile[];
}

export interface ProfileResponse {
  profile: Profile;
}

export interface GeocodeResponse {
  results: ResolvedLocation[];
}

// ── Admin ──────────────────────────────────────────────────────
export interface BetaSignup {
  email: string;
  source: string | null;
  created_at: string;
  /** true = invited tester; false = on the waitlist. */
  allowed: boolean;
  approved_at: string | null;
}

export interface AdminAccount {
  id: string;
  email: string | null;
  cohort: Cohort;
  created_at: string;
}

export interface AdminGrant {
  email: string;
  role: string;
}

export interface AdminOverviewResponse {
  admins: AdminGrant[];
  accounts: AdminAccount[];
  /** Every beta_signups row; split client-side by `allowed` into invited vs waitlist. */
  signups: BetaSignup[];
}
