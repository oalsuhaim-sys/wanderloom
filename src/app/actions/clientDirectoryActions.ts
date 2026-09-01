'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';

import { CLIENT_LIST_SELECT, CLIENT_SELECT_CORE, normalizeVipClient, type VipClientProfile } from '@/lib/clientsTravelDna';
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

export type ClientDirectoryFetchResult =
  | {
      ok: true;
      rows: VipClientProfile[];
    }
  | { ok: false; error: string };

export type DeleteClientActionResult =
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
 * قاعدة العملاء — Single Source of Truth = `clients` table ONLY.
 * No leads merge, no dedupe Maps, no ghost rows.
 * No sales_stage / trip-count filters — brand-new clients with 0 trips must appear.
 * Experts/leaders with access_assigned_only see only referral-linked clients.
 */
export async function fetchClientDirectoryAction(
  accessToken?: string | null,
): Promise<ClientDirectoryFetchResult> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) {
    return { ok: false, error: serviceKeyError };
  }

  try {
    const admin = createSupabaseAdminClient();
    const auth = await requireCrmServerAction(accessToken);

    // Progressive selects — missing optional columns must not empty the whole directory
    const selectAttempts = [
      CLIENT_LIST_SELECT,
      `${CLIENT_SELECT_CORE}, total_spent, total_profit, lifetime_value, engagement_status, vip_tier, wallet_balance, onboarding_completed`,
      `${CLIENT_SELECT_CORE}, total_spent, total_profit, vip_tier, wallet_balance, onboarding_completed`,
      CLIENT_SELECT_CORE,
      'id, name, phone_wa, email, created_at, sales_stage, client_type, client_tier, total_trips, total_spent, lifetime_value, engagement_status, travel_dna, dna_interests, lead_source, referral_code, ref_code, used_code, tags, target_trip',
      'id, name, phone_wa, email, created_at, sales_stage, client_type, client_tier, total_trips, lead_source, referral_code, ref_code, used_code, tags, target_trip',
      'id, name, phone_wa, email, created_at, sales_stage, client_type',
      'id, name, phone_wa, created_at',
    ];

    let data: unknown[] | null = null;
    let lastError = '';

    for (const select of selectAttempts) {
      const result = await admin
        .from('clients')
        .select(select)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (!result.error) {
        data = (result.data ?? []) as unknown[];
        break;
      }

      lastError = result.error.message || 'select failed';
      console.warn('[fetchClientDirectoryAction] select failed, retrying leaner:', lastError);

      // Non-schema errors (RLS, network) — stop early
      if (!/column|schema cache|does not exist/i.test(lastError)) {
        return { ok: false, error: lastError };
      }
    }

    if (data == null) {
      return { ok: false, error: lastError || 'تعذر قراءة جدول العملاء.' };
    }

    let rows: VipClientProfile[] = [];
    const seenIds = new Set<string>();
    for (const raw of data as Record<string, unknown>[]) {
      const mapped = normalizeVipClient(raw);
      if (!mapped) continue;
      const rowId = String(mapped.id);
      if (seenIds.has(rowId)) continue;
      seenIds.add(rowId);
      rows.push(mapped);
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

export type SyncExistingGroupMembersActionResult =
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

export type LegacyGroupDnaSyncResult =
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
