/**
 * Kanban board presentation — built on `@/lib/lead-status` SSOT.
 */

import { LEAD_STATUS_LABEL_AR, normalizeLeadStatus, type LeadStatus } from '@/lib/lead-status';

export type { LeadStatus, MasterLeadStatus } from '@/lib/lead-status';
export {
  ITINERARY_PIPELINE_STATUSES,
  QUOTE_PIPELINE_STATUSES,
  RADAR_INBOX_STATUSES,
  RADAR_INBOX_DB_VALUES,
  RADAR_INBOX_STATUS_OR,
  LEAD_STATUSES,
  LEAD_STATUS_LABEL_AR,
  KANBAN_VISIBLE_STATUSES,
  CLIENT_DATABASE_LEAD_STATUSES,
  normalizeLeadStatus,
  normalizeMasterLeadStatus,
  isLeadStatus,
  isMasterLeadStatus,
  leadStatusPipelineIndex,
  masterPipelineIndex,
  MASTER_LEAD_STATUSES,
  isKanbanVisibleStatus,
} from '@/lib/lead-status';

/** Kanban columns — 5-stage sales pipeline (Radar gate statuses are not shown here) */
export const LEAD_KANBAN_COLUMNS = [
  { id: 'awaiting_dna' as const, label: LEAD_STATUS_LABEL_AR.awaiting_dna, tone: 'teal' },
  { id: 'meeting' as const, label: LEAD_STATUS_LABEL_AR.meeting, tone: 'sky' },
  { id: 'quote_stage' as const, label: LEAD_STATUS_LABEL_AR.quote_stage, tone: 'amber' },
  {
    id: 'awaiting_payment' as const,
    label: LEAD_STATUS_LABEL_AR.awaiting_payment,
    tone: 'orange',
  },
  {
    id: 'payment_confirmed' as const,
    label: 'تم الدفع / المسارات',
    tone: 'emerald',
  },
] as const;

export type LeadKanbanColumnId = (typeof LEAD_KANBAN_COLUMNS)[number]['id'];

/** DB value written when dropping on a Kanban column */
export const LEAD_KANBAN_DB_STATUS: Record<LeadKanbanColumnId, LeadStatus> = {
  awaiting_dna: 'awaiting_dna',
  meeting: 'meeting',
  quote_stage: 'quote_stage',
  /** User-facing alias pending_payment → canonical awaiting_payment */
  awaiting_payment: 'awaiting_payment',
  payment_confirmed: 'payment_confirmed',
};

/** Map DB status → Kanban column (null = radar gate / rejected / postponed) */
export function normalizeLeadKanbanStatus(raw: unknown): LeadKanbanColumnId | null {
  const master = normalizeLeadStatus(raw);
  if (master === 'interview_scheduled') return 'meeting';
  if (
    master === 'radar_pending' ||
    master === 'radar_rejected' ||
    master === 'postponed' ||
    master === 'interest_only' ||
    master === 'converted'
  ) {
    return null;
  }
  if (LEAD_KANBAN_COLUMNS.some((c) => c.id === master)) {
    return master as LeadKanbanColumnId;
  }
  // Legacy route stages collapse into payment_confirmed column
  if (master === 'preparing_itinerary' || master === 'delivered') {
    return 'payment_confirmed';
  }
  return null;
}

export function isLeadKanbanColumnId(value: string): value is LeadKanbanColumnId {
  return LEAD_KANBAN_COLUMNS.some((col) => col.id === value);
}

/**
 * Dual-theme column accents — light pastel strip + dark olive/gold readable headers.
 * Never leaves light-only backgrounds in dark mode (invisible white text bug).
 */
export function leadKanbanColumnToneClass(tone: string): {
  header: string;
  badge: string;
  drop: string;
  accentDot: string;
} {
  const baseHeader =
    'border-slate-200 bg-white/80 dark:border-[#2D3F3A] dark:bg-[#22302C]';
  const baseBadge =
    'bg-slate-200 text-slate-700 dark:bg-[#1A2421] dark:text-[#D4AF37] border border-slate-300 dark:border-[#2D3F3A]';

  switch (tone) {
    case 'amber':
      return {
        header: `${baseHeader} border-s-4 border-s-amber-400 dark:border-s-[#D4AF37]`,
        badge: baseBadge,
        drop: 'ring-amber-300/60 dark:ring-[#D4AF37]/35',
        accentDot: 'bg-amber-400 dark:bg-[#D4AF37]',
      };
    case 'teal':
      return {
        header: `${baseHeader} border-s-4 border-s-teal-500 dark:border-s-teal-400`,
        badge: baseBadge,
        drop: 'ring-teal-300/60 dark:ring-teal-500/35',
        accentDot: 'bg-teal-500 dark:bg-teal-400',
      };
    case 'sky':
      return {
        header: `${baseHeader} border-s-4 border-s-sky-500 dark:border-s-sky-400`,
        badge: baseBadge,
        drop: 'ring-sky-300/60 dark:ring-sky-500/35',
        accentDot: 'bg-sky-500 dark:bg-sky-400',
      };
    case 'orange':
      return {
        header: `${baseHeader} border-s-4 border-s-orange-400 dark:border-s-orange-400`,
        badge: baseBadge,
        drop: 'ring-orange-300/60 dark:ring-orange-400/35',
        accentDot: 'bg-orange-400',
      };
    case 'violet':
      return {
        header: `${baseHeader} border-s-4 border-s-violet-400 dark:border-s-violet-400`,
        badge: baseBadge,
        drop: 'ring-violet-300/60 dark:ring-violet-400/35',
        accentDot: 'bg-violet-400',
      };
    case 'emerald':
      return {
        header: `${baseHeader} border-s-4 border-s-emerald-500 dark:border-s-emerald-400`,
        badge: baseBadge,
        drop: 'ring-emerald-300/60 dark:ring-emerald-400/35',
        accentDot: 'bg-emerald-500 dark:bg-emerald-400',
      };
    default:
      return {
        header: baseHeader,
        badge: baseBadge,
        drop: 'ring-slate-300/60 dark:ring-[#D4AF37]/30',
        accentDot: 'bg-slate-400 dark:bg-[#D4AF37]',
      };
  }
}

export function initialsFromName(name: string): string {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase();
}
