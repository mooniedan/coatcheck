// Whether Supabase is configured (env vars present). Lets middleware and Route Handlers
// degrade gracefully — behave as "signed out" — before `.env.local` is filled in, instead
// of throwing when `createServerClient` is handed undefined URL/key.
//
// Kept dependency-free (no `next/headers`) so it is safe to import from middleware too.
export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
