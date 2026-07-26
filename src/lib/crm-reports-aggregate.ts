import {
  formatInvoiceDate,
  INVOICE_TYPE_LABEL,
  isInvoiceReceivableStatus,
  mapInvoiceRow,
  type InvoiceRow,
} from '@/lib/crm-invoices';
import type {
  CrmClientTripHistoryRow,
  CrmPaidTransactionRow,
  CrmReceivableInvoiceRow,
  CrmReportsSnapshot,
} from '@/lib/crm-reports';
import { resolveItineraryCost } from '@/lib/client-active-itinerary';
import {
  formatDestinationsLabel,
  formatQuotationDateRange,
  mapQuotationClientEmbed,
  mapQuotationRow,
  QUOTATION_STATUS_LABEL,
  quotationClientName,
  quotationTotalPrice,
  type QuotationRow,
} from '@/lib/crm-quotations';
import { joinDestinations } from '@/lib/crm-leads';

function roundMoney(value: number): number {
  return Math.round(Math.max(0, value) * 100) / 100;
}

function monthStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function tripHistoryToneFromRaw(raw: string): CrmClientTripHistoryRow['statusTone'] {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return 'active';
  if (s.includes('draft') || s === 'مسودة') return 'draft';
  if (
    s.includes('archiv') ||
    s.includes('complet') ||
    s === 'fully_paid' ||
    s === 'deposit_paid' ||
    s === 'completed'
  ) {
    return s.includes('archiv') ? 'archived' : 'completed';
  }
  if (s.includes('pend') || s.includes('انتظار') || s === 'pending_client') return 'pending';
  if (s === 'approved' || s === 'awaiting_payment' || s.includes('active') || s.includes('نشط')) {
    return 'active';
  }
  return 'active';
}

function tripHistoryStatusLabel(raw: string): string {
  const s = String(raw ?? '').trim();
  const lower = s.toLowerCase();
  if (!s) return '—';
  if (lower === 'fully_paid' || lower === 'deposit_paid') return 'مكتملة';
  if (lower === 'draft') return 'مسودة';
  if (lower === 'pending_client') return 'بانتظار الاعتماد';
  if (lower === 'awaiting_payment') return 'نشطة — بانتظار الدفع';
  if (lower === 'approved') return 'نشطة — معتمدة';
  if (lower === 'completed' || lower.includes('complet')) return 'مكتملة';
  if (lower === 'archived' || lower.includes('archiv')) return 'أرشيف';
  if (lower === 'active' || lower.includes('نشط')) return 'نشطة';
  if (s in QUOTATION_STATUS_LABEL) {
    return QUOTATION_STATUS_LABEL[s as keyof typeof QUOTATION_STATUS_LABEL];
  }
  return s;
}

function clientNameFromEmbed(row: Record<string, unknown>): string {
  const embed = mapQuotationClientEmbed(row.clients ?? row.client);
  const name = String(embed?.name ?? row.client_name ?? '').trim();
  return name || '—';
}

function formatLegacyDateRange(tripDate: unknown, createdAt: unknown): string {
  const trip = tripDate != null ? String(tripDate).slice(0, 10) : '';
  if (trip) return trip;
  const created = createdAt != null ? String(createdAt).slice(0, 10) : '';
  return created || '—';
}

export function buildClientTripHistoryRowsFromDb(
  quotationRecords: Record<string, unknown>[],
): CrmClientTripHistoryRow[] {
  return quotationRecords
    .filter((row) => row.id != null && String(row.id).trim())
    .map((row) => {
      const mapped = mapQuotationRow(row);
      const clients = mapQuotationClientEmbed(row.clients ?? row.client);
      const quote: QuotationRow = clients ? { ...mapped, clients } : mapped;
      const rawStatus = String(row.status ?? '').trim() || quote.status;

      return {
        id: quote.id,
        clientName: quotationClientName(quote),
        destinations: formatDestinationsLabel(quote.destinations),
        dateRange: formatQuotationDateRange(quote.start_date, quote.end_date),
        status: rawStatus,
        statusLabel: tripHistoryStatusLabel(rawStatus),
        statusTone: tripHistoryToneFromRaw(rawStatus),
        tripTitle: quote.title || '—',
        sortAt: String(row.created_at ?? row.start_date ?? row.updated_at ?? ''),
      };
    });
}

function buildLeadTripHistoryRows(leads: Record<string, unknown>[]): CrmClientTripHistoryRow[] {
  return leads
    .filter((row) => row.id != null && String(row.id).trim())
    .map((row) => {
      const id = String(row.id).trim();
      const clientName = String(row.full_name ?? row.name ?? '').trim() || '—';
      const destinations = joinDestinations(
        Array.isArray(row.destinations)
          ? (row.destinations as string[])
          : row.destinations
            ? [String(row.destinations)]
            : [],
      );
      const travelDate = row.travel_date != null ? String(row.travel_date).slice(0, 10) : '';
      const rawStatus = String(row.status ?? '').trim() || 'new_request';

      return {
        id: `lead:${id}`,
        clientName,
        destinations,
        dateRange: travelDate || formatLegacyDateRange(null, row.created_at),
        status: rawStatus,
        statusLabel: rawStatus === 'new' || rawStatus === 'new_request' ? 'طلب جديد' : tripHistoryStatusLabel(rawStatus),
        statusTone: rawStatus === 'new' || rawStatus === 'new_request' ? 'pending' : tripHistoryToneFromRaw(rawStatus),
        tripTitle:
          destinations !== '—'
            ? `طلب رحلة — ${destinations}`
            : String(row.final_thoughts ?? '').trim().slice(0, 80) || 'طلب رحلة جديد',
        sortAt: String(row.created_at ?? row.travel_date ?? ''),
      };
    });
}

function pickEmbeddedRecord(
  row: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null {
  const raw = row[key];
  if (!raw) return null;
  if (Array.isArray(raw)) {
    const first = raw[0];
    return first && typeof first === 'object' ? (first as Record<string, unknown>) : null;
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  return null;
}

function buildItineraryTripHistoryRows(
  itineraries: Record<string, unknown>[],
  quotationRecords: Record<string, unknown>[],
): CrmClientTripHistoryRow[] {
  const quotations = mapQuotationRowsFromDb(quotationRecords);
  const quotationById = new Map<string, QuotationRow>();
  for (const q of quotations) {
    if (q.id) {
      quotationById.set(String(q.id), q);
    }
  }

  return itineraries
    .filter((row) => {
      const id = String(row.id ?? '').trim();
      if (!id) return false;
      const isTemplate = row.is_template === true || String(row.is_template ?? '').trim() === 'true';
      return !isTemplate;
    })
    .map((row) => {
      const id = String(row.id ?? '').trim();
      const embeddedQuote = pickEmbeddedRecord(row, 'quotations');
      const quoteId =
        row.quote_id != null
          ? String(row.quote_id).trim()
          : embeddedQuote?.id != null
            ? String(embeddedQuote.id).trim()
            : '';
      const quoteFromEmbed = embeddedQuote ? mapQuotationRow(embeddedQuote) : undefined;
      const quote = quoteFromEmbed ?? (quoteId ? quotationById.get(quoteId) : undefined);

      const clientName =
        clientNameFromEmbed(row) ||
        String(row.customer_name ?? '').trim() ||
        (quote ? quotationClientName(quote) : '') ||
        '—';

      const destination =
        String(row.destination ?? '').trim() ||
        (quote ? formatDestinationsLabel(quote.destinations) : '') ||
        '—';

      const start = (row.start_date as string | null) ?? null;
      const end = (row.end_date as string | null) ?? null;
      const dateRange =
        start || end
          ? formatQuotationDateRange(start, end)
          : formatLegacyDateRange(row.dates, row.created_at);

      const rawStatusFromQuote =
        String(embeddedQuote?.status ?? quote?.status ?? '').trim() || '';
      const rawStatusItinerary = String(row.status ?? '').trim();
      const rawStatus =
        String(rawStatusFromQuote).trim() ||
        rawStatusItinerary ||
        'new_request';

      const hasQuotation = Boolean(quote);
      const statusLabel = hasQuotation
        ? tripHistoryStatusLabel(rawStatus)
        : 'طلب جديد';

      const statusTone = hasQuotation
        ? tripHistoryToneFromRaw(rawStatus)
        : 'pending';

      const tripTitle =
        String(row.title ?? '').trim() ||
        (quote ? quote.title : '') ||
        destination ||
        '—';

      const sortAt = String(
        row.updated_at ??
          row.created_at ??
          row.start_date ??
          row.end_date ??
          row.dates ??
          '',
      );

      return {
        id: `itinerary:${id}`,
        clientName,
        destinations: destination,
        dateRange,
        status: rawStatus,
        statusLabel,
        statusTone,
        tripTitle,
        sortAt,
      };
    });
}

export function buildLegacyClientTripHistoryRows(
  clientTrips: Record<string, unknown>[],
  customerTrips: Record<string, unknown>[],
): CrmClientTripHistoryRow[] {
  const rows: CrmClientTripHistoryRow[] = [];

  for (const row of clientTrips) {
    const id = String(row.id ?? '').trim();
    if (!id) continue;
    const rawStatus = String(row.status ?? 'completed').trim() || 'completed';
    const destination = String(row.destination ?? '').trim() || '—';
    rows.push({
      id: `client_trips:${id}`,
      clientName: clientNameFromEmbed(row),
      destinations: destination,
      dateRange: formatLegacyDateRange(row.trip_date, row.created_at),
      status: rawStatus,
      statusLabel: tripHistoryStatusLabel(rawStatus),
      statusTone: tripHistoryToneFromRaw(rawStatus),
      tripTitle: String(row.notes ?? row.title ?? destination).trim() || destination,
      sortAt: String(row.created_at ?? row.trip_date ?? ''),
    });
  }

  for (const row of customerTrips) {
    const id = String(row.id ?? '').trim();
    if (!id) continue;
    const rawStatus = String(row.status ?? 'completed').trim() || 'completed';
    const destination = String(row.destination ?? '').trim() || '—';
    rows.push({
      id: `customer_trips:${id}`,
      clientName: clientNameFromEmbed(row),
      destinations: destination,
      dateRange: formatLegacyDateRange(row.trip_date, row.created_at),
      status: rawStatus,
      statusLabel: tripHistoryStatusLabel(rawStatus),
      statusTone: tripHistoryToneFromRaw(rawStatus),
      tripTitle: String(row.notes ?? row.title ?? destination).trim() || destination,
      sortAt: String(row.created_at ?? row.trip_date ?? ''),
    });
  }

  return rows;
}

function mergeTripHistory(
  quotationRecords: Record<string, unknown>[],
  clientTrips: Record<string, unknown>[],
  customerTrips: Record<string, unknown>[],
): CrmClientTripHistoryRow[] {
  const merged = [
    ...buildClientTripHistoryRowsFromDb(quotationRecords),
    ...buildLegacyClientTripHistoryRows(clientTrips, customerTrips),
  ];

  return merged.sort((a, b) => {
    const cmp = b.sortAt.localeCompare(a.sortAt);
    if (cmp !== 0) return cmp;
    return b.id.localeCompare(a.id);
  });
}

function sumLegacyTripFinancials(
  clientTrips: Record<string, unknown>[],
  customerTrips: Record<string, unknown>[],
): { revenue: number; profit: number } {
  let revenue = 0;
  let profit = 0;

  for (const row of clientTrips) {
    const rowProfit =
      Number(row.profit ?? row.expected_profit ?? 0) || 0;
    const rowRevenue =
      Number(
        row.cost ??
          row.total_price ??
          row.total_cost ??
          row.amount ??
          row.revenue ??
          row.grand_total ??
          0,
      ) || 0;
    // Legacy client_trips often store only `profit` as the financial value
    profit += rowProfit;
    revenue += rowRevenue > 0 ? rowRevenue : rowProfit;
  }

  for (const row of customerTrips) {
    const rowProfit =
      Number(row.profit ?? row.expected_profit ?? 0) || 0;
    const rowRevenue =
      Number(
        row.cost ??
          row.total_price ??
          row.total_cost ??
          row.amount ??
          row.revenue ??
          row.grand_total ??
          0,
      ) || 0;
    profit += rowProfit > 0 ? rowProfit : 0;
    revenue += rowRevenue > 0 ? rowRevenue : rowProfit;
  }

  return { revenue, profit };
}

/** Financials from itineraries — including route-less / legacy-style rows (no days required). */
function sumItineraryFinancials(
  itineraries: Record<string, unknown>[],
  options?: {
    /** Skip itineraries whose quote already contributed paid revenue */
    skipQuoteIds?: Set<string>;
  },
): { revenue: number; profit: number; monthlyRevenue: number } {
  const skipQuoteIds = options?.skipQuoteIds ?? new Set<string>();
  const monthStart = monthStartIso();
  let revenue = 0;
  let profit = 0;
  let monthlyRevenue = 0;

  for (const row of itineraries) {
    const id = String(row.id ?? '').trim();
    if (!id) continue;
    if (row.is_template === true || String(row.is_template ?? '').trim() === 'true') {
      continue;
    }

    const quoteId =
      row.quote_id != null ? String(row.quote_id).trim() : '';
    // Still count itineraries that have NO quote (legacy / route-less).
    // Skip only when that quote already drove paid invoice/quotation revenue.
    if (quoteId && skipQuoteIds.has(quoteId)) continue;

    const rowProfit =
      Number(row.expected_profit ?? row.profit ?? 0) || 0;
    const rowRevenue =
      resolveItineraryCost(row) ||
      Number(row.total_price ?? row.amount ?? row.revenue ?? 0) ||
      rowProfit;

    if (rowRevenue <= 0 && rowProfit <= 0) continue;

    revenue += rowRevenue > 0 ? rowRevenue : rowProfit;
    profit += rowProfit > 0 ? rowProfit : 0;

    const stamped = String(
      row.start_date ?? row.end_date ?? row.created_at ?? row.updated_at ?? '',
    ).trim();
    const monthKey = monthStart.slice(0, 10);
    if (stamped && (stamped.slice(0, 10) >= monthKey || stamped >= monthStart)) {
      monthlyRevenue += rowRevenue > 0 ? rowRevenue : rowProfit;
    }
  }

  return { revenue, profit, monthlyRevenue };
}

function quotationHasPaidContribution(quote: QuotationRow): boolean {
  return (Number(quote.paid_amount) || 0) > 0;
}

export function buildCrmReportsSnapshot(input: {
  paidInvoices: InvoiceRow[];
  receivableInvoices: InvoiceRow[];
  quotationRecords: Record<string, unknown>[];
  legacyClientTrips?: Record<string, unknown>[];
  legacyCustomerTrips?: Record<string, unknown>[];
  itineraryRecords?: Record<string, unknown>[];
  leadRecords?: Record<string, unknown>[];
  clientNames?: Map<string, string>;
}): CrmReportsSnapshot {
  const {
    paidInvoices,
    receivableInvoices,
    quotationRecords,
    legacyClientTrips = [],
    legacyCustomerTrips = [],
    itineraryRecords = [],
    leadRecords = [],
  } = input;
  const quotations = mapQuotationRowsFromDb(quotationRecords);
  const clientNames = input.clientNames ?? new Map<string, string>();
  const monthStart = monthStartIso();

  const quoteMeta = new Map<string, { title: string; category: 'private' | 'group' }>();
  for (const quote of quotations) {
    quoteMeta.set(quote.id, {
      title: quote.title || 'رحلة Wanderloom',
      category: quote.trip_category,
    });
    if (quote.client_id) {
      const name = quotationClientName(quote);
      if (name && name !== '—') clientNames.set(String(quote.client_id), name);
    }
  }

  let invoiceRevenue = 0;
  let monthlyRevenue = 0;
  let privateTrips = 0;
  let groupTours = 0;
  const paidQuoteIds = new Set<string>();

  for (const inv of paidInvoices) {
    invoiceRevenue += inv.amount;
    const paidAt = inv.paid_at || inv.created_at;
    if (paidAt && paidAt >= monthStart) monthlyRevenue += inv.amount;
    const meta = quoteMeta.get(inv.quote_id);
    if (meta?.category === 'group') groupTours += inv.amount;
    else privateTrips += inv.amount;
    if (inv.quote_id) paidQuoteIds.add(String(inv.quote_id));
  }

  const quotationPaidTotal = quotations.reduce((sum, q) => sum + (q.paid_amount || 0), 0);
  for (const quote of quotations) {
    if (quotationHasPaidContribution(quote)) paidQuoteIds.add(quote.id);
  }

  const legacy = sumLegacyTripFinancials(legacyClientTrips, legacyCustomerTrips);
  const itineraryFin = sumItineraryFinancials(itineraryRecords, {
    skipQuoteIds: paidQuoteIds,
  });

  // Base: paid invoices, falling back to / topping up with quotation paid amounts
  let totalRevenue = invoiceRevenue;
  if (totalRevenue <= 0 && quotationPaidTotal > 0) {
    totalRevenue = quotationPaidTotal;
  } else if (quotationPaidTotal > totalRevenue) {
    totalRevenue = quotationPaidTotal;
  }

  // Unify: legacy trips + route-less / unpaid-quote itineraries
  totalRevenue += legacy.revenue + itineraryFin.revenue;

  if (monthlyRevenue <= 0) {
    monthlyRevenue = legacy.revenue + itineraryFin.monthlyRevenue;
  } else {
    monthlyRevenue += itineraryFin.monthlyRevenue;
  }

  // When invoice breakdown is empty, attribute legacy+itinerary revenue to private trips
  if (privateTrips + groupTours <= 0 && totalRevenue > 0) {
    privateTrips = legacy.revenue + itineraryFin.revenue;
  } else {
    privateTrips += legacy.revenue + itineraryFin.revenue;
  }

  const quotationProfitTotal = quotations.reduce((sum, q) => {
    // Unpaid quotes that already have an itinerary row are counted via itineraryFin
    const linkedItinerary = itineraryRecords.some((row) => {
      if (row.is_template === true) return false;
      return row.quote_id != null && String(row.quote_id).trim() === q.id;
    });
    if (linkedItinerary && !paidQuoteIds.has(q.id)) return sum;
    return sum + (Number(q.expected_profit) || 0);
  }, 0);
  const totalProfit = roundMoney(
    legacy.profit + itineraryFin.profit + quotationProfitTotal,
  );

  let expectedReceivables = 0;
  const quotesWithReceivableInvoice = new Set<string>();
  for (const inv of receivableInvoices) {
    expectedReceivables += inv.amount;
    if (inv.quote_id) quotesWithReceivableInvoice.add(inv.quote_id);
  }

  let pendingRevenue = 0;
  let quoteRemainingUncovered = 0;

  for (const quote of quotations) {
    const budget = quotationTotalPrice(quote);
    const remaining =
      quote.remaining_amount > 0
        ? quote.remaining_amount
        : Math.max(0, budget - (quote.paid_amount || 0));

    const rawStatus = String(
      quotationRecords.find((r) => String(r.id) === quote.id)?.status ?? quote.status,
    )
      .trim()
      .toLowerCase();

    const isPendingQuote =
      rawStatus === 'approved' ||
      rawStatus === 'awaiting_payment' ||
      rawStatus.includes('اعتماد') ||
      rawStatus.includes('انتظار');

    if (isPendingQuote) {
      pendingRevenue += remaining;
    }

    if (!quotesWithReceivableInvoice.has(quote.id)) {
      quoteRemainingUncovered += remaining;
    }
  }

  const recentReceivables: CrmReceivableInvoiceRow[] = receivableInvoices.map((inv) => {
    const meta = quoteMeta.get(inv.quote_id);
    return {
      id: inv.id,
      date: inv.created_at,
      dateLabel: formatInvoiceDate(inv.created_at),
      clientName: inv.client_id
        ? clientNames.get(inv.client_id) || inv.client_name || '—'
        : '—',
      tripTitle: inv.trip_title || meta?.title || '—',
      amount: inv.amount,
      type: inv.type,
      typeLabel: INVOICE_TYPE_LABEL[inv.type],
      statusLabel: 'بانتظار السداد',
    };
  });

  const recentTransactions: CrmPaidTransactionRow[] = paidInvoices.map((inv) => {
    const meta = quoteMeta.get(inv.quote_id);
    const dateIso = inv.paid_at || inv.created_at;
    return {
      id: inv.id,
      date: dateIso,
      dateLabel: formatInvoiceDate(dateIso),
      clientName: inv.client_id
        ? clientNames.get(inv.client_id) || inv.client_name || '—'
        : '—',
      tripTitle: inv.trip_title || meta?.title || '—',
      amount: inv.amount,
      type: inv.type,
      typeLabel: INVOICE_TYPE_LABEL[inv.type],
      tripCategory: meta?.category ?? 'private',
    };
  });

  const itineraryHistory = buildItineraryTripHistoryRows(itineraryRecords, quotationRecords);
  const leadHistory = buildLeadTripHistoryRows(leadRecords);

  const itineraryQuoteIds = new Set(
    itineraryRecords
      .map((row) => (row.quote_id != null ? String(row.quote_id).trim() : ''))
      .filter(Boolean),
  );

  const mergedTripHistory = mergeTripHistory(
    quotationRecords,
    legacyClientTrips,
    legacyCustomerTrips,
  ).filter((row) => !itineraryQuoteIds.has(row.id));

  const clientTripHistory = [...itineraryHistory, ...leadHistory, ...mergedTripHistory].sort(
    (a, b) => {
      const cmp = b.sortAt.localeCompare(a.sortAt);
      if (cmp !== 0) return cmp;
      return b.id.localeCompare(a.id);
    },
  );

  const transactionCount = clientTripHistory.length;

  return {
    kpis: {
      totalRevenue: roundMoney(totalRevenue),
      totalProfit,
      monthlyRevenue: roundMoney(monthlyRevenue),
      expectedReceivables: roundMoney(expectedReceivables),
      pendingInvoiceCount: receivableInvoices.length,
      outstandingBalances: roundMoney(
        pendingRevenue > 0 ? pendingRevenue : expectedReceivables + quoteRemainingUncovered,
      ),
      transactionCount,
    },
    revenueBreakdown: {
      privateTrips: roundMoney(privateTrips),
      groupTours: roundMoney(groupTours),
    },
    recentTransactions,
    recentReceivables,
    clientTripHistory,
  };
}

export function mapQuotationRowsFromDb(rows: Record<string, unknown>[]): QuotationRow[] {
  return rows
    .map((row) => {
      const mapped = mapQuotationRow(row);
      const clients = mapQuotationClientEmbed(row.clients ?? row.client);
      return clients ? { ...mapped, clients } : mapped;
    })
    .filter((row) => Boolean(row.id));
}

export function filterReceivableInvoiceRows(rows: Record<string, unknown>[]): InvoiceRow[] {
  return rows
    .filter((row) => isInvoiceReceivableStatus((row as { status?: unknown }).status))
    .map((row) => mapInvoiceRow(row));
}

export function mapPaidInvoiceRows(rows: Record<string, unknown>[]): InvoiceRow[] {
  return rows
    .filter((row) => String((row as { status?: unknown }).status ?? '').trim() === 'paid')
    .map((row) => mapInvoiceRow(row));
}
