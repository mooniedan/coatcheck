// Service-role Supabase client. SERVER-ONLY — bypasses RLS.
// Used by Route Handlers for all trust-sensitive mutations: account/profile provisioning,
// feedback ingestion (server_ts, cohort denormalization), cohort baseline aggregation.
import 'server-only';
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
