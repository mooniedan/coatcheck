import 'server-only';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createClient } from './server';
import { isSupabaseConfigured } from './env';

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
