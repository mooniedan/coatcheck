'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import type { ApiError, MeResponse } from '@/lib/types';

type Status = 'idle' | 'saving' | 'done' | 'error';

export default function BetaPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);

  // Signed-in state: an invited user shouldn't be here; a signed-in non-invited user confirms
  // their waitlist spot (email pre-filled, opt-in) rather than typing a fresh email.
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [alreadyTester, setAlreadyTester] = useState(false);

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json() as Promise<MeResponse>)
      .then((data) => {
        if (data.user?.email) {
          setSignedInEmail(data.user.email);
          setEmail(data.user.email);
          setAlreadyTester(data.status === 'active');
        }
      })
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('saving');
    setMessage(null);
    try {
      const res = await fetch('/api/beta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as ApiError;
      if (!res.ok) {
        setStatus('error');
        setMessage(data.error ?? 'Something went wrong.');
        return;
      }
      setStatus('done');
    } catch {
      setStatus('error');
      setMessage('Network error — please try again.');
    }
  }

  const confirmMode = signedInEmail !== null && !alreadyTester;

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-6 px-4 py-10 sm:py-16">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-medium tracking-tight text-on-surface sm:text-3xl">Coat Check</h1>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-surface-high"
        >
          <Icon name="arrowBack" size={16} strokeWidth={2} />
          Home
        </Link>
      </header>

      <div className="rounded-[28px] border border-outline-variant bg-surface-low p-6 sm:p-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-container px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-on-primary-container">
          <Icon name="info" size={14} strokeWidth={2} />
          Closed testing in progress
        </span>

        {alreadyTester ? (
          <>
            <h2 className="mt-4 text-xl font-medium text-on-surface">You&apos;re in 🎉</h2>
            <p className="mt-2 text-on-surface-variant">
              You&apos;re an active tester. Head back to the app to check the weather.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 font-medium text-on-primary shadow-[var(--md-elev-1)] transition-opacity hover:opacity-90"
            >
              Open Coat Check
            </Link>
          </>
        ) : (
          <>
            <h2 className="mt-4 text-xl font-medium text-on-surface">
              {confirmMode ? 'Confirm your spot' : 'Join the beta'}
            </h2>
            <p className="mt-2 text-on-surface-variant">
              {confirmMode ? (
                <>
                  You&apos;re signed in as <span className="font-medium text-on-surface">{signedInEmail}</span>.
                  Coat Check is in closed testing — confirm you&apos;d like to be added to the waitlist and
                  we&apos;ll let you in as soon as a spot opens.
                </>
              ) : (
                <>
                  Coat Check is in closed testing while we tune the recommendations. Leave your email and
                  we&apos;ll add you as soon as testing opens up — no spam, just your invite.
                </>
              )}
            </p>

            {status === 'done' ? (
              <div className="mt-6 flex items-center gap-2 rounded-2xl bg-just-container px-4 py-3 text-just">
                <Icon name="check" size={20} strokeWidth={2} />
                <span className="font-medium">You&apos;re on the list. We&apos;ll be in touch.</span>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-6 flex flex-col gap-2 sm:flex-row">
                <input
                  type="email"
                  required
                  readOnly={confirmMode}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex-1 rounded-full border border-outline-variant bg-surface-lowest px-5 py-3 text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/70 focus:border-primary read-only:opacity-70"
                />
                <button
                  type="submit"
                  disabled={status === 'saving'}
                  className="rounded-full bg-primary px-6 py-3 font-medium text-on-primary shadow-[var(--md-elev-1)] transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {status === 'saving'
                    ? 'Adding…'
                    : confirmMode
                      ? 'Add me to the waitlist'
                      : 'Notify me'}
                </button>
              </form>
            )}

            {message && <p className="mt-3 text-sm text-on-surface-variant">{message}</p>}
          </>
        )}
      </div>

      {!signedInEmail && (
        <p className="text-center text-sm text-on-surface-variant">
          Already a tester?{' '}
          <Link href="/" className="font-medium text-primary hover:underline">
            Sign in on the home screen
          </Link>
          .
        </p>
      )}
    </main>
  );
}
