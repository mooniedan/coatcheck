import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEFAULT_CATALOG } from './catalog';

// Guards the two hand-mirrored sources of truth: lib/catalog.ts (read by the engine) and
// supabase/seed.sql (seeds clothing_items). If a band/flag is edited in one but not the other,
// this fails instead of silently diverging.

interface SeedRow {
  id: string;
  name: string;
  category: string;
  minTempC: number;
  maxTempC: number;
  requiresRain: boolean;
  requiresWind: boolean;
}

function parseSeed(): SeedRow[] {
  const sql = readFileSync(fileURLToPath(new URL('../supabase/seed.sql', import.meta.url)), 'utf8');
  const rowRe =
    /\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*(-?\d+),\s*(-?\d+),\s*(true|false),\s*(true|false),\s*'[^']*'\)/g;
  const rows: SeedRow[] = [];
  for (const m of sql.matchAll(rowRe)) {
    rows.push({
      id: m[1],
      name: m[2],
      category: m[3],
      minTempC: Number(m[4]),
      maxTempC: Number(m[5]),
      requiresRain: m[6] === 'true',
      requiresWind: m[7] === 'true',
    });
  }
  return rows;
}

function normalizeCatalog() {
  return DEFAULT_CATALOG.map((i) => ({
    id: i.id,
    name: i.name,
    category: i.category,
    minTempC: i.minTempC,
    maxTempC: i.maxTempC,
    requiresRain: Boolean(i.requiresRain),
    requiresWind: Boolean(i.requiresWind),
  })).sort((a, b) => a.id.localeCompare(b.id));
}

describe('catalog ↔ seed.sql', () => {
  it('seed parses to the same number of items as the catalog', () => {
    expect(parseSeed()).toHaveLength(DEFAULT_CATALOG.length);
  });

  it('every catalog item matches its seed row (id, name, category, bands, flags)', () => {
    const seed = parseSeed().sort((a, b) => a.id.localeCompare(b.id));
    expect(seed).toEqual(normalizeCatalog());
  });
});
