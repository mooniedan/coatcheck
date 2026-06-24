import 'server-only';
import { createAdminClient } from './admin';

// Family resolution for Route Handlers. A profile is accessible to a caller when it's in the
// caller's family. During the additive transition (profiles still carry account_id, family_id
// may be null on rows created before the API rework) we also accept account ownership — see
// ADR-0001 and migration 0010. The account_id fallback is removed once account_id is dropped.

export interface CallerFamily {
  accountId: string;
  familyId: string;
  role: string; // 'owner' | 'member'
  cohort: string;
}

// The caller's account row (id + cohort) by auth user id. The single place the
// accounts.eq(user_id) lookup lives — every route resolves the caller through here.
async function callerAccount(userId: string): Promise<{ id: string; cohort: string } | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('accounts')
    .select('id, cohort')
    .eq('user_id', userId)
    .maybeSingle();
  return data ?? null;
}

// Just the caller's account id (null if they have no account — waitlisted / not provisioned).
export async function callerAccountId(userId: string): Promise<string | null> {
  return (await callerAccount(userId))?.id ?? null;
}

// The caller's account + family. Idempotently ensures the account has a family (creates a
// family-of-one as owner if missing — heals accounts provisioned before family sharing).
// Returns null only when the user has no account at all (waitlisted / not provisioned).
export async function ensureCallerFamily(userId: string): Promise<CallerFamily | null> {
  const admin = createAdminClient();
  const account = await callerAccount(userId);
  if (!account) return null;

  const { data: member } = await admin
    .from('family_members')
    .select('family_id, role')
    .eq('account_id', account.id)
    .maybeSingle();
  if (member) {
    return { accountId: account.id, familyId: member.family_id, role: member.role, cohort: account.cohort };
  }

  // No family yet → create a family-of-one (owner).
  const { data: fam } = await admin.from('families').insert({}).select('id').single();
  if (!fam) return null;
  await admin.from('family_members').insert({ family_id: fam.id, account_id: account.id, role: 'owner' });
  return { accountId: account.id, familyId: fam.id, role: 'owner', cohort: account.cohort };
}

// The newest pending family invite for an email, to a family the caller isn't already in.
// Shared by /api/me (surfacing the invite) and /api/family/accept (consuming it).
export async function findPendingInvite(
  email: string,
  excludeFamilyId: string
): Promise<{ id: string; family_id: string; invited_by: string | null } | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('family_invites')
    .select('id, family_id, invited_by')
    .eq('email', email.toLowerCase())
    .neq('family_id', excludeFamilyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

// A PostgREST `.or(...)` filter that matches profiles in the caller's family OR (transition
// fallback) still owned by the caller's account.
export function profileScopeFilter(caller: CallerFamily): string {
  return `family_id.eq.${caller.familyId},account_id.eq.${caller.accountId}`;
}

// Whether a fetched profile row belongs to the caller's family (with the account fallback).
export function profileInFamily(
  profile: { family_id?: string | null; account_id?: string | null },
  caller: CallerFamily
): boolean {
  return profile.family_id === caller.familyId || profile.account_id === caller.accountId;
}
