'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import type {
  ApiError,
  FamilyResponse,
  Profile,
  ProfileResponse,
  ProfilesResponse,
} from '@/lib/types';

const RELATIONSHIPS = ['self', 'partner', 'child', 'other'];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '·';
}

export default function FamilyPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [family, setFamily] = useState<FamilyResponse | null>(null);
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('child');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const res = await fetch('/api/profiles');
    if (res.status === 401) {
      setLoaded(true);
      return;
    }
    const data = (await res.json()) as ProfilesResponse;
    setProfiles(data.profiles ?? []);
    const fam = await fetch('/api/family');
    if (fam.ok) setFamily((await fam.json()) as FamilyResponse);
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
    const data = (await res.json()) as ProfileResponse | ApiError;
    if (!res.ok || 'error' in data) {
      setError(('error' in data && data.error) || 'Could not add');
      return;
    }
    setName('');
    setProfiles((p) => [...p, data.profile]);
  }

  async function removeProfile(id: string) {
    const res = await fetch(`/api/profiles?id=${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = (await res.json()) as ApiError;
      setError(data.error ?? 'Could not remove');
      return;
    }
    setProfiles((p) => p.filter((x) => x.id !== id));
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setInviteMsg(null);
    const email = inviteEmail.trim();
    const res = await fetch('/api/family/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = (await res.json()) as ApiError | { ok: true };
    if (!res.ok || 'error' in data) {
      setInviteMsg(('error' in data && data.error) || 'Could not invite');
      return;
    }
    setInviteEmail('');
    setInviteMsg(`Invited ${email}. They join when they sign in with that email.`);
    const fam = await fetch('/api/family');
    if (fam.ok) setFamily((await fam.json()) as FamilyResponse);
  }

  const signedOut = loaded && family === null && profiles.length === 0;

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-6 sm:py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-medium tracking-tight text-on-surface sm:text-3xl">Family</h1>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-surface-high"
        >
          <Icon name="arrowBack" size={16} strokeWidth={2} />
          Back
        </Link>
      </header>

      {!loaded ? (
        <p className="text-on-surface-variant">Loading…</p>
      ) : signedOut ? (
        <p className="rounded-2xl border border-outline-variant bg-surface-low px-4 py-3 text-on-surface-variant">
          Sign in on the home screen to manage your family.
        </p>
      ) : (
        <>
          {/* ── Members: accounts that co-manage this family ── */}
          {family && (
            <section className="flex flex-col gap-3">
              <div>
                <h2 className="text-lg font-medium text-on-surface">Members</h2>
                <p className="text-sm text-on-surface-variant">
                  People who can see and update everyone&apos;s profiles. Invite by email — they
                  get access when they sign in with that Google email.
                </p>
              </div>

              <ul className="flex flex-col gap-2">
                {family.members.map((m) => (
                  <li
                    key={m.account_id}
                    className="flex items-center gap-3 rounded-2xl border border-outline-variant bg-surface px-4 py-3"
                  >
                    <Icon name="pin" size={16} color="var(--md-primary)" />
                    <span className="min-w-0 flex-1 truncate text-on-surface">{m.email ?? '—'}</span>
                    {m.is_self && <span className="text-xs text-on-surface-variant">you</span>}
                    <span className="rounded-full bg-secondary-container px-2.5 py-0.5 text-xs font-medium capitalize text-on-secondary-container">
                      {m.role}
                    </span>
                  </li>
                ))}
                {family.invites.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center gap-3 rounded-2xl border border-dashed border-outline-variant px-4 py-3"
                  >
                    <Icon name="clock" size={16} color="var(--md-primary)" strokeWidth={1.8} />
                    <span className="min-w-0 flex-1 truncate text-on-surface-variant">
                      {i.email}
                    </span>
                    <span className="text-xs text-on-surface-variant">pending</span>
                  </li>
                ))}
              </ul>

              <form onSubmit={invite} className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="partner@email.com"
                  className="flex-1 rounded-full border border-outline-variant bg-surface-lowest px-5 py-3 text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/70 focus:border-primary"
                />
                <button className="rounded-full bg-primary px-6 py-3 font-medium text-on-primary shadow-[var(--md-elev-1)] transition-opacity hover:opacity-90">
                  Invite
                </button>
              </form>
              {inviteMsg && <p className="text-sm text-on-surface-variant">{inviteMsg}</p>}
            </section>
          )}

          {/* ── Profiles: the wearers ── */}
          <section className="flex flex-col gap-3">
            <div>
              <h2 className="text-lg font-medium text-on-surface">People you dress for</h2>
              <p className="text-sm text-on-surface-variant">
                Each person learns their own comfort over time.
              </p>
            </div>

            <ul className="flex flex-col gap-2.5">
              {profiles.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-2xl border border-outline-variant bg-surface-lowest px-4 py-3 shadow-[var(--md-elev-1)]"
                >
                  <span
                    aria-hidden
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary-container text-sm font-semibold text-on-primary-container"
                  >
                    {initials(p.display_name)}
                  </span>
                  <span className="flex flex-1 flex-col">
                    <span className="font-medium text-on-surface">{p.display_name}</span>
                    <span className="text-sm capitalize text-on-surface-variant">
                      {p.relationship}
                    </span>
                  </span>
                  {p.relationship !== 'self' && (
                    <button
                      onClick={() => removeProfile(p.id)}
                      aria-label={`Remove ${p.display_name}`}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-high"
                    >
                      <Icon name="close" size={18} strokeWidth={2} />
                    </button>
                  )}
                </li>
              ))}
            </ul>

            <form onSubmit={addProfile} className="flex flex-col gap-2 sm:flex-row">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                className="flex-1 rounded-full border border-outline-variant bg-surface-lowest px-5 py-3 text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/70 focus:border-primary"
              />
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="rounded-full border border-outline-variant bg-surface-lowest px-4 py-3 capitalize text-on-surface outline-none focus:border-primary"
              >
                {RELATIONSHIPS.filter((r) => r !== 'self').map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <button className="rounded-full bg-primary px-6 py-3 font-medium text-on-primary shadow-[var(--md-elev-1)] transition-opacity hover:opacity-90">
                Add
              </button>
            </form>
          </section>
        </>
      )}

      {error && (
        <p className="rounded-2xl bg-error-container px-4 py-3 text-on-error-container">{error}</p>
      )}
    </main>
  );
}
