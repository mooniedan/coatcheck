'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import SignInButton from '@/components/SignInButton';
import CitySearch from '@/components/CitySearch';
import AnimatedHome from '@/components/home/AnimatedHome';
import WeekStrip from '@/components/home/WeekStrip';
import DayItems from '@/components/home/DayItems';
import { dayLabel } from '@/components/home/weekday';
import { isoDate, tripsAlertCount } from '@/components/trip/dates';
import { Icon } from '@/components/ui/Icon';
import { CATEGORIES } from '@/lib/types';
import type {
  ApiError,
  DayRecommendation,
  MeResponse,
  Profile,
  Recommendation,
  RecommendationsResponse,
  ResolvedLocation,
  TripsResponse,
  Verdict,
} from '@/lib/types';

export default function Home() {
  const [location, setLocation] = useState<ResolvedLocation | null>(null);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [week, setWeek] = useState<DayRecommendation[]>([]);
  const [comfortOffsetC, setComfortOffsetC] = useState(0);
  const [selectedDay, setSelectedDay] = useState(0);
  const [view, setView] = useState<'scene' | 'list'>('scene');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [isTester, setIsTester] = useState(false); // signed in AND invited (allow-listed)
  const [waitlisted, setWaitlisted] = useState(false); // signed in but not yet invited
  const [isAdmin, setIsAdmin] = useState(false);

  // Saved "home" location (the open-on-launch fallback when GPS isn't readable) + a once-guard
  // so the auto-load runs a single time after /api/me resolves.
  const [homeLocation, setHomeLocation] = useState<ResolvedLocation | null>(null);
  const [homeMsg, setHomeMsg] = useState<string | null>(null);
  const [meReady, setMeReady] = useState(false);
  const autoLoadedRef = useRef(false);

  // Trips-nav badge: how many saved trips just became forecastable (and haven't been opened).
  const [tripsAlert, setTripsAlert] = useState(0);
  useEffect(() => {
    if (!isTester) return;
    fetch('/api/trips')
      .then((r) => r.json() as Promise<TripsResponse | ApiError>)
      .then((d) => {
        if (!('error' in d)) setTripsAlert(tripsAlertCount(d.trips, isoDate(new Date())));
      })
      .catch(() => {});
  }, [isTester]);

  // When a new location's results load, scroll the forecast strip to the top of the viewport
  // so the 7-day strip + animated card are immediately in view (esp. on mobile).
  const resultsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (rec && location && !loading) {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [rec, location, loading]);

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json() as Promise<MeResponse>)
      .then((data) => {
        setSignedIn(Boolean(data.user));
        setIsTester(data.status === 'active');
        setWaitlisted(Boolean(data.user) && data.status === 'waitlisted');
        setIsAdmin(data.user?.role === 'admin' || data.user?.role === 'superadmin');
        setProfiles(data.profiles ?? []);
        if (data.profiles?.length) setActiveProfile(data.profiles[0].id);
        setHomeLocation(data.account?.home_location ?? null);
      })
      .catch(() => {})
      .finally(() => setMeReady(true));
  }, []);

  // `displayLocation` lets a picked autocomplete result drive the header label even though we
  // fetch by lat/lng (the coordinate path resolves to a generic "Your location" name).
  const fetchRecommendation = useCallback(
    async (params: string, displayLocation?: ResolvedLocation) => {
      setLoading(true);
      setError(null);
      setFeedbackMsg(null);
      try {
        const profileParam = activeProfile ? `&profileId=${activeProfile}` : '';
        const res = await fetch(`/api/recommendations?${params}${profileParam}`);
        const data = (await res.json()) as RecommendationsResponse | ApiError;
        if (!res.ok || 'error' in data) {
          throw new Error(('error' in data && data.error) || 'Something went wrong');
        }
        setLocation(displayLocation ?? data.location);
        setRec(data.recommendation);
        setWeek(data.week ?? []);
        setComfortOffsetC(data.comfortOffsetC ?? 0);
        setSelectedDay(0);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
        setRec(null);
        setWeek([]);
      } finally {
        setLoading(false);
      }
    },
    [activeProfile]
  );

  // Picked a suggestion → fetch by its exact coordinates, display the picked place.
  const pickLocation = (loc: ResolvedLocation) =>
    fetchRecommendation(`lat=${loc.latitude}&lng=${loc.longitude}`, loc);

  // Free-text submit (no suggestion chosen) → geocode the typed query (best match).
  const searchText = (q: string) => fetchRecommendation(`q=${encodeURIComponent(q)}`);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError('Location is not available in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchRecommendation(`lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`),
      () => setError('Could not get your location')
    );
  }

  // Auto-load on open (testers only): prefer the device's current location, and fall back to the
  // saved home when GPS is denied/unavailable. Runs once, after /api/me resolves, and never
  // overrides a location the visitor already searched in the brief window before then.
  useEffect(() => {
    if (!meReady || autoLoadedRef.current) return;
    autoLoadedRef.current = true;
    if (!isTester || location) return;
    const loadHome = () => {
      if (homeLocation) pickLocation(homeLocation);
    };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchRecommendation(`lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`),
        loadHome,
        { timeout: 8000 }
      );
    } else {
      loadHome();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meReady]);

  // Is the place currently shown the saved home? (coarse coordinate match)
  const isHome = Boolean(
    location &&
      homeLocation &&
      Math.abs(location.latitude - homeLocation.latitude) < 1e-4 &&
      Math.abs(location.longitude - homeLocation.longitude) < 1e-4
  );

  // Pin the current place as home, or clear it when it's already home.
  async function toggleHome() {
    if (!location) return;
    const next = isHome ? null : location;
    setHomeLocation(next); // optimistic
    const res = await fetch('/api/home', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location: next }),
    });
    if (res.ok) {
      setHomeMsg(next ? 'Saved as your home.' : 'Home cleared.');
    } else {
      setHomeLocation(isHome ? location : null); // revert
      setHomeMsg('Could not save home.');
    }
  }

  async function sendFeedback(verdict: Verdict, wornItemIds?: string[]) {
    if (!activeProfile || !rec) {
      setFeedbackMsg('Sign in and pick a profile to tune your recommendations.');
      return;
    }
    const recommendedItemIds = CATEGORIES.flatMap((c) =>
      rec.itemsByCategory[c].map((i) => i.id)
    );
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profileId: activeProfile,
        verdict,
        weather: rec.weather,
        recommendedItemIds,
        wornItemIds,
      }),
    });
    setFeedbackMsg(res.ok ? 'Thanks — noted for next time.' : 'Could not save feedback.');
  }

  // A child profile gets a smaller figure in the scene (same outfit engine).
  const activeRelationship = profiles.find((p) => p.id === activeProfile)?.relationship;
  const figureScale = activeRelationship === 'child' ? 0.75 : 1;

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-6 sm:py-10">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-medium tracking-tight text-on-surface sm:text-3xl">
          Coat Check
        </h1>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Link href="/admin" className="text-sm font-medium text-primary hover:underline">
              Admin
            </Link>
          )}
          <Link
            href="/trips"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Trips
            {tripsAlert > 0 && (
              <span
                aria-label={`${tripsAlert} trip${tripsAlert === 1 ? '' : 's'} with new weather`}
                className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-on-primary"
              >
                {tripsAlert}
              </span>
            )}
          </Link>
          {profiles.length > 0 && (
            <Link href="/family" className="text-sm font-medium text-primary hover:underline">
              Family
            </Link>
          )}
          <SignInButton />
        </div>
      </header>

      <p className="text-on-surface-variant">What should you wear today? Tell me where you are.</p>

      {!signedIn && (
        <Link
          href="/beta"
          className="flex items-center gap-2 rounded-2xl border border-outline-variant bg-surface-low px-4 py-3 text-sm text-on-surface-variant transition-colors hover:bg-surface-high"
        >
          <Icon name="info" size={18} color="var(--md-primary)" strokeWidth={2} />
          <span>
            Coat Check is in <span className="font-medium text-on-surface">closed testing</span>.
          </span>
          <span className="ml-auto inline-flex items-center gap-1 font-medium text-primary">
            Join the beta
            <Icon name="chevronRight" size={16} strokeWidth={2} />
          </span>
        </Link>
      )}

      {waitlisted && (
        <Link
          href="/beta"
          className="flex items-center gap-2 rounded-2xl border border-outline-variant bg-surface-low px-4 py-3 text-sm text-on-surface-variant transition-colors hover:bg-surface-high"
        >
          <Icon name="info" size={18} color="var(--md-primary)" strokeWidth={2} />
          <span>
            You’re signed in but not yet a tester. Coat Check is in{' '}
            <span className="font-medium text-on-surface">closed testing</span>.
          </span>
          <span className="ml-auto inline-flex items-center gap-1 font-medium text-primary">
            Confirm your spot
            <Icon name="chevronRight" size={16} strokeWidth={2} />
          </span>
        </Link>
      )}

      <CitySearch onPick={pickLocation} onSubmitText={searchText} onUseMyLocation={useMyLocation} />

      {profiles.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-on-surface-variant">For:</span>
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => setActiveProfile(p.id)}
              className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
                activeProfile === p.id
                  ? 'bg-secondary-container text-on-secondary-container'
                  : 'border border-outline-variant text-on-surface-variant hover:bg-surface-high'
              }`}
            >
              {p.display_name}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="text-on-surface-variant">Checking the skies…</p>}
      {error && (
        <p className="rounded-2xl bg-error-container px-4 py-3 text-on-error-container">{error}</p>
      )}

      {rec && location && !loading && (() => {
        // The recommendation for the day the strip has selected (today = the live `rec`).
        const selectedRec =
          selectedDay === 0 ? rec : (week[selectedDay]?.recommendation ?? rec);
        return (
        <div ref={resultsRef} className="flex scroll-mt-4 flex-col gap-3">
          {week.length > 0 && (
            <WeekStrip week={week} selectedIndex={selectedDay} onSelect={setSelectedDay} />
          )}
          {/* Scene/List toggle + Set-as-home, between the days and the content. */}
          {(week.length > 0 || isTester) && (
            <div className="flex items-center justify-between gap-2">
              {week.length > 0 ? (
                <div className="inline-flex rounded-full border border-outline-variant bg-surface-low p-0.5">
                  {(['scene', 'list'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={view === v}
                      onClick={() => setView(v)}
                      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                        view === v
                          ? 'bg-secondary-container text-on-secondary-container'
                          : 'text-on-surface-variant hover:bg-surface-high'
                      }`}
                    >
                      {v === 'scene' ? 'Scene' : 'List'}
                    </button>
                  ))}
                </div>
              ) : (
                <span />
              )}
              {isTester && (
                <button
                  type="button"
                  onClick={toggleHome}
                  aria-pressed={isHome}
                  title={isHome ? 'This is your home — tap to clear' : 'Set as your home location'}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    isHome
                      ? 'border-transparent bg-secondary-container text-on-secondary-container'
                      : 'border-outline-variant text-on-surface-variant hover:bg-surface-high'
                  }`}
                >
                  <Icon name="pin" size={15} color={isHome ? 'currentColor' : 'var(--md-primary)'} />
                  {isHome ? 'Home' : 'Set as home'}
                </button>
              )}
            </div>
          )}
          {homeMsg && <p className="text-xs text-on-surface-variant">{homeMsg}</p>}
          {view === 'list' ? (
            <DayItems
              rec={selectedRec}
              day={week[selectedDay]?.day ?? null}
              location={location}
              label={
                week[selectedDay] ? dayLabel(week[selectedDay].day.date, selectedDay) : 'Today'
              }
            />
          ) : (
            <AnimatedHome
              location={location}
              rec={selectedRec}
              day={week[selectedDay]?.day ?? null}
              comfortOffsetC={comfortOffsetC}
              isToday={selectedDay === 0}
              signedIn={isTester}
              onFeedback={sendFeedback}
              feedbackMsg={feedbackMsg}
              figureScale={figureScale}
            />
          )}
        </div>
        );
      })()}
    </main>
  );
}

