'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Profile {
  id: string;
  display_name: string;
  relationship: string;
}

const RELATIONSHIPS = ['self', 'partner', 'child', 'other'];

export default function FamilyPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('child');
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const res = await fetch('/api/profiles');
    if (res.status === 401) {
      setLoaded(true);
      return;
    }
    const data = await res.json();
    setProfiles(data.profiles ?? []);
    setLoaded(true);
  }

  useEffect(() => {
    load();
  }, []);

  async function addProfile(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: name, relationship }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Could not add');
      return;
    }
    setName('');
    setProfiles((p) => [...p, data.profile]);
  }

  async function removeProfile(id: string) {
    const res = await fetch(`/api/profiles?id=${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Could not remove');
      return;
    }
    setProfiles((p) => p.filter((x) => x.id !== id));
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-6 sm:py-10">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Family</h1>
        <Link href="/" className="text-sm font-medium text-sky-deep hover:underline">
          ← Back
        </Link>
      </header>

      <p className="text-ink-3">
        Add the people you dress for. Each person learns their own comfort over time.
      </p>

      {!loaded ? (
        <p className="text-ink-3">Loading…</p>
      ) : profiles.length === 0 ? (
        <p className="rounded-lg bg-paper-2 px-4 py-3 text-ink-3">
          Sign in on the home screen to manage family profiles.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {profiles.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-ink-3/15 bg-white px-4 py-3"
            >
              <span>
                <span className="font-medium">{p.display_name}</span>
                <span className="ml-2 text-sm text-ink-3">{p.relationship}</span>
              </span>
              {p.relationship !== 'self' && (
                <button
                  onClick={() => removeProfile(p.id)}
                  className="text-sm font-medium text-bonnet hover:underline"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {loaded && profiles.length > 0 && (
        <form onSubmit={addProfile} className="flex flex-col gap-2 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="flex-1 rounded-lg border border-ink-3/30 bg-white px-4 py-2.5 outline-none focus:border-sky"
          />
          <select
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            className="rounded-lg border border-ink-3/30 bg-white px-3 py-2.5"
          >
            {RELATIONSHIPS.filter((r) => r !== 'self').map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button className="rounded-lg bg-sky px-4 py-2.5 font-semibold text-white hover:bg-sky-deep">
            Add
          </button>
        </form>
      )}

      {error && <p className="text-bonnet">{error}</p>}
    </main>
  );
}
