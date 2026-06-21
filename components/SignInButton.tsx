'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// Google (Gmail) sign-in / sign-out. Uses Supabase OAuth (PKCE); the callback at
// /auth/callback exchanges the code for a session cookie. The browser client is created
// lazily in the browser (not during prerender, where env vars may be absent).
export default function SignInButton() {
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabaseRef.current = supabase;

    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn() {
    await supabaseRef.current?.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function signOut() {
    await supabaseRef.current?.auth.signOut();
    setEmail(null);
  }

  if (!ready) return null;

  return email ? (
    <div className="flex items-center gap-3 text-sm">
      <span className="hidden text-ink-3 sm:inline">{email}</span>
      <button
        onClick={signOut}
        className="rounded-full border border-ink-3/30 px-3 py-1 font-medium hover:bg-paper-2"
      >
        Sign out
      </button>
    </div>
  ) : (
    <button
      onClick={signIn}
      className="rounded-full bg-sky px-4 py-1.5 text-sm font-semibold text-white hover:bg-sky-deep"
    >
      Sign in with Google
    </button>
  );
}
