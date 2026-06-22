import 'server-only';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createClient } from './server';
import { createAdminClient } from './admin';
import { isSupabaseConfigured } from './env';

/** Elevated roles that may access the admin surface. */
const ADMIN_ROLES = new Set(['admin', 'superadmin']);

// Shared auth gate for Route Handlers that require a signed-in user. Collapses the repeated
// `isSupabaseConfigured() → createClient() → getUser() → 401` boilerplate into one call.
//
// Usage:
//   const auth = await requireUser();
//   if (auth instanceof NextResponse) return auth;   // 401 (not configured / not signed in)
//   const { user } = auth;
export async function requireUser(): Promise<{ user: User } | NextResponse> {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }
  return { user };
}

// Gate for admin-only Route Handlers: signed in AND granted an elevated role in admin_emails.
// The role is re-resolved server-side here (never trusted from the client). Returns 401 if not
// signed in, 403 if signed in without an admin grant.
//
//   const auth = await requireAdmin();
//   if (auth instanceof NextResponse) return auth;
// Resolve a signed-in email's access: its elevated role (if any) and whether it may use the app
// as a tester. Staff are always allowed; everyone else must be allow-listed in beta_signups
// (allowed=true). If the `allowed` column is missing (pre-0006) the check fails open. Shared by
// /api/me and the OAuth callback so the gate is identical in both places.
export async function resolveAccess(
  email: string | undefined
): Promise<{ role: string; allowed: boolean }> {
  const admin = createAdminClient();
  const emailLc = (email ?? '').toLowerCase();
  const { data: grant } = await admin
    .from('admin_emails')
    .select('role')
    .eq('email', emailLc)
    .maybeSingle();
  const role = grant?.role ?? 'user';
  if (ADMIN_ROLES.has(role)) return { role, allowed: true };
  const { data: signup, error } = await admin
    .from('beta_signups')
    .select('allowed')
    .eq('email', emailLc)
    .maybeSingle();
  return { role, allowed: error ? true : Boolean(signup?.allowed) };
}

async function roleFor(email: string | undefined): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('admin_emails')
    .select('role')
    .eq('email', (email ?? '').toLowerCase())
    .maybeSingle();
  return data?.role ?? null;
}

export async function requireAdmin(): Promise<{ user: User } | NextResponse> {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const role = await roleFor(auth.user.email);
  if (!role || !ADMIN_ROLES.has(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return auth;
}

// Stricter gate for actions only a superadmin may perform (e.g. granting admin roles).
export async function requireSuperadmin(): Promise<{ user: User } | NextResponse> {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if ((await roleFor(auth.user.email)) !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return auth;
}
