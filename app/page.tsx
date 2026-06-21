'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import SignInButton from '@/components/SignInButton';
import type {
  Category,
  ClothingItem,
  Recommendation,
  ResolvedLocation,
  Verdict,
} from '@/lib/types';

const CATEGORIES: Category[] = ['Tops', 'Bottoms', 'Outerwear', 'Accessories'];

interface Profile {
  id: string;
  display_name: string;
  relationship: string;
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState<ResolvedLocation | null>(null);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((data) => {
        setProfiles(data.profiles ?? []);
        if (data.profiles?.length) setActiveProfile(data.profiles[0].id);
      })
      .catch(() => {});
  }, []);

  const fetchRecommendation = useCallback(
    async (params: string) => {
      setLoading(true);
      setError(null);
      setFeedbackMsg(null);
      try {
        const profileParam = activeProfile ? `&profileId=${activeProfile}` : '';
        const res = await fetch(`/api/recommendations?${params}${profileParam}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Something went wrong');
        setLocation(data.location);
        setRec(data.recommendation);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
        setRec(null);
      } finally {
        setLoading(false);
      }
    },
    [activeProfile]
  );

  function searchCity(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) fetchRecommendation(`q=${encodeURIComponent(query.trim())}`);
  }

  function useMyLocation() {
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchRecommendation(`lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`),
      () => setError('Could not get your location')
    );
  }

  async function sendFeedback(verdict: Verdict) {
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
      }),
    });
    setFeedbackMsg(res.ok ? 'Thanks — noted for next time.' : 'Could not save feedback.');
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-6 sm:py-10">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-medium tracking-tight text-on-surface sm:text-3xl">
          Coat Check
        </h1>
        <div className="flex items-center gap-3">
          {profiles.length > 0 && (
            <Link href="/family" className="text-sm font-medium text-primary hover:underline">
              Family
            </Link>
          )}
          <SignInButton />
        </div>
      </header>

      <p className="text-on-surface-variant">What should you wear today? Tell me where you are.</p>

      <form onSubmit={searchCity} className="flex flex-col gap-2 sm:flex-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="City or address…"
          className="flex-1 rounded-full border border-outline-variant bg-surface-lowest px-5 py-3 text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/70 focus:border-primary"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 rounded-full bg-primary px-6 py-3 font-medium text-on-primary shadow-[var(--md-elev-1)] transition-opacity hover:opacity-90 sm:flex-none"
          >
            Check
          </button>
          <button
            type="button"
            onClick={useMyLocation}
            className="inline-flex items-center gap-1.5 rounded-full bg-surface-high px-4 py-3 font-medium text-on-surface transition-colors hover:bg-surface-highest"
          >
            <span aria-hidden>📍</span> Me
          </button>
        </div>
      </form>

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

      {rec && location && !loading && (
        <section className="flex flex-col gap-5">
          <WeatherCard location={location} rec={rec} />

          {CATEGORIES.map((category) => (
            <CategoryRow key={category} category={category} items={rec.itemsByCategory[category]} />
          ))}

          <div className="mt-2 rounded-[28px] border border-outline-variant bg-surface-low p-5">
            <p className="mb-3 text-sm font-medium text-on-surface-variant">How did this feel?</p>
            <div className="flex flex-wrap gap-2.5">
              <FeedbackChip
                label="Too cold"
                emoji="🥶"
                tone="cool"
                onClick={() => sendFeedback('too_cold')}
              />
              <FeedbackChip
                label="Just right"
                emoji="👍"
                tone="just"
                onClick={() => sendFeedback('just_right')}
              />
              <FeedbackChip
                label="Too hot"
                emoji="🥵"
                tone="warm"
                onClick={() => sendFeedback('too_hot')}
              />
            </div>
            {feedbackMsg && <p className="mt-3 text-sm text-on-surface-variant">{feedbackMsg}</p>}
          </div>
        </section>
      )}
    </main>
  );
}

function WeatherCard({ location, rec }: { location: ResolvedLocation; rec: Recommendation }) {
  const w = rec.weather;
  return (
    <div className="rounded-[28px] bg-gradient-to-br from-primary to-secondary p-6 text-on-primary shadow-[var(--md-elev-2)]">
      <p className="text-sm font-medium opacity-90">
        {location.name}
        {location.admin1 ? `, ${location.admin1}` : ''}
      </p>
      <div className="mt-1 flex items-end gap-3">
        <span className="text-5xl font-semibold leading-none">{Math.round(w.tempC)}°</span>
        <span className="pb-1 opacity-90">feels like {Math.round(w.feelsLikeC)}°</span>
      </div>
      <p className="mt-2 text-sm opacity-90">
        {w.description} · 💨 {Math.round(w.windKph)} km/h · 💧 {w.precipitationProbability}%
      </p>
    </div>
  );
}

function CategoryRow({ category, items }: { category: Category; items: ClothingItem[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-primary">
        {category}
      </h2>
      <div className="flex flex-wrap gap-2.5">
        {items.map((item) => (
          <span
            key={item.id}
            className="flex items-center gap-2 rounded-2xl border border-outline-variant bg-surface-lowest px-3 py-2 text-sm font-medium text-on-surface shadow-[var(--md-elev-1)]"
          >
            <span
              aria-hidden
              className="flex h-7 w-7 items-center justify-center rounded-[10px] bg-primary-container text-base"
            >
              {item.icon}
            </span>
            {item.name}
          </span>
        ))}
      </div>
    </div>
  );
}

const FEEDBACK_TONES = {
  cool: 'bg-cool-container text-cool',
  warm: 'bg-warm-container text-warm',
  just: 'bg-just-container text-just',
} as const;

function FeedbackChip({
  label,
  emoji,
  tone,
  onClick,
}: {
  label: string;
  emoji: string;
  tone: keyof typeof FEEDBACK_TONES;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-2xl border-2 border-transparent px-4 py-2.5 text-sm font-medium transition-shadow hover:shadow-[var(--md-elev-1)] ${FEEDBACK_TONES[tone]}`}
    >
      <span aria-hidden>{emoji}</span>
      {label}
    </button>
  );
}
