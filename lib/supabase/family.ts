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

// The caller's account + family. Idempotently ensures the account has a family (creates a
// family-of-one as owner if missing — heals accounts provisioned before family sharing).
// Returns null only when the user has no account at all (waitlisted / not provisioned).
export async function ensureCallerFamily(userId: string): Promise<CallerFamily | null> {
  const admin = createAdminClient();
  const { data: account } = await admin
    .from('accounts')
    .select('id, cohort')
    .eq('user_id', userId)
    .maybeSingle();
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
