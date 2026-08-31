/**
 * Single Source of Truth — `leads.status` master pipeline.
 *
 * Maps 1:1 to Radar / Kanban / Quotes / Itineraries.
 * Legacy DB values (planning, approved, converted, processing, …)
 * are normalized via `normalizeLeadStatus`.
 */

export const LEAD_STATUSES = [
  'radar_pending',
  'radar_rejected',
  'interest_only',
  'converted',
  'awaiting_dna',
  'meeting',
  'interview_scheduled',
  'quote_stage',
  'awaiting_payment',
  'payment_confirmed',
  'preparing_itinerary',
  'delivered',
  'postponed',
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** @deprecated Use LeadStatus — alias kept for older imports */
export type MasterLeadStatus = LeadStatus;

/** Arabic labels for CRM UI */
export const LEAD_STATUS_LABEL_AR: Record<LeadStatus, string> = {
  radar_pending: 'طلب جديد (الرادار)',
  radar_rejected: 'مرفوض',
  interest_only: 'تسجيل اهتمام فقط',
  converted: 'محوَّل لقاعدة العملاء',
  awaiting_dna: 'بانتظار DNA',
  meeting: 'اجتماع العميل',
  interview_scheduled: 'مقابلة مجدولة',
  quote_stage: 'عروض الأسعار',
  awaiting_payment: 'بانتظار الدفع',
  payment_confirmed: 'تم الدفع / المسارات',
  preparing_itinerary: 'تجهيز المسار',
  delivered: 'تم التسليم',
  postponed: 'مؤجّل / مؤرشف',
};

/** Forward-only order (excludes rejected + postponed) */
export const LEAD_STATUS_PIPELINE_ORDER: Exclude<
  LeadStatus,
  'radar_rejected' | 'postponed'
>[] = [
  'radar_pending',
  'awaiting_dna',
  'meeting',
  'quote_stage',
  'awaiting_payment',
  'payment_confirmed',
  'preparing_itinerary',
  'delivered',
];

/** Statuses that belong in قاعدة العملاء (past radar gate) */
export const CLIENT_DATABASE_LEAD_STATUSES: LeadStatus[] = [
  'awaiting_dna',
  'meeting',
  'quote_stage',
  'awaiting_payment',
  'payment_confirmed',
  'preparing_itinerary',
  'delivered',
  'postponed',
];

/** DB values written for marketing sign-ups (Radar «قائمة الاهتمامات») */
export const INTEREST_ONLY_DB_VALUES = ['interest_only', 'interest', 'register_interest'] as const;

export const INTEREST_ONLY_STATUS_OR = `status.in.(${INTEREST_ONLY_DB_VALUES.join(',')})`;

/** Lightweight marketing sign-ups — separate from quote pipeline */
export const INTEREST_ONLY_STATUS = 'interest_only' as const satisfies LeadStatus;

export const INTEREST_ONLY_STATUSES: LeadStatus[] = [INTEREST_ONLY_STATUS];

/** Group onboarding — intro call booked */
export const INTERVIEW_SCHEDULED_STATUS = 'interview_scheduled' as const satisfies LeadStatus;

/** Post-inbox approval + scheduled interviews (مواعيد المقابلات القادمة). */
export const INTERVIEW_APPOINTMENT_DB_STATUSES = [
  'approved',
  'meeting',
  'interview_scheduled',
] as const;

export const GROUP_ONBOARDING_STATUSES: LeadStatus[] = [
  'awaiting_dna',
  'meeting',
  INTERVIEW_SCHEDULED_STATUS,
];

/** Radar inbox */
export const RADAR_INBOX_STATUSES: LeadStatus[] = ['radar_pending'];

/**
 * Legacy + current values that mean “still in radar inbox”.
 * Must stay in sync with Radar «صندوق الوارد» (`fetchNewCrmLeads`).
 * Includes legacy `pending` (common default before radar_pending rename).
 */
export const RADAR_INBOX_DB_VALUES = [
  'radar_pending',
  'new',
  'new_request',
  'pending_approval',
  'pending',
] as const;

/** True when a lead belongs in صندوق الوارد (not yet admin-approved). */
export function isInboxPendingLeadStatus(raw: unknown): boolean {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return true;
  return (RADAR_INBOX_DB_VALUES as readonly string[]).includes(s);
}

/**
 * PostgREST filter matching Radar inbox: known inbox statuses OR null status.
 * Use with `.or(RADAR_INBOX_STATUS_OR)` on `leads`.
 */
export const RADAR_INBOX_STATUS_OR = [
  `status.in.(${RADAR_INBOX_DB_VALUES.join(',')})`,
  'status.is.null',
].join(',');

/** Quotes page work queue */
export const QUOTE_PIPELINE_STATUSES: LeadStatus[] = ['quote_stage', 'awaiting_payment'];

/** Itineraries page work queue */
export const ITINERARY_PIPELINE_STATUSES: LeadStatus[] = [
  'payment_confirmed',
  'preparing_itinerary',
  'delivered',
];

/** Kanban board columns (Radar gate statuses excluded) */
export const KANBAN_VISIBLE_STATUSES: LeadStatus[] = [
  'awaiting_dna',
  'meeting',
  'quote_stage',
  'awaiting_payment',
  'payment_confirmed',
];

/**
 * Map any raw `leads.status` (including legacy screenshot values) → LeadStatus.
 *
 * Legacy examples from Supabase:
 * - new / pending_approval → radar_pending
 * - dna_sent → awaiting_dna
 * - planning / approved / processing → quote_stage
 * - converted / active → preparing_itinerary
 * - completed / done → delivered
 */
export function normalizeLeadStatus(raw: unknown): LeadStatus {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();

  if (!s || s === 'new' || s === 'new_request' || s === 'pending_approval' || s === 'radar_pending' || s === 'pending') {
    return 'radar_pending';
  }

  if (s === 'radar_rejected' || s === 'rejected' || s === 'dead') {
    return 'radar_rejected';
  }

  if (s === 'interest_only' || s === 'interest' || s === 'register_interest') {
    return 'interest_only';
  }

  if (s === 'converted' || s === 'interest_converted') {
    return 'converted';
  }

  if (s === 'postponed' || s === 'archived_lead' || s === 'on_hold' || s === 'paused') {
    return 'postponed';
  }

  if (s === 'awaiting_dna' || s === 'dna_sent' || s === 'dna_pending') {
    return 'awaiting_dna';
  }

  if (s === 'meeting' || s === 'client_meeting') {
    return 'meeting';
  }

  if (s === 'interview_scheduled') {
    return 'interview_scheduled';
  }

  /** Group inbox approval — interview queue (not quote pipeline). */
  if (s === 'approved') {
    return 'meeting';
  }

  if (
    s === 'quote_stage' ||
    s === 'planning' ||
    s === 'in_progress' ||
    s === 'processing' ||
    s === 'processing_quote' ||
    s === 'approved'
  ) {
    return 'quote_stage';
  }

  if (s === 'awaiting_payment' || s === 'pending_payment') {
    return 'awaiting_payment';
  }

  if (
    s === 'payment_confirmed' ||
    s === 'preparing_itinerary' ||
    s === 'active' ||
    s === 'confirmed' ||
    s === 'deposit_paid' ||
    s === 'fully_paid'
  ) {
    // Paid / route stage — prefer payment_confirmed for Kanban SSOT
    if (s === 'preparing_itinerary' || s === 'active' || s === 'confirmed') {
      return 'payment_confirmed';
    }
    return 'payment_confirmed';
  }

  if (s === 'delivered' || s === 'completed' || s === 'done' || s === 'archived') {
    return 'payment_confirmed';
  }

  return 'radar_pending';
}

/** @deprecated Use normalizeLeadStatus */
export function normalizeMasterLeadStatus(raw: unknown): LeadStatus | null {
  return normalizeLeadStatus(raw);
}

export function isLeadStatus(value: string): value is LeadStatus {
  return (LEAD_STATUSES as readonly string[]).includes(value);
}

/** @deprecated Use isLeadStatus */
export const isMasterLeadStatus = isLeadStatus;

export function leadStatusPipelineIndex(status: unknown): number {
  const normalized = normalizeLeadStatus(status);
  if (normalized === 'radar_rejected' || normalized === 'postponed' || normalized === 'interest_only' || normalized === 'converted') {
    return -1;
  }
  if (normalized === 'interview_scheduled') {
    return LEAD_STATUS_PIPELINE_ORDER.indexOf('meeting');
  }
  return LEAD_STATUS_PIPELINE_ORDER.indexOf(normalized);
}

/** @deprecated Use leadStatusPipelineIndex */
export const masterPipelineIndex = leadStatusPipelineIndex;

/** Whether this status should appear on the Kanban board */
export function isKanbanVisibleStatus(raw: unknown): boolean {
  const s = normalizeLeadStatus(raw);
  return (KANBAN_VISIBLE_STATUSES as readonly string[]).includes(s);
}

/** @deprecated Prefer LEAD_STATUSES */
export const MASTER_LEAD_STATUSES = LEAD_STATUSES;
