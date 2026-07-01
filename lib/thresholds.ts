import { effectiveTemp } from './recommend';
import type { ClothingItem, ComfortModel, Cohort, Verdict, WeatherSnapshot } from './types';

// Threshold resolution + feedback learning. Pure and unit-tested (thresholds.test.ts).

/** How much one piece of feedback shifts a profile's comfort offset (°C). */
export const FEEDBACK_STEP_C = 1.5;
/** Clamp the personal offset so a noisy streak can't make advice absurd. */
export const MAX_OFFSET_C = 10;
/** Fraction of the way to the outfit-implied offset one edit moves (the rest converges over time). */
export const LEARN_RATE = 0.5;
/** Hard cap on a single update, so one odd correction can't swing the model. */
export const STEP_CAP_C = 3;

export const GENERIC_COMFORT: ComfortModel = { offsetC: 0 };

/**
 * Resolve which comfort model the engine should use, in priority order:
 *   profile personal model → cohort baseline → hard-coded generic.
 * Pass `undefined` for any layer that isn't set yet.
 */
export function resolveComfort(
  personal: ComfortModel | undefined | null,
  cohortBaseline: ComfortModel | undefined | null
): ComfortModel {
  if (personal) return personal;
  if (cohortBaseline) return cohortBaseline;
  return GENERIC_COMFORT;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Update a profile's comfort model from one feedback verdict.
 *   too_cold  → wearer was cold → treat weather as colder → offset up   (warmer clothes next time)
 *   too_hot   → wearer was hot  → treat weather as warmer → offset down (lighter clothes next time)
 *   just_right → no change.
 */
export function applyFeedback(model: ComfortModel, verdict: Verdict): ComfortModel {
  let offsetC = model.offsetC;
  if (verdict === 'too_cold') offsetC += FEEDBACK_STEP_C;
  else if (verdict === 'too_hot') offsetC -= FEEDBACK_STEP_C;
  return { offsetC: clamp(offsetC, -MAX_OFFSET_C, MAX_OFFSET_C) };
}

// Rain/wind/sun-gated items signal the weather, not the wearer's warmth — they'd be recommended in
// those conditions regardless of comfort, so they're excluded from the comfort-temperature inference.
function isTemperatureDriven(item: ClothingItem): boolean {
  if (item.requiresRain || item.requiresWind) return false;
  return item.id !== 'sunglasses' && item.id !== 'umbrella';
}

/**
 * Infer the effective temperature the chosen outfit suits: the temperature at which the engine's
 * own temperature-driven layering best matches what the wearer picked (max Jaccard overlap). This
 * is robust to the catalog's open-ended sentinel bands (±40/60) that make a naive band midpoint
 * meaningless — a tank top implies "very warm", not the midpoint of [26, 60].
 */
function inferComfortTempC(chosen: ClothingItem[], catalog: ClothingItem[]): number {
  const tempItems = catalog.filter(isTemperatureDriven);
  const chosenIds = new Set(chosen.map((i) => i.id));
  let bestT = 12; // temperate default if nothing scores
  let bestScore = -1;
  for (let tenths = -300; tenths <= 450; tenths += 5) {
    const T = tenths / 10;
    const at = tempItems.filter((i) => T >= i.minTempC && T <= i.maxTempC);
    let inter = 0;
    for (const i of at) if (chosenIds.has(i.id)) inter++;
    const union = at.length + chosenIds.size - inter;
    const score = union === 0 ? 0 : inter / union;
    if (score > bestScore) {
      bestScore = score;
      bestT = T;
    }
  }
  return bestT;
}

/**
 * Learn from the outfit the wearer said they'd actually wear (a stronger signal than a bare
 * verdict). Infer the effective temperature that outfit suits, then nudge the offset toward
 * reproducing it: pick lighter clothes → higher implied temp → lower offset → lighter future advice.
 * Nudges a fraction (LEARN_RATE) with a per-update cap so one odd edit can't swing the model.
 */
export function learnFromOutfit(
  model: ComfortModel,
  weather: WeatherSnapshot,
  wornItemIds: string[],
  catalog: ClothingItem[]
): ComfortModel {
  const chosen = catalog.filter((i) => wornItemIds.includes(i.id) && isTemperatureDriven(i));
  if (chosen.length === 0) return model; // nothing warmth-bearing to learn from

  const comfortTempC = inferComfortTempC(chosen, catalog);
  // effectiveTemp(weather, {offsetC:0}) == feelsLikeC + windChill, so the offset that makes the
  // engine's effective temperature equal the implied comfort temp is (baseEff − comfortTemp).
  const baseEffC = effectiveTemp(weather, GENERIC_COMFORT);
  const target = baseEffC - comfortTempC;
  const step = clamp(LEARN_RATE * (target - model.offsetC), -STEP_CAP_C, STEP_CAP_C);
  return { offsetC: clamp(model.offsetC + step, -MAX_OFFSET_C, MAX_OFFSET_C) };
}

/**
 * Which cohort's aggregate feeds which cohort's baseline. Alpha feedback refines the beta
 * baseline; alpha+beta refines GA. Used by the aggregation job (Phase 3).
 */
export function sourceCohortsForBaseline(target: Cohort): Cohort[] {
  switch (target) {
    case 'beta':
      return ['alpha'];
    case 'ga':
      return ['alpha', 'beta'];
    case 'alpha':
      return []; // alpha uses hand-tuned generic defaults
  }
}
