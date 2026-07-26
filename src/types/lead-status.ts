/**
 * Re-export lead pipeline SSOT — prefer importing from `@/lib/lead-status`.
 */
export type { LeadStatus, MasterLeadStatus } from '@/lib/lead-status';
export {
  LEAD_STATUSES,
  LEAD_STATUS_LABEL_AR,
  LEAD_STATUS_PIPELINE_ORDER,
  RADAR_INBOX_STATUSES,
  RADAR_INBOX_DB_VALUES,
  RADAR_INBOX_STATUS_OR,
  QUOTE_PIPELINE_STATUSES,
  ITINERARY_PIPELINE_STATUSES,
  KANBAN_VISIBLE_STATUSES,
  normalizeLeadStatus,
  isLeadStatus,
  leadStatusPipelineIndex,
} from '@/lib/lead-status';
