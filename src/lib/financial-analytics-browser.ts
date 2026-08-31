import { supabase } from '@/lib/supabase';
import {
  buildFinancialAnalyticsSnapshot,
  type FinancialAnalyticsSnapshot,
} from '@/lib/financial-analytics';

const PAGE = 5000;

const INVOICE_SELECTS = [
  'id, client_id, quote_id, trip_title, amount, type, status, created_at, updated_at, paid_at, receipt_url',
  'id, client_id, quote_id, trip_title, amount, type, status, created_at, updated_at, paid_at',
  'id, quote_id, amount, type, status, created_at, paid_at',
  '*',
] as const;

async function fetchTable(
  table: string,
  select: string,
): Promise<Record<string, unknown>[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(table)
    .select(select)
    .order('created_at', { ascending: false })
    .range(0, PAGE - 1);

  if (error) {
    console.warn(`[financial-analytics] ${table}:`, error.message);
    const fallback = await supabase.from(table).select(select).limit(PAGE);
    if (fallback.error) {
      console.warn(`[financial-analytics] ${table} fallback:`, fallback.error.message);
      return [];
    }
    return (fallback.data ?? []) as unknown as Record<string, unknown>[];
  }
  return (data ?? []) as unknown as Record<string, unknown>[];
}

async function fetchAllInvoicesBrowser(): Promise<Record<string, unknown>[]> {
  if (!supabase) return [];
  for (const select of INVOICE_SELECTS) {
    const { data, error } = await supabase
      .from('invoices')
      .select(select)
      .order('created_at', { ascending: false })
      .range(0, PAGE - 1);

    if (!error) {
      return (data ?? []) as unknown as Record<string, unknown>[];
    }
    console.warn('[financial-analytics] invoices:', error.message);
    if (!/column|schema cache|does not exist/i.test(error.message ?? '')) {
      break;
    }
  }
  return [];
}

export async function fetchFinancialAnalyticsBrowser(): Promise<FinancialAnalyticsSnapshot | null> {
  if (!supabase) return null;

  const [itineraries, quotations, invoices, experts, clientTrips] = await Promise.all([
    fetchTable(
      'itineraries',
      'id, title, destination, status, client_id, quote_id, expert_id, is_template, expected_profit, total_estimated_cost, total_cost, grand_total, total_price, price, paid_amount, amount_paid, created_at, quotations(*)',
    ),
    fetchTable(
      'quotations',
      'id, title, destinations, status, total_estimated_cost, expected_profit, grand_total, paid_amount, created_at',
    ),
    fetchAllInvoicesBrowser(),
    fetchTable('experts', 'id, name, status'),
    fetchTable(
      'client_trips',
      'id, destination, profit, expected_profit, cost, total_price, grand_total, amount, revenue, created_at',
    ),
  ]);

  return buildFinancialAnalyticsSnapshot({
    itineraries,
    quotations,
    invoices,
    experts,
    legacyClientTrips: clientTrips,
  });
}
