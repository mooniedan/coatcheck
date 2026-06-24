'use client';

// A single saved trip: edit its place + date range, and see the day-by-day packing list.
// The day cards update live as you edit; "Save changes" persists the edits to the account.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import CitySearch from '@/components/CitySearch';
import TripDays from '@/components/trip/TripDays';
import { isoDate, addDays, TRIP_HORIZON_DAYS } from '@/components/trip/dates';
import { Icon } from '@/components/ui/Icon';
import type {
  ApiError,
  GeocodeResponse,
  ResolvedLocation,
  Trip,
  TripResponse,
} from '@/lib/types';

export default function TripDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { todayIso, maxIso } = useMemo(() => {
    const today = new Date();
    return { todayIso: isoDate(today), maxIso: isoDate(addDays(today, TRIP_HORIZON_DAYS)) };
  }, []);

  const [trip, setTrip] = useState<Trip | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'notfound'>('loading');

  // Editable working copy.
  const [location, setLocation] = useState<ResolvedLocation | null>(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/trips/${id}`)
      .then((r) => r.json() as Promise<TripResponse | ApiError>)
      .then((d) => {
        if ('error' in d) {
          setStatus('notfound');
          return;
        }
        setTrip(d.trip);
        setLocation(d.trip.location);
        setStart(d.trip.start_date);
        setEnd(d.trip.end_date);
        setStatus('ready');
      })
      .catch(() => setStatus('notfound'));
  }, [id]);

  async function geocodeFirst(q: string) {
    try {
      const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const d = (await r.json()) as GeocodeResponse;
      if (d.results?.[0]) setLocation(d.results[0]);
    } catch {
      /* ignore */
    }
  }

  const dirty =
    !!trip &&
    !!location &&
    (location.latitude !== trip.location.latitude ||
      location.longitude !== trip.location.longitude ||
      start !== trip.start_date ||
      end !== trip.end_date);

  async function save() {
    if (!location || !dirty) return;
    setSaving(true);
    setMsg(null);
    const res = await fetch(`/api/trips/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location, startDate: start, endDate: end }),
    });
    const data = (await res.json()) as TripResponse | ApiError;
    setSaving(false);
    if (!res.ok || 'error' in data) {
      setMsg(('error' in data && data.error) || 'Could not save');
      return;
    }
    setTrip(data.trip);
    setMsg('Saved.');
  }

  async function remove() {
    const res = await fetch(`/api/trips/${id}`, { method: 'DELETE' });
    if (res.ok) router.push('/trips');
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-6 sm:py-10">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-medium tracking-tight text-on-surface sm:text-3xl">Trip</h1>
        <Link href="/trips" className="text-sm font-medium text-primary hover:underline">
          ← Trips
        </Link>
      </header>

      {status === 'loading' && <p className="text-on-surface-variant">Loading…</p>}
      {status === 'notfound' && (
        <p className="rounded-2xl border border-outline-variant bg-surface-low px-5 py-6 text-on-surface-variant">
          This trip isn’t available. It may have been removed, or you’re not signed in.
        </p>
      )}

      {status === 'ready' && location && (
        <>
          {/* Editor */}
          <section className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-surface-low p-4">
            <CitySearch
              onPick={(loc) => setLocation(loc)}
              onSubmitText={geocodeFirst}
              onUseMyLocation={() => {
                if (navigator.geolocation)
                  navigator.geolocation.getCurrentPosition((pos) =>
                    setLocation({
                      name: 'Current location',
                      latitude: pos.coords.latitude,
                      longitude: pos.coords.longitude,
                    })
                  );
              }}
            />
            <p className="inline-flex items-center gap-1.5 text-sm text-on-surface">
              <Icon name="pin" size={15} color="var(--md-primary)" />
              {[location.name, location.admin1, location.country].filter(Boolean).join(', ')}
            </p>
            <div className="flex flex-wrap items-end gap-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-on-surface-variant">Start</span>
                <input
                  type="date"
                  value={start}
                  min={todayIso}
                  max={maxIso}
                  onChange={(e) => {
                    const v = e.target.value;
                    setStart(v);
                    if (v > end) setEnd(v);
                  }}
                  className="rounded-xl border border-outline-variant bg-surface-lowest px-3 py-2 text-on-surface outline-none focus:border-primary"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-on-surface-variant">End</span>
                <input
                  type="date"
                  value={end}
                  min={start}
                  max={maxIso}
                  onChange={(e) => setEnd(e.target.value)}
                  className="rounded-xl border border-outline-variant bg-surface-lowest px-3 py-2 text-on-surface outline-none focus:border-primary"
                />
              </label>
              <button
                type="button"
                onClick={save}
                disabled={!dirty || saving}
                className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-on-primary shadow-[var(--md-elev-1)] transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={remove}
                className="rounded-full px-4 py-2.5 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-high hover:text-error"
              >
                Delete trip
              </button>
            </div>
            {msg && <p className="text-sm text-on-surface-variant">{msg}</p>}
          </section>

          {/* Day-by-day packing list (live from the working copy) */}
          <TripDays location={location} start={start} end={end} />
        </>
      )}
    </main>
  );
}
