import { describe, it, expect } from 'vitest';
import { recommend, effectiveTemp, WINDY_KPH } from './recommend';
import { DEFAULT_CATALOG } from './catalog';
import type { WeatherSnapshot } from './types';

function weather(overrides: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  return {
    feelsLikeC: 15,
    tempC: 15,
    humidity: 50,
    windKph: 5,
    precipitationProbability: 0,
    isRaining: false,
    weatherCode: 1,
    description: 'Mainly clear',
    observedAt: '2026-06-21T08:00:00Z',
    ...overrides,
  };
}

const ids = (items: { id: string }[]) => items.map((i) => i.id);

describe('effectiveTemp', () => {
  it('subtracts a positive comfort offset (runs cold → colder effective temp)', () => {
    expect(effectiveTemp(weather({ feelsLikeC: 15 }), { offsetC: 3 })).toBe(12);
  });

  it('applies a wind-chill penalty above the windy threshold', () => {
    expect(effectiveTemp(weather({ feelsLikeC: 15, windKph: WINDY_KPH }), { offsetC: 0 })).toBe(13);
  });
});

describe('recommend', () => {
  it('suggests warm layers in the cold', () => {
    const rec = recommend(weather({ feelsLikeC: 0 }), DEFAULT_CATALOG);
    expect(ids(rec.itemsByCategory.Outerwear)).toContain('heavy_coat');
    expect(ids(rec.itemsByCategory.Accessories)).toContain('gloves');
    expect(ids(rec.itemsByCategory.Tops)).toContain('thermal_top');
  });

  it('suggests light clothing in the heat', () => {
    const rec = recommend(weather({ feelsLikeC: 30 }), DEFAULT_CATALOG);
    expect(ids(rec.itemsByCategory.Tops)).toContain('tshirt');
    expect(ids(rec.itemsByCategory.Bottoms)).toContain('shorts');
    expect(ids(rec.itemsByCategory.Outerwear)).toHaveLength(0);
  });

  it('only suggests rain gear when it is raining', () => {
    const dry = recommend(weather({ feelsLikeC: 14 }), DEFAULT_CATALOG);
    expect(ids(dry.itemsByCategory.Outerwear)).not.toContain('raincoat');

    const wet = recommend(weather({ feelsLikeC: 14, isRaining: true }), DEFAULT_CATALOG);
    expect(ids(wet.itemsByCategory.Outerwear)).toContain('raincoat');
    expect(ids(wet.itemsByCategory.Accessories)).toContain('umbrella');
  });

  it('only suggests a windbreaker when it is windy', () => {
    const calm = recommend(weather({ feelsLikeC: 14, windKph: 5 }), DEFAULT_CATALOG);
    expect(ids(calm.itemsByCategory.Outerwear)).not.toContain('windbreaker');

    const windy = recommend(weather({ feelsLikeC: 14, windKph: 30 }), DEFAULT_CATALOG);
    expect(ids(windy.itemsByCategory.Outerwear)).toContain('windbreaker');
  });

  it('shifts recommendations colder for a wearer who runs cold', () => {
    const w = weather({ feelsLikeC: 17 });
    const neutral = recommend(w, DEFAULT_CATALOG, { offsetC: 0 });
    const runsCold = recommend(w, DEFAULT_CATALOG, { offsetC: 6 });
    // Neutral (eff 17°C) is past the sweater band; the cold-runner (eff 11°C) lands in it.
    expect(ids(neutral.itemsByCategory.Tops)).not.toContain('sweater');
    expect(ids(runsCold.itemsByCategory.Tops)).toContain('sweater');
  });

  it('always returns all four category keys', () => {
    const rec = recommend(weather(), DEFAULT_CATALOG);
    expect(Object.keys(rec.itemsByCategory).sort()).toEqual([
      'Accessories',
      'Bottoms',
      'Outerwear',
      'Tops',
    ]);
  });

  it('returns four empty arrays for an empty catalog (no crash)', () => {
    const rec = recommend(weather(), []);
    expect(rec.itemsByCategory).toEqual({
      Tops: [],
      Bottoms: [],
      Outerwear: [],
      Accessories: [],
    });
  });

  it('orders each category heaviest-rated (lowest minTempC) first', () => {
    const rec = recommend(weather({ feelsLikeC: 4 }), DEFAULT_CATALOG);
    const tops = rec.itemsByCategory.Tops;
    for (let i = 1; i < tops.length; i++) {
      expect(tops[i].minTempC).toBeGreaterThanOrEqual(tops[i - 1].minTempC);
    }
  });

  it('includes both raincoat and windbreaker when wet AND windy', () => {
    const rec = recommend(
      weather({ feelsLikeC: 12, isRaining: true, windKph: 30 }),
      DEFAULT_CATALOG
    );
    expect(ids(rec.itemsByCategory.Outerwear)).toEqual(
      expect.arrayContaining(['raincoat', 'windbreaker'])
    );
  });

  it('handles extreme cold and heat without empty essentials', () => {
    const freezing = recommend(weather({ feelsLikeC: -25 }), DEFAULT_CATALOG);
    expect(ids(freezing.itemsByCategory.Tops)).toContain('thermal_top');
    expect(freezing.itemsByCategory.Bottoms.length).toBeGreaterThan(0);

    const scorching = recommend(weather({ feelsLikeC: 45 }), DEFAULT_CATALOG);
    expect(ids(scorching.itemsByCategory.Tops)).toContain('tank');
    expect(scorching.itemsByCategory.Bottoms.length).toBeGreaterThan(0);
  });
});
