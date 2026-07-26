import type { SupabaseClient } from '@supabase/supabase-js';

import { pickActiveOrUpcomingItinerary } from '@/lib/client-active-itinerary';
import { normalizeProfilePinInput } from '@/lib/client-profile-unlock';

export type VaultClientMatch = {
  id: string | number;
  profile_code: string;
  name?: string | null;
};

export type VaultItineraryMatch = {
  id: string | number;
  magic_link_id?: string | null;
  passcode?: string | null;
  status?: string | null;
};

export type VaultLookupDebug = {
  normalizedCode: string;
  rawCode: string;
  clientExact: { data: unknown; error: string | null };
  clientIlike: { data: unknown; error: string | null };
  tripPasscode: { data: unknown; error: string | null };
  tripPasscodeIlike: { data: unknown; error: string | null };
};

function errorMessage(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;
  const msg = (err as { message?: unknown }).message;
  return msg != null ? String(msg) : null;
}

function profileCodesMatch(stored: unknown, code: string, rawCode: string): boolean {
  const storedNorm = String(stored ?? '').trim().toUpperCase();
  if (!storedNorm) return false;
  return storedNorm === code || storedNorm === rawCode.trim().toUpperCase();
}

function pickBestVaultItinerary(
  rows: Record<string, unknown>[],
): VaultItineraryMatch | null {
  if (rows.length === 0) return null;
  if (rows.length === 1) {
    const row = rows[0]!;
    return {
      id: row.id as string | number,
      magic_link_id: row.magic_link_id != null ? String(row.magic_link_id) : null,
      passcode: row.passcode != null ? String(row.passcode) : null,
      status: row.status != null ? String(row.status) : null,
    };
  }

  const active = pickActiveOrUpcomingItinerary(rows);
  const chosen =
    (active
      ? rows.find((row) => String(row.id) === active.id)
      : null) ??
    [...rows].sort((a, b) => {
      const aId = Number(a.id);
      const bId = Number(b.id);
      if (Number.isFinite(aId) && Number.isFinite(bId)) return bId - aId;
      return String(b.id).localeCompare(String(a.id));
    })[0];

  if (!chosen) return null;
  return {
    id: chosen.id as string | number,
    magic_link_id:
      chosen.magic_link_id != null ? String(chosen.magic_link_id) : null,
    passcode: chosen.passcode != null ? String(chosen.passcode) : null,
    status: chosen.status != null ? String(chosen.status) : null,
  };
}

export async function lookupClientByProfileCode(
  supabase: SupabaseClient,
  rawInput: string,
): Promise<{
  client: VaultClientMatch | null;
  debug: Pick<
    VaultLookupDebug,
    'normalizedCode' | 'rawCode' | 'clientExact' | 'clientIlike'
  >;
}> {
  const rawCode = rawInput.trim();
  const normalizedCode = normalizeProfilePinInput(rawInput);

  const clientExact = await supabase
    .from('clients')
    .select('*')
    .eq('profile_code', normalizedCode)
    .maybeSingle();

  const clientIlike =
    normalizedCode.length > 0
      ? await supabase
          .from('clients')
          .select('*')
          .ilike('profile_code', normalizedCode)
          .maybeSingle()
      : { data: null, error: null };

  const debug = {
    normalizedCode,
    rawCode,
    clientExact: { data: clientExact.data, error: errorMessage(clientExact.error) },
    clientIlike: { data: clientIlike.data, error: errorMessage(clientIlike.error) },
  };

  const candidate = clientExact.data ?? clientIlike.data;
  if (candidate && typeof candidate === 'object' && 'id' in candidate) {
    const row = candidate as Record<string, unknown>;
    if (profileCodesMatch(row.profile_code, normalizedCode, rawCode)) {
      return {
        client: {
          id: row.id as string | number,
          profile_code: String(row.profile_code ?? normalizedCode).trim(),
          name: row.name != null ? String(row.name) : null,
        },
        debug,
      };
    }
  }

  return { client: null, debug };
}

export async function lookupItineraryByPasscode(
  supabase: SupabaseClient,
  rawInput: string,
): Promise<{
  trip: VaultItineraryMatch | null;
  debug: Pick<VaultLookupDebug, 'tripPasscode' | 'tripPasscodeIlike'>;
}> {
  const normalizedCode = normalizeProfilePinInput(rawInput);

  const tripPasscode = await supabase
    .from('itineraries')
    .select('*')
    .eq('passcode', normalizedCode)
    .order('id', { ascending: false })
    .limit(20);

  const tripPasscodeIlike =
    normalizedCode.length > 0
      ? await supabase
          .from('itineraries')
          .select('*')
          .ilike('passcode', normalizedCode)
          .order('id', { ascending: false })
          .limit(20)
      : { data: null, error: null };

  const debug = {
    tripPasscode: {
      data: tripPasscode.data,
      error: errorMessage(tripPasscode.error),
    },
    tripPasscodeIlike: {
      data: tripPasscodeIlike.data,
      error: errorMessage(tripPasscodeIlike.error),
    },
  };

  const rows = [
    ...((tripPasscode.data ?? []) as Record<string, unknown>[]),
    ...((tripPasscodeIlike.data ?? []) as Record<string, unknown>[]),
  ];

  const byId = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const id = String(row.id ?? '').trim();
    if (id && !byId.has(id)) byId.set(id, row);
  }

  return {
    trip: pickBestVaultItinerary([...byId.values()]),
    debug,
  };
}

export function itineraryPublicSlug(trip: VaultItineraryMatch): string {
  const magic = trip.magic_link_id?.trim() ?? '';
  return magic || String(trip.id).trim();
}
