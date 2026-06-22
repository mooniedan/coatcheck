import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveAccess } from '@/lib/supabase/auth';
import { isSupabaseConfigured } from '@/lib/supabase/env';

// OAuth (PKCE) callback: exchange the code for a session cookie. Invited testers continue to the
// app; everyone else lands on /beta to opt in to the closed-testing waitlist.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // Only allow same-origin relative paths. Reject protocol-relative (`//host`) and any value
  // not starting with a single `/`, so `next` can't be used to redirect off-site.
  const rawNext = searchParams.get('next');
  const next = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';

  if (code && isSupabaseConfigured()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { allowed } = await resolveAccess(user?.email);
      return NextResponse.redirect(`${origin}${allowed ? next : '/beta'}`);
    }
  }
  return NextResponse.redirect(`${origin}/?error=auth`);
}
