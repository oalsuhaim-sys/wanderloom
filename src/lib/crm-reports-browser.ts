import { supabase } from '@/lib/supabase';
import type { CrmReportsSnapshot } from '@/lib/crm-reports';
import {
  buildCrmReportsSnapshot,
  filterReceivableInvoiceRows,
  mapPaidInvoiceRows,
} from '@/lib/crm-reports-aggregate';
const FETCH_PAGE_SIZE = 5000;

async function fetchTable(
  table: string,
  select: string,
  orderColumn = 'created_at',
): Promise<Record<string, unknown>[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(table)
    .select(select)
    .order(orderColumn, { ascending: false })
    .range(0, FETCH_PAGE_SIZE - 1);

  if (error) {
    console.error(`[reports-browser] ${table}:`, error.message);
    return [];
  }
  return (data ?? []) as unknown as Record<string, unknown>[];
}

/** Embed join may fail under RLS — retry bare select like the admin path. */
async function fetchTableWithEmbedFallback(
  table: string,
  embedSelect: string,
): Promise<Record<string, unknown>[]> {
  const embedded = await fetchTable(table, embedSelect);
  if (embedded.length > 0) return embedded;
  return fetchTable(table, '*');
}

/** Fallback للمتصفح عند فشل server action (مثلاً بدون service role على Vercel). */
export async function fetchCrmReportsSnapshotBrowser(): Promise<CrmReportsSnapshot | null> {
  if (!supabase) return null;

  const [paidRows, receivableRows, quoteRows, clientTripRows, customerTripRows, itineraryRows, leadRows] =
    await Promise.all([
      fetchTable(
        'invoices',
        'id, client_id, quote_id, amount, type, status, created_at, paid_at, trip_title',
      ),
      fetchTable(
        'invoices',
        'id, client_id, quote_id, amount, type, status, created_at, trip_title',
      ),
      fetchTableWithEmbedFallback('quotations', '*, clients(id, name, phone_wa)'),
      fetchTableWithEmbedFallback('client_trips', '*, clients(id, name, phone_wa)'),
      fetchTableWithEmbedFallback('customer_trips', '*, clients(id, name, phone_wa)'),
      fetchTableWithEmbedFallback(
        'itineraries',
        'id, customer_name, title, destination, status, dates, start_date, end_date, client_id, quote_id, trip_type, is_template, created_at, updated_at, expected_profit, total_estimated_cost, total_cost, grand_total, price, clients(id, name), quotations(*)',
      ),
      fetchTable('leads', 'id, full_name, destinations, travel_date, status, created_at, final_thoughts'),
    ]);

  if (
    !quoteRows.length &&
    !paidRows.length &&
    !receivableRows.length &&
    !clientTripRows.length &&
    !customerTripRows.length &&
    !itineraryRows.length &&
    !leadRows.length
  ) {
    return null;
  }

  return buildCrmReportsSnapshot({
    paidInvoices: mapPaidInvoiceRows(paidRows),
    receivableInvoices: filterReceivableInvoiceRows(receivableRows),
    quotationRecords: quoteRows,
    legacyClientTrips: clientTripRows,
    legacyCustomerTrips: customerTripRows,
    itineraryRecords: itineraryRows,
    leadRecords: leadRows,
  });
}
