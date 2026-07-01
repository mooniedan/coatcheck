import { describe, it, expect } from 'vitest';
import {
  applyFeedback,
  learnFromOutfit,
  resolveComfort,
  sourceCohortsForBaseline,
  FEEDBACK_STEP_C,
  MAX_OFFSET_C,
  STEP_CAP_C,
  GENERIC_COMFORT,
} from './thresholds';
import { DEFAULT_CATALOG } from './catalog';
import type { WeatherSnapshot } from './types';

// A calm, dry snapshot at a given feels-like — isolates the comfort inference from rain/wind gates.
function weatherAt(feelsLikeC: number): WeatherSnapshot {
  return {
    feelsLikeC,
    tempC: feelsLikeC,
    humidity: 50,
    windKph: 5,
    precipitationProbability: 0,
    isRaining: false,
    weatherCode: 0,
    description: 'Clear sky',
    observedAt: '2026-07-01T12:00',
  };
}

describe('resolveComfort', () => {
  it('prefers the personal model', () => {
    expect(resolveComfort({ offsetC: 4 }, { offsetC: 2 })).toEqual({ offsetC: 4 });
  });
  it('falls back to the cohort baseline', () => {
    expect(resolveComfort(null, { offsetC: 2 })).toEqual({ offsetC: 2 });
  });
  it('falls back to generic when nothing is set', () => {
    expect(resolveComfort(null, null)).toEqual(GENERIC_COMFORT);
    expect(resolveComfort(undefined, undefined)).toEqual(GENERIC_COMFORT);
  });
});

describe('applyFeedback', () => {
  it('raises the offset when too cold', () => {
    expect(applyFeedback({ offsetC: 0 }, 'too_cold').offsetC).toBe(FEEDBACK_STEP_C);
  });
  it('lowers the offset when too hot', () => {
    expect(applyFeedback({ offsetC: 0 }, 'too_hot').offsetC).toBe(-FEEDBACK_STEP_C);
  });
  it('leaves the offset unchanged when just right', () => {
    expect(applyFeedback({ offsetC: 3 }, 'just_right').offsetC).toBe(3);
  });
  it('clamps to the maximum offset', () => {
    expect(applyFeedback({ offsetC: MAX_OFFSET_C }, 'too_cold').offsetC).toBe(MAX_OFFSET_C);
  });
  it('clamps to the minimum (negative) offset', () => {
    expect(applyFeedback({ offsetC: -MAX_OFFSET_C }, 'too_hot').offsetC).toBe(-MAX_OFFSET_C);
  });
});

describe('learnFromOutfit', () => {
  // Dressing lighter than the baseline for the weather → the wearer runs hot → offset goes negative
  // (engine will treat future weather as warmer → lighter advice).
  it('lowers the offset when the wearer dresses light for the temperature', () => {
    const { offsetC } = learnFromOutfit(
      { offsetC: 0 },
      weatherAt(15),
      ['tshirt', 'shorts'],
      DEFAULT_CATALOG
    );
    expect(offsetC).toBeLessThan(0);
    expect(offsetC).toBeGreaterThanOrEqual(-STEP_CAP_C);
  });

  // Dressing heavier (sweater + jacket at 15°C) → runs cold → offset goes positive.
  it('raises the offset when the wearer bundles up for the temperature', () => {
    const { offsetC } = learnFromOutfit(
      { offsetC: 0 },
      weatherAt(15),
      ['sweater', 'trousers', 'light_jacket'],
      DEFAULT_CATALOG
    );
    expect(offsetC).toBeGreaterThan(0);
    expect(offsetC).toBeLessThanOrEqual(STEP_CAP_C);
  });

  // Wearing exactly what the engine would suggest at the current offset teaches it nothing.
  it('barely moves when the outfit matches the recommendation for the weather', () => {
    const { offsetC } = learnFromOutfit(
      { offsetC: 0 },
      weatherAt(12),
      ['long_sleeve', 'sweater', 'trousers', 'light_jacket'],
      DEFAULT_CATALOG
    );
    expect(Math.abs(offsetC)).toBeLessThan(0.5);
  });

  it('never moves more than the per-update cap', () => {
    const { offsetC } = learnFromOutfit({ offsetC: 0 }, weatherAt(-10), ['tshirt', 'shorts'], DEFAULT_CATALOG);
    expect(Math.abs(offsetC)).toBeLessThanOrEqual(STEP_CAP_C);
  });

  it('stays within the clamp and converges toward (not past) the target', () => {
    const { offsetC } = learnFromOutfit(
      { offsetC: -MAX_OFFSET_C },
      weatherAt(15),
      ['tshirt', 'shorts'],
      DEFAULT_CATALOG
    );
    expect(offsetC).toBeGreaterThanOrEqual(-MAX_OFFSET_C);
    expect(offsetC).toBeLessThanOrEqual(MAX_OFFSET_C);
  });

  it('does not change the model when no warmth-bearing items are chosen', () => {
    expect(learnFromOutfit({ offsetC: 2 }, weatherAt(20), [], DEFAULT_CATALOG)).toEqual({ offsetC: 2 });
    // umbrella/sunglasses are weather-gated, not warmth signals → ignored.
    expect(
      learnFromOutfit({ offsetC: 2 }, weatherAt(20), ['umbrella', 'sunglasses'], DEFAULT_CATALOG)
    ).toEqual({ offsetC: 2 });
  });
});

describe('sourceCohortsForBaseline', () => {
  it('alpha feeds the beta baseline', () => {
    expect(sourceCohortsForBaseline('beta')).toEqual(['alpha']);
  });
  it('alpha + beta feed the GA baseline', () => {
    expect(sourceCohortsForBaseline('ga')).toEqual(['alpha', 'beta']);
  });
  it('alpha has no source cohorts', () => {
    expect(sourceCohortsForBaseline('alpha')).toEqual([]);
  });
});
