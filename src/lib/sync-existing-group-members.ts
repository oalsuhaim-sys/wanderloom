import type { SupabaseClient } from '@supabase/supabase-js';

import { canonicalizePhoneWa } from '@/lib/client-intake-pipeline';
import { parseMemberPreferencesRow } from '@/lib/group-client-dna-backfill';
import {
  extractLeadFoodPreferences,
  extractLeadInterests,
  upsertPrimaryGroupClient,
  type ClientId,
} from '@/lib/group-client-dna-sync';

export type SyncExistingGroupMembersResult = {
  scanned: number;
  created: number;
  linked: number;
  skipped: number;
  errors: string[];
};

function sanitizePhoneDigits(phoneRaw: string): string {
  return String(phoneRaw ?? '')
    .trim()
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, '');
}

function phoneLookupKeys(phone: string): string[] {
  const clean = sanitizePhoneDigits(phone);
  if (!clean) return [];
  const canon = canonicalizePhoneWa(clean) || clean;
  const keys = new Set<string>([clean, canon]);
  if (clean.length >= 9) keys.add(clean.slice(-9));
  if (canon.length >= 9) keys.add(canon.slice(-9));
  return Array.from(keys);
}

async function fetchAllGroupMembers(
  admin: SupabaseClient,
): Promise<Record<string, unknown>[]> {
  const selects = [
    'id, client_id, customer_phone, customer_name, notes, preferences, group_id',
    'id, client_id, customer_phone, customer_name, notes, preferences',
    'id, client_id, customer_phone, customer_name, notes',
    'id, client_id, customer_phone, customer_name',
    'id, client_id, customer_phone',
  ];

  for (const cols of selects) {
    const { data, error } = await admin.from('group_members').select(cols).limit(3000);
    if (!error) return (data ?? []) as unknown as Record<string, unknown>[];
    if (!/column|schema cache|does not exist|preferences/i.test(error.message ?? '')) {
      console.warn('[sync-existing-group-members] group_members:', error.message);
      return [];
    }
  }
  return [];
}

async function fetchClientsByPhone(
  admin: SupabaseClient,
): Promise<Map<string, { id: ClientId; phone_wa: string }>> {
  const map = new Map<string, { id: ClientId; phone_wa: string }>();
  const selects = ['id, phone_wa', 'id, phone_wa, name'];

  for (const cols of selects) {
    const { data, error } = await admin.from('clients').select(cols).limit(5000);
    if (error) {
      if (/column|schema cache|does not exist/i.test(error.message ?? '')) continue;
      break;
    }
    for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
      const id = row.id as ClientId;
      const phone = String(row.phone_wa ?? '').trim();
      if (!phone) continue;
      const entry = { id, phone_wa: phone };
      for (const key of phoneLookupKeys(phone)) {
        if (!map.has(key)) map.set(key, entry);
      }
    }
    if (map.size > 0) break;
  }
  return map;
}

function resolveClientByPhone(
  phone: string,
  clientsByPhone: Map<string, { id: ClientId; phone_wa: string }>,
): { id: ClientId; phone_wa: string } | null {
  for (const key of phoneLookupKeys(phone)) {
    const hit = clientsByPhone.get(key);
    if (hit) return hit;
  }
  return null;
}

function memberPreferencesToClientInput(
  member: Record<string, unknown>,
): Pick<
  import('@/lib/group-client-dna-sync').GroupRegistrationClientInput,
  'interests' | 'dailyPace' | 'foodPreferences' | 'specialNotes'
> {
  const parsed =
    parseMemberPreferencesRow(member.preferences) ?? {
      interests: [],
      food_preferences: [],
      daily_pace: null,
      final_thoughts: null,
    };

  const notes = String(member.notes ?? '').trim();
  if (notes && !parsed.final_thoughts) {
    parsed.final_thoughts = notes;
  }

  return {
    interests: extractLeadInterests(parsed),
    dailyPace: String(parsed.daily_pace ?? '').trim() || null,
    foodPreferences: extractLeadFoodPreferences(parsed),
    specialNotes: String(parsed.final_thoughts ?? '').trim() || null,
  };
}

async function linkMemberClientId(
  admin: SupabaseClient,
  memberId: string,
  clientId: ClientId,
): Promise<string | null> {
  const clientKey = /^\d+$/.test(String(clientId)) ? Number(clientId) : clientId;
  const { error } = await admin
    .from('group_members')
    .update({ client_id: clientKey })
    .eq('id', memberId);
  return error ? error.message : null;
}

/**
 * One-time style repair: ensure every group_members row with a phone has a matching
 * clients profile (SSOT), then point group_members.client_id at it.
 */
export async function syncExistingGroupMembers(
  admin: SupabaseClient,
): Promise<SyncExistingGroupMembersResult> {
  const result: SyncExistingGroupMembersResult = {
    scanned: 0,
    created: 0,
    linked: 0,
    skipped: 0,
    errors: [],
  };

  const [members, clientsByPhone] = await Promise.all([
    fetchAllGroupMembers(admin),
    fetchClientsByPhone(admin),
  ]);

  result.scanned = members.length;

  for (const member of members) {
    const memberId = String(member.id ?? '').trim();
    if (!memberId) {
      result.skipped += 1;
      continue;
    }

    const phone = String(member.customer_phone ?? '').trim();
    const name = String(member.customer_name ?? '').trim() || 'عميل مجموعة';
    const memberClientId =
      member.client_id != null ? String(member.client_id).trim() : '';

    if (!phone) {
      result.skipped += 1;
      continue;
    }

    const prefs = memberPreferencesToClientInput(member);
    let targetClientId: ClientId | null = null;

    const existing = resolveClientByPhone(phone, clientsByPhone);
    if (existing) {
      targetClientId = existing.id;
    } else if (memberClientId) {
      const { data: linkedClient } = await admin
        .from('clients')
        .select('id, phone_wa')
        .eq('id', /^\d+$/.test(memberClientId) ? Number(memberClientId) : memberClientId)
        .maybeSingle();
      if (linkedClient?.id != null) {
        targetClientId = linkedClient.id as ClientId;
        const linkedPhone = String((linkedClient as { phone_wa?: unknown }).phone_wa ?? '').trim();
        if (linkedPhone) {
          for (const key of phoneLookupKeys(linkedPhone)) {
            clientsByPhone.set(key, { id: targetClientId, phone_wa: linkedPhone });
          }
        }
      }
    }

    if (!targetClientId) {
      const created = await upsertPrimaryGroupClient(admin, {
        fullName: name,
        phoneWa: phone,
        interests: prefs.interests?.length ? prefs.interests : ['رحلة جماعية'],
        dailyPace: prefs.dailyPace,
        foodPreferences: prefs.foodPreferences,
        specialNotes: prefs.specialNotes,
        tripLabel: 'رحلة جماعية',
      });
      if (!created.ok) {
        result.errors.push(`member ${memberId}: ${created.error}`);
        result.skipped += 1;
        continue;
      }
      targetClientId = created.clientId;
      for (const key of phoneLookupKeys(phone)) {
        clientsByPhone.set(key, { id: targetClientId, phone_wa: phone });
      }
      result.created += 1;
    }

    if (memberClientId !== String(targetClientId)) {
      const linkErr = await linkMemberClientId(admin, memberId, targetClientId);
      if (linkErr) {
        result.errors.push(`member ${memberId} link: ${linkErr}`);
      } else {
        result.linked += 1;
      }
    } else {
      result.skipped += 1;
    }
  }

  return result;
}
