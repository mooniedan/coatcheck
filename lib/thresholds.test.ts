import { describe, it, expect } from 'vitest';
import {
  applyFeedback,
  resolveComfort,
  sourceCohortsForBaseline,
  FEEDBACK_STEP_C,
  MAX_OFFSET_C,
  GENERIC_COMFORT,
} from './thresholds';

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
