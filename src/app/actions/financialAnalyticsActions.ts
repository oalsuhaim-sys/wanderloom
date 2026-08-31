'use server';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { assertServiceRoleKeyConfigured } from '@/lib/supabase/server-action-auth';
import {
  buildFinancialAnalyticsSnapshot,
  type FinancialAnalyticsSnapshot,
} from '@/lib/financial-analytics';

export type GetFinancialAnalyticsResult =
  | { ok: true; snapshot: FinancialAnalyticsSnapshot }
  | { ok: false; error: string };

const INVOICE_SELECTS = [
  'id, client_id, quote_id, trip_title, amount, type, status, created_at, updated_at, paid_at, receipt_url',
  'id, client_id, quote_id, trip_title, amount, type, status, created_at, updated_at, paid_at',
  'id, quote_id, amount, type, status, created_at, paid_at',
  '*',
] as const;

async function fetchAdmin(
  table: string,
  select: string,
): Promise<Record<string, unknown>[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from(table)
    .select(select)
    .order('created_at', { ascending: false })
    .limit(5000);

  if (error) {
    console.warn(`[financial-analytics-admin] ${table}:`, error.message);
    const fallback = await admin.from(table).select(select).limit(5000);
    if (fallback.error) return [];
    return (fallback.data ?? []) as unknown as Record<string, unknown>[];
  }
  return (data ?? []) as unknown as Record<string, unknown>[];
}

async function fetchAllInvoicesAdmin(): Promise<Record<string, unknown>[]> {
  const admin = createSupabaseAdminClient();
  for (const select of INVOICE_SELECTS) {
    const { data, error } = await admin
      .from('invoices')
      .select(select)
      .order('created_at', { ascending: false })
      .limit(5000);

    if (!error) {
      return (data ?? []) as unknown as Record<string, unknown>[];
    }
    console.warn('[financial-analytics-admin] invoices:', error.message);
    if (!/column|schema cache|does not exist/i.test(error.message ?? '')) {
      break;
    }
  }
  return [];
}

export async function getFinancialAnalyticsAction(): Promise<GetFinancialAnalyticsResult> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  try {
    const [itineraries, quotations, invoices, experts, clientTrips] = await Promise.all([
      fetchAdmin(
        'itineraries',
        'id, title, destination, status, client_id, quote_id, expert_id, is_template, expected_profit, total_estimated_cost, total_cost, grand_total, total_price, price, paid_amount, amount_paid, created_at, quotations(*)',
      ),
      fetchAdmin(
        'quotations',
        'id, title, destinations, status, total_estimated_cost, expected_profit, grand_total, paid_amount, created_at',
      ),
      fetchAllInvoicesAdmin(),
      fetchAdmin('experts', 'id, name, status'),
      fetchAdmin(
        'client_trips',
        'id, destination, profit, expected_profit, cost, total_price, grand_total, amount, revenue, created_at',
      ),
    ]);

    const snapshot = buildFinancialAnalyticsSnapshot({
      itineraries,
      quotations,
      invoices,
      experts,
      legacyClientTrips: clientTrips,
    });

    return { ok: true, snapshot };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر تحميل التحليل المالي.',
    };
  }
}
