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

/** Kanban columns (Radar gate statuses are not shown here) */
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
    id: 'preparing_itinerary' as const,
    label: LEAD_STATUS_LABEL_AR.preparing_itinerary,
    tone: 'violet',
  },
  { id: 'delivered' as const, label: LEAD_STATUS_LABEL_AR.delivered, tone: 'emerald' },
] as const;

export type LeadKanbanColumnId = (typeof LEAD_KANBAN_COLUMNS)[number]['id'];

/** DB value written when dropping on a Kanban column */
export const LEAD_KANBAN_DB_STATUS: Record<LeadKanbanColumnId, LeadStatus> = {
  awaiting_dna: 'awaiting_dna',
  meeting: 'meeting',
  quote_stage: 'quote_stage',
  awaiting_payment: 'awaiting_payment',
  preparing_itinerary: 'preparing_itinerary',
  delivered: 'delivered',
};

/** Map DB status → Kanban column (null = radar gate / rejected / postponed) */
export function normalizeLeadKanbanStatus(raw: unknown): LeadKanbanColumnId | null {
  const master = normalizeLeadStatus(raw);
  if (
    master === 'radar_pending' ||
    master === 'radar_rejected' ||
    master === 'postponed'
  ) {
    return null;
  }
  if (LEAD_KANBAN_COLUMNS.some((c) => c.id === master)) {
    return master as LeadKanbanColumnId;
  }
  return null;
}

export function isLeadKanbanColumnId(value: string): value is LeadKanbanColumnId {
  return LEAD_KANBAN_COLUMNS.some((col) => col.id === value);
}

export function leadKanbanColumnToneClass(tone: string): {
  header: string;
  badge: string;
  drop: string;
} {
  switch (tone) {
    case 'amber':
      return {
        header: 'border-amber-200/80 bg-amber-50/90',
        badge: 'bg-amber-100 text-amber-900',
        drop: 'ring-amber-300/60',
      };
    case 'teal':
      return {
        header: 'border-teal-200/80 bg-teal-50/90',
        badge: 'bg-teal-100 text-teal-900',
        drop: 'ring-teal-300/60',
      };
    case 'sky':
      return {
        header: 'border-sky-200/80 bg-sky-50/90',
        badge: 'bg-sky-100 text-sky-900',
        drop: 'ring-sky-300/60',
      };
    case 'orange':
      return {
        header: 'border-orange-200/80 bg-orange-50/90',
        badge: 'bg-orange-100 text-orange-950',
        drop: 'ring-orange-300/60',
      };
    case 'violet':
      return {
        header: 'border-violet-200/80 bg-violet-50/90',
        badge: 'bg-violet-100 text-violet-900',
        drop: 'ring-violet-300/60',
      };
    case 'emerald':
      return {
        header: 'border-emerald-200/80 bg-emerald-50/90',
        badge: 'bg-emerald-100 text-emerald-900',
        drop: 'ring-emerald-300/60',
      };
    default:
      return {
        header: 'border-slate-200 bg-slate-50/90',
        badge: 'bg-slate-200/80 text-slate-800',
        drop: 'ring-slate-300/60',
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
