'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';

import { CLIENT_LIST_SELECT, CLIENT_LIST_SELECT_WITH_STATUS, CLIENT_SELECT_CORE, CLIENT_SELECT_CORE_WITH_STATUS, normalizeVipClient, type VipClientProfile } from '@/lib/clientsTravelDna';
import {
  approximateBirthDateFromAge,
  calculateAge,
  extractAgeFromRegistrationMeta,
  resolveClientBirthDate,
  resolveClientDisplayAge,
} from '@/lib/client-crm-profile';
import {
  filterClientsByAssignedScope,
  resolvePartnerAssignedScope,
  shouldApplyAssignedScope,
} from '@/lib/crm-assigned-scope';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { runGroupClientDnaBackfill, type GroupDnaBackfillResult } from '@/lib/group-client-dna-backfill';
import {
  syncExistingGroupMembers,
  type SyncExistingGroupMembersResult,
} from '@/lib/sync-existing-group-members';
import {
  assertServiceRoleKeyConfigured,
  requireCrmServerAction,
} from '@/lib/supabase/server-action-auth';

type ClientDirectoryFetchResult =
  | {
      ok: true;
      rows: VipClientProfile[];
    }
  | { ok: false; error: string };

type DeleteClientActionResult =
  | { ok: true; deletedId: string }
  | { ok: false; error: string };

function coerceClientDbId(raw: string | number): string | number {
  const s = String(raw ?? '').trim();
  if (!s) return s;
  const n = Number(s);
  // Prefer numeric id for bigint columns when the string is purely numeric
  if (Number.isFinite(n) && String(n) === s) return n;
  return s;
}

function formatDeleteError(error: {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}): string {
  const msg = (error.message ?? '').toLowerCase();
  if (
    msg.includes('foreign key') ||
    msg.includes('violates') ||
    msg.includes('constraint') ||
    msg.includes('23503') ||
    error.code === '23503'
  ) {
    return 'عذراً، لا يمكن حذف هذا العميل لوجود عروض أسعار أو رحلات مرتبطة به.';
  }
  const parts = [
    error.message?.trim(),
    error.details?.trim(),
    error.hint?.trim(),
    error.code ? `code=${error.code}` : '',
  ].filter(Boolean);
  return parts.join(' | ') || 'تعذر حذف العميل من قاعدة البيانات.';
}

function isIgnorableSchemaError(message: string | undefined): boolean {
  return /relation|table|column|schema cache|does not exist|could not find/i.test(message ?? '');
}

async function deleteByClientId(
  admin: SupabaseClient,
  table: string,
  clientId: string | number,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await admin.from(table).delete().eq('client_id', clientId);
  if (!error) return { ok: true };
  if (isIgnorableSchemaError(error.message)) return { ok: true };
  return { ok: false, error: `${table}: ${error.message}` };
}

async function nullifyClientId(
  admin: SupabaseClient,
  table: string,
  clientId: string | number,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await admin.from(table).update({ client_id: null }).eq('client_id', clientId);
  if (!error) return { ok: true };
  if (isIgnorableSchemaError(error.message)) return { ok: true };
  // If nullify is blocked, try hard-delete of those rows
  return deleteByClientId(admin, table, clientId);
}

/**
 * Clear child rows that block clients DELETE when FKs are RESTRICT
 * (production group_members often lacks ON DELETE CASCADE).
 */
async function cascadeDeleteClientDependents(
  admin: SupabaseClient,
  clientId: string | number,
): Promise<{ ok: boolean; error?: string }> {
  // 1) group_members — adjust booked_seats for confirmed seats, then delete
  const { data: members, error: membersReadErr } = await admin
    .from('group_members')
    .select('id, group_id, status')
    .eq('client_id', clientId);

  if (membersReadErr && !isIgnorableSchemaError(membersReadErr.message)) {
    return { ok: false, error: `group_members: ${membersReadErr.message}` };
  }

  for (const row of members ?? []) {
    const m = row as { group_id?: unknown; status?: unknown };
    if (String(m.status ?? '') !== 'confirmed_seat') continue;
    const tripId = m.group_id != null ? String(m.group_id).trim() : '';
    if (!tripId) continue;

    const { data: trip } = await admin
      .from('group_trips')
      .select('id, booked_seats')
      .eq('id', tripId)
      .maybeSingle();
    if (!trip) continue;
    const current = Math.max(0, Number((trip as { booked_seats?: unknown }).booked_seats) || 0);
    await admin
      .from('group_trips')
      .update({ booked_seats: Math.max(0, current - 1) })
      .eq('id', tripId);
  }

  const gm = await deleteByClientId(admin, 'group_members', clientId);
  if (!gm.ok) return gm;

  // 2) Hard-delete typical child tables (ignore missing relations)
  for (const table of [
    'wallet_transactions',
    'client_memories',
    'client_preferences',
    'itinerary_client_members',
  ] as const) {
    const res = await deleteByClientId(admin, table, clientId);
    if (!res.ok) return res;
  }

  // 3) Detach optional links (quotes / invoices / leads / itineraries)
  for (const table of ['quotations', 'quotes', 'invoices', 'leads', 'itineraries'] as const) {
    const res = await nullifyClientId(admin, table, clientId);
    if (!res.ok) return res;
  }

  // 4) Clear group_trips.leader_id if this client was a leader
  {
    const { error } = await admin
      .from('group_trips')
      .update({ leader_id: null })
      .eq('leader_id', clientId);
    if (error && !isIgnorableSchemaError(error.message)) {
      return { ok: false, error: `group_trips.leader_id: ${error.message}` };
    }
  }

  return { ok: true };
}

/**
 * Hard-delete a client via service_role (bypasses RLS).
 * Cascades child records first so FK RESTRICT cannot block the delete.
 */
export async function deleteClientAction(
  clientId: string | number,
): Promise<DeleteClientActionResult> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) {
    return { ok: false, error: serviceKeyError };
  }

  const raw = String(clientId ?? '').trim();
  if (!raw) {
    return { ok: false, error: 'معرّف العميل غير صالح.' };
  }

  const admin = createSupabaseAdminClient();
  const dbId = coerceClientDbId(raw);

  try {
    const cascade = await cascadeDeleteClientDependents(admin, dbId);
    if (!cascade.ok) {
      console.error('[deleteClientAction] cascade', cascade.error);
      return { ok: false, error: cascade.error ?? 'تعذر حذف السجلات المرتبطة بالعميل.' };
    }

    let { data, error } = await admin
      .from('clients')
      .delete()
      .eq('id', dbId)
      .select('id');

    // Retry alternate id typing if zero rows (bigint vs text mismatch)
    if (!error && (!data || data.length === 0) && typeof dbId === 'number') {
      const cascadeAlt = await cascadeDeleteClientDependents(admin, String(dbId));
      if (!cascadeAlt.ok) {
        return { ok: false, error: cascadeAlt.error ?? 'تعذر حذف السجلات المرتبطة بالعميل.' };
      }
      const retry = await admin
        .from('clients')
        .delete()
        .eq('id', String(dbId))
        .select('id');
      data = retry.data;
      error = retry.error;
    } else if (!error && (!data || data.length === 0) && typeof dbId === 'string') {
      const asNum = Number(dbId);
      if (Number.isFinite(asNum)) {
        const cascadeAlt = await cascadeDeleteClientDependents(admin, asNum);
        if (!cascadeAlt.ok) {
          return { ok: false, error: cascadeAlt.error ?? 'تعذر حذف السجلات المرتبطة بالعميل.' };
        }
        const retry = await admin
          .from('clients')
          .delete()
          .eq('id', asNum)
          .select('id');
        data = retry.data;
        error = retry.error;
      }
    }

    if (error) {
      console.error('[deleteClientAction]', error);
      return { ok: false, error: formatDeleteError(error) };
    }

    if (!data?.length) {
      return {
        ok: false,
        error:
          'لم يُحذف أي صف من قاعدة البيانات — المعرّف غير موجود أو الحذف محجوب.',
      };
    }

    revalidatePath('/crm/clients');
    revalidatePath('/crm');
    revalidatePath('/crm', 'layout');
    return { ok: true, deletedId: String(data[0].id) };
  } catch (err) {
    console.error('[deleteClientAction]', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر حذف العميل من قاعدة البيانات.',
    };
  }
}

/**
 * Batch-load birth dates + ages from group_members + leads (by client_id / phone).
 * Embeds often fail because production group_members historically lacked birth_date.
 */
async function fetchRelatedBirthDates(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  clients: Array<{ id: string; phone_wa?: string | null }>,
): Promise<{
  byClientId: Map<string, string>;
  ageByClientId: Map<string, number>;
  membersByClientId: Map<string, Record<string, unknown>[]>;
}> {
  const byClientId = new Map<string, string>();
  const ageByClientId = new Map<string, number>();
  const membersByClientId = new Map<string, Record<string, unknown>[]>();
  if (clients.length === 0) return { byClientId, ageByClientId, membersByClientId };

  const clientIds = clients.map((c) => c.id).filter(Boolean);
  const clientIdQueryValues = clientIds.flatMap((id) =>
    /^\d+$/.test(id) ? [id, Number(id)] : [id],
  );
  const phones = clients.map((c) => String(c.phone_wa ?? '').trim()).filter(Boolean);

  const rememberAge = (clientKey: string, age: number | null) => {
    if (!clientKey || age == null) return;
    if (!ageByClientId.has(clientKey)) ageByClientId.set(clientKey, age);
  };

  const remember = (
    clientKey: string,
    date: string | null,
    member?: Record<string, unknown>,
    ageHint?: number | null,
  ) => {
    if (!clientKey) return;
    if (member) {
      const list = membersByClientId.get(clientKey) ?? [];
      list.push(member);
      membersByClientId.set(clientKey, list);
    }
    if (date && !byClientId.has(clientKey)) byClientId.set(clientKey, date);
    rememberAge(
      clientKey,
      ageHint ??
        extractAgeFromRegistrationMeta(member) ??
        (date ? calculateAge(date) : null),
    );
  };

  const memberSelects = [
    'id, client_id, customer_phone, birth_date, dob, date_of_birth, birthdate, preferences, notes, passenger_info, created_at',
    'id, client_id, customer_phone, birth_date, dob, preferences, notes, created_at',
    'id, client_id, customer_phone, birth_date, preferences, notes, created_at',
    'id, client_id, customer_phone, birth_date, created_at',
    'id, client_id, customer_phone, preferences, notes, created_at',
    'id, client_id, customer_phone, notes, created_at',
    'id, client_id, customer_phone, created_at',
  ];

  for (const select of memberSelects) {
    const { data, error } = await admin
      .from('group_members')
      .select(select)
      .in('client_id', clientIdQueryValues)
      .limit(5000);
    if (error) {
      if (/column|schema cache|does not exist|passenger_info/i.test(error.message ?? '')) continue;
      console.warn('[fetchRelatedBirthDates] group_members:', error.message);
      break;
    }
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      const cid = String(row.client_id ?? '').trim();
      const dob = resolveClientBirthDate(row);
      remember(cid, dob, row);
    }
    break;
  }

  // Also match members by phone when client_id is missing/mismatched
  if (phones.length > 0) {
    for (const select of [
      'id, client_id, customer_phone, birth_date, dob, preferences, notes, created_at',
      'id, client_id, customer_phone, birth_date, notes, created_at',
      'id, client_id, customer_phone, notes, created_at',
    ]) {
      const { data, error } = await admin
        .from('group_members')
        .select(select)
        .in('customer_phone', phones)
        .limit(5000);
      if (error) {
        if (/column|schema cache|does not exist/i.test(error.message ?? '')) continue;
        break;
      }
      const phoneToClient = new Map(
        clients.map((c) => [String(c.phone_wa ?? '').trim(), c.id] as const),
      );
      for (const row of (data ?? []) as Record<string, unknown>[]) {
        const phone = String(row.customer_phone ?? '').trim();
        const cid = String(row.client_id ?? '').trim() || phoneToClient.get(phone) || '';
        const dob = resolveClientBirthDate(row);
        remember(cid, dob, row);
      }
      break;
    }
  }

  const leadSelects = [
    'id, client_id, phone_wa, birth_date, age, dob, date_of_birth, final_thoughts, created_at',
    'id, client_id, phone_wa, birth_date, age, final_thoughts, created_at',
    'id, client_id, phone_wa, birth_date, age, created_at',
    'id, client_id, phone_wa, birth_date, dob, date_of_birth, created_at',
    'id, client_id, phone_wa, birth_date, created_at',
    'id, phone_wa, birth_date, age, final_thoughts, created_at',
    'id, phone_wa, birth_date, age, created_at',
    'id, phone_wa, birth_date, created_at',
  ];
  for (const select of leadSelects) {
    if (clientIdQueryValues.length) {
      const byClient = await admin
        .from('leads')
        .select(select)
        .in('client_id', clientIdQueryValues)
        .limit(5000);
      if (!byClient.error) {
        for (const row of (byClient.data ?? []) as Record<string, unknown>[]) {
          const cid = String(row.client_id ?? '').trim();
          const age = extractAgeFromRegistrationMeta(row);
          const dob =
            resolveClientBirthDate(row) || approximateBirthDateFromAge(age ?? row.age);
          remember(cid, dob, undefined, age);
        }
        // Keep going to also try phone matches for orphan leads
      } else if (
        !/column|schema cache|does not exist|client_id|final_thoughts/i.test(
          byClient.error.message ?? '',
        )
      ) {
        console.warn('[fetchRelatedBirthDates] leads:', byClient.error.message);
      }
    }

    if (phones.length) {
      const byPhone = await admin.from('leads').select(select).in('phone_wa', phones).limit(5000);
      if (byPhone.error) {
        if (/column|schema cache|does not exist|final_thoughts/i.test(byPhone.error.message ?? ''))
          continue;
        break;
      }
      const phoneToClient = new Map(
        clients.map((c) => [String(c.phone_wa ?? '').trim(), c.id] as const),
      );
      for (const row of (byPhone.data ?? []) as Record<string, unknown>[]) {
        const phone = String(row.phone_wa ?? '').trim();
        const cid = String(row.client_id ?? '').trim() || phoneToClient.get(phone) || '';
        const age = extractAgeFromRegistrationMeta(row);
        const dob =
          resolveClientBirthDate(row) || approximateBirthDateFromAge(age ?? row.age);
        remember(cid, dob, undefined, age);
      }
      break;
    }
    break;
  }

  return { byClientId, ageByClientId, membersByClientId };
}

/** Full directory fetch — no artificial 50-row cap (PostgREST soft max). */
const CLIENT_DIRECTORY_PAGE_LIMIT = 5000;

type FetchClientDirectoryOptions = {
  /** Max rows to return (default 5000). */
  limit?: number;
  /** Skip healing UPDATE round-trips on list load (default true). */
  skipBackfill?: boolean;
};

export async function fetchClientDirectoryAction(
  accessToken?: string | null,
  options?: FetchClientDirectoryOptions,
): Promise<ClientDirectoryFetchResult> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) {
    return { ok: false, error: serviceKeyError };
  }

  try {
    const admin = createSupabaseAdminClient();
    const auth = await requireCrmServerAction(accessToken);
    const requested = options?.limit ?? CLIENT_DIRECTORY_PAGE_LIMIT;
    const listLimit = Math.min(Math.max(1, requested), 5000);
    const skipBackfill = options?.skipBackfill !== false;

    // Progressive selects — try `status` first, then CORE without it (keeps lead_source/tags)
    const selectAttempts = [
      CLIENT_LIST_SELECT_WITH_STATUS,
      CLIENT_LIST_SELECT,
      `${CLIENT_SELECT_CORE_WITH_STATUS}, total_spent, total_profit, lifetime_value, engagement_status, vip_tier, wallet_balance, onboarding_completed`,
      `${CLIENT_SELECT_CORE}, total_spent, total_profit, lifetime_value, engagement_status, vip_tier, wallet_balance, onboarding_completed`,
      `${CLIENT_SELECT_CORE}, total_spent, total_profit, vip_tier, wallet_balance, onboarding_completed`,
      CLIENT_SELECT_CORE_WITH_STATUS,
      CLIENT_SELECT_CORE,
      'id, name, phone_wa, email, birth_date, age, created_at, sales_stage, client_type, client_tier, total_trips, total_spent, lifetime_value, engagement_status, travel_dna, dna_interests, lead_source, status, ref_code, used_code, tags, target_trip',
      'id, name, phone_wa, email, birth_date, age, created_at, sales_stage, client_type, client_tier, total_trips, total_spent, lifetime_value, engagement_status, travel_dna, dna_interests, lead_source, ref_code, used_code, tags, target_trip',
      'id, name, phone_wa, email, birth_date, age, created_at, sales_stage, client_type, client_tier, total_trips, lead_source, tags, target_trip, travel_dna, ref_code',
      'id, name, phone_wa, email, birth_date, created_at, sales_stage, client_type, client_tier, total_trips, lead_source, tags, target_trip, ref_code',
      'id, name, phone_wa, email, birth_date, age, created_at, sales_stage, client_type, total_trips, lead_source, ref_code',
      'id, name, phone_wa, email, birth_date, created_at, sales_stage, client_type, total_trips',
      'id, name, phone_wa, birth_date, age, travel_dna, created_at, total_trips, lead_source, ref_code',
      'id, name, phone_wa, birth_date, created_at',
      'id, name, phone_wa, created_at',
    ];

    let data: unknown[] | null = null;
    let lastError = '';

    for (const select of selectAttempts) {
      const result = await admin
        .from('clients')
        .select(select)
        .order('created_at', { ascending: false })
        .limit(listLimit);

      if (!result.error) {
        data = (result.data ?? []) as unknown[];
        break;
      }

      lastError = result.error.message || 'select failed';
      console.warn('[fetchClientDirectoryAction] select failed, retrying leaner:', lastError);

      if (!/column|schema cache|does not exist|relationship|could not find/i.test(lastError)) {
        return { ok: false, error: lastError };
      }
    }

    if (data == null) {
      return { ok: false, error: lastError || 'تعذر قراءة جدول العملاء.' };
    }

    const rawClients = data as Record<string, unknown>[];
    const related = await fetchRelatedBirthDates(
      admin,
      rawClients.map((r) => ({
        id: String(r.id ?? ''),
        phone_wa: r.phone_wa != null ? String(r.phone_wa) : null,
      })),
    );

    console.info('[fetchClientDirectoryAction] birth-date enrichment', {
      clients: rawClients.length,
      withRelatedDob: related.byClientId.size,
      withRelatedAge: related.ageByClientId.size,
      withMemberRows: related.membersByClientId.size,
    });

    let rows: VipClientProfile[] = [];
    const seenIds = new Set<string>();
    const backfillBirthDates: { id: string; birth_date: string }[] = [];
    const backfillAges: { id: string; age: number }[] = [];

    for (const raw of rawClients) {
      const rowId = String(raw.id ?? '');
      const members = related.membersByClientId.get(rowId) ?? [];
      if (members.length) raw.group_members = members;

      // SSOT: clients.birth_date first; related tables only fill gaps.
      const clientDob = resolveClientBirthDate(raw);
      const relatedDob = related.byClientId.get(rowId) ?? null;
      const resolvedDob =
        clientDob ||
        relatedDob ||
        resolveClientBirthDate({
          ...raw,
          group_members: members,
        });
      if (resolvedDob) {
        if (!clientDob) {
          backfillBirthDates.push({ id: rowId, birth_date: resolvedDob });
        }
        raw.birth_date = resolvedDob;
      }

      // Force age onto the row before normalize (clients.age / leads.age / notes / DOB)
      const hadPersistedAge =
        extractAgeFromRegistrationMeta({
          age: raw.age,
          travel_dna: raw.travel_dna,
        }) != null;
      const relatedAge = related.ageByClientId.get(rowId) ?? null;
      const resolvedAge =
        extractAgeFromRegistrationMeta(raw) ||
        relatedAge ||
        extractAgeFromRegistrationMeta({ group_members: members }) ||
        (resolvedDob ? calculateAge(resolvedDob) : null);
      if (resolvedAge != null) {
        raw.age = resolvedAge;
      }

      const mapped = normalizeVipClient(raw);
      if (!mapped) continue;

      if (resolvedDob) mapped.birth_date = resolvedDob;
      // Always materialize age on the profile object returned to ClientCard
      mapped.age =
        mapped.age ??
        relatedAge ??
        resolveClientDisplayAge({
          ...mapped,
          group_members: members,
        });
      if (mapped.age == null && resolvedDob) {
        mapped.age = calculateAge(resolvedDob);
      }
      if (mapped.age != null && !hadPersistedAge) {
        backfillAges.push({ id: rowId, age: mapped.age });
      }
      ;(mapped as VipClientProfile & { group_members?: unknown }).group_members = members;

      if (seenIds.has(rowId)) continue;
      seenIds.add(rowId);
      rows.push(mapped);
    }

    // Heal legacy rows in the background — never block directory paint on UPDATEs.
    if (!skipBackfill && backfillBirthDates.length) {
      void Promise.all(
        backfillBirthDates.map(async ({ id, birth_date }) => {
          const age = calculateAge(birth_date);
          const patch: Record<string, unknown> = { birth_date };
          if (age != null) patch.age = age;
          const { error } = await admin
            .from('clients')
            .update(patch)
            .eq('id', id)
            .is('birth_date', null);
          if (error) {
            if (/column|schema cache|does not exist|age/i.test(error.message ?? '')) {
              const { error: leanErr } = await admin
                .from('clients')
                .update({ birth_date })
                .eq('id', id)
                .is('birth_date', null);
              if (leanErr) {
                console.warn('[fetchClientDirectoryAction] birth_date backfill:', id, leanErr.message);
              }
            } else {
              console.warn('[fetchClientDirectoryAction] birth_date backfill:', id, error.message);
            }
          }
        }),
      );
    }

    if (!skipBackfill && backfillAges.length) {
      void Promise.all(
        backfillAges.map(async ({ id, age }) => {
          const { error } = await admin
            .from('clients')
            .update({ age })
            .eq('id', id)
            .is('age', null);
          if (error && !/column|schema cache|does not exist|age/i.test(error.message ?? '')) {
            console.warn('[fetchClientDirectoryAction] age backfill:', id, error.message);
          }
        }),
      );
    }

    if (auth.ok && shouldApplyAssignedScope(auth.access)) {
      const scope = await resolvePartnerAssignedScope(admin, {
        email: auth.email,
        userId: auth.userId,
      });
      rows = filterClientsByAssignedScope(rows, scope);
    }

    return { ok: true, rows };
  } catch (err) {
    console.error('[fetchClientDirectoryAction]', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر تحميل قاعدة العملاء.',
    };
  }
}

type SyncExistingGroupMembersActionResult =
  | ({ ok: true } & SyncExistingGroupMembersResult)
  | { ok: false; error: string };

/**
 * One-time repair: create missing `clients` rows from `group_members` (by phone)
 * and back-fill group_members.client_id pointers.
 */
export async function syncExistingGroupMembersAction(
  accessToken?: string | null,
): Promise<SyncExistingGroupMembersActionResult> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const auth = await requireCrmServerAction(accessToken);
  if (!auth.ok) return { ok: false, error: auth.error };

  try {
    const admin = createSupabaseAdminClient();
    const result = await syncExistingGroupMembers(admin);

    if (result.created > 0 || result.linked > 0) {
      revalidatePath('/crm/clients');
    }

    return { ok: true, ...result };
  } catch (err) {
    console.error('[syncExistingGroupMembersAction]', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر مزامنة أعضاء المجموعات مع قاعدة العملاء.',
    };
  }
}

type LegacyGroupDnaSyncResult =
  | ({ ok: true } & GroupDnaBackfillResult)
  | { ok: false; error: string };

/**
 * One-shot backfill: copy legacy group DNA (leads / group_members / lead_applications)
 * into clients when dna_interests is empty. Safe to run on every CRM clients page load.
 */
export async function syncLegacyGroupMemberDnaAction(
  accessToken?: string | null,
): Promise<LegacyGroupDnaSyncResult> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const auth = await requireCrmServerAction(accessToken);
  if (!auth.ok) return { ok: false, error: auth.error };

  try {
    const admin = createSupabaseAdminClient();
    const result = await runGroupClientDnaBackfill(admin);

    if (result.synced > 0 || result.linked > 0) {
      revalidatePath('/crm/clients');
    }

    return { ok: true, ...result };
  } catch (err) {
    console.error('[syncLegacyGroupMemberDnaAction]', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر مزامنة DNA للعملاء القدامى.',
    };
  }
}
