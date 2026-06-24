import type { ResolvedLocation } from './types';

// Sanitize a client-supplied location into a trusted ResolvedLocation, keeping only the fields
// we render/re-fetch with and requiring finite coordinates + a name. Returns null on bad input.
// Shared by the routes that persist a location (home, trips).
export function normalizeLocation(input: unknown): ResolvedLocation | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  const latitude = Number(o.latitude);
  const longitude = Number(o.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (typeof o.name !== 'string' || !o.name) return null;
  return {
    name: o.name,
    latitude,
    longitude,
    country: typeof o.country === 'string' ? o.country : undefined,
    countryCode: typeof o.countryCode === 'string' ? o.countryCode : undefined,
    admin1: typeof o.admin1 === 'string' ? o.admin1 : undefined,
  };
}

// Validate an ISO date string (YYYY-MM-DD) that denotes a real calendar date.
export function isValidIsoDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
