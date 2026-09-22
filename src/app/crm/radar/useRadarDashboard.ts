'use client';

import { useCallback } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';

import {
  buildLazySupplierAlerts,
  buildPassportAlerts,
  buildSalesPipelinePulse,
  buildVipsInTransit,
  type LazySupplierAlert,
  type PassportAlert,
  type SalesPipelinePulse,
  type VipInTransit,
} from '@/lib/live-radar-dashboard';
import {
  fetchGroupOnboardingLeads,
  fetchInterestOnlyLeads,
  fetchNewCrmLeads,
  type CrmLeadRow,
  type CrmLeadWithIntake,
} from '@/lib/crm-leads';
import {
  fetchGroupFulfillmentClients,
  type GroupFulfillmentClient,
} from '@/lib/group-operations-radar';
import {
  fetchMarketingPublishingRadar,
  type MarketingPublishRadarItem,
} from '@/lib/marketing-publishing-radar';
import { supabase } from '@/lib/supabase';
import {
  anyJwtClockSkewError,
  recoverSupabaseSessionFromClockSkew,
} from '@/lib/supabase/auth-clock-skew';

export const RADAR_DASHBOARD_SWR_KEY = 'crm/radar-dashboard';

export type RadarDashboardPayload = {
  pulse: SalesPipelinePulse;
  inTransit: VipInTransit[];
  passportAlerts: PassportAlert[];
  lazySuppliers: LazySupplierAlert[];
  newLeads: CrmLeadWithIntake[];
  leadsWarning?: string;
  interestLeads: CrmLeadRow[];
  interestWarning?: string;
  groupOnboardingLeads: CrmLeadRow[];
  groupOnboardingError?: string;
  groupFulfillment: GroupFulfillmentClient[];
  groupFulfillmentError?: string;
  marketingPublish: MarketingPublishRadarItem[];
  marketingPublishError?: string;
  quotationRevisions: Array<{
    id: string;
    title: string;
    status: 'needs_revision' | 'client_responded';
    clientName: string;
    clientPhone: string | null;
    updatedAt: string | null;
  }>;
  dataWarning?: string;
};

export async function fetchRadarDashboardPayload(): Promise<RadarDashboardPayload> {
  if (!supabase) throw new Error('Supabase غير مهيأ.');

  const itineraryCols =
    'id, customer_name, title, destination, status, dates, start_date, end_date, is_template, client_id, supplier_requests, updated_at, expected_profit, clients(name)';

  const loadCoreQueries = () =>
    Promise.all([
      supabase.from('itineraries').select(itineraryCols).not('is_template', 'eq', true),
      supabase.from('clients').select('id, name, passport_expiry, wallet_balance'),
      supabase.from('quotations').select('id, status, total_estimated_cost, expected_profit'),
      supabase
        .from('quotations')
        .select('id, title, status, updated_at, clients(name, phone_wa)')
        .in('status', ['needs_revision', 'client_responded'])
        .order('updated_at', { ascending: false })
        .limit(8),
    ]);

  let [tripsRes, clientsRes, quotationsRes, quotationRevisionRes] = await loadCoreQueries();

  if (
    anyJwtClockSkewError(
      tripsRes.error,
      clientsRes.error,
      quotationsRes.error,
      quotationRevisionRes.error,
    )
  ) {
    const recovered = await recoverSupabaseSessionFromClockSkew(supabase);
    if (recovered) {
      ;[tripsRes, clientsRes, quotationsRes, quotationRevisionRes] = await loadCoreQueries();
    }
  }

  let dataWarning = '';
  let itineraries = (tripsRes.data as Record<string, unknown>[]) ?? [];

  if (tripsRes.error) {
    const msg = tripsRes.error.message ?? '';
    if (anyJwtClockSkewError(tripsRes.error)) {
      throw new Error('انحراف بسيط في ساعة الجهاز (JWT) — أعد المحاولة بعد لحظات.');
    }
    if (msg.includes('expected_profit') || msg.includes('supplier_requests') || msg.includes('column')) {
      dataWarning = 'بعض أعمدة المسارات غير متوفرة — نفّذ سكربتات SQL الأحدث في Supabase.';
      const fallback = await supabase
        .from('itineraries')
        .select(
          'id, customer_name, title, destination, status, dates, start_date, end_date, is_template, client_id, clients(name)',
        )
        .not('is_template', 'eq', true);
      if (fallback.error) throw new Error(fallback.error.message || 'تعذر تحميل الرادار.');
      itineraries = (fallback.data as Record<string, unknown>[]) ?? [];
    } else {
      throw new Error(msg || 'تعذر تحميل الرادار.');
    }
  }

  let clients = (clientsRes.data as Record<string, unknown>[]) ?? [];
  if (clientsRes.error) {
    const msg = clientsRes.error.message ?? '';
    if (msg.includes('wallet_balance') || msg.includes('passport_expiry') || msg.includes('column')) {
      dataWarning = dataWarning
        ? dataWarning
        : 'تعذر تحميل wallet_balance أو passport_expiry — نفّذ سكربتات العملاء في Supabase.';
      const fallback = await supabase.from('clients').select('id, name');
      clients = (fallback.data as Record<string, unknown>[]) ?? [];
    } else if (!anyJwtClockSkewError(clientsRes.error)) {
      dataWarning = dataWarning ? `${dataWarning} · ${msg}` : msg;
    }
  }

  let quotations = (quotationsRes.data as Record<string, unknown>[]) ?? [];
  if (quotationsRes.error) {
    const msg = quotationsRes.error.message ?? '';
    if (msg.includes('quotations') || msg.includes('relation') || msg.includes('column')) {
      dataWarning = dataWarning
        ? `${dataWarning} · جدول quotations غير متوفر.`
        : 'جدول quotations غير متوفر — نفّذ supabase/sql/quotations.sql';
      quotations = [];
    } else if (!anyJwtClockSkewError(quotationsRes.error)) {
      quotations = [];
    }
  }

  const quotationRevisions = ((quotationRevisionRes.data as Record<string, unknown>[] | null) ?? [])
    .map((row) => {
      const clientsRaw = row.clients;
      const firstClient =
        Array.isArray(clientsRaw) && clientsRaw.length > 0
          ? (clientsRaw[0] as Record<string, unknown>)
          : clientsRaw && typeof clientsRaw === 'object'
            ? (clientsRaw as Record<string, unknown>)
            : null;
      const statusRaw = String(row.status ?? '');
      const status: 'needs_revision' | 'client_responded' =
        statusRaw === 'client_responded' ? 'client_responded' : 'needs_revision';
      return {
        id: String(row.id ?? '').trim(),
        title: String(row.title ?? '').trim() || 'عرض سعر',
        status,
        clientName: String(firstClient?.name ?? '').trim() || '—',
        clientPhone:
          firstClient?.phone_wa != null ? String(firstClient.phone_wa).trim() || null : null,
        updatedAt: row.updated_at != null ? String(row.updated_at) : null,
      };
    })
    .filter((row) => row.id);

  const now = new Date();

  let newLeads: CrmLeadWithIntake[] = [];
  let leadsWarning: string | undefined;
  try {
    const leadsResult = await fetchNewCrmLeads(supabase);
    newLeads = leadsResult.leads;
    leadsWarning = leadsResult.warning;
  } catch (leadsErr) {
    const leadsMsg = leadsErr instanceof Error ? leadsErr.message : 'تعذر تحميل الطلبات الجديدة.';
    dataWarning = dataWarning ? `${dataWarning} · ${leadsMsg}` : leadsMsg;
  }

  let interestLeads: CrmLeadRow[] = [];
  let interestWarning: string | undefined;
  try {
    const interestResult = await fetchInterestOnlyLeads(supabase);
    interestLeads = interestResult.leads;
    interestWarning = interestResult.warning;
  } catch (interestErr) {
    const interestMsg =
      interestErr instanceof Error ? interestErr.message : 'تعذر تحميل قائمة الاهتمامات.';
    dataWarning = dataWarning ? `${dataWarning} · ${interestMsg}` : interestMsg;
  }

  let groupOnboardingLeads: CrmLeadRow[] = [];
  let groupOnboardingError: string | undefined;
  try {
    const groupObResult = await fetchGroupOnboardingLeads(supabase);
    groupOnboardingLeads = groupObResult.leads;
    if (groupObResult.error) groupOnboardingError = groupObResult.error;
  } catch {
    groupOnboardingError = 'حدث خطأ في جلب البيانات، تأكد من الاتصال بقاعدة البيانات.';
  }

  const groupResult = await fetchGroupFulfillmentClients(supabase);
  const marketingResult = await fetchMarketingPublishingRadar(supabase);

  return {
    pulse: buildSalesPipelinePulse({ itineraries, quotations, clients }),
    inTransit: buildVipsInTransit(itineraries, now),
    passportAlerts: buildPassportAlerts(clients, now),
    lazySuppliers: buildLazySupplierAlerts(itineraries, now),
    newLeads,
    leadsWarning,
    interestLeads,
    interestWarning,
    groupOnboardingLeads,
    groupOnboardingError,
    groupFulfillment: groupResult.clients,
    groupFulfillmentError: groupResult.error,
    marketingPublish: marketingResult.items,
    marketingPublishError: marketingResult.error,
    quotationRevisions,
    dataWarning: dataWarning || undefined,
  };
}

export function useRadarDashboard() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<RadarDashboardPayload>(
    RADAR_DASHBOARD_SWR_KEY,
    fetchRadarDashboardPayload,
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
      dedupingInterval: 10_000,
    },
  );

  const refresh = useCallback(
    async (_opts?: { soft?: boolean }) => {
      await mutate();
    },
    [mutate],
  );

  return {
    data: data ?? null,
    error: error instanceof Error ? error.message : error ? String(error) : '',
    dataWarning: data?.dataWarning ?? '',
    showFullPageSpinner: Boolean(isLoading && !data),
    isValidating,
    mutate,
    refresh,
  };
}

export function revalidateRadarDashboard() {
  return globalMutate(RADAR_DASHBOARD_SWR_KEY);
}
