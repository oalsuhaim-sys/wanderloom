'use server';

import { revalidatePath } from 'next/cache';

import {
  MEMBER_SELECT_COLS,
  MEMBER_SELECT_COLS_LEAN,
  MEMBER_SELECT_GROUP_ID,
  MEMBER_SELECT_GROUP_ID_LEAN,
  MEMBER_SELECT_LEGACY,
  MEMBER_SELECT_LEGACY_LEAN,
  bucketGroupMemberManifestStatus,
  computePaymentDeadlineForBookedSeats,
  crossesScarcityThreshold,
  fetchGroupTripCapacity,
  isGroupMemberStatus,
  isGroupPaymentStatus,
  mapGroupMemberRow,
  normalizeGroupMemberStatus,
  PAYMENT_GRACE_MS,
  resolveGroupMemberTripId,
  SCARCITY_THRESHOLD,
  type GroupMember,
  type GroupMemberStatus,
  type GroupPaymentStatus,
} from '@/lib/group-members';
import { resolveLeadPreferredTripId } from '@/lib/crm-leads';
import { logClientActivity } from '@/lib/client-activity-logs';
import { normalizeLeadStatus } from '@/lib/lead-status';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  assertServiceRoleKeyConfigured,
  requireAdminServerAction,
} from '@/lib/supabase/server-action-auth';

export type GroupTripActionResult<T = undefined> =
  | { ok: true; message: string; data?: T }
  | { ok: false; error: string };

export type ActiveGroupTripOption = {
  id: string;
  title_ar: string;
  max_seats: number;
  booked_seats: number;
  allow_waitlist: boolean;
  seats_left: number | null;
};

export type TripManifestMember = {
  id: string;
  clientId: string | number;
  clientName: string;
  phone: string | null;
  email: string | null;
  status: GroupMemberStatus;
  paymentStatus: GroupMember['payment_status'];
  paymentDeadline: string | null;
  createdAt: string;
  updatedAt: string;
  /** clients.passport_expiry when available */
  passportExpiry: string | null;
  /** Optional visa status from client profile when present */
  visaStatus: string | null;
  /** group_member row vs interview-stage lead not yet seated */
  source?: 'group_member' | 'lead';
  /** Raw leads.status when source=lead (awaiting_dna / meeting / interview_scheduled) */
  leadPipelineStatus?: string | null;
};

export type GroupTripManifest = {
  trip: {
    id: string;
    titleAr: string;
    titleEn: string | null;
    maxSeats: number;
    bookedSeats: number;
    allowWaitlist: boolean;
    datesAr: string | null;
    price: string | null;
    isActive: boolean;
  };
  confirmed: TripManifestMember[];
  waitlisted: TripManifestMember[];
  /** pending_interview + approved + interview-stage leads for this trip */
  pending: TripManifestMember[];
};

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

/** clients.id may be integer OR uuid depending on environment. */
type ClientId = string | number;

function parseClientId(raw: unknown): ClientId | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : null;
  }
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    if (Number.isSafeInteger(n) && n > 0) return n;
  }
  // UUID / opaque string ids
  return s;
}

function nowIso(): string {
  return new Date().toISOString();
}

function tripIdsMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (a == null || b == null) return false;
  const sa = String(a).trim();
  const sb = String(b).trim();
  if (!sa || !sb) return false;
  if (sa === sb) return true;
  return String(coerceTripIdForQuery(sa)) === String(coerceTripIdForQuery(sb));
}

function attachTripFkToPayload(
  payload: Record<string, unknown>,
  tripId: string | null | undefined,
): void {
  if (tripId === undefined) return;
  payload.group_id = tripId ?? null;
}

function stripMemberPayloadForSchemaError(
  message: string,
  payload: Record<string, unknown>,
): Record<string, unknown> | null {
  const msg = message ?? '';
  const next = { ...payload };
  let changed = false;

  if (/group_id|group_trip_id/i.test(msg)) {
    if ('group_id' in next) {
      next.group_trip_id = next.group_id;
      delete next.group_id;
      changed = true;
    } else if ('group_trip_id' in next) {
      next.group_id = next.group_trip_id;
      delete next.group_trip_id;
      changed = true;
    }
  }
  if (/payment_|column|schema cache|does not exist/i.test(msg)) {
    if ('payment_deadline' in next) {
      delete next.payment_deadline;
      changed = true;
    }
    if ('payment_status' in next) {
      delete next.payment_status;
      changed = true;
    }
  }
  if (/updated_at/i.test(msg)) {
    delete next.updated_at;
    changed = true;
  }
  if (/customer_name|customer_phone/i.test(msg)) {
    delete next.customer_name;
    delete next.customer_phone;
    changed = true;
  }

  return changed ? next : null;
}

type MemberRowPatch = {
  status?: GroupMemberStatus;
  tripId?: string | null;
  notes?: string | null;
  payment_deadline?: string | null;
  payment_status?: string | null;
  clearPayment?: boolean;
  customer_name?: string;
  customer_phone?: string;
};

async function updateMemberById(
  admin: AdminClient,
  memberId: string,
  patch: MemberRowPatch,
): Promise<GroupTripActionResult<GroupMember>> {
  const payload: Record<string, unknown> = { updated_at: nowIso() };

  if (patch.status) {
    payload.status = normalizeGroupMemberStatus(patch.status) ?? patch.status;
  }
  if (patch.notes !== undefined) payload.notes = patch.notes ?? null;
  if (patch.customer_name !== undefined) {
    payload.customer_name = String(patch.customer_name).trim();
  }
  if (patch.customer_phone !== undefined) {
    payload.customer_phone = String(patch.customer_phone).trim();
  }
  if (patch.clearPayment) {
    payload.payment_deadline = null;
    payload.payment_status = 'pending';
  } else {
    if (patch.payment_deadline !== undefined) {
      payload.payment_deadline = patch.payment_deadline ?? null;
    }
    if (patch.payment_status !== undefined) {
      payload.payment_status = patch.payment_status ?? 'pending';
    }
  }
  if ('tripId' in patch) {
    attachTripFkToPayload(payload, patch.tripId);
  }

  const selectAttempts = [
    MEMBER_SELECT_COLS,
    MEMBER_SELECT_COLS_LEAN,
    MEMBER_SELECT_GROUP_ID_LEAN,
    'id, client_id, group_id, status',
    'id, client_id, group_trip_id, status',
    'id, client_id, status',
  ];

  let attemptPayload = { ...payload };
  let data: Record<string, unknown> | null = null;
  let lastError = '';

  for (let i = 0; i < 8; i++) {
    const select = selectAttempts[Math.min(i, selectAttempts.length - 1)]!;
    const res = await admin
      .from('group_members')
      .update(attemptPayload)
      .eq('id', memberId)
      .select(select)
      .maybeSingle();

    if (!res.error && res.data) {
      data = res.data as Record<string, unknown>;
      break;
    }

    lastError = res.error?.message ?? 'تعذر تحديث سجل العضوية.';
    const stripped = stripMemberPayloadForSchemaError(lastError, attemptPayload);
    if (!stripped) break;
    attemptPayload = stripped;
  }

  if (!data) {
    return {
      ok: false,
      error: formatGroupTripDbError('updateMemberById', lastError),
    };
  }

  const mapped = mapGroupMemberRow(data);
  if (!mapped) return { ok: false, error: 'تعذر قراءة سجل العضوية بعد التحديث.' };
  return { ok: true, message: 'ok', data: mapped };
}

const GENERIC_GROUP_TRIP_DB_ERROR =
  'حدث خطأ في جلب البيانات، تأكد من الاتصال بقاعدة البيانات.';

function isMissingSchemaError(message: string): boolean {
  const msg = (message ?? '').trim();
  if (!msg) return false;
  return (
    /relation .+ does not exist/i.test(msg) ||
    /column .+ does not exist/i.test(msg) ||
    /could not find the .+ column/i.test(msg) ||
    /schema cache/i.test(msg)
  );
}

function formatGroupTripDbError(context: string, message: string): string {
  console.error(`[groupTripAssignment] ${context}:`, message);
  if (isMissingSchemaError(message)) {
    return GENERIC_GROUP_TRIP_DB_ERROR;
  }
  return message.trim() || GENERIC_GROUP_TRIP_DB_ERROR;
}

async function requireAdmin(
  accessToken?: string | null,
): Promise<GroupTripActionResult | null> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };
  const auth = await requireAdminServerAction(accessToken);
  if (!auth.ok) return { ok: false, error: auth.error };
  return null;
}

function revalidateClientPaths(clientId: ClientId, tripId?: string | null) {
  revalidatePath(`/crm/clients/${clientId}`);
  revalidatePath('/crm/clients');
  revalidatePath('/crm/groups');
  revalidatePath(`/portal/${clientId}`);
  if (tripId) {
    revalidatePath(`/crm/groups/${tripId}`);
  }
}

async function selectMemberRow(admin: AdminClient, clientId: ClientId) {
  const attempts = [
    MEMBER_SELECT_COLS,
    MEMBER_SELECT_COLS_LEAN,
    MEMBER_SELECT_GROUP_ID,
    MEMBER_SELECT_GROUP_ID_LEAN,
    MEMBER_SELECT_LEGACY,
    MEMBER_SELECT_LEGACY_LEAN,
  ];

  let last = await admin
    .from('group_members')
    .select(attempts[0])
    .eq('client_id', clientId)
    .maybeSingle();

  for (let i = 1; i < attempts.length; i++) {
    if (
      last.error &&
      /column|schema cache|does not exist|payment_/i.test(last.error.message ?? '')
    ) {
      last = await admin
        .from('group_members')
        .select(attempts[i])
        .eq('client_id', clientId)
        .maybeSingle();
      continue;
    }
    break;
  }
  return last;
}

/**
 * When booked seats first hit SCARCITY_THRESHOLD, start the 3-day timer
 * for every confirmed+pending member who still has no deadline.
 */
async function triggerRetroactiveScarcityDeadlines(
  admin: AdminClient,
  tripId: string,
  previousBooked: number,
  newBooked: number,
) {
  if (!crossesScarcityThreshold(previousBooked, newBooked)) return;

  const deadline = new Date(Date.now() + PAYMENT_GRACE_MS).toISOString();
  const tripKey = coerceTripIdForQuery(tripId);
  let { error } = await admin
    .from('group_members')
    .update({
      payment_deadline: deadline,
      updated_at: nowIso(),
    })
    .eq('group_id', tripKey)
    .in('status', ['confirmed_seat', 'confirmed'])
    .eq('payment_status', 'pending')
    .is('payment_deadline', null);

  if (error && /group_id|column|schema cache|does not exist/i.test(error.message ?? '')) {
    const retry = await admin
      .from('group_members')
      .update({
        payment_deadline: deadline,
        updated_at: nowIso(),
      })
      .eq('group_trip_id', tripId)
      .in('status', ['confirmed_seat', 'confirmed'])
      .eq('payment_status', 'pending')
      .is('payment_deadline', null);
    error = retry.error;
  }

  if (error && !/payment_|column|schema cache|does not exist|updated_at/i.test(error.message ?? '')) {
    console.warn('[scarcity] retroactive deadline update:', error.message);
  }
}

/** List active group trips for the assign dropdown */
export async function listActiveGroupTripsForAssign(
  accessToken?: string | null,
): Promise<GroupTripActionResult<ActiveGroupTripOption[]>> {
  const denied = await requireAdmin(accessToken);
  if (denied) return denied;

  try {
    const admin = createSupabaseAdminClient();
    const tripSelect =
      'id, title_ar, max_seats, booked_seats, allow_waitlist, is_active';

    let { data, error } = await admin
      .from('group_trips')
      .select(tripSelect)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error && /sort_order/i.test(error.message ?? '')) {
      const retry = await admin
        .from('group_trips')
        .select(tripSelect)
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      return {
        ok: false,
        error: formatGroupTripDbError('listActiveGroupTripsForAssign', error.message ?? ''),
      };
    }

    const options: ActiveGroupTripOption[] = (data ?? [])
      .map((row) => {
        const r = row as Record<string, unknown>;
        const max = Math.max(0, Number(r.max_seats) || 0);
        const booked = Math.max(0, Number(r.booked_seats) || 0);
        return {
          id: String(r.id ?? '').trim(),
          title_ar: String(r.title_ar ?? 'رحلة جماعية'),
          max_seats: max,
          booked_seats: booked,
          allow_waitlist: r.allow_waitlist !== false,
          seats_left: max > 0 ? Math.max(0, max - booked) : null,
        };
      })
      .filter((opt) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(opt.id),
      );

    return { ok: true, message: 'ok', data: options };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Fetch client's group_members row (with trip title when assigned) */
export async function getClientGroupMember(
  clientIdRaw: number | string,
  accessToken?: string | null,
): Promise<GroupTripActionResult<GroupMember | null>> {
  const denied = await requireAdmin(accessToken);
  if (denied) return denied;

  const clientId = parseClientId(clientIdRaw);
  if (!clientId) return { ok: false, error: 'معرّف العميل غير صالح.' };

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await selectMemberRow(admin, clientId);

    if (error) {
      return {
        ok: false,
        error: formatGroupTripDbError('getClientGroupMember', error.message ?? ''),
      };
    }

    const mapped = mapGroupMemberRow(data as unknown as Record<string, unknown>);
    if (!mapped) return { ok: true, message: 'none', data: null };

    if (mapped.group_trip_id) {
      const { data: trip } = await admin
        .from('group_trips')
        .select('title_ar, dates_ar')
        .eq('id', mapped.group_trip_id)
        .maybeSingle();
      if (trip) {
        mapped.trip_title_ar = String((trip as { title_ar?: string }).title_ar ?? '');
        mapped.trip_dates_ar = String((trip as { dates_ar?: string }).dates_ar ?? '').trim() || null;
      }
    }

    return { ok: true, message: 'ok', data: mapped };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function upsertMemberStatus(
  clientId: ClientId,
  status: GroupMemberStatus,
  extras?: {
    group_trip_id?: string | null;
    notes?: string | null;
    payment_deadline?: string | null;
    payment_status?: string | null;
    clearPayment?: boolean;
  },
): Promise<GroupTripActionResult<GroupMember>> {
  const admin = createSupabaseAdminClient();
  const payload: Record<string, unknown> = {
    client_id: clientId,
    status,
    updated_at: nowIso(),
  };
  if (extras && 'group_trip_id' in extras) {
    attachTripFkToPayload(payload, extras.group_trip_id ?? null);
  }
  if (extras && 'notes' in extras) {
    payload.notes = extras.notes ?? null;
  }
  if (extras?.clearPayment) {
    payload.payment_deadline = null;
    payload.payment_status = 'pending';
  } else {
    if (extras && 'payment_deadline' in extras) {
      payload.payment_deadline = extras.payment_deadline ?? null;
    }
    if (extras && 'payment_status' in extras) {
      payload.payment_status = extras.payment_status ?? 'pending';
    }
  }

  let { data, error } = await admin
    .from('group_members')
    .upsert(payload, { onConflict: 'client_id' })
    .select(MEMBER_SELECT_COLS)
    .single();

  if (error) {
    const stripped = stripMemberPayloadForSchemaError(error.message ?? '', payload);
    if (stripped) {
      const retry = await admin
        .from('group_members')
        .upsert(stripped, { onConflict: 'client_id' })
        .select(MEMBER_SELECT_COLS)
        .single();
      data = retry.data as typeof data;
      error = retry.error;
    }
  }

  if (error && /payment_|column|schema cache|does not exist/i.test(error.message ?? '')) {
    const leanPayload = { ...payload };
    delete leanPayload.payment_deadline;
    delete leanPayload.payment_status;
    const retry = await admin
      .from('group_members')
      .upsert(leanPayload, { onConflict: 'client_id' })
      .select(MEMBER_SELECT_COLS_LEAN)
      .single();
    data = retry.data as typeof data;
    error = retry.error;
  }

  if (error) {
    return {
      ok: false,
      error: formatGroupTripDbError('upsertMemberStatus', error.message ?? ''),
    };
  }

  const mapped = mapGroupMemberRow(data as unknown as Record<string, unknown>);
  if (!mapped) return { ok: false, error: 'تعذر قراءة سجل الانضمام.' };
  return { ok: true, message: 'ok', data: mapped };
}

/** Admin: موافقة */
export async function approveClientGroupMember(
  clientIdRaw: number | string,
  accessToken?: string | null,
): Promise<GroupTripActionResult<GroupMember>> {
  const denied = await requireAdmin(accessToken);
  if (denied) return denied;

  const clientId = parseClientId(clientIdRaw);
  if (!clientId) return { ok: false, error: 'معرّف العميل غير صالح.' };

  try {
    const result = await upsertMemberStatus(clientId, 'approved');
    if (!result.ok) return result;
    revalidateClientPaths(clientId);
    return { ok: true, message: 'تمت الموافقة — اختر الرحلة ثم عيّن للرحلة.', data: result.data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Admin: رفض */
export async function rejectClientGroupMember(
  clientIdRaw: number | string,
  accessToken?: string | null,
): Promise<GroupTripActionResult<GroupMember>> {
  const denied = await requireAdmin(accessToken);
  if (denied) return denied;

  const clientId = parseClientId(clientIdRaw);
  if (!clientId) return { ok: false, error: 'معرّف العميل غير صالح.' };

  try {
    const admin = createSupabaseAdminClient();
    const existing = await admin
      .from('group_members')
      .select('id, client_id, group_trip_id, status, notes, created_at, updated_at')
      .eq('client_id', clientId)
      .maybeSingle();

    const prev = existing.data
      ? mapGroupMemberRow(existing.data as unknown as Record<string, unknown>)
      : null;

    if (prev?.status === 'confirmed_seat' && prev.group_trip_id) {
      await releaseConfirmedSeat(admin, clientId, prev.group_trip_id);
    }

    const result = await upsertMemberStatus(clientId, 'rejected', {
      group_trip_id: null,
      clearPayment: true,
    });
    if (!result.ok) return result;
    revalidateClientPaths(clientId);
    return { ok: true, message: 'تم رفض طلب الانضمام.', data: result.data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function releaseConfirmedSeat(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  _clientId: ClientId,
  tripId: string,
) {
  const { data: trip } = await admin
    .from('group_trips')
    .select('id, booked_seats')
    .eq('id', tripId)
    .maybeSingle();

  if (!trip) return;

  const r = trip as Record<string, unknown>;
  const booked = Math.max(0, (Number(r.booked_seats) || 0) - 1);

  await admin.from('group_trips').update({ booked_seats: booked }).eq('id', tripId);
}

/**
 * Core inventory: assign client to a group trip via group_members.
 * Seats available → confirmed_seat + booked_seats++
 * Full → waitlisted (no seat increment)
 * Yield management: payment_deadline null below SCARCITY_THRESHOLD, else +3 days.
 * Crossing the threshold retroactively starts timers for all pending confirmed seats.
 */
export async function assignClientToGroupTrip(
  clientIdRaw: number | string,
  tripIdRaw: string,
  accessToken?: string | null,
): Promise<
  GroupTripActionResult<{
    status: GroupMemberStatus;
    tripTitle: string;
    paymentDeadline: string | null;
  }>
> {
  const denied = await requireAdmin(accessToken);
  if (denied) return denied;

  const clientId = parseClientId(clientIdRaw);
  const tripId = String(tripIdRaw ?? '').trim();
  if (!clientId) return { ok: false, error: 'معرّف العميل غير صالح.' };
  if (!tripId) return { ok: false, error: 'اختر رحلة جماعية أولاً.' };

  try {
    const admin = createSupabaseAdminClient();

    const capacity = await fetchGroupTripCapacity(admin, tripId);
    if (!capacity.ok) {
      return {
        ok: false,
        error: formatGroupTripDbError('assignClientToGroupTrip', capacity.error),
      };
    }

    const {
      tripId: resolvedTripId,
      titleAr: tripTitle,
      maxSeats,
      confirmedCount,
      bookedSeatsColumn,
      allowWaitlist,
      isActive,
      hasConfirmedCapacity,
    } = capacity.data;

    if (!isActive) {
      return { ok: false, error: 'هذه الرحلة غير مفعّلة حالياً.' };
    }

    const { data: prevAppRaw, error: prevErr } = await admin
      .from('group_members')
      .select('status, group_trip_id, group_id')
      .eq('client_id', clientId)
      .maybeSingle();

    let prevApp: {
      status?: unknown;
      group_trip_id?: unknown;
      group_id?: unknown;
    } | null = prevAppRaw as {
      status?: unknown;
      group_trip_id?: unknown;
      group_id?: unknown;
    } | null;
    if (prevErr && /column|schema cache|does not exist|group_id/i.test(prevErr.message ?? '')) {
      const retry = await admin
        .from('group_members')
        .select('status, group_trip_id')
        .eq('client_id', clientId)
        .maybeSingle();
      prevApp = retry.data as {
        status?: unknown;
        group_trip_id?: unknown;
        group_id?: unknown;
      } | null;
    }

    const prevTripId = String(
      (prevApp as { group_id?: unknown; group_trip_id?: unknown } | null)?.group_id ??
        (prevApp as { group_trip_id?: unknown } | null)?.group_trip_id ??
        '',
    );
    const prevStatus = (prevApp as { status?: unknown } | null)?.status;

    if (
      prevApp &&
      isGroupMemberStatus(prevStatus) &&
      prevStatus === 'confirmed_seat' &&
      (prevTripId === tripId || prevTripId === resolvedTripId)
    ) {
      const paymentDeadline = computePaymentDeadlineForBookedSeats(confirmedCount);
      const app = await upsertMemberStatus(clientId, 'confirmed_seat', {
        group_trip_id: resolvedTripId,
        payment_status: 'pending',
        payment_deadline: paymentDeadline,
      });
      if (!app.ok) return app;
      revalidateClientPaths(clientId, resolvedTripId);
      return {
        ok: true,
        message: 'العميل مسجّل مسبقاً على هذه الرحلة — تم تثبيت حالة المقعد المؤكد.',
        data: { status: 'confirmed_seat', tripTitle, paymentDeadline },
      };
    }

    if (
      prevApp &&
      isGroupMemberStatus(prevStatus) &&
      prevStatus === 'confirmed_seat' &&
      prevTripId &&
      prevTripId !== tripId &&
      prevTripId !== resolvedTripId
    ) {
      await releaseConfirmedSeat(admin, clientId, prevTripId);
    }

    // Waitlist ONLY when confirmed seats have hit max capacity
    if (!hasConfirmedCapacity) {
      if (!allowWaitlist) {
        return { ok: false, error: 'الرحلة مكتملة وقائمة الانتظار غير مفعّلة.' };
      }
      const wait = await upsertMemberStatus(clientId, 'waitlisted', {
        group_trip_id: resolvedTripId,
        clearPayment: true,
      });
      if (!wait.ok) return wait;
      revalidateClientPaths(clientId, resolvedTripId);
      return {
        ok: true,
        message: `الرحلة مكتملة (${confirmedCount}/${maxSeats || '∞'}) — تم وضع العميل في قائمة انتظار «${tripTitle}».`,
        data: { status: 'waitlisted', tripTitle, paymentDeadline: null },
      };
    }

    const nextBooked = confirmedCount + 1;
    const paymentDeadline = computePaymentDeadlineForBookedSeats(nextBooked);
    const tripKey = coerceTripIdForQuery(resolvedTripId);

    let { data: updated, error: updateError } = await admin
      .from('group_trips')
      .update({ booked_seats: nextBooked })
      .eq('id', tripKey)
      .eq('booked_seats', bookedSeatsColumn)
      .select('id')
      .maybeSingle();

    if (updateError && /booked_seats/i.test(updateError.message)) {
      const fallback = await admin
        .from('group_trips')
        .update({ booked_seats: nextBooked })
        .eq('id', tripKey)
        .select('id')
        .maybeSingle();
      updated = fallback.data;
      updateError = fallback.error;
    }

    if (updateError) {
      return { ok: false, error: updateError.message };
    }

    if (!updated) {
      // Race: another confirmation won — re-check live capacity
      const again = await fetchGroupTripCapacity(admin, resolvedTripId);
      if (again.ok && !again.data.hasConfirmedCapacity) {
        if (!allowWaitlist) {
          return { ok: false, error: 'الرحلة امتلأت للتو ولا تتوفر قائمة انتظار.' };
        }
        const wait = await upsertMemberStatus(clientId, 'waitlisted', {
          group_trip_id: resolvedTripId,
          clearPayment: true,
        });
        if (!wait.ok) return wait;
        revalidateClientPaths(clientId, resolvedTripId);
        return {
          ok: true,
          message: 'الرحلة مكتملة — تم وضع العميل في قائمة الانتظار.',
          data: { status: 'waitlisted', tripTitle, paymentDeadline: null },
        };
      }
      // Sync column even if CAS missed
      await admin.from('group_trips').update({ booked_seats: nextBooked }).eq('id', tripKey);
    }

    const app = await upsertMemberStatus(clientId, 'confirmed_seat', {
      group_trip_id: resolvedTripId,
      payment_status: 'pending',
      payment_deadline: paymentDeadline,
    });
    if (!app.ok) return app;

    await triggerRetroactiveScarcityDeadlines(admin, resolvedTripId, confirmedCount, nextBooked);

    revalidateClientPaths(clientId, resolvedTripId);

    void logClientActivity(
      clientId,
      'تم تأكيد الحجز',
      `مقعد مؤكد على «${tripTitle}»`,
      'booking',
      {
        admin,
        metadata: {
          group_trip_id: resolvedTripId,
          payment_deadline: paymentDeadline,
        },
      },
    );

    const scarcityNote =
      nextBooked >= SCARCITY_THRESHOLD
        ? paymentDeadline
          ? ' · بدأت مهلة السداد (3 أيام).'
          : ''
        : ' · مقعد بدون مهلة حالياً.';
    return {
      ok: true,
      message: `تم تأكيد المقعد على «${tripTitle}»${scarcityNote}`,
      data: { status: 'confirmed_seat', tripTitle, paymentDeadline },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Unlink client from current trip and free seat if confirmed. */
export async function unlinkClientFromGroupTrip(
  clientIdRaw: number | string,
  accessToken?: string | null,
): Promise<GroupTripActionResult<GroupMember>> {
  const denied = await requireAdmin(accessToken);
  if (denied) return denied;

  const clientId = parseClientId(clientIdRaw);
  if (!clientId) return { ok: false, error: 'معرّف العميل غير صالح.' };

  try {
    const admin = createSupabaseAdminClient();
    const { data: existing, error } = await admin
      .from('group_members')
      .select('id, client_id, group_trip_id, status, notes, created_at, updated_at')
      .eq('client_id', clientId)
      .maybeSingle();

    if (error) {
      return {
        ok: false,
        error: formatGroupTripDbError('unlinkClientFromGroupTrip', error.message ?? ''),
      };
    }

    const current = mapGroupMemberRow(existing as unknown as Record<string, unknown>);
    if (!current) return { ok: false, error: 'تعذر قراءة سجل العضوية الحالي.' };

    const tripIdForRevalidate = current.group_trip_id;

    if (current.status === 'confirmed_seat' && current.group_trip_id) {
      await releaseConfirmedSeat(admin, clientId, current.group_trip_id);
    }

    const nextStatus: GroupMemberStatus =
      current.status === 'rejected' ? 'pending_interview' : 'approved';
    const result = await upsertMemberStatus(clientId, nextStatus, {
      group_trip_id: null,
      clearPayment: true,
    });
    if (!result.ok) return result;

    revalidateClientPaths(clientId, tripIdForRevalidate);
    return { ok: true, message: 'تم إلغاء الارتباط بالرحلة وتحديث السعة.', data: result.data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** DNA Group toggle: tag client + ensure pending_interview in group_members */
export async function tagClientForGroupDna(
  clientIdRaw: number | string,
  accessToken?: string | null,
): Promise<GroupTripActionResult<GroupMember>> {
  const denied = await requireAdmin(accessToken);
  if (denied) return denied;

  const clientId = parseClientId(clientIdRaw);
  if (!clientId) return { ok: false, error: 'معرّف العميل غير صالح.' };

  try {
    const admin = createSupabaseAdminClient();

    await admin
      .from('clients')
      .update({ intake_trip_type: 'group' })
      .eq('id', clientId);

    const { data: existing } = await admin
      .from('group_members')
      .select('id, status')
      .eq('client_id', clientId)
      .maybeSingle();

    const currentStatus = existing
      ? (existing as { status?: string }).status
      : null;

    if (
      currentStatus === 'confirmed_seat' ||
      currentStatus === 'waitlisted' ||
      currentStatus === 'approved' ||
      currentStatus === 'rejected'
    ) {
      const full = await getClientGroupMember(clientId, accessToken);
      if (full.ok && full.data) {
        return { ok: true, message: 'العميل موسوم كرحلة جماعية.', data: full.data };
      }
    }

    const result = await upsertMemberStatus(clientId, 'pending_interview');
    if (!result.ok) return result;
    revalidateClientPaths(clientId);
    return {
      ok: true,
      message: 'تم وسم العميل كرحلة جماعية — حالة بانتظار المقابلة.',
      data: result.data,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Public welcome: ensure group_members row when DNA opens with ?flow=group */
export async function ensureGroupDnaApplicationFromWelcome(
  clientIdRaw: number | string,
): Promise<GroupTripActionResult> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const clientId = parseClientId(clientIdRaw);
  if (!clientId) return { ok: false, error: 'معرّف العميل غير صالح.' };

  try {
    const admin = createSupabaseAdminClient();

    await admin
      .from('clients')
      .update({ intake_trip_type: 'group' })
      .eq('id', clientId);

    const { data: existing, error } = await admin
      .from('group_members')
      .select('id, status')
      .eq('client_id', clientId)
      .maybeSingle();

    if (error) {
      return {
        ok: false,
        error: formatGroupTripDbError('ensureGroupDnaApplicationFromWelcome', error.message ?? ''),
      };
    }

    if (existing) {
      return { ok: true, message: 'already tracked' };
    }

    const { error: insertError } = await admin.from('group_members').insert({
      client_id: clientId,
      status: 'pending_interview',
      updated_at: nowIso(),
    });

    if (insertError) {
      if (/duplicate|unique/i.test(insertError.message)) {
        return { ok: true, message: 'already tracked' };
      }
      return {
        ok: false,
        error: formatGroupTripDbError(
          'ensureGroupDnaApplicationFromWelcome.insert',
          insertError.message ?? '',
        ),
      };
    }

    return { ok: true, message: 'tagged' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function selectMemberRowById(admin: AdminClient, memberId: string) {
  const attempts = [
    MEMBER_SELECT_COLS,
    MEMBER_SELECT_COLS_LEAN,
    MEMBER_SELECT_GROUP_ID,
    MEMBER_SELECT_GROUP_ID_LEAN,
    MEMBER_SELECT_LEGACY,
    MEMBER_SELECT_LEGACY_LEAN,
    'id, client_id, group_id, group_trip_id, status',
    'id, client_id, group_id, status',
    'id, client_id, status',
  ];

  let last = await admin
    .from('group_members')
    .select(attempts[0])
    .eq('id', memberId)
    .maybeSingle();

  for (let i = 1; i < attempts.length; i++) {
    if (
      last.error &&
      /column|schema cache|does not exist|payment_/i.test(last.error.message ?? '')
    ) {
      last = await admin
        .from('group_members')
        .select(attempts[i])
        .eq('id', memberId)
        .maybeSingle();
      continue;
    }
    break;
  }
  return last;
}

/**
 * Admin: حذف عضوية بالمعرّف الفريد group_members.id (لا يعتمد على اسم العميل).
 */
export async function deleteGroupMemberById(
  memberIdRaw: string,
  accessToken?: string | null,
): Promise<GroupTripActionResult> {
  const denied = await requireAdmin(accessToken);
  if (denied) return denied;

  const memberId = String(memberIdRaw ?? '').trim();
  if (!memberId) return { ok: false, error: 'معرّف العضوية غير صالح.' };

  try {
    const admin = createSupabaseAdminClient();

    // Best-effort read for seat inventory + revalidation (never block the delete).
    let clientId: ClientId | null = null;
    let tripId: string | null = null;
    try {
      const { data: existing } = await selectMemberRowById(admin, memberId);
      if (existing) {
        const raw = existing as unknown as Record<string, unknown>;
        clientId = parseClientId(raw.client_id);
        tripId = resolveGroupMemberTripId(raw);
        const status = normalizeGroupMemberStatus(raw.status);
        if (status === 'confirmed_seat' && tripId && clientId) {
          await releaseConfirmedSeat(admin, clientId, tripId);
        }
      }
    } catch (prefetchErr) {
      console.error('Error prefetching member before delete:', prefetchErr);
    }

    const { error: deleteError } = await admin
      .from('group_members')
      .delete()
      .eq('id', memberId);

    if (deleteError) {
      console.error('Error deleting member from group:', deleteError);
      return {
        ok: false,
        error: `تعذر إلغاء الحجز: ${deleteError.message}`,
      };
    }

    if (clientId) revalidateClientPaths(clientId, tripId);
    revalidatePath('/crm/groups');
    revalidatePath('/crm/radar');
    if (tripId) revalidatePath(`/crm/groups/${tripId}`);

    return { ok: true, message: 'تم حذف العضو بنجاح.' };
  } catch (err) {
    console.error('Unexpected removal error:', err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Admin: تحديث عضوية بالمعرّف الفريد group_members.id (الحالة، السداد، الاسم).
 */
export async function updateGroupMemberById(
  memberIdRaw: string,
  input: {
    status?: GroupMemberStatus;
    payment_status?: GroupPaymentStatus | null;
    customer_name?: string;
    customer_phone?: string;
  },
  accessToken?: string | null,
): Promise<GroupTripActionResult<GroupMember>> {
  const denied = await requireAdmin(accessToken);
  if (denied) return denied;

  const memberId = String(memberIdRaw ?? '').trim();
  if (!memberId) return { ok: false, error: 'معرّف العضوية غير صالح.' };

  if (input.status != null) {
    const normalized = normalizeGroupMemberStatus(input.status);
    if (!normalized) {
      return { ok: false, error: 'حالة العضوية غير صالحة.' };
    }
  }
  if (
    input.payment_status != null &&
    !isGroupPaymentStatus(input.payment_status)
  ) {
    return { ok: false, error: 'حالة السداد غير صالحة.' };
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data: existing, error: loadError } = await selectMemberRowById(admin, memberId);
    if (loadError) {
      return {
        ok: false,
        error: formatGroupTripDbError('updateGroupMemberById', loadError.message ?? ''),
      };
    }
    if (!existing) return { ok: false, error: 'لم يتم العثور على سجل العضوية.' };

    const current = mapGroupMemberRow(existing as unknown as Record<string, unknown>);
    if (!current) return { ok: false, error: 'تعذر قراءة سجل العضوية.' };

    const clientId = parseClientId(current.client_id);
    const nextStatus = input.status ?? current.status;
    const wasConfirmed = current.status === 'confirmed_seat';
    const nowConfirmed = nextStatus === 'confirmed_seat';

    if (wasConfirmed && !nowConfirmed && current.group_trip_id && clientId) {
      await releaseConfirmedSeat(admin, clientId, current.group_trip_id);
    }

    if (!wasConfirmed && nowConfirmed && current.group_trip_id && clientId) {
      const capacity = await fetchGroupTripCapacity(admin, current.group_trip_id);
      if (!capacity.ok) {
        return {
          ok: false,
          error: formatGroupTripDbError('updateGroupMemberById', capacity.error),
        };
      }
      if (!capacity.data.hasConfirmedCapacity) {
        return { ok: false, error: 'لا توجد مقاعد شاغرة — الرحلة مكتملة.' };
      }
      const nextBooked = capacity.data.confirmedCount + 1;
      const tripKey = coerceTripIdForQuery(current.group_trip_id);
      await admin
        .from('group_trips')
        .update({ booked_seats: nextBooked })
        .eq('id', tripKey);
    }

    const result = await updateMemberById(admin, memberId, {
      status: input.status != null ? normalizeGroupMemberStatus(input.status) ?? undefined : undefined,
      customer_name: input.customer_name,
      customer_phone: input.customer_phone,
      payment_status:
        input.payment_status === undefined ? undefined : input.payment_status,
    });
    if (!result.ok) return result;

    const clientIdAfter = parseClientId(result.data?.client_id);
    const tripId = result.data?.group_trip_id ?? current.group_trip_id;
    if (clientIdAfter) revalidateClientPaths(clientIdAfter, tripId);
    revalidatePath('/crm/radar');
    revalidatePath('/crm/groups');
    if (tripId) revalidatePath(`/crm/groups/${tripId}`);

    return {
      ok: true,
      message: 'تم تحديث بيانات العضو.',
      data: result.data,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Admin: إزالة من المقعد — حذف مباشر بـ group_members.id (المفتاح الأساسي فقط).
 * لا يعتمد على تحديث الحالة / FK columns التي قد تكون مفقودة في المخطط.
 */
export async function removeGroupMemberFromConfirmedSeatById(
  memberIdRaw: string,
  accessToken?: string | null,
): Promise<GroupTripActionResult<GroupMember>> {
  const denied = await requireAdmin(accessToken);
  if (denied) return denied;

  const memberId = String(memberIdRaw ?? '').trim();
  if (!memberId) return { ok: false, error: 'معرّف العضوية غير صالح.' };

  try {
    const admin = createSupabaseAdminClient();

    // Best-effort read for seat inventory + revalidation (never block the delete).
    let clientId: ClientId | null = null;
    let tripId: string | null = null;
    try {
      const { data: existing } = await selectMemberRowById(admin, memberId);
      if (existing) {
        const raw = existing as unknown as Record<string, unknown>;
        clientId = parseClientId(raw.client_id);
        tripId = resolveGroupMemberTripId(raw);
        const status = normalizeGroupMemberStatus(raw.status);
        if (status === 'confirmed_seat' && tripId && clientId) {
          await releaseConfirmedSeat(admin, clientId, tripId);
        }
      }
    } catch (prefetchErr) {
      console.error('Error prefetching member before delete:', prefetchErr);
    }

    const { error: deleteError } = await admin
      .from('group_members')
      .delete()
      .eq('id', memberId);

    if (deleteError) {
      console.error('Error deleting member from group:', deleteError);
      return {
        ok: false,
        error: `تعذر إلغاء الحجز: ${deleteError.message}`,
      };
    }

    if (clientId) revalidateClientPaths(clientId, tripId);
    revalidatePath('/crm/groups');
    revalidatePath('/crm/radar');
    if (tripId) revalidatePath(`/crm/groups/${tripId}`);

    return {
      ok: true,
      message: 'تم إزالة العميل من المقعد وتحرير السعة.',
    };
  } catch (err) {
    console.error('Unexpected removal error:', err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Admin: إزالة من المقعد — frees inventory + clears payment deadline.
 * Safe regardless of scarcity threshold.
 */
export async function removeClientFromConfirmedSeat(
  clientIdRaw: number | string,
  accessToken?: string | null,
): Promise<GroupTripActionResult<GroupMember>> {
  const denied = await requireAdmin(accessToken);
  if (denied) return denied;

  const clientId = parseClientId(clientIdRaw);
  if (!clientId) return { ok: false, error: 'معرّف العميل غير صالح.' };

  try {
    const admin = createSupabaseAdminClient();
    const { data: existing, error } = await selectMemberRow(admin, clientId);
    if (error) {
      return {
        ok: false,
        error: formatGroupTripDbError('removeClientFromConfirmedSeat', error.message ?? ''),
      };
    }
    if (!existing) return { ok: false, error: 'لا يوجد سجل عضوية لهذا العميل.' };

    const current = mapGroupMemberRow(existing as unknown as Record<string, unknown>);
    if (!current) return { ok: false, error: 'تعذر قراءة سجل العضوية.' };

    if (current.status === 'confirmed_seat' && current.group_trip_id) {
      await releaseConfirmedSeat(admin, clientId, current.group_trip_id);
    }

    const tripIdForRevalidate = current.group_trip_id;

    const result = await upsertMemberStatus(clientId, 'approved', {
      group_trip_id: null,
      clearPayment: true,
    });
    if (!result.ok) return result;

    revalidateClientPaths(clientId, tripIdForRevalidate);
    return {
      ok: true,
      message: 'تم إزالة العميل من المقعد وتحرير السعة.',
      data: result.data,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Admin: تحديث حالة السداد لعضو في كشف الرحلة (بالـ member id).
 */
export async function updateGroupMemberPaymentStatus(
  memberIdRaw: string,
  paymentStatusRaw: string,
  accessToken?: string | null,
): Promise<GroupTripActionResult<{ memberId: string; paymentStatus: GroupPaymentStatus }>> {
  const denied = await requireAdmin(accessToken);
  if (denied) return denied;

  const memberId = String(memberIdRaw ?? '').trim();
  if (!memberId) return { ok: false, error: 'معرّف العضوية غير صالح.' };

  if (!isGroupPaymentStatus(paymentStatusRaw)) {
    return { ok: false, error: 'حالة السداد غير صالحة.' };
  }
  const paymentStatus = paymentStatusRaw;

  try {
    const admin = createSupabaseAdminClient();

    let { data, error } = await admin
      .from('group_members')
      .update({ payment_status: paymentStatus })
      .eq('id', memberId)
      .select('id, payment_status, client_id, group_id, group_trip_id')
      .maybeSingle();

    if (error && /column|schema cache|does not exist|could not find|group_trip_id/i.test(error.message ?? '')) {
      const retry = await admin
        .from('group_members')
        .update({ payment_status: paymentStatus })
        .eq('id', memberId)
        .select('id, payment_status, client_id, group_id')
        .maybeSingle();
      data = retry.data as typeof data;
      error = retry.error;
    }

    if (error) {
      return {
        ok: false,
        error: formatGroupTripDbError('updateGroupMemberPaymentStatus', error.message ?? ''),
      };
    }
    if (!data) return { ok: false, error: 'سجل العضوية غير موجود.' };

    const row = data as Record<string, unknown>;
    const clientId = parseClientId(row.client_id);
    const tripId =
      row.group_id != null
        ? String(row.group_id)
        : row.group_trip_id != null
          ? String(row.group_trip_id)
          : null;
    if (clientId) revalidateClientPaths(clientId, tripId);

    return {
      ok: true,
      message:
        paymentStatus === 'paid'
          ? 'تم تسجيل السداد بالكامل ✓'
          : `تم تحديث حالة السداد إلى «${paymentStatus}».`,
      data: { memberId: String(row.id), paymentStatus },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Admin: تعديل المهلة — set absolute ISO, extend by days, or clear (null).
 */
export async function updateGroupMemberPaymentDeadline(
  clientIdRaw: number | string,
  input: { deadlineIso?: string | null; extendDays?: number; clear?: boolean },
  accessToken?: string | null,
): Promise<GroupTripActionResult<GroupMember>> {
  const denied = await requireAdmin(accessToken);
  if (denied) return denied;

  const clientId = parseClientId(clientIdRaw);
  if (!clientId) return { ok: false, error: 'معرّف العميل غير صالح.' };

  try {
    const admin = createSupabaseAdminClient();
    const { data: existing, error } = await selectMemberRow(admin, clientId);
    if (error) {
      return {
        ok: false,
        error: formatGroupTripDbError('updateGroupMemberPaymentDeadline', error.message ?? ''),
      };
    }
    if (!existing) return { ok: false, error: 'لا يوجد سجل عضوية لهذا العميل.' };

    const current = mapGroupMemberRow(existing as unknown as Record<string, unknown>);
    if (!current) return { ok: false, error: 'تعذر قراءة سجل العضوية.' };
    if (current.status !== 'confirmed_seat') {
      return { ok: false, error: 'تعديل المهلة متاح فقط للمقاعد المؤكدة.' };
    }

    let nextDeadline: string | null = current.payment_deadline;
    if (input.clear) {
      nextDeadline = null;
    } else if (typeof input.extendDays === 'number' && Number.isFinite(input.extendDays)) {
      const base = current.payment_deadline
        ? new Date(current.payment_deadline)
        : new Date();
      if (Number.isNaN(base.getTime())) {
        return { ok: false, error: 'مهلة السداد الحالية غير صالحة.' };
      }
      nextDeadline = new Date(
        base.getTime() + Math.max(0, input.extendDays) * 24 * 60 * 60 * 1000,
      ).toISOString();
    } else if (input.deadlineIso !== undefined) {
      if (input.deadlineIso === null || String(input.deadlineIso).trim() === '') {
        nextDeadline = null;
      } else {
        const parsed = new Date(String(input.deadlineIso).trim());
        if (Number.isNaN(parsed.getTime())) {
          return { ok: false, error: 'تاريخ المهلة غير صالح.' };
        }
        nextDeadline = parsed.toISOString();
      }
    }

    const result = await upsertMemberStatus(clientId, 'confirmed_seat', {
      group_trip_id: current.group_trip_id,
      payment_status: current.payment_status ?? 'pending',
      payment_deadline: nextDeadline,
    });
    if (!result.ok) return result;

    revalidateClientPaths(clientId, current.group_trip_id);
    return {
      ok: true,
      message: nextDeadline
        ? `تم تحديث مهلة السداد إلى ${new Date(nextDeadline).toLocaleString('ar-SA')}.`
        : 'تم إلغاء مهلة السداد — المقعد بدون عدّاد.',
      data: result.data,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function mapManifestMember(
  member: GroupMember,
  client: {
    name?: unknown;
    phone_wa?: unknown;
    email?: unknown;
    passport_expiry?: unknown;
    visa_status?: unknown;
    visa?: unknown;
  } | null,
  denorm?: { customer_name?: unknown; customer_phone?: unknown },
): TripManifestMember {
  const denormName = String(denorm?.customer_name ?? '').trim();
  const denormPhone = String(denorm?.customer_phone ?? '').trim();
  const clientName =
    String(client?.name ?? '').trim() ||
    denormName ||
    `عميل #${member.client_id}`;
  const phone =
    (client?.phone_wa != null ? String(client.phone_wa).trim() : '') ||
    denormPhone ||
    null;

  const passportRaw = client?.passport_expiry;
  const passportExpiry =
    passportRaw != null && String(passportRaw).trim()
      ? String(passportRaw).trim().slice(0, 10)
      : null;
  const visaRaw = client?.visa_status ?? client?.visa;
  const visaStatus =
    visaRaw != null && String(visaRaw).trim() ? String(visaRaw).trim() : null;

  return {
    id: member.id,
    clientId: member.client_id,
    clientName,
    phone: phone || null,
    email: client?.email != null ? String(client.email).trim() || null : null,
    status: member.status,
    paymentStatus: member.payment_status,
    paymentDeadline: member.payment_deadline,
    createdAt: member.created_at,
    updatedAt: member.updated_at,
    passportExpiry,
    visaStatus,
  };
}

function coerceTripIdForQuery(tripId: string): string | number {
  return /^\d+$/.test(tripId) ? Number(tripId) : tripId;
}

async function fetchManifestTripRow(
  admin: AdminClient,
  tripKey: string | number,
): Promise<{ row: Record<string, unknown> | null; error?: string }> {
  const selects = [
    'id, title_ar, title_en, max_seats, booked_seats, allow_waitlist, dates_ar, price, is_active',
    'id, title_ar, title_en, max_seats, booked_seats, dates_ar, price, is_active',
    'id, title_ar, title_en, max_seats, booked_seats, dates_ar, price',
    'id, title_ar, max_seats, booked_seats',
    'id, title_ar',
  ];

  let lastError = '';
  for (const select of selects) {
    const { data, error } = await admin
      .from('group_trips')
      .select(select)
      .eq('id', tripKey)
      .maybeSingle();

    if (!error) {
      return { row: data ? (data as unknown as Record<string, unknown>) : null };
    }
    lastError = error.message ?? '';
    console.error('[getGroupTripManifest] trip select failed:', { select, error: lastError });
    if (!/column|schema cache|does not exist|could not find/i.test(lastError)) {
      return { row: null, error: lastError };
    }
  }
  return { row: null, error: lastError || 'تعذر قراءة الرحلة.' };
}

function tripKeysForQuery(tripId: string): Array<string | number> {
  const raw = String(tripId ?? '').trim();
  const keys: Array<string | number> = [];
  if (raw) keys.push(raw);
  const coerced = coerceTripIdForQuery(raw);
  if (coerced !== raw) keys.push(coerced);
  return keys;
}

function isSchemaMissError(message: string): boolean {
  return /column|schema cache|does not exist|could not find|enum|invalid input|operator/i.test(
    message ?? '',
  );
}

/**
 * Fetch every group_members row for this trip from the live pivot table.
 * Do not short-circuit on an empty `group_id` match — production may store the
 * trip FK in group_id, group_trip_id, or trip_id.
 * Status is filtered in JS so confirmed_seat / confirmed both load.
 */
async function fetchManifestMembers(
  admin: AdminClient,
  tripId: string,
): Promise<{ rows: Record<string, unknown>[]; warning?: string }> {
  const keys = tripKeysForQuery(tripId);
  const columns = ['group_id', 'group_trip_id', 'trip_id'] as const;
  const selects = [
    '*',
    'id, client_id, group_id, group_trip_id, trip_id, status, payment_status, payment_deadline, customer_name, customer_phone, created_at',
    'id, client_id, group_id, status, payment_status, payment_deadline, customer_name, customer_phone, created_at',
    'id, client_id, group_trip_id, status, customer_name, customer_phone, created_at',
    'id, client_id, group_id, status, customer_name, customer_phone',
    'id, client_id, status, group_id',
    'id, client_id, status',
  ];

  let lastError = '';
  const seen = new Set<string>();
  const collected: Record<string, unknown>[] = [];

  for (const column of columns) {
    for (const tripKey of keys) {
      for (const select of selects) {
        const { data, error } = await admin
          .from('group_members')
          .select(select)
          .eq(column, tripKey);

        if (error) {
          lastError = error.message ?? '';
          console.error('Supabase Query Error details:', {
            context: 'fetchManifestMembers',
            select,
            column,
            tripKey,
            error: lastError,
            code: error.code,
            details: error.details,
            hint: error.hint,
          });
          if (isSchemaMissError(lastError)) break;
          continue;
        }

        for (const row of (data ?? []) as Record<string, unknown>[]) {
          const id = String(row.id ?? '').trim();
          if (!id || seen.has(id)) continue;
          seen.add(id);
          collected.push(row);
        }
        // This FK+select worked — skip leaner selects for the same column/key
        break;
      }
    }
  }

  if (collected.length === 0 && lastError && !isSchemaMissError(lastError)) {
    return { rows: [], warning: lastError };
  }

  return { rows: collected, warning: collected.length === 0 && lastError ? lastError : undefined };
}

function sortConfirmedMembers(members: TripManifestMember[]): TripManifestMember[] {
  return [...members].sort((a, b) => {
    if (!a.paymentDeadline && !b.paymentDeadline) {
      return a.clientName.localeCompare(b.clientName, 'ar');
    }
    if (!a.paymentDeadline) return 1;
    if (!b.paymentDeadline) return -1;
    return new Date(a.paymentDeadline).getTime() - new Date(b.paymentDeadline).getTime();
  });
}

/** Soft-map member rows even when client_id is missing (denormalized guest only). */
function mapManifestMemberLoose(
  raw: Record<string, unknown>,
  client: Record<string, unknown> | null,
): TripManifestMember | null {
  const id = String(raw.id ?? '').trim();
  if (!id) return null;
  const status =
    normalizeGroupMemberStatus(raw.status) ??
    (String(raw.status ?? '').toLowerCase().includes('confirm')
      ? 'confirmed_seat'
      : String(raw.status ?? '').toLowerCase().includes('wait')
        ? 'waitlisted'
        : 'pending_interview');

  const clientId =
    raw.client_id != null && String(raw.client_id).trim() !== ''
      ? (/^\d+$/.test(String(raw.client_id).trim())
          ? Number(raw.client_id)
          : String(raw.client_id).trim())
      : '—';

  const mappedMember: GroupMember = {
    id,
    client_id: clientId === '—' ? 0 : clientId,
    group_trip_id: resolveGroupMemberTripId(raw),
    status,
    notes: raw.notes != null ? String(raw.notes) : null,
    payment_status: isGroupPaymentStatus(raw.payment_status) ? raw.payment_status : null,
    payment_deadline:
      raw.payment_deadline != null && String(raw.payment_deadline).trim()
        ? String(raw.payment_deadline)
        : null,
    created_at: String(raw.created_at ?? ''),
    updated_at: String(raw.updated_at ?? ''),
  };

  return mapManifestMember(mappedMember, client, {
    customer_name: raw.customer_name,
    customer_phone: raw.customer_phone,
  });
}

/** Pre-seat funnel on `leads` (not group_members yet). */
const MANIFEST_PENDING_LEAD_STATUSES = [
  'awaiting_dna',
  'meeting',
  'interview_scheduled',
  'interview',
  'quote_stage',
  'awaiting_payment',
  'pending_payment',
  'dna_sent',
  'client_meeting',
] as const;

function parsePreferredTripIdLoose(finalThoughts: string | null | undefined): string | null {
  const text = String(finalThoughts ?? '');
  const uuid = text.match(/preferred_trip:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  if (uuid?.[1]) return uuid[1];
  const numeric = text.match(/preferred_trip:(\d+)/i);
  return numeric?.[1] ?? null;
}

function rawPreferredTripId(row: Record<string, unknown>): string | null {
  const fromCol = String(row.preferred_trip_id ?? '').trim();
  if (fromCol) return fromCol;
  const fromResolver = resolveLeadPreferredTripId({
    preferred_trip_id: null,
    final_thoughts: row.final_thoughts != null ? String(row.final_thoughts) : '',
  });
  if (fromResolver) return fromResolver;
  return parsePreferredTripIdLoose(
    row.final_thoughts != null ? String(row.final_thoughts) : null,
  );
}

function isExplicitGroupLeadRow(row: Record<string, unknown>): boolean {
  const style = String(row.travel_style ?? '').trim();
  if (style === 'Group' || style === 'Group Trip Onboarding') return true;
  if (/^group(\s+trip)?(\s+onboarding)?$/i.test(style)) return true;
  if (String(row.form_type ?? '').trim() === 'group_trip') return true;
  if (rawPreferredTripId(row)) return true;
  const thoughts = String(row.final_thoughts ?? '');
  return /رحلة جماعية|Group Trip Onboarding|preferred_trip:/i.test(thoughts);
}

/** Private VIP leads must never appear on a Group trip waiting / pending list. */
function isGroupStyleLeadRow(row: Record<string, unknown>): boolean {
  const style = String(row.travel_style ?? '').trim();
  if (style === 'Private') return false;
  if (style === 'Group' || style === 'Group Trip Onboarding') return true;
  if (/^group(\s+trip)?(\s+onboarding)?$/i.test(style)) return true;
  // Legacy rows without travel_style: only keep explicit group markers
  if (!style) return isExplicitGroupLeadRow(row);
  // Anything else (Register Interest, Session, Instagram-as-style pollution) → Private path
  return false;
}

function isPendingConfirmationLeadStatus(raw: unknown): boolean {
  const normalized = normalizeLeadStatus(raw);
  if (
    normalized === 'awaiting_dna' ||
    normalized === 'meeting' ||
    normalized === 'interview_scheduled' ||
    normalized === 'quote_stage' ||
    normalized === 'awaiting_payment'
  ) {
    return true;
  }
  const s = String(raw ?? '').trim().toLowerCase();
  return (
    s === 'interview' ||
    s === 'pending_payment' ||
    s === 'dna_sent' ||
    s === 'client_meeting' ||
    MANIFEST_PENDING_LEAD_STATUSES.includes(s as (typeof MANIFEST_PENDING_LEAD_STATUSES)[number])
  );
}

function destinationsHaystack(row: Record<string, unknown>): string {
  const dest = row.destinations;
  if (Array.isArray(dest)) return dest.map((v) => String(v ?? '').trim()).filter(Boolean).join(' ');
  if (dest == null) return '';
  return String(dest).trim();
}

/** Match Group lead → this trip via preferred_trip_id or destination/title overlap. */
function leadTargetsTrip(
  row: Record<string, unknown>,
  tripId: string,
  tripTitleAr: string,
  tripTitleEn = '',
): boolean {
  // Hard gate: Private / non-Group leads never join a Group trip waiting list
  if (!isGroupStyleLeadRow(row)) return false;

  const preferred = rawPreferredTripId(row);
  if (preferred) return preferred === tripId;

  // No preferred_trip yet — destination must overlap trip title
  if (!isExplicitGroupLeadRow(row)) return false;

  const hay = `${destinationsHaystack(row)} ${String(row.final_thoughts ?? '')}`
    .normalize('NFKC')
    .toLowerCase()
    .trim();
  if (!hay) return false;

  const titles = [tripTitleAr, tripTitleEn]
    .map((t) => String(t ?? '').trim().toLowerCase())
    .filter((t) => t.length >= 2);

  for (const title of titles) {
    if (hay.includes(title)) return true;
  }

  const destTokens = destinationsHaystack(row)
    .split(/[,،·/\s|]+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length >= 2);
  const titleBlob = titles.join(' ');
  if (destTokens.some((token) => titleBlob.includes(token))) {
    return true;
  }

  return false;
}

function mapLeadRowToPendingMember(row: Record<string, unknown>): TripManifestMember | null {
  const leadId = row.id != null ? String(row.id).trim() : '';
  if (!leadId) return null;
  const pipeline = String(row.status ?? '').trim();
  const clientId =
    row.client_id != null && String(row.client_id).trim() !== ''
      ? String(row.client_id).trim()
      : `lead:${leadId}`;
  const created = String(row.created_at ?? new Date().toISOString());
  return {
    id: `lead:${leadId}`,
    clientId,
    clientName: String(row.full_name ?? '').trim() || `ضيف #${leadId.slice(0, 8)}`,
    phone: row.phone_wa != null ? String(row.phone_wa).trim() || null : null,
    email: row.email != null ? String(row.email).trim() || null : null,
    status: 'pending_interview',
    paymentStatus: null,
    paymentDeadline: null,
    createdAt: created,
    updatedAt: String(row.updated_at ?? created),
    passportExpiry: null,
    visaStatus: null,
    source: 'lead',
    leadPipelineStatus: pipeline || null,
  };
}

/**
 * Pre-confirmation people live on `leads` until interview approval creates `group_members`.
 * Merge interview / DNA / quote-stage leads that target this trip into «بانتظار التأكيد».
 */
async function fetchPendingInterviewLeadsForTrip(
  admin: AdminClient,
  tripId: string,
  tripTitleAr: string,
  tripTitleEn = '',
): Promise<TripManifestMember[]> {
  const tripKey = String(tripId).trim();
  if (!tripKey) return [];

  const selects = [
    'id, full_name, phone_wa, email, status, form_type, travel_style, preferred_trip_id, destinations, final_thoughts, client_id, created_at, updated_at',
    'id, full_name, phone_wa, email, status, form_type, travel_style, preferred_trip_id, destinations, final_thoughts, client_id, created_at',
    'id, full_name, phone_wa, email, status, form_type, preferred_trip_id, destinations, final_thoughts, client_id, created_at',
    'id, full_name, phone_wa, email, status, form_type, preferred_trip_id, final_thoughts, created_at',
    'id, full_name, phone_wa, email, status, form_type, destinations, final_thoughts, created_at',
    'id, full_name, phone_wa, status, final_thoughts, created_at',
  ];

  const byId = new Map<string, Record<string, unknown>>();

  const absorb = (rows: Record<string, unknown>[] | null | undefined) => {
    for (const row of rows ?? []) {
      const id = row.id != null ? String(row.id).trim() : '';
      if (id) byId.set(id, row);
    }
  };

  for (const select of selects) {
    let selectUsable = true;
    const hasTravelStyle = select.includes('travel_style');

    // 1) Direct preferred_trip_id — Group style when column available
    if (select.includes('preferred_trip_id')) {
      let q = admin
        .from('leads')
        .select(select)
        .eq('preferred_trip_id', tripKey)
        .order('created_at', { ascending: false })
        .limit(150);
      if (hasTravelStyle) q = q.eq('travel_style', 'Group');

      const byPreferred = await q;

      if (byPreferred.error) {
        if (/preferred_trip|travel_style|column|schema cache|does not exist/i.test(byPreferred.error.message ?? '')) {
          // Retry without travel_style filter if that column broke the query
          if (hasTravelStyle && /travel_style/i.test(byPreferred.error.message ?? '')) {
            const retry = await admin
              .from('leads')
              .select(select)
              .eq('preferred_trip_id', tripKey)
              .order('created_at', { ascending: false })
              .limit(150);
            if (!retry.error) absorb(retry.data as unknown as Record<string, unknown>[]);
            else if (/preferred_trip|column|schema cache|does not exist/i.test(retry.error.message ?? '')) {
              selectUsable = false;
            }
          } else {
            selectUsable = false;
          }
        } else {
          console.warn('[fetchPendingInterviewLeadsForTrip] preferred:', byPreferred.error.message);
        }
      } else {
        absorb(byPreferred.data as unknown as Record<string, unknown>[]);
      }
    }

    if (!selectUsable) continue;

    // 2) Explicit Group travel_style rows (canonical after migration)
    if (hasTravelStyle) {
      const byStyle = await admin
        .from('leads')
        .select(select)
        .eq('travel_style', 'Group')
        .order('created_at', { ascending: false })
        .limit(200);

      if (byStyle.error) {
        if (!/travel_style|column|schema cache|does not exist/i.test(byStyle.error.message ?? '')) {
          console.warn('[fetchPendingInterviewLeadsForTrip] travel_style:', byStyle.error.message);
        }
      } else {
        absorb(byStyle.data as unknown as Record<string, unknown>[]);
      }
    }

    // 3) Explicit group_trip form rows (DNA → interview → quote)
    if (select.includes('form_type')) {
      let q = admin
        .from('leads')
        .select(select)
        .eq('form_type', 'group_trip')
        .order('created_at', { ascending: false })
        .limit(200);
      if (hasTravelStyle) q = q.eq('travel_style', 'Group');

      const byForm = await q;

      if (byForm.error) {
        if (/form_type|travel_style|column|schema cache|does not exist/i.test(byForm.error.message ?? '')) {
          /* try next select */
        } else {
          console.warn('[fetchPendingInterviewLeadsForTrip] form_type:', byForm.error.message);
        }
      } else {
        absorb(byForm.data as unknown as Record<string, unknown>[]);
      }
    }

    // 4) Interview-board statuses — only Group (never Private waiting-list pollution)
    for (const status of MANIFEST_PENDING_LEAD_STATUSES) {
      let q = admin
        .from('leads')
        .select(select)
        .eq('status', status)
        .order('created_at', { ascending: false })
        .limit(100);
      if (hasTravelStyle) q = q.eq('travel_style', 'Group');

      const byStatus = await q;

      if (byStatus.error) {
        if (/column|schema cache|does not exist/i.test(byStatus.error.message ?? '')) {
          selectUsable = false;
          break;
        }
        continue;
      }
      absorb(byStatus.data as unknown as Record<string, unknown>[]);
    }

    if (selectUsable) break;
  }

  const pendingData = [...byId.values()].filter(
    (row) =>
      isGroupStyleLeadRow(row) &&
      isPendingConfirmationLeadStatus(row.status) &&
      leadTargetsTrip(row, tripKey, tripTitleAr, tripTitleEn),
  );

  console.log('Pending Requests Fetched:', {
    tripId: tripKey,
    tripTitleAr,
    tripTitleEn,
    scanned: byId.size,
    matched: pendingData.length,
    names: pendingData.map((r) => String(r.full_name ?? '')),
    pendingData,
  });

  return pendingData
    .map(mapLeadRowToPendingMember)
    .filter((m): m is TripManifestMember => m != null);
}

function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (v: string | null | undefined) => String(v ?? '').replace(/\D/g, '');
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  return x === y || x.endsWith(y) || y.endsWith(x);
}

/** Admin manifest: trip + confirmed seats + waitlist + pending with client details */
export async function getGroupTripManifest(
  tripIdRaw: string,
  accessToken?: string | null,
): Promise<GroupTripActionResult<GroupTripManifest>> {
  const denied = await requireAdmin(accessToken);
  if (denied) return denied;

  const tripId = String(tripIdRaw ?? '').trim();
  if (!tripId) return { ok: false, error: 'معرّف الرحلة غير صالح.' };

  try {
    const admin = createSupabaseAdminClient();
    const tripKey = coerceTripIdForQuery(tripId);

    const tripResult = await fetchManifestTripRow(admin, tripKey);
    if (tripResult.error) {
      console.error('Supabase Query Error details:', {
        context: 'getGroupTripManifest.trip',
        tripId,
        error: tripResult.error,
      });
      return {
        ok: false,
        // Surface real DB message (was previously masked as generic Arabic)
        error: tripResult.error,
      };
    }
    if (!tripResult.row) return { ok: false, error: 'الرحلة غير موجودة.' };

    const t = tripResult.row;
    const maxSeats = Math.max(0, Number(t.max_seats) || 0);
    const bookedSeats = Math.max(0, Number(t.booked_seats) || 0);

    const membersResult = await fetchManifestMembers(admin, tripId);
    // Empty / failed members must NOT hard-crash the page
    if (membersResult.warning) {
      console.error('Supabase Query Error details:', {
        context: 'getGroupTripManifest.members',
        tripId,
        warning: membersResult.warning,
      });
    }

    const memberRows = membersResult.rows;
    const clientIds = [
      ...new Set(
        memberRows
          .map((r) => (r.client_id != null ? String(r.client_id).trim() : ''))
          .filter(Boolean),
      ),
    ];
    const clientsById = new Map<string, Record<string, unknown>>();

    if (clientIds.length > 0) {
      let clientRows: unknown[] | null = null;
      const clientSelects = [
        'id, name, phone_wa, email, passport_expiry, visa_status',
        'id, name, phone_wa, email, passport_expiry',
        'id, name, phone_wa, email',
      ];
      for (const select of clientSelects) {
        const { data, error: clientsErr } = await admin
          .from('clients')
          .select(select)
          .in('id', clientIds);
        if (!clientsErr) {
          clientRows = data ?? [];
          break;
        }
        console.error('Supabase Query Error details:', {
          context: 'getGroupTripManifest.clients',
          select,
          error: clientsErr.message,
        });
        if (!/column|schema cache|does not exist|could not find/i.test(clientsErr.message ?? '')) {
          break;
        }
      }
      for (const row of clientRows ?? []) {
        const id = (row as { id?: unknown }).id;
        if (id == null || String(id).trim() === '') continue;
        clientsById.set(String(id), row as Record<string, unknown>);
      }
    }

    const confirmed: TripManifestMember[] = [];
    const waitlisted: TripManifestMember[] = [];
    const pending: TripManifestMember[] = [];

    for (const raw of memberRows) {
      const statusRaw = String(raw.status ?? '').trim();
      const statusKey = statusRaw.toLowerCase();
      const isConfirmed =
        statusKey === 'confirmed_seat' ||
        statusKey === 'confirmed' ||
        bucketGroupMemberManifestStatus(raw.status) === 'confirmed';
      const isWaitlisted =
        statusKey === 'waitlisted' ||
        statusKey === 'waiting' ||
        bucketGroupMemberManifestStatus(raw.status) === 'waitlisted';

      const clientKey = raw.client_id != null ? String(raw.client_id) : '';
      const mapped = mapManifestMemberLoose(
        raw,
        clientKey ? clientsById.get(clientKey) ?? null : null,
      );
      if (!mapped) {
        console.warn('[getGroupTripManifest] skipped member row', {
          id: raw.id,
          status: raw.status,
          client_id: raw.client_id,
        });
        continue;
      }
      mapped.source = 'group_member';
      if (isConfirmed) confirmed.push(mapped);
      else if (isWaitlisted) waitlisted.push(mapped);
      else if (bucketGroupMemberManifestStatus(mapped.status) === 'pending') {
        pending.push(mapped);
      }
    }

    console.log('[getGroupTripManifest] group_members loaded', {
      tripId: String(t.id ?? tripId),
      rawCount: memberRows.length,
      confirmed: confirmed.length,
      waitlisted: waitlisted.length,
      pendingMembers: pending.length,
    });

    // Leads table (interview / DNA / quote) ∪ group_members pending — pre-confirmation
    const tripTitleAr = String(t.title_ar ?? 'رحلة جماعية');
    const tripTitleEn = String(t.title_en ?? t.title ?? '');
    const interviewLeads = await fetchPendingInterviewLeadsForTrip(
      admin,
      String(t.id ?? tripId),
      tripTitleAr,
      tripTitleEn,
    );
    const pendingClientIds = new Set(pending.map((m) => String(m.clientId)));
    const pendingPhones = pending.map((m) => m.phone).filter(Boolean) as string[];
    const seatedClientIds = new Set([
      ...confirmed.map((m) => String(m.clientId)),
      ...waitlisted.map((m) => String(m.clientId)),
      ...pendingClientIds,
    ]);
    const seatedPhones = [
      ...confirmed.map((m) => m.phone),
      ...waitlisted.map((m) => m.phone),
      ...pendingPhones,
    ].filter(Boolean) as string[];

    for (const leadMember of interviewLeads) {
      const cid = String(leadMember.clientId);
      if (seatedClientIds.has(cid)) continue;
      if (leadMember.phone && seatedPhones.some((p) => phonesMatch(p, leadMember.phone))) {
        continue;
      }
      pending.push(leadMember);
    }

    console.log('Pending Requests Fetched:', {
      tripId: String(t.id ?? tripId),
      fromLeads: interviewLeads.length,
      fromMembers: pendingClientIds.size,
      pendingTotal: pending.length,
      pendingNames: pending.map((m) => m.clientName),
      pending,
    });

    pending.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

    return {
      ok: true,
      message: membersResult.warning ? `ok_with_warning:${membersResult.warning}` : 'ok',
      data: {
        trip: {
          id: String(t.id ?? tripId),
          titleAr: tripTitleAr,
          titleEn: t.title_en != null ? String(t.title_en) : null,
          maxSeats,
          bookedSeats,
          allowWaitlist: t.allow_waitlist !== false,
          datesAr: t.dates_ar != null ? String(t.dates_ar) : null,
          price: t.price != null ? String(t.price) : null,
          isActive: t.is_active !== false,
        },
        confirmed: sortConfirmedMembers(confirmed),
        waitlisted,
        pending,
      },
    };
  } catch (err) {
    console.error('Supabase Query Error details:', err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Admin: ترقية من قائمة الانتظار إلى مقعد مؤكد.
 * Applies dynamic scarcity deadline + retroactive trigger when crossing threshold.
 */
export async function promoteWaitlistedClient(
  memberIdRaw: string,
  tripIdRaw: string,
  accessToken?: string | null,
): Promise<GroupTripActionResult<TripManifestMember>> {
  const denied = await requireAdmin(accessToken);
  if (denied) return denied;

  const memberId = String(memberIdRaw ?? '').trim();
  const tripId = String(tripIdRaw ?? '').trim();
  if (!memberId) return { ok: false, error: 'معرّف العضوية غير صالح.' };
  if (!tripId) return { ok: false, error: 'معرّف الرحلة غير صالح.' };

  try {
    const admin = createSupabaseAdminClient();

    const { data: memberRow, error: memberError } = await selectMemberRowById(admin, memberId);

    if (memberError) {
      return {
        ok: false,
        error: formatGroupTripDbError('promoteWaitlistedClient', memberError.message ?? ''),
      };
    }
    if (!memberRow) return { ok: false, error: 'سجل العضوية غير موجود.' };

    const member = mapGroupMemberRow(memberRow as unknown as Record<string, unknown>);
    if (!member) return { ok: false, error: 'تعذر قراءة سجل العضوية.' };
    if (member.group_trip_id && !tripIdsMatch(member.group_trip_id, tripId)) {
      return { ok: false, error: 'العضوية لا تتبع هذه الرحلة.' };
    }
    if (normalizeGroupMemberStatus(member.status) !== 'waitlisted') {
      return { ok: false, error: 'الترقية متاحة فقط لأعضاء قائمة الانتظار.' };
    }

    const clientId = member.client_id;
    const tripKey = coerceTripIdForQuery(tripId);

    const { data: trip, error: tripError } = await admin
      .from('group_trips')
      .select('id, title_ar, max_seats, booked_seats, is_active')
      .eq('id', tripKey)
      .maybeSingle();

    if (tripError) {
      return {
        ok: false,
        error: formatGroupTripDbError('getGroupTripManifest', tripError.message ?? ''),
      };
    }
    if (!trip) return { ok: false, error: 'الرحلة غير موجودة.' };

    const t = trip as Record<string, unknown>;
    if (t.is_active === false) {
      return { ok: false, error: 'هذه الرحلة غير مفعّلة حالياً.' };
    }

    const maxSeats = Math.max(0, Number(t.max_seats) || 0);
    const bookedSeats = Math.max(0, Number(t.booked_seats) || 0);
    const hasCapacity = maxSeats <= 0 || bookedSeats < maxSeats;

    if (!hasCapacity) {
      return { ok: false, error: 'لا توجد مقاعد شاغرة — الرحلة مكتملة.' };
    }

    const nextBooked = bookedSeats + 1;
    const paymentDeadline = computePaymentDeadlineForBookedSeats(nextBooked);

    let { data: updated, error: updateError } = await admin
      .from('group_trips')
      .update({ booked_seats: nextBooked })
      .eq('id', tripKey)
      .eq('booked_seats', Number(t.booked_seats) || 0)
      .select('id')
      .maybeSingle();

    if (updateError && /booked_seats/i.test(updateError.message)) {
      const fallback = await admin
        .from('group_trips')
        .update({ booked_seats: nextBooked })
        .eq('id', tripKey)
        .select('id')
        .maybeSingle();
      updated = fallback.data;
      updateError = fallback.error;
    }

    if (updateError) return { ok: false, error: updateError.message };
    if (!updated) {
      return { ok: false, error: 'تعذر حجز المقعد — قد تكون الرحلة امتلأت للتو.' };
    }

    const app = await updateMemberById(admin, memberId, {
      status: 'confirmed_seat',
      tripId,
      payment_status: 'pending',
      payment_deadline: paymentDeadline,
    });
    if (!app.ok) return app;

    await triggerRetroactiveScarcityDeadlines(admin, tripId, bookedSeats, nextBooked);

    const { data: clientRow } = await admin
      .from('clients')
      .select('id, name, phone_wa, email, passport_expiry')
      .eq('id', clientId)
      .maybeSingle();

    revalidateClientPaths(clientId, tripId);

    const promoted = mapManifestMember(
      app.data!,
      clientRow ? (clientRow as Record<string, unknown>) : null,
    );

    const scarcityNote =
      nextBooked >= SCARCITY_THRESHOLD && paymentDeadline
        ? ' · بدأت مهلة السداد (3 أيام).'
        : ' · مقعد بدون مهلة حالياً.';

    return {
      ok: true,
      message: `تم ترقية ${promoted.clientName} إلى مقعد مؤكد${scarcityNote}`,
      data: promoted,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
