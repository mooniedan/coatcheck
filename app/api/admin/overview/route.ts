import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/supabase/auth';

export const runtime = 'nodejs';

// GET /api/admin/overview → { admins, accounts, signups } for the admin dashboard.
// Superadmin/admin only. Reads private tables via the service_role client (the requireAdmin
// gate is the access control; RLS denies these tables to everyone else).
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const admin = createAdminClient();
    const [admins, accounts, signups] = await Promise.all([
      admin.from('admin_emails').select('email, role').order('email'),
      admin
        .from('accounts')
        .select('id, email, cohort, created_at')
        .order('created_at', { ascending: false }),
      admin
        .from('beta_signups')
        .select('email, source, created_at, allowed, approved_at')
        .order('created_at', { ascending: false }),
    ]);

    return NextResponse.json({
      admins: admins.data ?? [],
      accounts: accounts.data ?? [],
      signups: signups.data ?? [],
    });
  } catch (err) {
    console.error('GET /api/admin/overview failed:', err);
    return NextResponse.json({ error: 'Could not load admin data' }, { status: 500 });
  }
}
