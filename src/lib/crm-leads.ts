import type { SupabaseClient } from '@supabase/supabase-js';

import { enrichLeadsWithIntake, type CrmLeadWithIntake } from '@/lib/client-intake-pipeline';
import {
  LEAD_KANBAN_DB_STATUS,
  normalizeLeadKanbanStatus,
  RADAR_INBOX_STATUS_OR,
  type LeadKanbanColumnId,
} from '@/lib/leads-kanban';

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
  travel_style: string | null;
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
  created_at: string;
};

export type { CrmLeadWithIntake };

/** أعمدة `leads` الموجودة فعلياً — لا تُضمّن client_id (قد يكون غير موجود حتى clients_intake_pipeline.sql) */
const CRM_LEAD_SELECT_BASE =
  'id, full_name, email, phone_wa, age, destinations, travel_date, travel_days, travelers_count, budget, interests, travel_style, daily_pace, walking_readiness, day_start_time, food_preferences, accommodation_type, final_thoughts, form_type, referral_code, created_at';
/** يشمل `status` — قد يفشل الاستعلام إن كان العمود غير موجود (راجع fallback أدناه) */
const CRM_LEAD_SELECT = `${CRM_LEAD_SELECT_BASE}, status`;

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

      return {
        ...lead,
        kanbanStatus,
        expertName,
        expertInitials,
        hasLinkedItinerary: linkedItineraryCount > 0,
        linkedItineraryCount,
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
  const withIntake = await enrichLeadsWithIntake(supabase, raw);
  const leads = await enrichLeadsWithExperts(supabase, withIntake);

  const hasStatusColumn = raw.some((row) => 'status' in row);
  return {
    leads,
    warning: hasStatusColumn
      ? undefined
      : 'عمود status غير متوفر — نفّذ supabase/sql/leads_kanban_status.sql.',
  };
}

export async function updateLeadKanbanStatus(
  supabase: SupabaseClient,
  leadId: string,
  columnId: LeadKanbanColumnId,
): Promise<void> {
  const status = LEAD_KANBAN_DB_STATUS[columnId];
  const { error } = await supabase.from('leads').update({ status }).eq('id', leadId);
  if (error) {
    throw new Error(error.message || 'تعذر تحديث حالة الطلب.');
  }
}
