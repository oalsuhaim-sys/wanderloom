/** تجميع التحليل المالي — إيرادات، تكاليف، صافي ربح، وجهات، خبراء، فواتير */

import {
  computeInvoiceFinanceMetrics,
  isInvoicePaidOrApprovedStatus,
  mapInvoiceRow,
  type InvoiceFinanceMetrics,
  type InvoiceRow,
} from '@/lib/crm-invoices';

export type DestinationProfitRow = {
  destination: string;
  revenue: number;
  costs: number;
  profit: number;
  trips: number;
};

export type ExpertLeaderboardRow = {
  expertId: string;
  name: string;
  trips: number;
  revenue: number;
  profit: number;
};

export type FinancialAnalyticsSnapshot = {
  grossRevenue: number;
  totalCosts: number;
  netProfit: number;
  marginPct: number;
  closedTripCount: number;
  destinations: DestinationProfitRow[];
  experts: ExpertLeaderboardRow[];
  /** KPIs مباشرة من جدول invoices */
  invoiceMetrics: InvoiceFinanceMetrics;
  /** أحدث الفواتير للعرض في اللوحة */
  recentInvoices: InvoiceRow[];
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function money(raw: unknown): number {
  if (raw == null || raw === '') return 0;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function isClosedOrPaidStatus(raw: unknown): boolean {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!s) return false;
  return (
    s.includes('complet') ||
    s.includes('paid') ||
    s.includes('confirm') ||
    s === 'active' ||
    s === 'approved' ||
    s === 'converted' ||
    s.includes('نشط') ||
    s.includes('مكتمل') ||
    s.includes('مدفوع') ||
    s.includes('معتمد')
  );
}

function normalizeDestination(raw: unknown): string {
  const s = String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!s || s === '—' || s === '-') return 'غير محدد';
  // First segment of multi-city labels
  const first = s.split(/[,،|/·]+/)[0]?.trim() || s;
  return first.slice(0, 48);
}

type TripFin = {
  id: string;
  destination: string;
  revenue: number;
  costs: number;
  profit: number;
  expertId: string | null;
};

function finFromQuoteAndItinerary(
  itinerary: Record<string, unknown> | null,
  quote: Record<string, unknown> | null,
): Omit<TripFin, 'id' | 'destination' | 'expertId'> | null {
  const paid = money(quote?.paid_amount) || money(itinerary?.paid_amount) || money(itinerary?.amount_paid);
  const costs =
    money(quote?.total_estimated_cost) ||
    money(itinerary?.total_estimated_cost) ||
    money(itinerary?.total_cost);
  const expectedProfit =
    money(quote?.expected_profit) || money(itinerary?.expected_profit) || money(itinerary?.profit);
  const grand =
    money(quote?.grand_total) ||
    money(itinerary?.grand_total) ||
    money(itinerary?.total_price) ||
    money(itinerary?.price);

  const statusClosed =
    isClosedOrPaidStatus(quote?.status) ||
    isClosedOrPaidStatus(itinerary?.status) ||
    paid > 0;

  if (!statusClosed && paid <= 0 && expectedProfit <= 0 && grand <= 0) {
    return null;
  }

  // إيرادات العميل: المدفوع أولاً، ثم إجمالي العرض/المسار
  let revenue = paid > 0 ? paid : grand;
  if (revenue <= 0 && costs > 0 && expectedProfit > 0) {
    revenue = costs + expectedProfit;
  }
  if (revenue <= 0 && expectedProfit > 0) {
    revenue = expectedProfit;
  }

  // تكاليف الموردين/الطيران/الفنادق
  let tripCosts = costs;
  if (tripCosts <= 0 && revenue > 0 && expectedProfit > 0 && revenue >= expectedProfit) {
    tripCosts = roundMoney(revenue - expectedProfit);
  }

  let profit = expectedProfit;
  if (profit <= 0 && revenue > 0) {
    profit = roundMoney(revenue - tripCosts);
  }

  if (revenue <= 0 && tripCosts <= 0 && profit <= 0) return null;

  return {
    revenue: roundMoney(Math.max(0, revenue)),
    costs: roundMoney(Math.max(0, tripCosts)),
    profit: roundMoney(profit),
  };
}

function pickEmbed(row: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const raw = row[key];
  if (!raw) return null;
  if (Array.isArray(raw)) {
    const first = raw[0];
    return first && typeof first === 'object' ? (first as Record<string, unknown>) : null;
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  return null;
}

/**
 * يبني لوحة التحليل المالي من صفوف Supabase.
 */
export function buildFinancialAnalyticsSnapshot(input: {
  itineraries: Record<string, unknown>[];
  quotations: Record<string, unknown>[];
  /** All invoices (paid + pending) — preferred */
  invoices?: Record<string, unknown>[];
  /** @deprecated use `invoices` — kept for call-site compatibility */
  paidInvoices?: Record<string, unknown>[];
  experts: Record<string, unknown>[];
  legacyClientTrips?: Record<string, unknown>[];
}): FinancialAnalyticsSnapshot {
  const quoteById = new Map<string, Record<string, unknown>>();
  for (const q of input.quotations) {
    const id = String(q.id ?? '').trim();
    if (id) quoteById.set(id, q);
  }

  const expertNameById = new Map<string, string>();
  for (const e of input.experts) {
    const id = String(e.id ?? '').trim();
    const name = String(e.name ?? '').trim();
    if (id && name) expertNameById.set(id, name);
  }

  const allInvoiceRows = (input.invoices?.length ? input.invoices : input.paidInvoices) ?? [];
  const mappedInvoices = allInvoiceRows
    .map((row) => mapInvoiceRow(row))
    .filter((inv) => inv.id);
  const invoiceMetrics = computeInvoiceFinanceMetrics(mappedInvoices);
  const recentInvoices = [...mappedInvoices]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 40);

  // Paid invoice totals by quote_id (client payments)
  const paidByQuote = new Map<string, number>();
  let orphanInvoiceRevenue = 0;
  for (const inv of mappedInvoices) {
    if (!isInvoicePaidOrApprovedStatus(inv.status)) continue;
    const amount = money(inv.amount);
    if (amount <= 0) continue;
    const quoteId = inv.quote_id != null ? String(inv.quote_id).trim() : '';
    if (quoteId) {
      paidByQuote.set(quoteId, (paidByQuote.get(quoteId) ?? 0) + amount);
    } else {
      orphanInvoiceRevenue += amount;
    }
  }

  const trips: TripFin[] = [];
  const seenQuoteIds = new Set<string>();

  for (const row of input.itineraries) {
    if (row.is_template === true || String(row.is_template ?? '').trim() === 'true') continue;
    const id = String(row.id ?? '').trim();
    if (!id) continue;

    const embedded = pickEmbed(row, 'quotations');
    const quoteId =
      row.quote_id != null
        ? String(row.quote_id).trim()
        : embedded?.id != null
          ? String(embedded.id).trim()
          : '';
    const quote = embedded ?? (quoteId ? quoteById.get(quoteId) ?? null : null);

    // Inject invoice payments into quote-like view
    const quoteView: Record<string, unknown> | null = quote
      ? {
          ...quote,
          paid_amount: Math.max(
            money(quote.paid_amount),
            quoteId ? paidByQuote.get(quoteId) ?? 0 : 0,
          ),
        }
      : quoteId && paidByQuote.has(quoteId)
        ? { paid_amount: paidByQuote.get(quoteId), status: 'paid' }
        : null;

    const fin = finFromQuoteAndItinerary(row, quoteView);
    if (!fin) continue;

    if (quoteId) seenQuoteIds.add(quoteId);

    const destination = normalizeDestination(
      row.destination ??
        (Array.isArray(quote?.destinations)
          ? (quote!.destinations as string[]).join(' · ')
          : quote?.destinations),
    );

    const expertId =
      row.expert_id != null && String(row.expert_id).trim()
        ? String(row.expert_id).trim()
        : null;

    trips.push({
      id: `itinerary:${id}`,
      destination,
      revenue: fin.revenue,
      costs: fin.costs,
      profit: fin.profit,
      expertId,
    });
  }

  // Quotations without itinerary (paid / closed)
  for (const [quoteId, quote] of quoteById) {
    if (seenQuoteIds.has(quoteId)) continue;
    const paid = Math.max(money(quote.paid_amount), paidByQuote.get(quoteId) ?? 0);
    const quoteView = { ...quote, paid_amount: paid };
    if (!isClosedOrPaidStatus(quote.status) && paid <= 0) continue;

    const fin = finFromQuoteAndItinerary(null, quoteView);
    if (!fin) continue;

    const dest = normalizeDestination(
      Array.isArray(quote.destinations)
        ? (quote.destinations as string[]).join(' · ')
        : quote.destinations ?? quote.title,
    );

    trips.push({
      id: `quote:${quoteId}`,
      destination: dest,
      revenue: fin.revenue,
      costs: fin.costs,
      profit: fin.profit,
      expertId: null,
    });
  }

  // Legacy client_trips
  for (const row of input.legacyClientTrips ?? []) {
    const id = String(row.id ?? '').trim();
    if (!id) continue;
    const profit = money(row.profit ?? row.expected_profit);
    const revenue =
      money(row.cost ?? row.total_price ?? row.grand_total ?? row.amount ?? row.revenue) || profit;
    if (revenue <= 0 && profit <= 0) continue;
    const costs = revenue > profit ? roundMoney(revenue - profit) : 0;
    trips.push({
      id: `legacy:${id}`,
      destination: normalizeDestination(row.destination),
      revenue: roundMoney(revenue),
      costs,
      profit: roundMoney(profit || revenue - costs),
      expertId: null,
    });
  }

  const grossRevenue = trips.reduce((s, t) => s + t.revenue, 0) + orphanInvoiceRevenue;
  const totalCosts = trips.reduce((s, t) => s + t.costs, 0);
  let netProfit = trips.reduce((s, t) => s + t.profit, 0);

  // If orphan invoices exist without cost attribution, keep them in revenue only
  if (netProfit <= 0 && grossRevenue > totalCosts) {
    netProfit = roundMoney(grossRevenue - totalCosts);
  }

  const destMap = new Map<string, DestinationProfitRow>();
  for (const t of trips) {
    const cur = destMap.get(t.destination) ?? {
      destination: t.destination,
      revenue: 0,
      costs: 0,
      profit: 0,
      trips: 0,
    };
    cur.revenue += t.revenue;
    cur.costs += t.costs;
    cur.profit += t.profit;
    cur.trips += 1;
    destMap.set(t.destination, cur);
  }

  const destinations = [...destMap.values()]
    .map((d) => ({
      ...d,
      revenue: roundMoney(d.revenue),
      costs: roundMoney(d.costs),
      profit: roundMoney(d.profit),
    }))
    .sort((a, b) => b.profit - a.profit || b.revenue - a.revenue)
    .slice(0, 10);

  const expertMap = new Map<string, ExpertLeaderboardRow>();
  for (const t of trips) {
    if (!t.expertId) continue;
    const name = expertNameById.get(t.expertId) || 'خبير';
    const cur = expertMap.get(t.expertId) ?? {
      expertId: t.expertId,
      name,
      trips: 0,
      revenue: 0,
      profit: 0,
    };
    cur.trips += 1;
    cur.revenue += t.revenue;
    cur.profit += t.profit;
    expertMap.set(t.expertId, cur);
  }

  const experts = [...expertMap.values()]
    .map((e) => ({
      ...e,
      revenue: roundMoney(e.revenue),
      profit: roundMoney(e.profit),
    }))
    .sort((a, b) => b.revenue - a.revenue || b.trips - a.trips)
    .slice(0, 8);

  const marginPct =
    grossRevenue > 0 ? roundMoney((netProfit / grossRevenue) * 100) : 0;

  // Prefer hard invoice revenue when invoices exist; else trip-derived gross
  const invoiceBackedRevenue = invoiceMetrics.totalRevenue;
  const resolvedGross =
    invoiceBackedRevenue > 0 ? invoiceBackedRevenue : roundMoney(grossRevenue);

  return {
    grossRevenue: resolvedGross,
    totalCosts: roundMoney(totalCosts),
    netProfit: roundMoney(netProfit),
    marginPct:
      resolvedGross > 0 ? roundMoney((netProfit / resolvedGross) * 100) : marginPct,
    closedTripCount: trips.length,
    destinations,
    experts,
    invoiceMetrics,
    recentInvoices,
  };
}
