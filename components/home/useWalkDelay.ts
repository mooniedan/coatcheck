'use client';

import { useRef } from 'react';

// All walk-cycle animations share this period (see the ahs* keyframes in globals.css).
export const WALK_PERIOD_MS = 1100;

// Returns a negative `animation-delay` that anchors a looping walk animation to a global phase
// (T mod period), independent of when the element mounted. A limb or garment that (re)mounts
// mid-walk — e.g. when the outfit swaps as the day scrubs — then snaps into the same phase as
// the rest of the figure instead of restarting its cycle and drifting out of sync.
//
// Math: for delay D = -(mount mod P), an element's phase at time T is
//   ((T - mount - D) mod P) = (T mod P), independent of `mount`.
// The scene only renders after a client-side fetch (never SSR'd), so capturing the mount time
// at render time is safe (no hydration mismatch).
export function useWalkDelay(active: boolean): string | undefined {
  const startRef = useRef<number | null>(null);
  if (!active) {
    startRef.current = null;
    return undefined;
  }
  if (startRef.current === null) {
    startRef.current = typeof performance !== 'undefined' ? performance.now() : 0;
  }
  return `${-((startRef.current % WALK_PERIOD_MS) / 1000)}s`;
}
