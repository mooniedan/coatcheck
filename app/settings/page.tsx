'use client';

// Consolidated account settings: language, home location, and family management.
// Language lives on the shared /api/me (via I18nProvider); home location is patched into the
// same cached payload (MeProvider). Family data (profiles + members) isn't on /api/me, so it's
// fetched here on its own — mirrors what the old /family page did.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import CitySearch from '@/components/CitySearch';
import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/components/I18nProvider';
import { useMe } from '@/components/MeProvider';
import { type Locale, LOCALES } from '@/lib/i18n';
import type {
  ApiError,
  FamilyResponse,
  GeocodeResponse,
  Profile,
  ProfileResponse,
  ProfilesResponse,
  RecommendationsResponse,
  ResolvedLocation,
} from '@/lib/types';

const RELATIONSHIPS = ['self', 'partner', 'child', 'other'];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '·';
}

export default function SettingsPage() {
  const { t, locale, setLocale } = useI18n();
  const { me, loading: meLoading, setMe } = useMe();
  const signedIn = Boolean(me?.user);
  const homeLocation = me?.account?.home_location ?? null;

  // Family data (not on /api/me) — fetched here once signed in.
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [family, setFamily] = useState<FamilyResponse | null>(null);
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('child');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [homeMsg, setHomeMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    (async () => {
      const res = await fetch('/api/profiles');
      if (res.status === 401) return;
      setProfiles(((await res.json()) as ProfilesResponse).profiles ?? []);
      const fam = await fetch('/api/family');
      if (fam.ok) setFamily((await fam.json()) as FamilyResponse);
    })();
  }, [signedIn]);

  // ── Home location ──
  // Optimistically patch the cached home (it lives on the shared /api/me payload).
  const patchHome = (loc: ResolvedLocation | null) => {
    if (me?.account) setMe({ ...me, account: { ...me.account, home_location: loc } });
  };

  async function saveHome(loc: ResolvedLocation | null) {
    const prev = homeLocation;
    patchHome(loc); // optimistic
    const res = await fetch('/api/home', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location: loc }),
    });
    if (res.ok) {
      setHomeMsg(loc ? t('home.saved') : t('home.cleared'));
    } else {
      patchHome(prev); // revert
      setHomeMsg(t('home.couldNotSave'));
    }
  }

  // Free-text submit (no suggestion chosen) → geocode the typed query and take the top match.
  async function searchHome(q: string) {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
    const top = ((await res.json()) as GeocodeResponse).results?.[0];
    if (top) saveHome(top);
    else setHomeMsg(t('home.couldNotSave'));
  }

  // GPS → resolve to a named location (recommendations resolves the coordinate name) → save.
  function useMyLocationHome() {
    if (!navigator.geolocation) {
      setHomeMsg(t('home.couldNotSave'));
      return;
    }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const res = await fetch(
        `/api/recommendations?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`
      );
      const data = (await res.json()) as RecommendationsResponse | ApiError;
      if (!('error' in data)) saveHome(data.location);
      else setHomeMsg(t('home.couldNotSave'));
    }, () => setHomeMsg(t('home.couldNotSave')));
  }

  // ── Family ──
  async function refreshFamily() {
    const fam = await fetch('/api/family');
    if (fam.ok) setFamily((await fam.json()) as FamilyResponse);
  }

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
      setError(((await res.json()) as ApiError).error ?? 'Could not remove');
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
    setInviteMsg(t('family.invited', { email }));
    await refreshFamily();
  }

  async function cancelInvite(id: string) {
    const res = await fetch(`/api/family/invite?id=${id}`, { method: 'DELETE' });
    if (res.ok) await refreshFamily();
  }

  async function removeMember(accountId: string) {
    setError(null);
    const res = await fetch(`/api/family/members?accountId=${accountId}`, { method: 'DELETE' });
    if (!res.ok) {
      setError(((await res.json()) as ApiError).error ?? 'Could not update members');
      return;
    }
    await refreshFamily();
    const prof = await fetch('/api/profiles');
    if (prof.ok) setProfiles(((await prof.json()) as ProfilesResponse).profiles ?? []);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-4 py-6 sm:py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-medium tracking-tight text-on-surface sm:text-3xl">
          {t('settings.title')}
        </h1>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-surface-high"
        >
          <Icon name="arrowBack" size={16} strokeWidth={2} />
          {t('settings.back')}
        </Link>
      </header>

      {/* ── Language (available signed in or out) ── */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-medium text-on-surface">{t('settings.language')}</h2>
          <p className="text-sm text-on-surface-variant">{t('settings.languageIntro')}</p>
        </div>
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
          aria-label={t('language.label')}
          className="w-full rounded-2xl border border-outline-variant bg-surface-lowest px-4 py-3 text-on-surface outline-none transition-colors focus:border-primary sm:w-auto"
        >
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {t(`language.${l}`)}
            </option>
          ))}
        </select>
      </section>

      {meLoading ? (
        <p className="text-on-surface-variant">{t('trip.loading')}</p>
      ) : !signedIn ? (
        <p className="rounded-2xl border border-outline-variant bg-surface-low px-4 py-3 text-on-surface-variant">
          {t('settings.signIn')}
        </p>
      ) : (
        <>
          {/* ── Home location ── */}
          <section className="flex flex-col gap-3">
            <div>
              <h2 className="text-lg font-medium text-on-surface">{t('settings.homeLocation')}</h2>
              <p className="text-sm text-on-surface-variant">{t('settings.homeLocationIntro')}</p>
            </div>

            {homeLocation ? (
              <div className="flex items-center gap-3 rounded-2xl border border-outline-variant bg-surface px-4 py-3">
                <Icon name="pin" size={16} color="var(--md-primary)" />
                <span className="min-w-0 flex-1 truncate text-on-surface">{homeLocation.name}</span>
                <button
                  onClick={() => saveHome(null)}
                  aria-label={t('settings.clearHome')}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-high hover:text-error"
                >
                  <Icon name="close" size={16} strokeWidth={2} />
                </button>
              </div>
            ) : (
              <p className="text-sm text-on-surface-variant">{t('settings.noHome')}</p>
            )}

            <CitySearch
              onPick={saveHome}
              onSubmitText={searchHome}
              onUseMyLocation={useMyLocationHome}
              submitLabel={t('settings.setHome')}
            />
            {homeMsg && <p className="text-xs text-on-surface-variant">{homeMsg}</p>}
          </section>

          {/* ── Members: accounts that co-manage this family ── */}
          {family && (
            <section className="flex flex-col gap-3">
              <div>
                <h2 className="text-lg font-medium text-on-surface">{t('family.members')}</h2>
                <p className="text-sm text-on-surface-variant">{t('family.membersIntro')}</p>
              </div>

              <ul className="flex flex-col gap-2">
                {family.members.map((m) => {
                  const canLeave = m.is_self && family.members.length > 1;
                  const canRemove = !m.is_self && family.role === 'owner';
                  return (
                    <li
                      key={m.account_id}
                      className="flex items-center gap-3 rounded-2xl border border-outline-variant bg-surface px-4 py-3"
                    >
                      <Icon name="pin" size={16} color="var(--md-primary)" />
                      <span className="min-w-0 flex-1 truncate text-on-surface">
                        {m.email ?? '—'}
                      </span>
                      {m.is_self && (
                        <span className="text-xs text-on-surface-variant">{t('family.you')}</span>
                      )}
                      <span className="rounded-full bg-secondary-container px-2.5 py-0.5 text-xs font-medium capitalize text-on-secondary-container">
                        {m.role}
                      </span>
                      {canLeave && (
                        <button
                          onClick={() => removeMember(m.account_id)}
                          className="rounded-full px-3 py-1 text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-high hover:text-error"
                        >
                          {t('family.leave')}
                        </button>
                      )}
                      {canRemove && (
                        <button
                          onClick={() => removeMember(m.account_id)}
                          aria-label={`Remove ${m.email ?? 'member'}`}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-high hover:text-error"
                        >
                          <Icon name="close" size={16} strokeWidth={2} />
                        </button>
                      )}
                    </li>
                  );
                })}
                {family.invites.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center gap-3 rounded-2xl border border-dashed border-outline-variant px-4 py-3"
                  >
                    <Icon name="clock" size={16} color="var(--md-primary)" strokeWidth={1.8} />
                    <span className="min-w-0 flex-1 truncate text-on-surface-variant">{i.email}</span>
                    <span className="text-xs text-on-surface-variant">{t('family.pending')}</span>
                    <button
                      onClick={() => cancelInvite(i.id)}
                      aria-label={`Cancel invite to ${i.email}`}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-high hover:text-error"
                    >
                      <Icon name="close" size={16} strokeWidth={2} />
                    </button>
                  </li>
                ))}
              </ul>

              <form onSubmit={invite} className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder={t('family.invitePlaceholder')}
                  className="flex-1 rounded-full border border-outline-variant bg-surface-lowest px-5 py-3 text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/70 focus:border-primary"
                />
                <button className="rounded-full bg-primary px-6 py-3 font-medium text-on-primary shadow-[var(--md-elev-1)] transition-opacity hover:opacity-90">
                  {t('family.invite')}
                </button>
              </form>
              {inviteMsg && <p className="text-sm text-on-surface-variant">{inviteMsg}</p>}
            </section>
          )}

          {/* ── Profiles: the wearers ── */}
          <section className="flex flex-col gap-3">
            <div>
              <h2 className="text-lg font-medium text-on-surface">{t('family.dressFor')}</h2>
              <p className="text-sm text-on-surface-variant">{t('family.dressForIntro')}</p>
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
                      {t(`relationship.${p.relationship}`)}
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
                placeholder={t('family.namePlaceholder')}
                className="flex-1 rounded-full border border-outline-variant bg-surface-lowest px-5 py-3 text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/70 focus:border-primary"
              />
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="rounded-full border border-outline-variant bg-surface-lowest px-4 py-3 capitalize text-on-surface outline-none focus:border-primary"
              >
                {RELATIONSHIPS.filter((r) => r !== 'self').map((r) => (
                  <option key={r} value={r}>
                    {t(`relationship.${r}`)}
                  </option>
                ))}
              </select>
              <button className="rounded-full bg-primary px-6 py-3 font-medium text-on-primary shadow-[var(--md-elev-1)] transition-opacity hover:opacity-90">
                {t('family.add')}
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
