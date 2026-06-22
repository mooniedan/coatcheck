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
} from './scene-model';
import type { Category, ClothingItem, Recommendation, WeatherSnapshot } from './types';

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
  it('outfitAt keeps essentials on and crossfades layers', () => {
    const morning = outfitAt(0);
    expect(morning.base).toBe(1);
    expect(morning.bottoms).toBe(1);
    expect(morning.shell).toBe(1); // cold morning → shell on
    const noon = outfitAt(0.6);
    expect(noon.shell).toBe(0); // warm midday → shell off
    expect(noon.sunglasses).toBeGreaterThan(0);
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

describe('outfitFromRecommendation', () => {
  it('essentials always on', () => {
    const o = outfitFromRecommendation(rec([]));
    expect(o.base).toBe(1);
    expect(o.bottoms).toBe(1);
    expect(o.footwear).toBe(1);
    expect(o.shell).toBe(0);
    expect(o.mid).toBe(0);
  });
  it('mid on for a warm top layer; shell on for any outerwear', () => {
    const o = outfitFromRecommendation(
      rec([item('sweater', 'Tops'), item('light_jacket', 'Outerwear')])
    );
    expect(o.mid).toBe(1);
    expect(o.shell).toBe(1);
  });
  it('accessories drive scarf/beanie/umbrella/sunglasses', () => {
    const o = outfitFromRecommendation(
      rec([
        item('scarf', 'Accessories'),
        item('beanie', 'Accessories'),
        item('umbrella', 'Accessories'),
        item('sunglasses', 'Accessories'),
      ])
    );
    expect(o.scarf).toBe(1);
    expect(o.beanie).toBe(1);
    expect(o.umbrella).toBe(1);
    expect(o.sunglasses).toBe(1);
  });
  it('raincoat (outerwear) also raises the umbrella', () => {
    const o = outfitFromRecommendation(rec([item('raincoat', 'Outerwear')]));
    expect(o.umbrella).toBe(1);
    expect(o.shell).toBe(1);
  });
});
