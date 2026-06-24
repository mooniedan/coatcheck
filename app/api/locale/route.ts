import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/supabase/auth';
import { callerAccountId } from '@/lib/supabase/family';
import { isLocale } from '@/lib/i18n';

export const runtime = 'nodejs';

// PUT /api/locale { locale: 'en' | 'nb' } — save the signed-in account's language preference
// (follows them on every device + future native clients). Mutates via the service_role client.
export async function PUT(request: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  let body: { locale?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  if (!isLocale(body.locale)) {
    return NextResponse.json({ error: 'Unsupported locale' }, { status: 400 });
  }

  try {
    const accountId = await callerAccountId(auth.user.id);
    if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 400 });

    const admin = createAdminClient();
    const { error } = await admin
      .from('accounts')
      .update({ locale: body.locale })
      .eq('id', accountId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/locale failed:', err);
    return NextResponse.json({ error: 'Could not save language' }, { status: 500 });
  }
}
