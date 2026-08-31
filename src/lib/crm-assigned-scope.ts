import type { SupabaseClient } from '@supabase/supabase-js';

import {
  canonicalizeReferralCode,
  referralCodeLookupVariants,
} from '@/lib/referral-url';
import {
  isAssignedOnlyScope,
  type CrmProfileAccess,
} from '@/lib/crm-permissions';
import type { VipClientProfile } from '@/lib/clientsTravelDna';

export type PartnerAssignedScope = {
  referralCodes: string[];
  leaderIds: string[];
  expertIds: string[];
};

/**
 * Resolve expert/leader identity for assigned-only scoping by auth email / user id.
 */
export async function resolvePartnerAssignedScope(
  admin: SupabaseClient,
  input: { email?: string | null; userId?: string | null },
): Promise<PartnerAssignedScope> {
  const email = String(input.email ?? '')
    .trim()
    .toLowerCase();
  const userId = String(input.userId ?? '').trim();
  const referralCodes = new Set<string>();
  const leaderIds = new Set<string>();
  const expertIds = new Set<string>();

  if (email) {
    const [expertsRes, leadersRes] = await Promise.all([
      admin
        .from('experts')
        .select('id, referral_code, email')
        .ilike('email', email)
        .limit(5),
      admin
        .from('leaders')
        .select('id, referral_code, email')
        .ilike('email', email)
        .limit(5),
    ]);

    for (const row of expertsRes.data ?? []) {
      const id = String((row as { id?: unknown }).id ?? '').trim();
      if (id) expertIds.add(id);
      const code = String((row as { referral_code?: unknown }).referral_code ?? '').trim();
      if (code) referralCodes.add(code);
    }
    for (const row of leadersRes.data ?? []) {
      const id = String((row as { id?: unknown }).id ?? '').trim();
      if (id) leaderIds.add(id);
      const code = String((row as { referral_code?: unknown }).referral_code ?? '').trim();
      if (code) referralCodes.add(code);
    }
  }

  // Soft fallback: match employee email already known; nothing else if tables miss email col
  if (userId && referralCodes.size === 0 && expertIds.size === 0 && leaderIds.size === 0) {
    void userId;
  }

  return {
    referralCodes: [...referralCodes],
    leaderIds: [...leaderIds],
    expertIds: [...expertIds],
  };
}

function clientMatchesReferralScope(
  client: VipClientProfile | Record<string, unknown>,
  referralCodes: string[],
): boolean {
  if (referralCodes.length === 0) return false;
  const targets = new Set(
    referralCodes.flatMap((c) =>
      referralCodeLookupVariants(c).map((v) => canonicalizeReferralCode(v)),
    ),
  );
  const candidates = [
    (client as VipClientProfile).used_code,
    (client as VipClientProfile).referral_code,
    (client as Record<string, unknown>).used_code,
    (client as Record<string, unknown>).referral_code,
    (client as Record<string, unknown>).ref_code,
  ]
    .map((v) => canonicalizeReferralCode(String(v ?? '')))
    .filter(Boolean);

  return candidates.some((c) => targets.has(c));
}

export function filterClientsByAssignedScope(
  rows: VipClientProfile[],
  scope: PartnerAssignedScope,
): VipClientProfile[] {
  if (scope.referralCodes.length === 0) return [];
  return rows.filter((row) => clientMatchesReferralScope(row, scope.referralCodes));
}

export function filterGroupTripsByLeaderScope<T extends { leader_id?: unknown }>(
  rows: T[],
  scope: PartnerAssignedScope,
): T[] {
  if (scope.leaderIds.length === 0) return [];
  const allowed = new Set(scope.leaderIds.map(String));
  return rows.filter((row) => {
    const lid = row.leader_id != null ? String(row.leader_id).trim() : '';
    return Boolean(lid && allowed.has(lid));
  });
}

export function shouldApplyAssignedScope(
  access: CrmProfileAccess | null | undefined,
): boolean {
  return isAssignedOnlyScope(access);
}
