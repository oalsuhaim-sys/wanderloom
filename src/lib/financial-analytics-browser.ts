import { supabase } from '@/lib/supabase';
import {
  buildFinancialAnalyticsSnapshot,
  type FinancialAnalyticsSnapshot,
} from '@/lib/financial-analytics';

const PAGE = 5000;

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
    // Retry without order if column missing
    const fallback = await supabase.from(table).select(select).limit(PAGE);
    if (fallback.error) {
      console.warn(`[financial-analytics] ${table} fallback:`, fallback.error.message);
      return [];
    }
    return (fallback.data ?? []) as unknown as Record<string, unknown>[];
  }
  return (data ?? []) as unknown as Record<string, unknown>[];
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
    fetchTable(
      'invoices',
      'id, quote_id, amount, status, paid_at, created_at, type',
    ),
    fetchTable('experts', 'id, name, status'),
    fetchTable(
      'client_trips',
      'id, destination, profit, expected_profit, cost, total_price, grand_total, amount, revenue, created_at',
    ),
  ]);

  const paidInvoices = invoices.filter((row) => {
    const s = String(row.status ?? '')
      .trim()
      .toLowerCase();
    return s === 'paid' || s === 'fully_paid' || s.includes('paid') || s.includes('مدفوع');
  });

  if (
    !itineraries.length &&
    !quotations.length &&
    !paidInvoices.length &&
    !clientTrips.length
  ) {
    return buildFinancialAnalyticsSnapshot({
      itineraries: [],
      quotations: [],
      paidInvoices: [],
      experts,
      legacyClientTrips: [],
    });
  }

  return buildFinancialAnalyticsSnapshot({
    itineraries,
    quotations,
    paidInvoices,
    experts,
    legacyClientTrips: clientTrips,
  });
}
