import type { SupabaseClient } from '@supabase/supabase-js';

import { canonicalizePhoneWa } from '@/lib/client-intake-pipeline';
import {
  extractLeadFoodPreferences,
  extractLeadInterests,
  hasClientDnaPopulated,
  patchClientDnaWithFallback,
  upsertClientPreferencesInterests,
  type ClientId,
} from '@/lib/group-client-dna-sync';

export type GroupDnaBackfillResult = {
  scanned: number;
  synced: number;
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

function isGroupLeadRow(row: Record<string, unknown>): boolean {
  const formType = String(row.form_type ?? '').trim().toLowerCase();
  if (formType === 'group_trip') return true;
  const travelStyle = String(row.travel_style ?? '').trim().toLowerCase();
  if (travelStyle === 'group') return true;
  const interests = extractLeadInterests(row);
  return interests.some((item) => /رحلة جماعية|رحلة مجموعة/i.test(item));
}

function leadHasDnaPayload(row: Record<string, unknown>): boolean {
  return (
    extractLeadInterests(row).length > 0 ||
    Boolean(String(row.daily_pace ?? '').trim()) ||
    extractLeadFoodPreferences(row).length > 0 ||
    Boolean(String(row.final_thoughts ?? '').trim())
  );
}

/** Parse group_members.preferences when present (jsonb / text[] / object). */
export function parseMemberPreferencesRow(raw: unknown): Record<string, unknown> | null {
  if (raw == null || raw === '') return null;

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return parseMemberPreferencesRow(JSON.parse(trimmed) as unknown);
      } catch {
        return { interests: [trimmed] };
      }
    }
    return { interests: trimmed.split(/[,،|]/).map((s) => s.trim()).filter(Boolean) };
  }

  if (Array.isArray(raw)) {
    const interests = raw.map((v) => String(v).trim()).filter(Boolean);
    return interests.length ? { interests } : null;
  }

  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const interests = Array.isArray(obj.interests)
      ? (obj.interests as unknown[]).map((v) => String(v).trim()).filter(Boolean)
      : typeof obj.interests === 'string'
        ? obj.interests.split(/[,،|]/).map((s) => s.trim()).filter(Boolean)
        : [];
    const food = Array.isArray(obj.food_preferences)
      ? (obj.food_preferences as unknown[]).map((v) => String(v).trim()).filter(Boolean)
      : [];
    const pace = String(obj.daily_pace ?? obj.pace_preference ?? '').trim();
    const notes = String(obj.notes ?? obj.final_thoughts ?? obj.special_notes ?? '').trim();

    if (!interests.length && !food.length && !pace && !notes) return null;

    return {
      interests,
      food_preferences: food,
      daily_pace: pace || null,
      final_thoughts: notes || null,
    };
  }

  return null;
}

function indexMembersByPhone(
  rows: Array<{ phone: string; row: Record<string, unknown> }>,
): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  for (const { phone, row } of rows) {
    for (const key of phoneLookupKeys(phone)) {
      if (!map.has(key)) map.set(key, row);
    }
  }
  return map;
}

async function fetchGroupMembers(
  admin: SupabaseClient,
): Promise<Record<string, unknown>[]> {
  const selects = [
    'id, client_id, customer_phone, customer_name, notes, preferences',
    'id, client_id, customer_phone, customer_name, notes',
    'id, client_id, customer_phone, customer_name',
    'id, client_id, customer_phone',
  ];

  for (const cols of selects) {
    const { data, error } = await admin.from('group_members').select(cols).limit(2000);
    if (!error) return (data ?? []) as Record<string, unknown>[];
    if (!/column|schema cache|does not exist|preferences/i.test(error.message ?? '')) {
      console.warn('[group-dna-backfill] group_members:', error.message);
      return [];
    }
  }
  return [];
}

async function fetchGroupLeads(admin: SupabaseClient): Promise<Record<string, unknown>[]> {
  const selects = [
    'id, client_id, phone_wa, full_name, interests, daily_pace, food_preferences, final_thoughts, form_type, travel_style',
    'id, client_id, phone_wa, interests, daily_pace, food_preferences, final_thoughts, form_type, travel_style',
    'id, client_id, phone_wa, interests, daily_pace, food_preferences, final_thoughts, form_type',
  ];

  for (const cols of selects) {
    const { data, error } = await admin.from('leads').select(cols).limit(3000);
    if (error) {
      if (/column|schema cache|does not exist/i.test(error.message ?? '')) continue;
      console.warn('[group-dna-backfill] leads:', error.message);
      return [];
    }
    return ((data ?? []) as Record<string, unknown>[]).filter(isGroupLeadRow);
  }
  return [];
}

async function fetchLeadApplications(
  admin: SupabaseClient,
): Promise<Record<string, unknown>[]> {
  const selects = [
    'id, client_id, phone_wa, phone, full_name, interests, daily_pace, food_preferences, final_thoughts, preferences, notes',
    'id, client_id, phone_wa, interests, daily_pace, food_preferences, final_thoughts, preferences',
    'id, client_id, phone, preferences, notes',
  ];

  for (const cols of selects) {
    const { data, error } = await admin.from('lead_applications').select(cols).limit(2000);
    if (error) {
      if (/relation|table|column|schema cache|does not exist/i.test(error.message ?? '')) {
        return [];
      }
      console.warn('[group-dna-backfill] lead_applications:', error.message);
      return [];
    }
    return (data ?? []) as Record<string, unknown>[];
  }
  return [];
}

async function fetchClientsNeedingBackfill(
  admin: SupabaseClient,
): Promise<Record<string, unknown>[]> {
  const selects = [
    'id, phone_wa, dna_interests, travel_dna, intake_trip_type, tags',
    'id, phone_wa, dna_interests, travel_dna, tags',
    'id, phone_wa, dna_interests, travel_dna',
  ];

  for (const cols of selects) {
    const { data, error } = await admin.from('clients').select(cols).limit(2000);
    if (error) {
      if (/column|schema cache|does not exist/i.test(error.message ?? '')) continue;
      console.warn('[group-dna-backfill] clients:', error.message);
      return [];
    }
    return ((data ?? []) as Record<string, unknown>[]).filter((row) => !hasClientDnaPopulated(row));
  }
  return [];
}

function resolveDnaSourceForClient(
  client: Record<string, unknown>,
  leadsByClientId: Map<string, Record<string, unknown>>,
  leadsByPhone: Map<string, Record<string, unknown>>,
  appsByClientId: Map<string, Record<string, unknown>>,
  appsByPhone: Map<string, Record<string, unknown>>,
  membersByClientId: Map<string, Record<string, unknown>>,
  membersByPhone: Map<string, Record<string, unknown>>,
): Record<string, unknown> | null {
  const clientId = String(client.id ?? '').trim();
  const phone = String(client.phone_wa ?? '').trim();

  const leadById = clientId ? leadsByClientId.get(clientId) : undefined;
  if (leadById && leadHasDnaPayload(leadById)) return leadById;

  for (const key of phoneLookupKeys(phone)) {
    const lead = leadsByPhone.get(key);
    if (lead && leadHasDnaPayload(lead)) return lead;
  }

  const appById = clientId ? appsByClientId.get(clientId) : undefined;
  if (appById) {
    const parsed =
      parseMemberPreferencesRow(appById.preferences) ??
      ({
        interests: extractLeadInterests(appById),
        daily_pace: appById.daily_pace,
        food_preferences: extractLeadFoodPreferences(appById),
        final_thoughts: appById.final_thoughts ?? appById.notes,
      } as Record<string, unknown>);
    if (leadHasDnaPayload(parsed)) return parsed;
  }

  for (const key of phoneLookupKeys(phone)) {
    const app = appsByPhone.get(key);
    if (!app) continue;
    const parsed =
      parseMemberPreferencesRow(app.preferences) ??
      ({
        interests: extractLeadInterests(app),
        daily_pace: app.daily_pace,
        food_preferences: extractLeadFoodPreferences(app),
        final_thoughts: app.final_thoughts ?? app.notes,
      } as Record<string, unknown>);
    if (leadHasDnaPayload(parsed)) return parsed;
  }

  const memberById = clientId ? membersByClientId.get(clientId) : undefined;
  const member =
    memberById ??
    phoneLookupKeys(phone)
      .map((key) => membersByPhone.get(key))
      .find(Boolean);

  if (member) {
    const fromPrefs = parseMemberPreferencesRow(member.preferences);
    if (fromPrefs && leadHasDnaPayload(fromPrefs)) return fromPrefs;

    const fromNotes = String(member.notes ?? '').trim();
    if (fromNotes && /dna|اهتمام|طعام|وتيرة|رحلة جماعية/i.test(fromNotes)) {
      return { interests: ['رحلة جماعية'], final_thoughts: fromNotes };
    }
  }

  return null;
}

/**
 * Backfill CRM client DNA from legacy group_members + leads (+ lead_applications when present).
 * Idempotent: only updates clients whose dna_interests / travel_dna.interests are empty.
 */
export async function runGroupClientDnaBackfill(
  admin: SupabaseClient,
): Promise<GroupDnaBackfillResult> {
  const result: GroupDnaBackfillResult = {
    scanned: 0,
    synced: 0,
    linked: 0,
    skipped: 0,
    errors: [],
  };

  const [clients, members, leads, applications] = await Promise.all([
    fetchClientsNeedingBackfill(admin),
    fetchGroupMembers(admin),
    fetchGroupLeads(admin),
    fetchLeadApplications(admin),
  ]);

  result.scanned = clients.length;
  if (!clients.length) return result;

  const leadsByClientId = new Map<string, Record<string, unknown>>();
  const leadsByPhone = new Map<string, Record<string, unknown>>();
  for (const lead of leads) {
    const clientId = lead.client_id != null ? String(lead.client_id).trim() : '';
    if (clientId) leadsByClientId.set(clientId, lead);
    const phone = String(lead.phone_wa ?? '').trim();
    for (const key of phoneLookupKeys(phone)) {
      if (!leadsByPhone.has(key)) leadsByPhone.set(key, lead);
    }
  }

  const appsByClientId = new Map<string, Record<string, unknown>>();
  const appsByPhone = new Map<string, Record<string, unknown>>();
  for (const app of applications) {
    const clientId = app.client_id != null ? String(app.client_id).trim() : '';
    if (clientId) appsByClientId.set(clientId, app);
    const phone = String(app.phone_wa ?? app.phone ?? '').trim();
    for (const key of phoneLookupKeys(phone)) {
      if (!appsByPhone.has(key)) appsByPhone.set(key, app);
    }
  }

  const membersByClientId = new Map<string, Record<string, unknown>>();
  const memberPhoneRows: Array<{ phone: string; row: Record<string, unknown> }> = [];
  for (const member of members) {
    const clientId = member.client_id != null ? String(member.client_id).trim() : '';
    if (clientId) membersByClientId.set(clientId, member);
    const phone = String(member.customer_phone ?? '').trim();
    if (phone) memberPhoneRows.push({ phone, row: member });
  }
  const membersByPhone = indexMembersByPhone(memberPhoneRows);

  for (const client of clients) {
    const clientId = client.id as ClientId;
    const clientKey = String(clientId).trim();
    if (!clientKey) {
      result.skipped += 1;
      continue;
    }

    const source = resolveDnaSourceForClient(
      client,
      leadsByClientId,
      leadsByPhone,
      appsByClientId,
      appsByPhone,
      membersByClientId,
      membersByPhone,
    );

    if (!source) {
      result.skipped += 1;
      continue;
    }

    try {
      await patchClientDnaWithFallback(admin, clientId, source);
      await upsertClientPreferencesInterests(admin, clientId, extractLeadInterests(source));

      const phone = String(client.phone_wa ?? '').trim();
      for (const key of phoneLookupKeys(phone)) {
        const member = membersByPhone.get(key);
        if (!member?.id) continue;
        const memberClientId =
          member.client_id != null ? String(member.client_id).trim() : '';
        if (memberClientId === clientKey) break;

        const clientKeyForDb = /^\d+$/.test(clientKey) ? Number(clientKey) : clientKey;
        const { error: linkErr } = await admin
          .from('group_members')
          .update({ client_id: clientKeyForDb })
          .eq('id', member.id);
        if (!linkErr) {
          result.linked += 1;
        } else if (!/column|schema cache|does not exist/i.test(linkErr.message ?? '')) {
          result.errors.push(`group_members link ${member.id}: ${linkErr.message}`);
        }
        break;
      }

      result.synced += 1;
    } catch (err) {
      result.errors.push(
        `client ${clientKey}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return result;
}
