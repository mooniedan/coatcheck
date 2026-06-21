// Browser (anon/publishable) Supabase client. Read-only against RLS-protected tables;
// also used for the Google OAuth sign-in handshake. All mutations go through Route Handlers.
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
