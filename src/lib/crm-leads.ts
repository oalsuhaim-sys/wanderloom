import type { SupabaseClient } from '@supabase/supabase-js';

import { enrichLeadsWithIntake, type CrmLeadWithIntake } from '@/lib/client-intake-pipeline';
import {
  INTEREST_ONLY_DB_VALUES,
  INTEREST_ONLY_STATUS_OR,
  INTERVIEW_APPOINTMENT_DB_STATUSES,
  INTERVIEW_SCHEDULED_STATUS,
  isInboxPendingLeadStatus,
  normalizeLeadStatus,
  RADAR_INBOX_DB_VALUES,
} from '@/lib/lead-status';
import { reconcileLeadStatusesFromQuotesAndInvoices } from '@/lib/lead-pipeline-automation';
import {
  LEAD_KANBAN_DB_STATUS,
  normalizeLeadKanbanStatus,
  RADAR_INBOX_STATUS_OR,
  type LeadKanbanColumnId,
} from '@/lib/leads-kanban';
import {
  isGroupTravelStyle,
  type LeadTravelStyle,
} from '@/lib/lead-travel-style';

export type { LeadTravelStyle };
export { isInboxPendingLeadStatus } from '@/lib/lead-status';

export type CrmLeadRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone_wa: string;
  age: number | null;
  destinations: string[];
  travel_date: string | null;
  travel_days: number;
  travelers_count: number;
  budget: string | null;
  interests: string[];
  /** Canonical: 'Group' | 'Private' (legacy strings may appear until fully migrated) */
  travel_style: LeadTravelStyle | string | null;
  /** How the lead heard about us — not travel style */
  lead_source?: string | null;
  daily_pace: string | null;
  walking_readiness: string | null;
  day_start_time: string | null;
  food_preferences: string[];
  accommodation_type: string[];
  final_thoughts: string;
  form_type: string;
  /** Raw DB value — use `normalizeLeadStatus()` from `@/lib/lead-status` */
  status?: string | null;
  referral_code?: string | null;
  client_id?: number | null;
  interview_date?: string | null;
  interview_time?: string | null;
  /** Optional aliases used by some VIP / individual Cal.com writes */
  meeting_date?: string | null;
  meeting_time?: string | null;
  scheduled_at?: string | null;
  /** Direct registration link target (group_trips.id) */
  preferred_trip_id?: string | null;
  /** Promotional photography opt-in/out — set at group terms submit */
  media_consent?: boolean | null;
  created_at: string;
};

export type { CrmLeadWithIntake };

/** أعمدة `leads` الموجودة فعلياً — لا تُضمّن client_id (قد يكون غير موجود حتى clients_intake_pipeline.sql) */
const CRM_LEAD_SELECT_BASE =
  'id, full_name, email, phone_wa, age, destinations, travel_date, travel_days, travelers_count, budget, interests, travel_style, lead_source, daily_pace, walking_readiness, day_start_time, food_preferences, accommodation_type, final_thoughts, form_type, referral_code, created_at';
const CRM_LEAD_SELECT_BASE_NO_SOURCE =
  'id, full_name, email, phone_wa, age, destinations, travel_date, travel_days, travelers_count, budget, interests, travel_style, daily_pace, walking_readiness, day_start_time, food_preferences, accommodation_type, final_thoughts, form_type, referral_code, created_at';
/** يشمل `status` — قد يفشل الاستعلام إن كان العمود غير موجود (راجع fallback أدناه) */
const CRM_LEAD_SELECT = `${CRM_LEAD_SELECT_BASE}, status`;
const CRM_LEAD_SELECT_LEGACY = `${CRM_LEAD_SELECT_BASE_NO_SOURCE}, status`;
const CRM_LEAD_SELECT_WITH_INTERVIEW = `${CRM_LEAD_SELECT}, meeting_date, interview_date, interview_time, preferred_trip_id`;
const CRM_LEAD_SELECT_WITH_INTERVIEW_SLOT = `${CRM_LEAD_SELECT}, meeting_date, interview_date, interview_time`;
const CRM_LEAD_SELECT_WITH_INTERVIEW_DATE = `${CRM_LEAD_SELECT}, meeting_date, interview_date, preferred_trip_id`;
const CRM_LEAD_SELECT_WITH_INTERVIEW_DATE_ONLY = `${CRM_LEAD_SELECT}, meeting_date, interview_date`;
const CRM_LEAD_SELECT_WITH_MEETING_TS = `${CRM_LEAD_SELECT}, meeting_date`;
const CRM_LEAD_SELECT_WITH_PREFERRED = `${CRM_LEAD_SELECT}, preferred_trip_id`;

export function joinDestinations(destinations: string[] | null | undefined): string {
  if (!destinations?.length) return '—';
  return destinations.filter(Boolean).join(' · ');
}

export function formatTravelDateArabic(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  } catch {
    return iso;
  }
}

/** Parse preferred_trip_id from final_thoughts marker when column is missing. */
export function parsePreferredTripIdFromThoughts(
  finalThoughts: string | null | undefined,
): string | null {
  const text = String(finalThoughts ?? '');
  const match = text.match(/preferred_trip:([0-9a-f-]{36})/i);
  return match?.[1] ?? null;
}

/** UUID or numeric trip id embedded in onboarding notes. */
export function parsePreferredTripIdLoose(
  finalThoughts: string | null | undefined,
): string | null {
  const text = String(finalThoughts ?? '');
  const uuid = text.match(/preferred_trip:([0-9a-f-]{36})/i);
  if (uuid?.[1]) return uuid[1];
  const numeric = text.match(/preferred_trip:(\d+)/i);
  return numeric?.[1] ?? null;
}

/** group_trips.id is UUID — reject legacy numeric / garbage values like "1". */
export function isGroupTripUuid(raw: unknown): boolean {
  const s = String(raw ?? '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export function resolveLeadPreferredTripId(
  lead: Pick<CrmLeadRow, 'preferred_trip_id' | 'final_thoughts'>,
): string | null {
  const fromCol = String(lead.preferred_trip_id ?? '').trim();
  if (isGroupTripUuid(fromCol)) return fromCol;
  const fromNotes = parsePreferredTripIdFromThoughts(lead.final_thoughts);
  return fromNotes && isGroupTripUuid(fromNotes) ? fromNotes : null;
}

export type LeadBookedTripOption = { id: string; title_ar: string };

function normalizeTripMatchText(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Trip title the customer registered for — from destinations or onboarding notes. */
export function parseBookedTripLabelFromLead(
  lead: Pick<CrmLeadRow, 'destinations' | 'final_thoughts'>,
): string | null {
  for (const dest of lead.destinations ?? []) {
    const trimmed = String(dest ?? '').trim();
    if (trimmed && trimmed !== '—') return trimmed;
  }
  const text = String(lead.final_thoughts ?? '');
  const fromNotes = text.match(/طلب انضمام لرحلة جماعية\s*·\s*([^·]+)/);
  return fromNotes?.[1]?.trim() || null;
}

function tripTitlesMatch(a: string, b: string): boolean {
  const left = normalizeTripMatchText(a);
  const right = normalizeTripMatchText(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;
  return false;
}

/** Resolve the customer's booked group trip for CRM dropdowns (id first, then title match). */
export function resolveLeadBookedTripId(
  lead: Pick<CrmLeadRow, 'preferred_trip_id' | 'final_thoughts' | 'destinations'>,
  trips: LeadBookedTripOption[],
): string | null {
  if (!trips.length) return null;

  const idCandidates = new Set<string>();
  const preferred = resolveLeadPreferredTripId(lead);
  if (preferred) idCandidates.add(preferred);

  const fromCol = String(lead.preferred_trip_id ?? '').trim();
  if (fromCol) idCandidates.add(fromCol);

  const loose = parsePreferredTripIdLoose(lead.final_thoughts);
  if (loose) idCandidates.add(loose);

  for (const id of idCandidates) {
    const hit = trips.find((t) => String(t.id) === id);
    if (hit) return hit.id;
  }

  const bookedLabel = parseBookedTripLabelFromLead(lead);
  if (bookedLabel) {
    const byExactTitle = trips.find((t) => tripTitlesMatch(bookedLabel, t.title_ar));
    if (byExactTitle) return byExactTitle.id;
  }

  const hay = normalizeTripMatchText(
    `${joinDestinations(lead.destinations)} ${String(lead.final_thoughts ?? '')}`,
  );
  for (const trip of trips) {
    const title = normalizeTripMatchText(trip.title_ar);
    if (title.length >= 6 && hay.includes(title)) return trip.id;
  }

  return null;
}

/** Parse "مقابلة مجدولة: 2026-07-28 10:00 AM" notes written when interview columns are missing. */
export function parseInterviewFromFinalThoughts(
  finalThoughts: string | null | undefined,
): { interviewDate: string; interviewTime: string } | null {
  const text = String(finalThoughts ?? '').trim();
  if (!text) return null;

  const patterns = [
    /مقابلة مجدولة(?:\s*عبر\s*Cal\.com)?\s*[:—-]?\s*(\d{4}-\d{2}-\d{2})(?:\s+(.+))?/i,
    /interview\s*scheduled(?:\s*via\s*cal\.com)?\s*[:—-]?\s*(\d{4}-\d{2}-\d{2})(?:\s+(.+))?/i,
    /(?:meeting|موعد(?:\s*المقابلة)?)\s*[:—-]?\s*(\d{4}-\d{2}-\d{2})(?:[T\s]+(\d{1,2}:\d{2}(?:\s*[AP]M)?))?/i,
    /(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/,
  ];

  for (const re of patterns) {
    const match = text.match(re);
    if (!match?.[1]) continue;
    const interviewDate = match[1];
    let interviewTime = String(match[2] ?? '')
      .replace(/\s*[—-].*$/, '')
      .trim();
    if (interviewTime.toLowerCase().includes('cal.com')) {
      interviewTime = '';
    }
    // ISO time "16:00" → 4:00 PM
    if (/^\d{2}:\d{2}/.test(interviewTime) && !/[ap]m/i.test(interviewTime)) {
      const [hh, mm] = interviewTime.split(':');
      const h = Number(hh);
      if (Number.isFinite(h)) {
        const period = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        interviewTime = `${h12}:${String(mm ?? '00').slice(0, 2)} ${period}`;
      }
    }
    return { interviewDate, interviewTime };
  }
  return null;
}

/**
 * Resolve meeting slot from any known lead/client column aliases.
 * Groups typically use interview_date/time; individuals may use meeting_* / scheduled_at / notes.
 */
export function resolveLeadMeetingSlot(
  lead: Record<string, unknown> | Pick<
    CrmLeadRow,
    'interview_date' | 'interview_time' | 'final_thoughts' | 'travel_date'
  >,
): { interviewDate: string; interviewTime: string; display: string | null } {
  const row = lead as Record<string, unknown>;

  const pick = (...keys: string[]): string => {
    for (const key of keys) {
      const v = row[key];
      if (v == null) continue;
      const s = String(v).trim();
      if (s) return s;
    }
    return '';
  };

  // Prefer meeting_date (timestamptz from Cal.com webhook) over date-only interview_date
  let dateRaw = pick(
    'meeting_date',
    'scheduled_at',
    'interview_date',
    'individual_meeting_date',
    'group_meeting_date',
    'cal_date',
    'cal_booking_date',
    'meeting_at',
    'meeting_scheduled_at',
    'booking_start',
    'start_time',
  );

  let timeRaw = pick(
    'interview_time',
    'meeting_time',
    'individual_meeting_time',
    'group_meeting_time',
    'cal_time',
    'cal_booking_time',
    'scheduled_time',
  );

  // Full ISO in a single field
  if (/^\d{4}-\d{2}-\d{2}T/.test(dateRaw) || (!dateRaw && /^\d{4}-\d{2}-\d{2}T/.test(timeRaw))) {
    const iso = dateRaw || timeRaw;
    const parsed = parseInterviewSlotFromIso(iso);
    if (parsed) {
      return {
        interviewDate: parsed.interviewDate,
        interviewTime: parsed.interviewTime,
        display: parsed.display,
      };
    }
  }

  const thoughts = pick('final_thoughts', 'secret_notes', 'notes', 'admin_notes');
  const display = formatInterviewDateTimeDisplay(dateRaw, timeRaw, thoughts);
  if (display) {
    const fromNotes = parseInterviewFromFinalThoughts(thoughts);
    return {
      interviewDate: normalizeIsoDateOnly(dateRaw) || fromNotes?.interviewDate || '',
      interviewTime:
        timeRaw && timeRaw.toLowerCase() !== 'cal.com'
          ? timeRaw
          : fromNotes?.interviewTime || '',
      display,
    };
  }

  // Last resort: do NOT use travel_date (trip dates ≠ meeting). Stay empty.
  return { interviewDate: '', interviewTime: '', display: null };
}

/** CRM inbox — direct booking vs scheduled intro call. */
export function resolveLeadBookingChannelLabel(
  lead: Pick<CrmLeadRow, 'final_thoughts'> & Record<string, unknown>,
): { label: string; detail?: string } {
  const slot = resolveLeadMeetingSlot(lead);
  if (slot.display) {
    return { label: 'مكالمة مجدولة', detail: slot.display };
  }

  const thoughts = String(lead.final_thoughts ?? '');
  if (/مقابلة مجدولة/i.test(thoughts)) {
    const parsed = parseInterviewFromFinalThoughts(thoughts);
    if (parsed) {
      const display = formatInterviewDateTimeDisplay(
        parsed.interviewDate,
        parsed.interviewTime,
        thoughts,
      );
      return { label: 'مكالمة مجدولة', detail: display ?? undefined };
    }
    return { label: 'مكالمة مجدولة' };
  }

  if (
    /موافقة على (?:ميثاق السلوك|دليل الرحلة)|حجز مباشر|تأكيد الحجز المباشر/i.test(thoughts) &&
    !/مقابلة مجدولة/i.test(thoughts)
  ) {
    return { label: 'حجز مباشر', detail: 'بدون مكالمة تعارف' };
  }

  return { label: 'بانتظار الجدولة' };
}

function normalizeIsoDateOnly(raw: string): string {
  const s = String(raw ?? '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

/** Compact slot label for CRM cards — e.g. "15 Aug 2026 — 10:00 AM" */
export function formatInterviewDateTimeDisplay(
  interviewDate: string | null | undefined,
  interviewTime: string | null | undefined,
  finalThoughts?: string | null | undefined,
): string | null {
  let dateInput = String(interviewDate ?? '').trim();
  let timeInput = String(interviewTime ?? '').trim();

  // Full ISO stored in interview_date alone
  if (/^\d{4}-\d{2}-\d{2}T/.test(dateInput)) {
    const parsed = parseInterviewSlotFromIso(dateInput);
    if (parsed) {
      dateInput = parsed.interviewDate;
      if (!timeInput || timeInput.toLowerCase() === 'cal.com') {
        timeInput = parsed.interviewTime;
      }
    }
  }

  // Any Date-parseable value (timestamptz, locale strings, etc.)
  if (dateInput && !/^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
    const parsed = new Date(dateInput);
    if (!Number.isNaN(parsed.getTime())) {
      dateInput = [
        parsed.getFullYear(),
        String(parsed.getMonth() + 1).padStart(2, '0'),
        String(parsed.getDate()).padStart(2, '0'),
      ].join('-');
      if (!timeInput || timeInput.toLowerCase() === 'cal.com') {
        timeInput = new Intl.DateTimeFormat('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }).format(parsed);
      }
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}/.test(dateInput.slice(0, 10))) {
    const fromNotes = parseInterviewFromFinalThoughts(finalThoughts);
    if (fromNotes) {
      dateInput = fromNotes.interviewDate;
      if (!timeInput || timeInput.toLowerCase() === 'cal.com') {
        timeInput = fromNotes.interviewTime;
      }
    }
  }

  // Last resort: scrape any YYYY-MM-DD from final_thoughts / date field
  if (!/^\d{4}-\d{2}-\d{2}/.test(dateInput.slice(0, 10))) {
    const blob = `${dateInput} ${finalThoughts ?? ''}`;
    const anyDate = blob.match(/(\d{4}-\d{2}-\d{2})/);
    if (anyDate?.[1]) dateInput = anyDate[1];
  }

  // Time-only salvage from notes when date is known but time column is placeholder
  if ((!timeInput || timeInput.toLowerCase() === 'cal.com') && finalThoughts) {
    const fromNotes = parseInterviewFromFinalThoughts(finalThoughts);
    if (fromNotes?.interviewTime) timeInput = fromNotes.interviewTime;
  }

  const dateRaw = dateInput.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) return null;

  const timeRaw = timeInput;
  const hasRealTime = Boolean(timeRaw) && timeRaw.toLowerCase() !== 'cal.com';

  try {
    const dateObj = new Date(`${dateRaw}T12:00:00`);
    if (Number.isNaN(dateObj.getTime())) return dateRaw;

    const datePart = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(dateObj);

    if (!hasRealTime) return datePart;

    if (/^\d{4}-\d{2}-\d{2}T/.test(timeRaw)) {
      const timeObj = new Date(timeRaw);
      if (!Number.isNaN(timeObj.getTime())) {
        const timePart = new Intl.DateTimeFormat('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }).format(timeObj);
        return `${datePart} — ${timePart}`;
      }
    }

    return `${datePart} — ${timeRaw}`;
  } catch {
    return hasRealTime ? `${dateRaw} — ${timeRaw}` : dateRaw;
  }
}

/**
 * Format leads.meeting_date (timestamptz) for CRM cards.
 * e.g. "02 Aug 2026 — 10:00 AM" — no mock / placeholder values.
 */
export function formatMeetingDateLabel(meetingDate: string | null | undefined): string | null {
  const raw = String(meetingDate ?? '').trim();
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;

  try {
    const datePart = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Riyadh',
    }).format(d);
    const timePart = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Riyadh',
    }).format(d);
    return `${datePart} — ${timePart}`;
  } catch {
    return d.toISOString();
  }
}

/** Value for `<input type="datetime-local" />` from timestamptz (Riyadh wall clock). */
export function meetingDateToDatetimeLocal(meetingDate: string | null | undefined): string {
  const raw = String(meetingDate ?? '').trim();
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  const y = get('year');
  const m = get('month');
  const day = get('day');
  let h = get('hour');
  const min = get('minute');
  if (h === '24') h = '00';
  if (!y || !m || !day) return '';
  return `${y}-${m}-${day}T${h.padStart(2, '0')}:${min.padStart(2, '0')}`;
}

/** Resolve appointment instant from meeting_date / interview columns / notes. */
export function resolveLeadAppointmentDate(
  lead: Pick<
    CrmLeadRow,
    'meeting_date' | 'interview_date' | 'interview_time' | 'final_thoughts'
  > &
    Record<string, unknown>,
): Date | null {
  const meetingRaw = String(lead.meeting_date ?? '').trim();
  if (meetingRaw) {
    const d = new Date(meetingRaw);
    if (!Number.isNaN(d.getTime())) return d;
  }

  const slot = resolveLeadMeetingSlot(lead);
  if (slot.interviewDate) {
    const timeRaw = slot.interviewTime?.trim() || '23:59';
    let iso = `${slot.interviewDate}T${timeRaw}`;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(iso)) {
      const parsed = Date.parse(`${slot.interviewDate} ${timeRaw}`);
      if (!Number.isNaN(parsed)) return new Date(parsed);
    } else {
      const d = new Date(iso);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }

  return null;
}

/** True when a scheduled appointment datetime exists and is in the past. */
export function isLeadAppointmentExpired(
  lead: Pick<
    CrmLeadRow,
    'meeting_date' | 'interview_date' | 'interview_time' | 'final_thoughts' | 'status'
  > &
    Record<string, unknown>,
): boolean {
  const appt = resolveLeadAppointmentDate(lead);
  if (!appt) return false;
  return appt.getTime() < Date.now();
}

/** Parse datetime-local (treated as Asia/Riyadh) → ISO timestamptz for DB. */
export function datetimeLocalToMeetingIso(localValue: string): string | null {
  const v = String(localValue ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return null;
  // Append explicit +03:00 (Riyadh, no DST) so servers parse consistently
  const withSeconds = v.length === 16 ? `${v}:00` : v;
  const isoCandidate = `${withSeconds}+03:00`;
  const d = new Date(isoCandidate);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Parse Cal.com `startTime` ISO into DB columns + display string. */
export function parseInterviewSlotFromIso(startTime: string): {
  interviewDate: string;
  interviewTime: string;
  display: string;
} | null {
  const iso = String(startTime ?? '').trim();
  if (!iso) return null;

  const slot = new Date(iso);
  if (Number.isNaN(slot.getTime())) return null;

  const label = formatMeetingDateLabel(iso);
  if (!label) return null;

  const interviewDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(slot);

  const interviewTime = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Riyadh',
  }).format(slot);

  return { interviewDate, interviewTime, display: label };
}

export function formatRelativeTimeArabic(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';

  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return 'الآن';

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'الآن';
  if (minutes < 60) {
    if (minutes === 1) return 'منذ دقيقة';
    if (minutes === 2) return 'منذ دقيقتين';
    if (minutes <= 10) return `منذ ${minutes} دقائق`;
    return `منذ ${minutes} دقيقة`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    if (hours === 1) return 'منذ ساعة';
    if (hours === 2) return 'منذ ساعتين';
    if (hours <= 10) return `منذ ${hours} ساعات`;
    return `منذ ${hours} ساعة`;
  }

  const days = Math.floor(hours / 24);
  if (days === 1) return 'منذ يوم';
  if (days === 2) return 'منذ يومين';
  if (days <= 10) return `منذ ${days} أيام`;
  return `منذ ${days} يوم`;
}

export async function fetchNewCrmLeads(
  supabase: SupabaseClient,
  limit = 50,
): Promise<{ leads: CrmLeadWithIntake[]; warning?: string }> {
  // Radar gate: only pending approval — MUST match bell + dashboard pending
  const withStatus = await supabase
    .from('leads')
    .select(CRM_LEAD_SELECT)
    .or(RADAR_INBOX_STATUS_OR)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!withStatus.error) {
    const raw = (withStatus.data as CrmLeadRow[]) ?? [];
    const leads = await enrichLeadsWithIntake(supabase, raw);
    return { leads };
  }

  const msg = withStatus.error.message ?? '';

  // Retry inbox filter with the same status OR, but without optional select columns
  if (/client_id|column|schema cache|does not exist/i.test(msg) && !/status/i.test(msg)) {
    const retry = await supabase
      .from('leads')
      .select(
        'id, full_name, email, phone_wa, destinations, travel_date, travel_days, travelers_count, budget, interests, final_thoughts, form_type, referral_code, created_at, status',
      )
      .or(RADAR_INBOX_STATUS_OR)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (!retry.error) {
      const raw = (retry.data as CrmLeadRow[]) ?? [];
      const leads = await enrichLeadsWithIntake(supabase, raw);
      return { leads };
    }
  }

  // Status column missing — show latest leads without status filter
  if (/status|column|schema cache|does not exist|check/i.test(msg)) {
    const fallback = await supabase
      .from('leads')
      .select(CRM_LEAD_SELECT_BASE)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (fallback.error) {
      const minimal = await supabase
        .from('leads')
        .select(
          'id, full_name, email, phone_wa, destinations, travel_date, travel_days, travelers_count, budget, interests, final_thoughts, form_type, created_at',
        )
        .order('created_at', { ascending: false })
        .limit(limit);
      if (minimal.error) {
        throw new Error(minimal.error.message || 'تعذر تحميل الطلبات الجديدة.');
      }
      const raw = (minimal.data as CrmLeadRow[]) ?? [];
      const leads = await enrichLeadsWithIntake(supabase, raw);
      return {
        leads,
        warning:
          'بعض أعمدة leads غير متوفرة — يُعرض أحدث الطلبات. نفّذ supabase/sql/leads_kanban_status.sql.',
      };
    }
    const raw = (fallback.data as CrmLeadRow[]) ?? [];
    const leads = await enrichLeadsWithIntake(supabase, raw);
    return {
      leads,
      warning: 'عمود status غير متوفر — يُعرض أحدث الطلبات. نفّذ supabase/sql/leads_kanban_status.sql.',
    };
  }

  throw new Error(msg || 'تعذر تحميل الطلبات الجديدة.');
}

/** Marketing sign-ups — interest_only / interest (not in quote pipeline) */
export async function fetchInterestOnlyLeads(
  supabase: SupabaseClient,
  limit = 100,
): Promise<{ leads: CrmLeadRow[]; warning?: string }> {
  const withStatus = await supabase
    .from('leads')
    .select(CRM_LEAD_SELECT)
    .or(INTEREST_ONLY_STATUS_OR)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!withStatus.error) {
    return { leads: (withStatus.data as CrmLeadRow[]) ?? [] };
  }

  const msg = withStatus.error.message ?? '';
  console.warn('[fetchInterestOnlyLeads] status filter failed:', msg);

  if (/interest_only|interest|status|check constraint|column|schema cache|does not exist/i.test(msg)) {
    for (const status of INTEREST_ONLY_DB_VALUES) {
      const single = await supabase
        .from('leads')
        .select(CRM_LEAD_SELECT)
        .eq('status', status)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!single.error && (single.data?.length ?? 0) > 0) {
        return { leads: (single.data as CrmLeadRow[]) ?? [] };
      }
    }

    const fallback = await supabase
      .from('leads')
      .select(CRM_LEAD_SELECT)
      .ilike('final_thoughts', '%تسجيل اهتمام%')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!fallback.error) {
      const rows = ((fallback.data as CrmLeadRow[]) ?? []).filter(
        (row) => normalizeLeadStatus(row.status) !== 'converted' && row.status !== 'converted',
      );
      return {
        leads: rows,
        warning:
          'يُعرض حسب نص الطلب — نفّذ supabase/sql/leads_interest_only_status.sql لتفعيل status=interest_only.',
      };
    }
  }

  throw new Error(msg || 'تعذر تحميل قائمة الاهتمامات.');
}

/**
 * Explicit group-trip markers (seat / group DNA) — used to show group approve UI only.
 * Does NOT gate the interview inbox itself.
 */
export function isExplicitGroupTripLead(
  lead: Pick<
    CrmLeadRow,
    'form_type' | 'travel_style' | 'final_thoughts' | 'preferred_trip_id'
  > & {
    interests?: string[] | null;
  },
): boolean {
  if (isGroupTravelStyle(lead.travel_style)) return true;
  if (String(lead.form_type ?? '').trim() === 'group_trip') return true;
  if (resolveLeadPreferredTripId(lead)) return true;
  const thoughts = String(lead.final_thoughts ?? '');
  if (/رحلة جماعية|رحلة مجموعة|Group Trip Onboarding|preferred_trip:/i.test(thoughts)) {
    return true;
  }
  const interests = Array.isArray(lead.interests) ? lead.interests : [];
  if (
    interests.some((item) =>
      /رحلة جماعية|رحلة مجموعة|group(\s+trip)?/i.test(String(item ?? '')),
    )
  ) {
    return true;
  }
  return false;
}

/** Pending funnel statuses for group-join notification badge (inbox only). */
export const GROUP_ONBOARDING_PENDING_STATUSES = [...RADAR_INBOX_DB_VALUES] as const;

/**
 * PostgREST OR — any durable group-onboarding marker on `leads`
 * (form_type alone is too narrow: inserts often fall back to contact).
 */
export const GROUP_ONBOARDING_LEAD_MARKER_OR = [
  'form_type.eq.group_trip',
  'travel_style.eq.Group',
  'travel_style.ilike.Group%',
  'preferred_trip_id.not.is.null',
  'final_thoughts.ilike.%رحلة جماعية%',
  'final_thoughts.ilike.%رحلة مجموعة%',
  'final_thoughts.ilike.%preferred_trip:%',
  'final_thoughts.ilike.%Group Trip%',
].join(',');

/** Interview / meeting pipeline stage — individual VIP and group share this stage. */
export function isInterviewStageLead(
  lead: Pick<CrmLeadRow, 'status'>,
): boolean {
  const raw = String(lead.status ?? '').trim().toLowerCase();
  if (raw === 'approved') return true;

  const normalized = normalizeLeadStatus(lead.status);
  if (normalized === 'converted' || normalized === 'postponed' || normalized === 'radar_rejected') {
    return false;
  }
  return (
    normalized === 'interview_scheduled' ||
    normalized === 'meeting' ||
    String(lead.status ?? '').trim() === INTERVIEW_SCHEDULED_STATUS
  );
}

/** @deprecated Use isInterviewStageLead — kept for call-site compatibility */
export function isGroupOnboardingLead(
  lead: Pick<
    CrmLeadRow,
    'form_type' | 'status' | 'travel_style' | 'final_thoughts' | 'preferred_trip_id'
  >,
): boolean {
  return isInterviewStageLead(lead) || isExplicitGroupTripLead(lead);
}

/**
 * Interview inbox — approved + scheduled appointments only (not pending inbox).
 * Returns `error` on hard failure; empty `leads: []` only when the query succeeds with no rows.
 */
export async function fetchGroupOnboardingLeads(
  supabase: SupabaseClient,
  limit = 50,
): Promise<{ leads: CrmLeadRow[]; error?: string }> {
  const INTERVIEW_STATUSES = [...INTERVIEW_APPOINTMENT_DB_STATUSES] as const;

  try {
    const selectAttempts = [
      '*',
      CRM_LEAD_SELECT_WITH_INTERVIEW,
      CRM_LEAD_SELECT_WITH_INTERVIEW_SLOT,
      CRM_LEAD_SELECT_WITH_INTERVIEW_DATE,
      CRM_LEAD_SELECT_WITH_INTERVIEW_DATE_ONLY,
      CRM_LEAD_SELECT_WITH_MEETING_TS,
      CRM_LEAD_SELECT_WITH_PREFERRED,
      CRM_LEAD_SELECT,
      CRM_LEAD_SELECT_LEGACY,
      CRM_LEAD_SELECT_BASE,
      CRM_LEAD_SELECT_BASE_NO_SOURCE,
    ];

    for (const select of selectAttempts) {
      const byStatus = await supabase
        .from('leads')
        .select(select)
        .in('status', [...INTERVIEW_STATUSES])
        .order('created_at', { ascending: false })
        .limit(limit);

      if (byStatus.error) {
        console.error('Fetch Interview Leads Error:', byStatus.error);
        const msg = byStatus.error.message ?? '';

        if (/interview_|preferred_trip|column|schema cache|does not exist/i.test(msg)) {
          continue;
        }

        // status / check variance — try each status separately
        if (/status|check|constraint/i.test(msg)) {
          const chunks: CrmLeadRow[] = [];
          for (const status of INTERVIEW_STATUSES) {
            const single = await supabase
              .from('leads')
              .select(select)
              .eq('status', status)
              .order('created_at', { ascending: false })
              .limit(limit);
            if (single.error) {
              if (/interview_|preferred_trip|column|schema cache|does not exist/i.test(single.error.message ?? '')) {
                break;
              }
              continue;
            }
            chunks.push(...((single.data as unknown as CrmLeadRow[]) ?? []));
          }
          const seen = new Set<string>();
          const leads = chunks
            .filter((row) => {
              const id = String(row.id ?? '').trim();
              if (!id || seen.has(id)) return false;
              if (!isInterviewStageLead(row)) return false;
              seen.add(id);
              return true;
            })
            .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
            .slice(0, limit);
          return { leads };
        }

        return { leads: [], error: msg || 'تعذر تحميل طلبات المقابلات.' };
      }

      const seen = new Set<string>();
      const leads: CrmLeadRow[] = [];
      for (const row of (byStatus.data as unknown as CrmLeadRow[]) ?? []) {
        const id = String(row.id ?? '').trim();
        if (!id || seen.has(id)) continue;
        if (!isInterviewStageLead(row)) continue;
        seen.add(id);
        leads.push(row);
      }

      leads.sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
      return { leads: leads.slice(0, limit) };
    }

    return {
      leads: [],
      error: 'تعذر تحميل طلبات المقابلات (فشل كل محاولات الاستعلام).',
    };
  } catch (err) {
    console.error('Fetch Interview Leads Error:', err);
    return {
      leads: [],
      error: err instanceof Error ? err.message : 'تعذر تحميل طلبات المقابلات.',
    };
  }
}

/** Exact same filter as «صندوق الوارد» — for bell badge / dashboard counts */
export async function countNewCrmLeads(supabase: SupabaseClient): Promise<number> {
  const result = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .or(RADAR_INBOX_STATUS_OR);
  if (result.error) {
    console.warn('[countNewCrmLeads]', result.error.message);
    return 0;
  }
  return result.count ?? 0;
}

/**
 * Pending group-join attention count for the notification bell.
 * Matches group markers on leads (not only form_type) + pending group_members seats.
 */
export async function countGroupOnboardingLeads(
  supabase: SupabaseClient,
): Promise<number> {
  let leadCount = 0;

  const byMarkers = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .or(GROUP_ONBOARDING_LEAD_MARKER_OR)
    .in('status', [...GROUP_ONBOARDING_PENDING_STATUSES]);

  if (!byMarkers.error) {
    leadCount = byMarkers.count ?? 0;
  } else {
    const msg = byMarkers.error.message ?? '';
    console.warn('[countGroupOnboardingLeads] marker query:', msg);

    // Narrower fallbacks when OR / columns are unavailable
    const byFormType = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('form_type', 'group_trip')
      .in('status', [...GROUP_ONBOARDING_PENDING_STATUSES]);

    if (!byFormType.error) {
      leadCount = byFormType.count ?? 0;
    } else if (/form_type|column|schema cache|does not exist|status|check/i.test(msg)) {
      const byTravelStyle = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('travel_style', 'Group')
        .in('status', [...GROUP_ONBOARDING_PENDING_STATUSES]);
      if (!byTravelStyle.error) {
        leadCount = byTravelStyle.count ?? 0;
      }
    }
  }

  // Pending seats on the Group Operations board
  let memberCount = 0;
  try {
    const { countPendingGroupOperationsMembers } = await import('@/lib/group-operations-radar');
    memberCount = await countPendingGroupOperationsMembers(supabase);
  } catch (err) {
    console.warn('[countGroupOnboardingLeads] members:', err);
  }

  return leadCount + memberCount;
}

/** Lightweight inbox rows for Dashboard «طلبات بانتظار الإجراء» */
export async function fetchNewCrmLeadSummaries(
  supabase: SupabaseClient,
  limit = 6,
): Promise<
  Array<{
    id: string;
    name: string;
    destination: string;
    status: string;
    createdAt: string;
  }>
> {
  const { data, error } = await supabase
    .from('leads')
    .select('id, full_name, destinations, status, created_at')
    .or(RADAR_INBOX_STATUS_OR)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message || 'تعذر تحميل طلبات العملاء الجديدة.');
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.full_name ?? '').trim() || 'عميل بدون اسم',
    destination: joinDestinations(
      Array.isArray(row.destinations) ? (row.destinations as string[]) : [],
    ) || 'لم تُحدد الوجهة',
    status: String(row.status ?? ''),
    createdAt: String(row.created_at ?? ''),
  }));
}

export type CrmKanbanLead = CrmLeadWithIntake & {
  kanbanStatus: LeadKanbanColumnId;
  expertName: string | null;
  expertInitials: string | null;
  /** True when at least one `itineraries` row exists for this lead's client_id */
  hasLinkedItinerary: boolean;
  linkedItineraryCount: number;
  /** Latest itinerary id for «فتح المسار» shortcut */
  linkedItineraryId: string | null;
};

async function enrichLeadsWithExperts(
  supabase: SupabaseClient,
  leads: CrmLeadWithIntake[],
): Promise<CrmKanbanLead[]> {
  const clientIds = Array.from(
    new Set(
      leads
        .map((l) => l.client_id)
        .filter((id): id is number => id != null && Number.isFinite(Number(id))),
    ),
  );

  const expertByClient = new Map<number, { name: string }>();
  const itineraryCountByClient = new Map<number, number>();
  const itineraryIdByClient = new Map<number, string>();

  if (clientIds.length) {
    const { data: itineraryRows } = await supabase
      .from('itineraries')
      .select('id, client_id, expert_id, updated_at')
      .in('client_id', clientIds)
      .order('updated_at', { ascending: false })
      .limit(500);

    for (const row of itineraryRows ?? []) {
      const clientId = Number((row as { client_id?: unknown }).client_id);
      if (!Number.isFinite(clientId)) continue;
      itineraryCountByClient.set(clientId, (itineraryCountByClient.get(clientId) ?? 0) + 1);
      if (!itineraryIdByClient.has(clientId) && (row as { id?: unknown }).id != null) {
        itineraryIdByClient.set(clientId, String((row as { id: unknown }).id));
      }
    }

    const expertIds = Array.from(
      new Set(
        (itineraryRows ?? [])
          .map((row) => String((row as { expert_id?: unknown }).expert_id ?? '').trim())
          .filter(Boolean),
      ),
    );

    const expertNameById = new Map<string, string>();
    if (expertIds.length) {
      const { data: experts } = await supabase
        .from('experts')
        .select('id, name')
        .in('id', expertIds);
      for (const row of experts ?? []) {
        const id = String((row as { id?: unknown }).id ?? '').trim();
        const name = String((row as { name?: unknown }).name ?? '').trim();
        if (id && name) expertNameById.set(id, name);
      }
    }

    for (const row of itineraryRows ?? []) {
      const clientId = Number((row as { client_id?: unknown }).client_id);
      if (!Number.isFinite(clientId) || expertByClient.has(clientId)) continue;
      const expertId = String((row as { expert_id?: unknown }).expert_id ?? '').trim();
      const name = expertNameById.get(expertId);
      if (name) expertByClient.set(clientId, { name });
    }
  }

  return leads
    .map((lead) => {
      const clientKey =
        lead.client_id != null && Number.isFinite(Number(lead.client_id))
          ? Number(lead.client_id)
          : null;
      const expert = clientKey != null ? expertByClient.get(clientKey) : undefined;
      const expertName = expert?.name ?? null;
      const expertInitials = expertName
        ? expertName
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((p) => p[0] ?? '')
            .join('')
            .toUpperCase() || null
        : null;

      const kanbanStatus = normalizeLeadKanbanStatus(lead.status);
      if (!kanbanStatus) return null;

      const linkedItineraryCount =
        clientKey != null ? (itineraryCountByClient.get(clientKey) ?? 0) : 0;
      const linkedItineraryId =
        clientKey != null ? (itineraryIdByClient.get(clientKey) ?? null) : null;

      return {
        ...lead,
        kanbanStatus,
        expertName,
        expertInitials,
        hasLinkedItinerary: linkedItineraryCount > 0,
        linkedItineraryCount,
        linkedItineraryId,
      };
    })
    .filter((row): row is CrmKanbanLead => row != null);
}

/** طلبات مرحلة العروض / المسارات — لمزامنة صفحات Quotes & Itineraries */
export async function fetchPipelineLeadsByStatuses(
  supabase: SupabaseClient,
  statuses: readonly string[],
  limit = 100,
): Promise<CrmLeadWithIntake[]> {
  if (!statuses.length) return [];
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .in('status', [...statuses])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[fetchPipelineLeadsByStatuses]', error.message);
    return [];
  }
  return enrichLeadsWithIntake(supabase, (data as CrmLeadRow[]) ?? []);
}

/** كل طلبات الكانبان (بعد بوابة الرادار) */
export async function fetchKanbanCrmLeads(
  supabase: SupabaseClient,
  limit = 200,
): Promise<{ leads: CrmKanbanLead[]; warning?: string }> {
  const withStatus = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (withStatus.error) {
    const msg = withStatus.error.message ?? '';
    throw new Error(msg || 'تعذر تحميل لوحة الطلبات.');
  }

  const raw = (withStatus.data as CrmLeadRow[]) ?? [];
  // Heal stale awaiting_dna / meeting cards when quotes or paid invoices already exist
  const reconciled = await reconcileLeadStatusesFromQuotesAndInvoices(supabase, raw);
  const withIntake = await enrichLeadsWithIntake(supabase, reconciled);
  const leads = await enrichLeadsWithExperts(supabase, withIntake);

  const hasStatusColumn = raw.some((row) => 'status' in row);
  const healedCount = reconciled.filter((row, i) => {
    const before = normalizeLeadStatus(raw[i]?.status);
    const after = normalizeLeadStatus(row.status);
    return before !== after;
  }).length;

  return {
    leads,
    warning: !hasStatusColumn
      ? 'عمود status غير متوفر — نفّذ supabase/sql/leads_kanban_status.sql.'
      : healedCount > 0
        ? `تمت مزامنة ${healedCount} بطاقة مع حالة العروض/الفواتير الفعلية.`
        : undefined,
  };
}

export async function updateLeadKanbanStatus(
  supabase: SupabaseClient,
  leadId: string,
  columnId: LeadKanbanColumnId,
): Promise<{ itineraryId?: string }> {
  const status = LEAD_KANBAN_DB_STATUS[columnId];
  let { error } = await supabase.from('leads').update({ status }).eq('id', leadId);

  // Schema without payment_confirmed yet — fall back to preparing_itinerary
  if (
    error &&
    status === 'payment_confirmed' &&
    /payment_confirmed|check|constraint|status/i.test(error.message ?? '')
  ) {
    const retry = await supabase
      .from('leads')
      .update({ status: 'preparing_itinerary' })
      .eq('id', leadId);
    error = retry.error;
  }

  // pending_payment alias if awaiting_payment blocked somehow
  if (
    error &&
    status === 'awaiting_payment' &&
    /awaiting_payment|check|constraint|status/i.test(error.message ?? '')
  ) {
    const retry = await supabase
      .from('leads')
      .update({ status: 'pending_payment' })
      .eq('id', leadId);
    error = retry.error;
  }

  if (error) {
    throw new Error(error.message || 'تعذر تحديث حالة الطلب.');
  }

  return {};
}

/** Explicit Kanban handoff — always deep-fetches via service_role server action */
export async function createItineraryForKanbanLead(
  _supabase: SupabaseClient,
  leadId: string,
  clientId?: string | number | null,
): Promise<string> {
  const { ensureKanbanItineraryAction } = await import(
    '@/app/actions/kanbanItineraryActions'
  );
  const result = await ensureKanbanItineraryAction({
    leadId,
    clientId: clientId ?? null,
  });
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.itineraryId;
}
