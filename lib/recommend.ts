import type {
  Category,
  ClothingItem,
  ComfortModel,
  Recommendation,
  WeatherSnapshot,
} from './types';

// Pure recommendation engine. No framework/DB imports — unit-tested in recommend.test.ts
// and identical whether invoked from the web Route Handlers or a future mobile API.

const CATEGORIES: Category[] = ['Tops', 'Bottoms', 'Outerwear', 'Accessories'];

/** Wind (kph) at/above which windproofing and a real "feels colder" penalty kick in. */
export const WINDY_KPH = 20;

/**
 * The effective temperature the wearer experiences = forecast feels-like, made colder by
 * the wearer's personal offset (positive offset = runs cold) and by strong wind. We keep
 * this separate from the provider's apparent temperature so personalization is transparent.
 */
export function effectiveTemp(weather: WeatherSnapshot, comfort: ComfortModel): number {
  const windChill = weather.windKph >= WINDY_KPH ? -2 : 0;
  return weather.feelsLikeC - comfort.offsetC + windChill;
}

function applies(item: ClothingItem, effTempC: number, weather: WeatherSnapshot): boolean {
  if (item.requiresRain && !weather.isRaining) return false;
  if (item.requiresWind && weather.windKph < WINDY_KPH) return false;
  return effTempC >= item.minTempC && effTempC <= item.maxTempC;
}

/**
 * Recommend clothing for the given weather + wearer comfort model, grouped by category.
 * Layering emerges from overlapping catalog bands; conditional items (rain/wind) are
 * gated on the weather. Returns every category key (possibly with an empty array).
 */
export function recommend(
  weather: WeatherSnapshot,
  catalog: ClothingItem[],
  comfort: ComfortModel = { offsetC: 0 }
): Recommendation {
  const effTempC = effectiveTemp(weather, comfort);

  const itemsByCategory = Object.fromEntries(
    CATEGORIES.map((c) => [c, [] as ClothingItem[]])
  ) as Record<Category, ClothingItem[]>;

  for (const item of catalog) {
    if (applies(item, effTempC, weather)) {
      itemsByCategory[item.category].push(item);
    }
  }

  // Warmest-first within each category gives a stable, sensible display order.
  for (const c of CATEGORIES) {
    itemsByCategory[c].sort((a, b) => a.minTempC - b.minTempC);
  }

  return { effectiveTempC: effTempC, weather, itemsByCategory };
}
