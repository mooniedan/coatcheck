// Shared domain types for Coat Check. Kept framework-free so the same types serve
// the web app, the Route Handler API, and future native mobile clients.

export type Cohort = 'alpha' | 'beta' | 'ga';

export type Category = 'Tops' | 'Bottoms' | 'Outerwear' | 'Accessories';

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
