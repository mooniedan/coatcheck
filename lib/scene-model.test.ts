import { describe, it, expect } from 'vitest';
import {
  lerp,
  clamp,
  sampleNum,
  formatClock,
  celestialAt,
  outfitAt,
  tempAt,
  sceneWeatherFromSnapshot,
  outfitFromRecommendation,
  parseLocalHour,
  hourToSkyT,
  dayWindow,
  skyTAt,
  isPolarDay,
  isPolarNight,
  dayClothing,
} from './scene-model';
import { recommend } from './recommend';
import { DEFAULT_CATALOG } from './catalog';
import type {
  Category,
  ClothingItem,
  DailyForecast,
  HourForecast,
  Recommendation,
  WeatherSnapshot,
} from './types';

function snapshot(over: Partial<WeatherSnapshot>): WeatherSnapshot {
  return {
    feelsLikeC: 10,
    tempC: 10,
    humidity: 50,
    windKph: 5,
    precipitationProbability: 0,
    isRaining: false,
    weatherCode: 0,
    description: 'Clear sky',
    observedAt: '2026-06-22T12:00',
    ...over,
  };
}

function item(id: string, category: Category): ClothingItem {
  return { id, name: id, category, minTempC: -40, maxTempC: 60 };
}

function rec(items: ClothingItem[]): Recommendation {
  const byCat: Record<Category, ClothingItem[]> = {
    Tops: [],
    Bottoms: [],
    Outerwear: [],
    Accessories: [],
  };
  for (const it of items) byCat[it.category].push(it);
  return { effectiveTempC: 10, weather: snapshot({}), itemsByCategory: byCat };
}

describe('interpolation helpers', () => {
  it('lerp / clamp', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-2, 0, 1)).toBe(0);
  });
  it('sampleNum clamps to endpoints and interpolates', () => {
    const stops: [number, number][] = [
      [0, 0],
      [1, 10],
    ];
    expect(sampleNum(stops, -1)).toBe(0);
    expect(sampleNum(stops, 2)).toBe(10);
    expect(sampleNum(stops, 0.5)).toBeCloseTo(5, 5); // smoothstep(0.5) = 0.5
  });
});

describe('day model', () => {
  it('formatClock maps t to 06:00–21:00', () => {
    expect(formatClock(0)).toBe('06:00');
    expect(formatClock(1)).toBe('21:00');
    expect(formatClock(0.5)).toBe('13:30');
  });
  it('celestialAt shows sun by day, moon late', () => {
    expect(celestialAt(0.5).isMoon).toBe(false);
    expect(celestialAt(0.9).isMoon).toBe(true);
  });
  it('tempAt samples the canned temperature curve', () => {
    expect(tempAt(0)).toBe(3);
    expect(tempAt(0.6)).toBe(18);
  });
  it('outfitAt: cold morning wears outerwear, warm midday wears a top (and they differ)', () => {
    const morning = outfitAt(0); // tempAt(0)=3°C, raining → cold
    const noon = outfitAt(0.6); // tempAt(0.6)=18°C → warm
    expect(morning.torso).not.toBeNull();
    expect(morning.legs).not.toBeNull();
    expect(morning.torso).not.toBe(noon.torso); // cold vs warm look different
  });
});

describe('hour ↔ slider mapping', () => {
  it('parseLocalHour reads fractional local hour', () => {
    expect(parseLocalHour('2026-06-22T03:54')).toBeCloseTo(3.9, 2);
    expect(parseLocalHour('2026-06-22T13:00')).toBe(13);
    expect(Number.isNaN(parseLocalHour(''))).toBe(true);
  });
  it('hourToSkyT maps the day onto 0..1, clamped outside 06–21', () => {
    expect(hourToSkyT(6)).toBe(0);
    expect(hourToSkyT(21)).toBe(1);
    expect(hourToSkyT(3)).toBe(0); // pre-06:00 clamps to 0
    expect(hourToSkyT(23)).toBe(1); // post-21:00 clamps to 1
    expect(hourToSkyT(13.5)).toBeCloseTo(0.5, 2);
  });
  it('dayWindow anchors to whole-hour sunrise/sunset', () => {
    expect(dayWindow('2026-06-22T03:54', '2026-06-22T22:43')).toEqual({ start: 3, end: 23 });
    expect(dayWindow('2026-12-22T09:10', '2026-12-22T15:50')).toEqual({ start: 9, end: 16 });
  });
  it('dayWindow falls back to 06–21 when sun times are missing', () => {
    expect(dayWindow('', '')).toEqual({ start: 6, end: 21 });
  });
  it('dayWindow scrubs the full day under polar day/night', () => {
    // Midnight sun: Open-Meteo rolls sunset to the next day; daylight = 24h.
    expect(dayWindow('2026-06-22T00:00', '2026-06-23T00:00', 86400)).toEqual({ start: 0, end: 23 });
    // Polar night: ~0 daylight.
    expect(dayWindow('2026-12-22T11:00', '2026-12-22T11:00', 0)).toEqual({ start: 0, end: 23 });
  });
});

describe('polar detection', () => {
  it('classifies polar day/night by daylight seconds', () => {
    expect(isPolarDay(86400)).toBe(true);
    expect(isPolarDay(50000)).toBe(false);
    expect(isPolarDay(NaN)).toBe(false);
    expect(isPolarNight(0)).toBe(true);
    expect(isPolarNight(300)).toBe(true);
    expect(isPolarNight(40000)).toBe(false);
    expect(isPolarNight(NaN)).toBe(false);
  });
});

describe('skyTAt — light/dark from real sun times', () => {
  it('normal day: dark before dawn, dawn at sunrise, noon brightest, dusk at sunset, night after', () => {
    // sunrise 6, sunset 20 → solar noon 13.
    expect(skyTAt(3, 6, 20)).toBe(0); // deep night
    expect(skyTAt(6, 6, 20)).toBeCloseTo(0.08, 2); // dawn
    expect(skyTAt(13, 6, 20)).toBeCloseTo(0.45, 2); // solar noon (brightest)
    expect(skyTAt(20, 6, 20)).toBeCloseTo(0.82, 2); // dusk
    expect(skyTAt(23, 6, 20)).toBe(1); // night
  });
  it('polar day: never reaches the night colours (stays light at midnight)', () => {
    const midnight = skyTAt(0, 0, 0, 86400);
    const noon = skyTAt(12, 0, 0, 86400);
    expect(midnight).toBeGreaterThan(0.08); // brighter than dawn — i.e. not dark
    expect(noon).toBeCloseTo(0.45, 2); // full daylight at noon
    expect(noon).toBeGreaterThan(midnight);
  });
  it('polar night: stays dark all day', () => {
    expect(skyTAt(0, 0, 0, 0)).toBeLessThan(0.05);
    expect(skyTAt(12, 0, 0, 0)).toBeLessThanOrEqual(0.05); // faint noon lift, still dark
  });
});

describe('sceneWeatherFromSnapshot', () => {
  it('clear sky → low cloud, full clear factor, no rain', () => {
    const s = sceneWeatherFromSnapshot(snapshot({ weatherCode: 0 }));
    expect(s.clouds).toBeCloseTo(0.12);
    expect(s.clearFactor).toBe(1);
    expect(s.rain).toBe(0);
  });
  it('overcast → heavy cloud, no sun', () => {
    const s = sceneWeatherFromSnapshot(snapshot({ weatherCode: 3 }));
    expect(s.clearFactor).toBe(0);
    expect(s.clouds).toBeCloseTo(0.82);
  });
  it('rain intensity scales the overlay (drizzle < heavy)', () => {
    const drizzle = sceneWeatherFromSnapshot(
      snapshot({ weatherCode: 51, isRaining: true, precipitationProbability: 60 })
    );
    const heavy = sceneWeatherFromSnapshot(
      snapshot({ weatherCode: 65, isRaining: true, precipitationProbability: 60 })
    );
    expect(drizzle.rain).toBeCloseTo(0.35);
    expect(heavy.rain).toBeCloseTo(0.92);
    expect(heavy.rain).toBeGreaterThan(drizzle.rain);
  });
  it('probability nudges and clamps the rain overlay', () => {
    const high = sceneWeatherFromSnapshot(
      snapshot({ weatherCode: 65, isRaining: true, precipitationProbability: 100 })
    );
    expect(high.rain).toBeCloseTo(0.95); // 0.92 + 0.1, clamped to 0.95
    const lowProb = sceneWeatherFromSnapshot(
      snapshot({ weatherCode: 51, isRaining: true, precipitationProbability: 0 })
    );
    expect(lowProb.rain).toBeCloseTo(0.25); // 0.35 - 0.15, clamped up to 0.25
  });
  it('snow never paints rain', () => {
    const s = sceneWeatherFromSnapshot(
      snapshot({ weatherCode: 73, isRaining: true, precipitationProbability: 90 })
    );
    expect(s.rain).toBe(0);
  });
  it('high probability without active rain hints lightly', () => {
    const s = sceneWeatherFromSnapshot(
      snapshot({ weatherCode: 3, isRaining: false, precipitationProbability: 70 })
    );
    expect(s.rain).toBeCloseTo(0.2);
  });
});

describe('outfitFromRecommendation (worn outfit)', () => {
  it('falls back to a tee + trousers when nothing is recommended', () => {
    const o = outfitFromRecommendation(rec([]));
    expect(o.torso).toBe('tshirt');
    expect(o.legs).toBe('trousers');
    expect(o.hiddenLayers).toBe(0);
    expect(o.itemCount).toBe(0);
  });

  it('hot: tank + shorts + sunglasses, single layer', () => {
    const o = outfitFromRecommendation(
      rec([item('tank', 'Tops'), item('shorts', 'Bottoms'), item('sunglasses', 'Accessories')])
    );
    expect(o.torso).toBe('tank');
    expect(o.legs).toBe('shorts');
    expect(o.face).toBe('sunglasses');
    expect(o.hiddenLayers).toBe(0);
    expect(o.itemCount).toBe(3);
  });

  it('outermost wins: outerwear shows over the top, which becomes a hidden layer', () => {
    const o = outfitFromRecommendation(
      rec([item('long_sleeve', 'Tops'), item('light_jacket', 'Outerwear'), item('trousers', 'Bottoms')])
    );
    expect(o.torso).toBe('light_jacket'); // jacket over the long-sleeve
    expect(o.hiddenLayers).toBe(1); // the long-sleeve is hidden
  });

  it('cold: heavy coat wins; beanie/scarf/gloves on hands/head/neck', () => {
    const o = outfitFromRecommendation(
      rec([
        item('thermal_top', 'Tops'),
        item('sweater', 'Tops'),
        item('heavy_coat', 'Outerwear'),
        item('trousers', 'Bottoms'),
        item('beanie', 'Accessories'),
        item('scarf', 'Accessories'),
        item('gloves', 'Accessories'),
      ])
    );
    expect(o.torso).toBe('heavy_coat');
    expect(o.head).toBe('beanie');
    expect(o.neck).toBe('scarf');
    expect(o.hands).toBe('gloves');
    expect(o.hiddenLayers).toBe(2); // thermal + sweater hidden under the coat
  });

  it('rain: raincoat is the torso garment; umbrella is held', () => {
    const o = outfitFromRecommendation(
      rec([item('tshirt', 'Tops'), item('raincoat', 'Outerwear'), item('umbrella', 'Accessories')])
    );
    expect(o.torso).toBe('raincoat');
    expect(o.umbrella).toBe(true);
  });
});

describe('dayClothing (comprehensive day list)', () => {
  function hour(h: number, feelsLikeC: number): HourForecast {
    return {
      time: `2026-06-22T${String(h).padStart(2, '0')}:00`,
      hour: h,
      feelsLikeC,
      tempC: feelsLikeC,
      weatherCode: 0,
      isRaining: false,
      precipProb: 0,
      windKph: 5,
    };
  }
  function day(over: Partial<DailyForecast>): DailyForecast {
    return {
      date: '2026-06-22',
      tempMaxC: 24,
      tempMinC: 12,
      feelsLikeMaxC: 24,
      feelsLikeMinC: 12,
      precipProb: 0,
      windMaxKph: 5,
      weatherCode: 0,
      description: 'Clear sky',
      isRaining: false,
      feelsLikeC: 24,
      sunrise: '2026-06-22T05:00',
      sunset: '2026-06-22T22:00',
      daylightSeconds: 61_200,
      hours: [],
      ...over,
    };
  }

  it('unions garments across the day’s reachable hours — a warm hour adds shorts', () => {
    const base = recommend(snapshot({ feelsLikeC: 16 }), DEFAULT_CATALOG); // cool morning, no shorts
    expect(base.itemsByCategory.Bottoms.map((i) => i.id)).not.toContain('shorts');

    const merged = dayClothing(base, day({ hours: [hour(8, 16), hour(14, 24), hour(20, 15)] }), 0);
    const bottoms = merged.itemsByCategory.Bottoms.map((i) => i.id);
    expect(bottoms).toContain('shorts'); // from the 24°C afternoon hour
    expect(bottoms).toContain('trousers'); // from the cooler hours
  });

  it('respects the sunrise→sunset window — a warm hour at night is not counted', () => {
    const base = recommend(snapshot({ feelsLikeC: 16 }), DEFAULT_CATALOG);
    const d = day({
      hours: [hour(3, 26), hour(12, 16)],
      sunrise: '2026-06-22T06:00',
      sunset: '2026-06-22T21:00',
      daylightSeconds: 54_000,
    });
    expect(dayClothing(base, d, 0).itemsByCategory.Bottoms.map((i) => i.id)).not.toContain('shorts');
  });

  it('without hourly data, brackets the day by its feels-like extremes', () => {
    const base = recommend(snapshot({ feelsLikeC: 24 }), DEFAULT_CATALOG); // warm end (shorts)
    const merged = dayClothing(base, day({ hours: [], feelsLikeMaxC: 24, feelsLikeMinC: 12 }), 0);
    const bottoms = merged.itemsByCategory.Bottoms.map((i) => i.id);
    expect(bottoms).toContain('shorts'); // from the 24°C max
    expect(bottoms).toContain('trousers'); // from the 12°C min
  });

  it('returns the recommendation unchanged when there is no day data', () => {
    const base = rec([item('tshirt', 'Tops')]);
    expect(dayClothing(base, null, 0)).toBe(base);
  });
});
