import type { SupabaseClient } from '@supabase/supabase-js';

export type ReferralOwnerType = 'celebrities' | 'experts' | 'leaders';

export type ReferralCodeOwner = {
  id: string;
  type: ReferralOwnerType;
};

const LOOKUPS: Array<{ table: string; type: ReferralOwnerType; columns: string[] }> = [
  { table: 'influencers', type: 'celebrities', columns: ['referral_code', 'ref_code'] },
  { table: 'experts', type: 'experts', columns: ['referral_code', 'ref_code'] },
  { table: 'leaders', type: 'leaders', columns: ['referral_code', 'ref_code'] },
];

function isMissingColumn(message: string) {
  return /column|schema cache|does not exist/i.test(message);
}

export function normalizeReferralLookupCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

export async function findReferralCodeOwner(
  admin: SupabaseClient,
  rawCode: string,
): Promise<ReferralCodeOwner | null> {
  const code = normalizeReferralLookupCode(rawCode);
  if (!code) return null;

  for (const lookup of LOOKUPS) {
    for (const column of lookup.columns) {
      const { data, error } = await admin
        .from(lookup.table)
        .select('id')
        .eq(column, code)
        .limit(1);

      if (error) {
        if (isMissingColumn(error.message ?? '')) continue;
        console.warn(`[referral-code] ${lookup.table}.${column}:`, error.message);
        continue;
      }

      const id = data?.[0]?.id != null ? String(data[0].id) : '';
      if (id) return { id, type: lookup.type };
    }
  }

  return null;
}
