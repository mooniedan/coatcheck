'use client';

// Admin Wardrobe — review every clothing article as its rendered garment component, with its
// temperature band and rain/wind conditions. Read-only; gated to admins. Catalog is static
// (DEFAULT_CATALOG), so no API beyond the /api/me role check.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MiniFigure } from '@/components/home/garments';
import { DEFAULT_CATALOG } from '@/lib/catalog';
import { CATEGORIES } from '@/lib/types';
import type { ClothingItem, MeResponse } from '@/lib/types';

function band(i: ClothingItem): string {
  const lo = i.minTempC <= -40 ? null : i.minTempC;
  const hi = i.maxTempC >= 60 ? null : i.maxTempC;
  if (lo === null && hi !== null) return `≤ ${hi}°C`;
  if (hi === null && lo !== null) return `≥ ${lo}°C`;
  if (lo === null && hi === null) return 'any temp';
  return `${lo}–${hi}°C`;
}

export default function WardrobePage() {
  const [status, setStatus] = useState<'loading' | 'denied' | 'ready'>('loading');

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json() as Promise<MeResponse>)
      .then((me) => {
        const role = me.user?.role;
        setStatus(role === 'admin' || role === 'superadmin' ? 'ready' : 'denied');
      })
      .catch(() => setStatus('denied'));
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-6 sm:py-10">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-medium tracking-tight text-on-surface sm:text-3xl">Wardrobe</h1>
        <Link href="/admin" className="text-sm font-medium text-primary hover:underline">
          ← Admin
        </Link>
      </header>

      {status === 'loading' && <p className="text-on-surface-variant">Loading…</p>}
      {status === 'denied' && (
        <div className="rounded-2xl border border-outline-variant bg-surface-low px-5 py-6 text-on-surface-variant">
          You don’t have access to this page. It’s available to admins only.
        </div>
      )}

      {status === 'ready' &&
        CATEGORIES.map((cat) => {
          const items = DEFAULT_CATALOG.filter((i) => i.category === cat);
          if (items.length === 0) return null;
          return (
            <section key={cat} className="flex flex-col gap-3">
              <h2 className="text-lg font-medium text-on-surface">{cat}</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {items.map((i) => (
                  <div
                    key={i.id}
                    className="flex flex-col items-center gap-1 rounded-2xl border border-outline-variant bg-surface px-2 py-3"
                  >
                    <div className="flex h-28 items-end justify-center">
                      <MiniFigure garmentId={i.id} />
                    </div>
                    <span className="text-sm font-medium text-on-surface">{i.name}</span>
                    <span className="text-xs text-on-surface-variant">{band(i)}</span>
                    {(i.requiresRain || i.requiresWind) && (
                      <span className="text-[11px] font-medium text-primary">
                        {i.requiresRain ? 'rain' : ''}
                        {i.requiresRain && i.requiresWind ? ' · ' : ''}
                        {i.requiresWind ? 'wind' : ''}
                      </span>
                    )}
                    <span className="font-mono text-[10px] text-on-surface-variant/60">{i.id}</span>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
    </main>
  );
}
