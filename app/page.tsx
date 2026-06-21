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
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Coat Check</h1>
        <div className="flex items-center gap-3">
          {profiles.length > 0 && (
            <Link href="/family" className="text-sm font-medium text-sky-deep hover:underline">
              Family
            </Link>
          )}
          <SignInButton />
        </div>
      </header>

      <p className="text-ink-3">What should you wear today? Tell me where you are.</p>

      <form onSubmit={searchCity} className="flex flex-col gap-2 sm:flex-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="City or address…"
          className="flex-1 rounded-lg border border-ink-3/30 bg-white px-4 py-2.5 outline-none focus:border-sky"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 rounded-lg bg-sky px-4 py-2.5 font-semibold text-white hover:bg-sky-deep sm:flex-none"
          >
            Check
          </button>
          <button
            type="button"
            onClick={useMyLocation}
            className="rounded-lg border border-ink-3/30 px-4 py-2.5 font-medium hover:bg-paper-2"
          >
            📍 Me
          </button>
        </div>
      </form>

      {profiles.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-3">For:</span>
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => setActiveProfile(p.id)}
              className={`rounded-full px-3 py-1 font-medium ${
                activeProfile === p.id
                  ? 'bg-ink text-white'
                  : 'border border-ink-3/30 hover:bg-paper-2'
              }`}
            >
              {p.display_name}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="text-ink-3">Checking the skies…</p>}
      {error && <p className="rounded-lg bg-bonnet/10 px-4 py-3 text-bonnet">{error}</p>}

      {rec && location && !loading && (
        <section className="flex flex-col gap-5">
          <WeatherCard location={location} rec={rec} />

          {CATEGORIES.map((category) => (
            <CategoryRow key={category} category={category} items={rec.itemsByCategory[category]} />
          ))}

          <div className="mt-2 rounded-xl bg-paper-2 p-4">
            <p className="mb-3 text-sm font-medium text-ink-2">How did this feel?</p>
            <div className="flex flex-wrap gap-2">
              <FeedbackChip label="🥶 Too cold" onClick={() => sendFeedback('too_cold')} />
              <FeedbackChip label="👍 Just right" onClick={() => sendFeedback('just_right')} />
              <FeedbackChip label="🥵 Too hot" onClick={() => sendFeedback('too_hot')} />
            </div>
            {feedbackMsg && <p className="mt-3 text-sm text-ink-3">{feedbackMsg}</p>}
          </div>
        </section>
      )}
    </main>
  );
}

function WeatherCard({ location, rec }: { location: ResolvedLocation; rec: Recommendation }) {
  const w = rec.weather;
  return (
    <div className="rounded-2xl bg-gradient-to-br from-sky to-dusk p-5 text-white">
      <p className="text-sm opacity-90">
        {location.name}
        {location.admin1 ? `, ${location.admin1}` : ''}
      </p>
      <div className="mt-1 flex items-end gap-3">
        <span className="text-4xl font-bold">{Math.round(w.tempC)}°</span>
        <span className="pb-1 opacity-90">feels like {Math.round(w.feelsLikeC)}°</span>
      </div>
      <p className="mt-1 text-sm opacity-90">
        {w.description} · 💨 {Math.round(w.windKph)} km/h · 💧 {w.precipitationProbability}%
      </p>
    </div>
  );
}

function CategoryRow({ category, items }: { category: Category; items: ClothingItem[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-3">{category}</h2>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item.id}
            className="flex items-center gap-2 rounded-xl border border-ink-3/15 bg-white px-3 py-2 text-sm font-medium shadow-sm"
          >
            <span aria-hidden>{item.icon}</span>
            {item.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function FeedbackChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border border-ink-3/30 bg-white px-4 py-2 text-sm font-medium hover:bg-paper-3"
    >
      {label}
    </button>
  );
}
