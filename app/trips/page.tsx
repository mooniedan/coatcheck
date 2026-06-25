'use client';

// Trips list — the saved trips for the signed-in account. Add a trip (place + date range),
// open one to see/edit its day-by-day packing list, or remove it. Trips persist per-account
// (Supabase), so every client shares them. Signed-out visitors are prompted to sign in.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import CitySearch from '@/components/CitySearch';
import SignInButton from '@/components/SignInButton';
import { Icon } from '@/components/ui/Icon';
import { isoDate, addDays, rangeLabel } from '@/components/trip/dates';
import { useI18n } from '@/components/I18nProvider';
import type {
  ApiError,
  GeocodeResponse,
  MeResponse,
  ResolvedLocation,
  Trip,
  TripResponse,
  TripsResponse,
} from '@/lib/types';

export default function TripsPage() {
  const { t, locale } = useI18n();
  // Any future date is allowed; the forecast just fills in as dates enter the ~16-day horizon.
  const todayIso = useMemo(() => isoDate(new Date()), []);

  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [pending, setPending] = useState<ResolvedLocation | null>(null);
  const [start, setStart] = useState(todayIso);
  const [end, setEnd] = useState(isoDate(addDays(new Date(), 6)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Trip pending a delete confirmation (the X is a two-step action so a trip isn't lost on a stray tap).
  const [confirmId, setConfirmId] = useState<string | null>(null);
  // Bumped after a successful add to remount CitySearch and clear its internal query text.
  const [formKey, setFormKey] = useState(0);

  // Only show trips that haven't ended yet; past trips stay saved but out of the way.
  const upcoming = useMemo(
    () =>
      trips
        .filter((trip) => trip.end_date >= todayIso)
        .sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [trips, todayIso]
  );

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json() as Promise<MeResponse>)
      .then((d) => setSignedIn(Boolean(d.user)))
      .catch(() => setSignedIn(false));
    fetch('/api/trips')
      .then((r) => r.json() as Promise<TripsResponse | ApiError>)
      .then((d) => {
        if (!('error' in d)) setTrips(d.trips);
      })
      .catch(() => {});
  }, []);

  // Free-text submit → geocode and take the best match as the pending place.
  async function geocodeFirst(q: string) {
    try {
      const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const d = (await r.json()) as GeocodeResponse;
      if (d.results?.[0]) setPending(d.results[0]);
      else setError('Location not found');
    } catch {
      setError('Location lookup failed');
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) =>
      setPending({
        name: 'Current location',
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      })
    );
  }

  async function addTrip() {
    if (!pending) {
      setError(t('trip.pickPlace'));
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch('/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location: pending, startDate: start, endDate: end }),
    });
    const data = (await res.json()) as TripResponse | ApiError;
    setSaving(false);
    if (!res.ok || 'error' in data) {
      setError(('error' in data && data.error) || 'Could not add trip');
      return;
    }
    setTrips((t) => [...t, data.trip].sort((a, b) => a.start_date.localeCompare(b.start_date)));
    // Clear the form for the next trip: place, dates back to the default window, and the search box.
    setPending(null);
    setStart(todayIso);
    setEnd(isoDate(addDays(new Date(), 6)));
    setFormKey((k) => k + 1);
  }

  async function removeTrip(id: string) {
    setConfirmId(null);
    const prev = trips;
    setTrips((t) => t.filter((x) => x.id !== id)); // optimistic
    const res = await fetch(`/api/trips/${id}`, { method: 'DELETE' });
    if (!res.ok) setTrips(prev);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-6 sm:py-10">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-medium tracking-tight text-on-surface sm:text-3xl">
          {t('trip.title')}
        </h1>
        <Link href="/" className="text-sm font-medium text-primary hover:underline">
          ← {t('trip.home')}
        </Link>
      </header>

      {signedIn === false ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-outline-variant bg-surface-low px-5 py-6">
          <p className="text-on-surface-variant">{t('trip.signIn')}</p>
          <SignInButton />
        </div>
      ) : (
        <>
          {/* Add a trip */}
          <section className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-surface-low p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-primary">
              {t('trip.addTrip')}
            </h2>
            <CitySearch
              key={formKey}
              onPick={(loc) => {
                setPending(loc);
                setError(null);
              }}
              onSubmitText={geocodeFirst}
              onUseMyLocation={useMyLocation}
            />
            {pending && (
              <p className="inline-flex items-center gap-1.5 text-sm text-on-surface">
                <Icon name="pin" size={15} color="var(--md-primary)" />
                {[pending.name, pending.admin1, pending.country].filter(Boolean).join(', ')}
              </p>
            )}
            <div className="flex flex-wrap items-end gap-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-on-surface-variant">{t('trip.start')}</span>
                <input
                  type="date"
                  value={start}
                  min={todayIso}
                  onChange={(e) => {
                    const v = e.target.value;
                    setStart(v);
                    if (v > end) setEnd(v);
                  }}
                  className="rounded-xl border border-outline-variant bg-surface-lowest px-3 py-2 text-on-surface outline-none focus:border-primary"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-on-surface-variant">{t('trip.end')}</span>
                <input
                  type="date"
                  value={end}
                  min={start}
                  onChange={(e) => setEnd(e.target.value)}
                  className="rounded-xl border border-outline-variant bg-surface-lowest px-3 py-2 text-on-surface outline-none focus:border-primary"
                />
              </label>
              <button
                type="button"
                onClick={addTrip}
                disabled={!pending || saving}
                className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-on-primary shadow-[var(--md-elev-1)] transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {saving ? t('trip.adding') : t('trip.add')}
              </button>
            </div>
            {error && <p className="text-sm text-error">{error}</p>}
          </section>

          {/* Upcoming trips */}
          <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-primary">
            {t('trip.upcoming')}
          </h2>
          {upcoming.length === 0 ? (
            <p className="text-on-surface-variant">{t('trip.noTrips')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {upcoming.map((trip) => (
                <li
                  key={trip.id}
                  className="flex items-center gap-2 rounded-2xl border border-outline-variant bg-surface"
                >
                  <Link
                    href={`/trips/${trip.id}`}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-high"
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <Icon name="pin" size={16} color="var(--md-primary)" />
                      <span className="truncate font-medium text-on-surface">
                        {[trip.location.name, trip.location.country].filter(Boolean).join(', ')}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm text-on-surface-variant">
                      {rangeLabel(trip.start_date, trip.end_date, locale)}
                    </span>
                  </Link>
                  {confirmId === trip.id ? (
                    <span className="mr-2 inline-flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => removeTrip(trip.id)}
                        aria-label={t('trip.confirm')}
                        className="inline-flex h-9 items-center gap-1 rounded-full bg-error-container px-3 text-sm font-medium text-on-error-container transition-opacity hover:opacity-90"
                      >
                        <Icon name="check" size={16} strokeWidth={2} />
                        {t('trip.confirm')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        aria-label={t('trip.cancel')}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-high"
                      >
                        <Icon name="close" size={18} strokeWidth={2} />
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmId(trip.id)}
                      aria-label={`Remove trip to ${trip.location.name}`}
                      className="mr-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-high hover:text-error"
                    >
                      <Icon name="close" size={18} strokeWidth={2} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
