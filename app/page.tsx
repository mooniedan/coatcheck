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
import { useI18n } from '@/components/I18nProvider';
import { useMe } from '@/components/MeProvider';
import { Icon } from '@/components/ui/Icon';
import { CATEGORIES } from '@/lib/types';
import type {
  ApiError,
  DayRecommendation,
  Recommendation,
  RecommendationsResponse,
  ResolvedLocation,
  TripsResponse,
  Verdict,
} from '@/lib/types';

export default function Home() {
  const { t, locale } = useI18n();
  const [location, setLocation] = useState<ResolvedLocation | null>(null);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [week, setWeek] = useState<DayRecommendation[]>([]);
  const [comfortOffsetC, setComfortOffsetC] = useState(0);
  const [selectedDay, setSelectedDay] = useState(0);
  const [view, setView] = useState<'scene' | 'list'>('scene');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Session comes from the shared /api/me (MeProvider) — derived, not re-fetched here.
  const { me, loading: meLoading, refresh: refreshMe } = useMe();
  const signedIn = Boolean(me?.user);
  const isTester = me?.status === 'active'; // signed in AND invited (allow-listed)
  const waitlisted = Boolean(me?.user) && me?.status === 'waitlisted';
  const isAdmin = me?.user?.role === 'admin' || me?.user?.role === 'superadmin';
  const profiles = me?.profiles ?? [];
  const pendingInvite = me?.pendingFamilyInvite ?? null;
  const homeLocation = me?.account?.home_location ?? null;
  const meReady = !meLoading;

  const [activeProfile, setActiveProfile] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [inviteDismissed, setInviteDismissed] = useState(false);
  const autoLoadedRef = useRef(false);

  // Default the active profile to the first once profiles load.
  useEffect(() => {
    setActiveProfile((cur) => cur ?? me?.profiles?.[0]?.id ?? null);
  }, [me]);

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

  // Accept a pending family invite → join the inviting family, then refresh the session.
  async function acceptFamilyInvite() {
    const res = await fetch('/api/family/accept', { method: 'POST' });
    if (res.ok) await refreshMe();
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
    setFeedbackMsg(res.ok ? t('feedback.thanks') : t('feedback.couldNotSave'));
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
              {t('nav.admin')}
            </Link>
          )}
          <Link
            href="/trips"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {t('nav.trips')}
            {tripsAlert > 0 && (
              <span
                aria-label={`${tripsAlert} trip${tripsAlert === 1 ? '' : 's'} with new weather`}
                className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-on-primary"
              >
                {tripsAlert}
              </span>
            )}
          </Link>
          <Link
            href="/settings"
            aria-label={t('nav.settings')}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <Icon name="settings" size={18} strokeWidth={1.8} />
            <span className="hidden sm:inline">{t('nav.settings')}</span>
          </Link>
          <SignInButton />
        </div>
      </header>

      <p className="text-on-surface-variant">{t('tagline')}</p>

      {!signedIn && (
        <Link
          href="/beta"
          className="flex items-center gap-2 rounded-2xl border border-outline-variant bg-surface-low px-4 py-3 text-sm text-on-surface-variant transition-colors hover:bg-surface-high"
        >
          <Icon name="info" size={18} color="var(--md-primary)" strokeWidth={2} />
          <span>{t('beta.closedTesting')}</span>
          <span className="ml-auto inline-flex items-center gap-1 font-medium text-primary">
            {t('beta.join')}
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

      {pendingInvite && !inviteDismissed && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-outline-variant bg-surface-low px-4 py-3 text-sm text-on-surface-variant">
          <Icon name="pin" size={18} color="var(--md-primary)" strokeWidth={2} />
          <span>
            <span className="font-medium text-on-surface">
              {pendingInvite.invited_by_email ?? t('invite.someone')}
            </span>{' '}
            {t('invite.shared')}
          </span>
          <button
            onClick={acceptFamilyInvite}
            className="ml-auto rounded-full bg-primary px-4 py-1.5 font-medium text-on-primary shadow-[var(--md-elev-1)] transition-opacity hover:opacity-90"
          >
            Join
          </button>
          <button
            onClick={() => setInviteDismissed(true)}
            className="rounded-full px-3 py-1.5 font-medium text-on-surface-variant transition-colors hover:bg-surface-high"
          >
            {t('invite.notNow')}
          </button>
        </div>
      )}

      <CitySearch onPick={pickLocation} onSubmitText={searchText} onUseMyLocation={useMyLocation} />

      {profiles.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-on-surface-variant">{t('profilesFor')}</span>
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

      {loading && <p className="text-on-surface-variant">{t('loading')}</p>}
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
          {/* Scene/List toggle, between the days and the content. */}
          {week.length > 0 && (
            <div className="inline-flex self-start rounded-full border border-outline-variant bg-surface-low p-0.5">
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
                  {v === 'scene' ? t('view.scene') : t('view.list')}
                </button>
              ))}
            </div>
          )}
          {view === 'list' ? (
            <DayItems
              rec={selectedRec}
              day={week[selectedDay]?.day ?? null}
              location={location}
              label={
                week[selectedDay]
                  ? dayLabel(week[selectedDay].day.date, selectedDay, locale, t('day.today'))
                  : t('day.today')
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

