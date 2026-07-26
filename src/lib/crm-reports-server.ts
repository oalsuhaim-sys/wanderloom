import 'server-only';

import { isInvoiceReceivableStatus } from '@/lib/crm-invoices';
import type { CrmReportsSnapshot } from '@/lib/crm-reports';
import {
  buildCrmReportsSnapshot,
  filterReceivableInvoiceRows,
  mapPaidInvoiceRows,
} from '@/lib/crm-reports-aggregate';
import { QUOTATION_CLIENT_EMBED_SELECT } from '@/lib/crm-quotations';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { SupabaseClient } from '@supabase/supabase-js';

const CRM_INVOICES_TABLE = 'invoices';
const CRM_QUOTATIONS_TABLE = 'quotations';

/** جلب كل الصفوف بدون حد Supabase الافتراضي (1000) */
const FETCH_PAGE_SIZE = 5000;

function emptySnapshot(): CrmReportsSnapshot {
  return buildCrmReportsSnapshot({
    paidInvoices: [],
    receivableInvoices: [],
    quotationRecords: [],
    legacyClientTrips: [],
    legacyCustomerTrips: [],
    itineraryRecords: [],
    leadRecords: [],
  });
}

async function fetchAllRows(
  admin: SupabaseClient,
  table: string,
  select: string,
  orderColumn = 'created_at',
): Promise<Record<string, unknown>[]> {
  const { data, error } = await admin
    .from(table)
    .select(select)
    .order(orderColumn, { ascending: false })
    .range(0, FETCH_PAGE_SIZE - 1);

  if (error) {
    console.error(`[reports] ${table}:`, error.message);
    return [];
  }
  return (data ?? []) as unknown as Record<string, unknown>[];
}

async function fetchReportsRaw(admin: SupabaseClient) {
  const paidAll = await fetchAllRows(
    admin,
    CRM_INVOICES_TABLE,
    'id, client_id, quote_id, amount, type, status, created_at, paid_at, trip_title',
  );
  const receivableAll = await fetchAllRows(
    admin,
    CRM_INVOICES_TABLE,
    'id, client_id, quote_id, amount, type, status, created_at, trip_title',
  );

  let quoteRows = await fetchAllRows(
    admin,
    CRM_QUOTATIONS_TABLE,
    `*, clients(${QUOTATION_CLIENT_EMBED_SELECT})`,
  );
  if (!quoteRows.length) {
    quoteRows = await fetchAllRows(admin, CRM_QUOTATIONS_TABLE, '*');
  }

  let clientTripRows = await fetchAllRows(
    admin,
    'client_trips',
    `*, clients(${QUOTATION_CLIENT_EMBED_SELECT})`,
  );
  if (!clientTripRows.length) {
    clientTripRows = await fetchAllRows(admin, 'client_trips', '*');
  }

  let customerTripRows = await fetchAllRows(
    admin,
    'customer_trips',
    `*, clients(${QUOTATION_CLIENT_EMBED_SELECT})`,
  );
  if (!customerTripRows.length) {
    customerTripRows = await fetchAllRows(admin, 'customer_trips', '*');
  }

  const itineraryRows = await fetchAllRows(
    admin,
    'itineraries',
    'id, customer_name, title, destination, status, dates, start_date, end_date, client_id, quote_id, trip_type, is_template, created_at, updated_at, expected_profit, total_estimated_cost, total_cost, grand_total, price, clients(id, name), quotations(*)',
  );
  const itineraryRowsBare =
    itineraryRows.length > 0
      ? itineraryRows
      : await fetchAllRows(
          admin,
          'itineraries',
          'id, customer_name, title, destination, status, dates, start_date, end_date, client_id, quote_id, trip_type, is_template, created_at, updated_at, expected_profit, total_estimated_cost, total_cost, grand_total, price, clients(id, name)',
        );

  // Final fallback: bare * if financial columns are missing from schema cache
  const itineraryRowsFinal =
    itineraryRowsBare.length > 0
      ? itineraryRowsBare
      : await fetchAllRows(admin, 'itineraries', '*');

  const leadRows = await fetchAllRows(
    admin,
    'leads',
    'id, full_name, destinations, travel_date, status, created_at, final_thoughts',
  );

  return {
    paidRows: paidAll.filter((r) => String(r.status ?? '') === 'paid'),
    receivableRows: receivableAll.filter((r) =>
      isInvoiceReceivableStatus((r as { status?: unknown }).status),
    ),
    quoteRows,
    clientTripRows,
    customerTripRows,
    itineraryRows: itineraryRowsFinal,
    leadRows,
  };
}

export async function fetchCrmReportsSnapshotAdmin(): Promise<CrmReportsSnapshot> {
  try {
    const admin = createSupabaseAdminClient();
    const {
      paidRows,
      receivableRows,
      quoteRows,
      clientTripRows,
      customerTripRows,
      itineraryRows,
      leadRows,
    } = await fetchReportsRaw(admin);

    return buildCrmReportsSnapshot({
      paidInvoices: mapPaidInvoiceRows(paidRows),
      receivableInvoices: filterReceivableInvoiceRows(receivableRows),
      quotationRecords: quoteRows,
      legacyClientTrips: clientTripRows,
      legacyCustomerTrips: customerTripRows,
      itineraryRecords: itineraryRows,
      leadRecords: leadRows,
    });
  } catch (err) {
    console.error('[reports] admin snapshot:', err);
    return emptySnapshot();
  }
}
