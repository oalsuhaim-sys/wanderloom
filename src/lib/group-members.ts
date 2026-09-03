/** Canonical pivot: public.group_members (client ↔ group_trips) */

import type { SupabaseClient } from '@supabase/supabase-js';

export const GROUP_MEMBER_STATUSES = [
  'pending_interview',
  'approved',
  'rejected',
  'confirmed_seat',
  'waitlisted',
] as const;

export type GroupMemberStatus = (typeof GROUP_MEMBER_STATUSES)[number];

export const GROUP_PAYMENT_STATUSES = ['pending', 'paid', 'waived', 'expired'] as const;
export type GroupPaymentStatus = (typeof GROUP_PAYMENT_STATUSES)[number];

/** Yield management: below this booked count, seats hold indefinitely. */
export const SCARCITY_THRESHOLD = 11;
/** Grace period once scarcity kicks in. */
export const PAYMENT_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

export type GroupMember = {
  id: string;
  /** clients.id — integer or UUID depending on environment */
  client_id: string | number;
  group_trip_id: string | null;
  status: GroupMemberStatus;
  notes: string | null;
  payment_status: GroupPaymentStatus | null;
  payment_deadline: string | null;
  created_at: string;
  updated_at: string;
  trip_title_ar?: string | null;
  trip_dates_ar?: string | null;
};

export function isGroupMemberStatus(value: unknown): value is GroupMemberStatus {
  return (
    typeof value === 'string' &&
    (GROUP_MEMBER_STATUSES as readonly string[]).includes(value)
  );
}

/** Legacy / shorthand values that may still exist in group_members.status */
const GROUP_MEMBER_STATUS_ALIASES: Record<string, GroupMemberStatus> = {
  confirmed: 'confirmed_seat',
  'confirmed seat': 'confirmed_seat',
  seat_confirmed: 'confirmed_seat',
  confirmed_seats: 'confirmed_seat',
  waitlist: 'waitlisted',
  waiting: 'waitlisted',
  wait_list: 'waitlisted',
  waitlisted_seat: 'waitlisted',
  pending: 'pending_interview',
  interview: 'pending_interview',
  approve: 'approved',
  reject: 'rejected',
};

/** Values to include in `.in('status', …)` so legacy rows are not dropped from queries. */
export const GROUP_MEMBER_STATUS_FETCH_VALUES: readonly string[] = [
  ...GROUP_MEMBER_STATUSES,
  ...Object.keys(GROUP_MEMBER_STATUS_ALIASES),
];

/**
 * Normalize group_members.status to canonical enum (confirmed_seat, waitlisted, …).
 * Returns null when the value cannot be mapped.
 */
export function normalizeGroupMemberStatus(raw: unknown): GroupMemberStatus | null {
  if (raw == null || String(raw).trim() === '') return null;
  if (isGroupMemberStatus(raw)) return raw;
  const key = String(raw).trim().toLowerCase();
  return GROUP_MEMBER_STATUS_ALIASES[key] ?? null;
}

export function isConfirmedGroupMemberStatus(raw: unknown): boolean {
  return normalizeGroupMemberStatus(raw) === 'confirmed_seat';
}

export function isWaitlistedGroupMemberStatus(raw: unknown): boolean {
  return normalizeGroupMemberStatus(raw) === 'waitlisted';
}

export type GroupMemberManifestBucket = 'confirmed' | 'waitlisted' | 'pending' | 'other';

export function bucketGroupMemberManifestStatus(
  raw: unknown,
): GroupMemberManifestBucket {
  const status = normalizeGroupMemberStatus(raw);
  if (status === 'confirmed_seat') return 'confirmed';
  if (status === 'waitlisted') return 'waitlisted';
  if (status === 'pending_interview' || status === 'approved') return 'pending';
  return 'other';
}

export type GroupTripCapacitySnapshot = {
  tripId: string;
  titleAr: string;
  maxSeats: number;
  /** Live count of group_members.status = confirmed_seat */
  confirmedCount: number;
  /** Cached column on group_trips (may drift — prefer confirmedCount) */
  bookedSeatsColumn: number;
  allowWaitlist: boolean;
  isActive: boolean;
  /** True when a new confirmed seat can still be granted */
  hasConfirmedCapacity: boolean;
};

function coerceTripIdForQuery(tripId: string): string | number {
  return /^\d+$/.test(tripId) ? Number(tripId) : tripId;
}

/**
 * Capacity for waitlist automation: max_seats vs live confirmed_seat count.
 * Do not rely on booked_seats alone — it can drift from the pivot table.
 */
export async function fetchGroupTripCapacity(
  db: SupabaseClient,
  tripIdRaw: string,
): Promise<{ ok: true; data: GroupTripCapacitySnapshot } | { ok: false; error: string }> {
  const tripIdStr = String(tripIdRaw ?? '').trim();
  if (!tripIdStr) return { ok: false, error: 'معرّف الرحلة غير صالح.' };
  const tripKey = coerceTripIdForQuery(tripIdStr);

  const tripSelects = [
    'id, title_ar, max_seats, booked_seats, allow_waitlist, is_active',
    'id, title_ar, max_seats, booked_seats, is_active',
    'id, title_ar, max_seats, booked_seats',
  ];

  let trip: Record<string, unknown> | null = null;
  let lastError = '';
  for (const select of tripSelects) {
    const { data, error } = await db
      .from('group_trips')
      .select(select)
      .eq('id', tripKey)
      .maybeSingle();
    if (!error) {
      trip = (data as Record<string, unknown> | null) ?? null;
      break;
    }
    lastError = error.message ?? '';
    if (!/column|schema cache|does not exist/i.test(lastError)) {
      return { ok: false, error: lastError };
    }
  }
  if (!trip) return { ok: false, error: lastError || 'الرحلة غير موجودة.' };

  const maxSeats = Math.max(0, Number(trip.max_seats) || 0);
  const bookedSeatsColumn = Math.max(0, Number(trip.booked_seats) || 0);
  const allowWaitlist = trip.allow_waitlist !== false;
  const isActive = trip.is_active !== false;

  async function countConfirmed(fk: 'group_id' | 'group_trip_id'): Promise<number | null> {
    const { count, error } = await db
      .from('group_members')
      .select('id', { count: 'exact', head: true })
      .eq(fk, tripKey)
      .in('status', ['confirmed_seat', 'confirmed']);
    if (error) {
      if (/column|schema cache|does not exist/i.test(error.message ?? '')) return null;
      console.warn('[fetchGroupTripCapacity]', error.message);
      return null;
    }
    return count ?? 0;
  }

  let confirmedCount = await countConfirmed('group_id');
  if (confirmedCount == null) {
    confirmedCount = (await countConfirmed('group_trip_id')) ?? bookedSeatsColumn;
  }

  return {
    ok: true,
    data: {
      tripId: String(trip.id ?? tripIdStr),
      titleAr: String(trip.title_ar ?? 'رحلة جماعية'),
      maxSeats,
      confirmedCount,
      bookedSeatsColumn,
      allowWaitlist,
      isActive,
      hasConfirmedCapacity: maxSeats <= 0 || confirmedCount < maxSeats,
    },
  };
}

export function isGroupPaymentStatus(value: unknown): value is GroupPaymentStatus {
  return (
    typeof value === 'string' &&
    (GROUP_PAYMENT_STATUSES as readonly string[]).includes(value)
  );
}

/** ISO deadline or null when below scarcity threshold. */
export function computePaymentDeadlineForBookedSeats(
  newBookedSeats: number,
  now: Date = new Date(),
): string | null {
  if (newBookedSeats < SCARCITY_THRESHOLD) return null;
  return new Date(now.getTime() + PAYMENT_GRACE_MS).toISOString();
}

/** True when this assignment crosses into scarcity (e.g. 10 → 11). */
export function crossesScarcityThreshold(
  previousBookedSeats: number,
  newBookedSeats: number,
): boolean {
  return previousBookedSeats < SCARCITY_THRESHOLD && newBookedSeats >= SCARCITY_THRESHOLD;
}

export function remainingPaymentDeadlineParts(
  deadlineIso: string | null | undefined,
  now: Date = new Date(),
): { expired: boolean; days: number; hours: number; label: string } | null {
  if (!deadlineIso) return null;
  const end = new Date(deadlineIso);
  if (Number.isNaN(end.getTime())) return null;
  const ms = end.getTime() - now.getTime();
  if (ms <= 0) {
    return { expired: true, days: 0, hours: 0, label: 'انتهت مهلة السداد' };
  }
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days >= 1) {
    return {
      expired: false,
      days,
      hours,
      label: days === 1 ? 'تبقى يوم واحد' : `تبقى ${days} أيام`,
    };
  }
  return {
    expired: false,
    days: 0,
    hours,
    label: hours <= 1 ? 'تبقى أقل من ساعة' : `تبقى ${hours} ساعات`,
  };
}

export function paymentDeadlineBadgeLabel(
  deadlineIso: string | null | undefined,
): { label: string; tone: 'slate' | 'amber' | 'rose' | 'green' } {
  if (!deadlineIso) {
    return { label: 'مقعد محجوز (بدون مهلة)', tone: 'slate' };
  }
  const parts = remainingPaymentDeadlineParts(deadlineIso);
  if (!parts) return { label: 'مقعد محجوز (بدون مهلة)', tone: 'slate' };
  if (parts.expired) return { label: parts.label, tone: 'rose' };
  return { label: parts.label, tone: 'amber' };
}

export function groupPaymentStatusLabel(status: GroupPaymentStatus | null | undefined): string {
  switch (status) {
    case 'pending':
      return 'بانتظار السداد';
    case 'paid':
      return 'مدفوع';
    case 'waived':
      return 'معفى';
    case 'expired':
      return 'منتهي / غير مسدد';
    default:
      return 'غير محدد';
  }
}

/** Visual tone for financial tracking badges on the trip manifest. */
export function groupPaymentStatusBadgeClass(
  status: GroupPaymentStatus | null | undefined,
): string {
  switch (status) {
    case 'paid':
      return 'bg-emerald-100 text-emerald-900 ring-emerald-300';
    case 'pending':
      return 'bg-amber-100 text-amber-950 ring-amber-300';
    case 'waived':
      return 'bg-sky-100 text-sky-900 ring-sky-300';
    case 'expired':
      return 'bg-rose-100 text-rose-900 ring-rose-300';
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
}

export function groupMemberStatusLabel(status: GroupMemberStatus): string {
  switch (status) {
    case 'pending_interview':
      return 'بانتظار المقابلة';
    case 'approved':
      return 'تمت الموافقة — بانتظار التعيين';
    case 'rejected':
      return 'مرفوض';
    case 'confirmed_seat':
      return 'مقعد مؤكد';
    case 'waitlisted':
      return 'قائمة الانتظار';
    default:
      return status;
  }
}

/** Client portal badge copy (Arabic) */
export function groupMemberPortalBadge(status: GroupMemberStatus): {
  label: string;
  detail: string;
  tone: 'amber' | 'green' | 'orange' | 'rose' | 'slate';
} {
  switch (status) {
    case 'pending_interview':
      return {
        label: 'جاري مراجعة طلبك وتحديد موعد المقابلة',
        detail: 'فريق Wanderloom يراجع ملفك ويحدد موعد المقابلة قريباً.',
        tone: 'amber',
      };
    case 'approved':
      return {
        label: 'تمت الموافقة على طلبك',
        detail: 'جاري تعيينك على رحلة المجموعة المناسبة.',
        tone: 'slate',
      };
    case 'confirmed_seat':
      return {
        label: 'تم تأكيد المقعد! بانتظار السداد',
        detail: 'مقعدك محجوز — أكمل السداد لتثبيت حجزك نهائياً.',
        tone: 'green',
      };
    case 'waitlisted':
      return {
        label: 'في قائمة الانتظار ⏳',
        detail: 'الرحلة مكتملة حالياً، سنبلغك فور توفر مقعد شاغر.',
        tone: 'orange',
      };
    case 'rejected':
      return {
        label: 'لم تتم الموافقة على الطلب',
        detail: 'يمكنك التواصل مع فريق Wanderloom لمزيد من التفاصيل.',
        tone: 'rose',
      };
    default:
      return {
        label: 'حالة الطلب',
        detail: '',
        tone: 'slate',
      };
  }
}

/** Prefer group_id; omit updated_at (missing in production). */
const MEMBER_SELECT_COLS =
  'id, client_id, group_id, status, notes, payment_status, payment_deadline, customer_name, customer_phone, created_at';
const MEMBER_SELECT_COLS_LEAN =
  'id, client_id, group_id, status, notes, customer_name, customer_phone, created_at';
/** Production schema: trip FK is group_id */
const MEMBER_SELECT_GROUP_ID =
  'id, client_id, group_id, status, notes, payment_status, payment_deadline, customer_name, customer_phone, created_at';
const MEMBER_SELECT_GROUP_ID_LEAN =
  'id, client_id, group_id, status, notes, customer_name, customer_phone, created_at';
/** Legacy schema: trip FK is group_trip_id */
const MEMBER_SELECT_LEGACY =
  'id, client_id, group_trip_id, status, notes, payment_status, payment_deadline, created_at';
const MEMBER_SELECT_LEGACY_LEAN =
  'id, client_id, group_trip_id, status, notes, created_at';

export {
  MEMBER_SELECT_COLS,
  MEMBER_SELECT_COLS_LEAN,
  MEMBER_SELECT_GROUP_ID,
  MEMBER_SELECT_GROUP_ID_LEAN,
  MEMBER_SELECT_LEGACY,
  MEMBER_SELECT_LEGACY_LEAN,
};

/** Resolve trip FK whether DB column is group_id, group_trip_id, or trip_id. */
export function resolveGroupMemberTripId(raw: Record<string, unknown>): string | null {
  const v = raw.group_id ?? raw.group_trip_id ?? raw.trip_id;
  if (v == null || String(v).trim() === '') return null;
  return String(v);
}

function parseClientIdField(raw: unknown): string | number | null {
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
  return s;
}

export function mapGroupMemberRow(raw: Record<string, unknown>): GroupMember | null {
  const id = String(raw.id ?? '').trim();
  const clientId = parseClientIdField(raw.client_id);
  const status = normalizeGroupMemberStatus(raw.status);
  if (!id || clientId == null || !status) return null;

  return {
    id,
    client_id: clientId,
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
    trip_title_ar:
      raw.trip_title_ar != null
        ? String(raw.trip_title_ar)
        : raw.title_ar != null
          ? String(raw.title_ar)
          : null,
  };
}
