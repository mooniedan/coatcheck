import type { ComfortModel, Cohort, Verdict } from './types';

// Threshold resolution + feedback learning. Pure and unit-tested (thresholds.test.ts).

/** How much one piece of feedback shifts a profile's comfort offset (°C). */
export const FEEDBACK_STEP_C = 1.5;
/** Clamp the personal offset so a noisy streak can't make advice absurd. */
export const MAX_OFFSET_C = 10;

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
