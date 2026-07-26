import { NextResponse } from 'next/server';

import {
  resolveItineraryCost,
  resolveItineraryPaid,
} from '@/lib/client-active-itinerary';
import { fetchClientMemoriesAdmin } from '@/lib/client-memories-server';
import {
  fetchUnifiedClientTripsAdmin,
  loadClientItinerariesBundleAdmin,
} from '@/lib/client-itineraries-server';
import { normalizeProfilePinInput } from '@/lib/client-profile-unlock';
import type { ClientProfileDashboardPayload } from '@/lib/client-profile-dashboard';
import { mapInvoiceRow } from '@/lib/crm-invoices';
import { CRM_INVOICES_TABLE, CRM_QUOTATIONS_TABLE } from '@/lib/crm-invoices-server';
import {
  coerceQuotationIdForDb,
  mapQuotationRow,
  quotationTotalPrice,
} from '@/lib/crm-quotations';
import { normalizeVipSpendingTier } from '@/lib/vip-spending-tier';
import { parseWalletBalance } from '@/lib/vip-wallet-ledger';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function pickString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

function roundMoney(value: number): number {
  return Math.round(Math.max(0, value) * 100) / 100;
}

/** Coerce DB numerics / numeric strings — never NaN. */
function money(raw: unknown): number {
  if (raw == null || raw === '') return 0;
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.max(0, raw) : 0;
  const cleaned = String(raw).replace(/,/g, '').replace(/[^\d.-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function clientIdKeys(clientId: string | number): Array<string | number> {
  const raw = String(clientId ?? '').trim();
  const keys: Array<string | number> = [raw, coerceQuotationIdForDb(clientId)];
  if (/^\d+$/.test(raw)) keys.push(Number(raw));
  return [...new Set(keys.map((k) => (typeof k === 'number' ? k : String(k))))];
}

/**
 * Confirmed schema (from supabase/sql + CRM libs):
 *
 * invoices:    amount + status ('paid' | 'pending')  ← source of truth for payments
 * quotations:  grand_total / total_estimated_cost, paid_amount, remaining_amount
 * itineraries: total_budget / total_price / amount_paid / spent_amount
 */
function aggregateClientFinancials(input: {
  quoteRows: Record<string, unknown>[];
  invoiceRows: Record<string, unknown>[];
  itineraryRows: Record<string, unknown>[];
  legacyTripCost: number;
  clientStoredSpent: number;
}): {
  totalCost: number;
  amountPaid: number;
  remainingBalance: number;
  debug: Record<string, unknown>;
} {
  let quoteCost = 0;
  let quotePaid = 0;
  let quoteRemaining = 0;
  let quoteBudgetFound = false;

  const quoteDebug: Array<Record<string, unknown>> = [];

  for (const raw of input.quoteRows) {
    const quote = mapQuotationRow(raw);
    const budget =
      quotationTotalPrice(quote) ||
      money(raw.grand_total) ||
      money(raw.total_estimated_cost) ||
      money(raw.total_price) ||
      money(raw.amount);
    // Exact column: quotations.paid_amount
    const paid = money(raw.paid_amount) || money(quote.paid_amount);
    // Exact column: quotations.remaining_amount
    const remainingStored = money(raw.remaining_amount) || money(quote.remaining_amount);

    quoteDebug.push({
      id: raw.id,
      grand_total: raw.grand_total,
      total_estimated_cost: raw.total_estimated_cost,
      paid_amount: raw.paid_amount,
      remaining_amount: raw.remaining_amount,
      resolvedBudget: budget,
      resolvedPaid: paid,
      resolvedRemaining: remainingStored,
    });

    if (budget > 0) {
      quoteBudgetFound = true;
      quoteCost += budget;
      quotePaid += paid;
      quoteRemaining +=
        remainingStored > 0 ? remainingStored : Math.max(0, budget - paid);
    } else if (paid > 0 || remainingStored > 0) {
      quoteBudgetFound = true;
      quoteCost += paid + remainingStored;
      quotePaid += paid;
      quoteRemaining += remainingStored;
    }
  }

  // Exact schema: invoices.amount where invoices.status = 'paid'
  let invoicePaid = 0;
  const invoiceDebug: Array<Record<string, unknown>> = [];
  for (const raw of input.invoiceRows) {
    const inv = mapInvoiceRow(raw);
    invoiceDebug.push({
      id: inv.id,
      amount: inv.amount,
      status: inv.status,
      client_id: inv.client_id,
      quote_id: inv.quote_id,
    });
    if (inv.status === 'paid') {
      invoicePaid += money(inv.amount);
    }
  }

  let itineraryCost = 0;
  let itineraryPaid = 0;
  const itineraryDebug: Array<Record<string, unknown>> = [];
  for (const row of input.itineraryRows) {
    const cost = resolveItineraryCost(row);
    // Exact / known itinerary paid columns: amount_paid, spent_amount
    const paid =
      money(row.amount_paid) ||
      money(row.spent_amount) ||
      money(row.paid_amount) ||
      resolveItineraryPaid(row);
    itineraryCost += cost;
    itineraryPaid += paid;
    itineraryDebug.push({
      id: row.id,
      total_budget: row.total_budget,
      total_price: row.total_price,
      amount_paid: row.amount_paid,
      spent_amount: row.spent_amount,
      resolvedCost: cost,
      resolvedPaid: paid,
    });
  }

  // Cost: prefer quotation budgets; else itineraries; else legacy trips
  let totalCost = quoteBudgetFound
    ? quoteCost
    : itineraryCost > 0
      ? itineraryCost
      : input.legacyTripCost;

  /**
   * Paid: ALWAYS prefer live invoice `amount` (status=paid), then quotation.paid_amount,
   * then itinerary amount_paid/spent_amount. Never treat cost as paid.
   */
  let amountPaid = 0;
  if (invoicePaid > 0) amountPaid = invoicePaid;
  else if (quotePaid > 0) amountPaid = quotePaid;
  else if (itineraryPaid > 0) amountPaid = itineraryPaid;
  else if (input.clientStoredSpent > 0 && input.clientStoredSpent < totalCost) {
    amountPaid = input.clientStoredSpent;
  }

  // If we have invoice paid AND quote paid, take the max (avoid double-count, prefer higher signal)
  if (invoicePaid > 0 && quotePaid > 0) {
    amountPaid = Math.max(invoicePaid, quotePaid);
  }

  totalCost = roundMoney(totalCost);
  amountPaid = roundMoney(amountPaid);

  // Prefer explicit remaining from quotes when it matches cost−paid within 1 SAR; else compute.
  let remainingBalance = roundMoney(Math.max(0, totalCost - amountPaid));
  if (quoteBudgetFound && quoteRemaining > 0) {
    const computed = remainingBalance;
    const stored = roundMoney(quoteRemaining);
    // Use stored remaining when paid was resolved (avoids stale remaining when paid=0 wrongly)
    if (amountPaid > 0 || Math.abs(stored - computed) < 1) {
      remainingBalance = amountPaid > 0 ? computed : stored;
    }
  }

  // Final authoritative formula when we have both cost and paid
  if (totalCost > 0) {
    remainingBalance = roundMoney(Math.max(0, totalCost - amountPaid));
  }

  return {
    totalCost,
    amountPaid,
    remainingBalance,
    debug: {
      schemaHint: {
        invoices: 'amount + status=paid',
        quotations: 'grand_total / paid_amount / remaining_amount',
        itineraries: 'total_budget|total_price / amount_paid|spent_amount',
      },
      quoteCount: input.quoteRows.length,
      invoiceCount: input.invoiceRows.length,
      itineraryCount: input.itineraryRows.length,
      quoteCost,
      quotePaid,
      quoteRemaining,
      invoicePaid,
      itineraryCost,
      itineraryPaid,
      legacyTripCost: input.legacyTripCost,
      clientStoredSpent: input.clientStoredSpent,
      resolved: { totalCost, amountPaid, remainingBalance },
      quotes: quoteDebug,
      invoices: invoiceDebug,
      itineraries: itineraryDebug,
    },
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = normalizeProfilePinInput(url.searchParams.get('code') ?? '');
  if (!code) {
    return NextResponse.json({ ok: false, error: 'missing_code' }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 });
  }

  const { data: clientRaw, error: clientError } = await admin
    .from('clients')
    .select('*')
    .eq('profile_code', code)
    .maybeSingle();

  if (clientError) {
    console.warn('[profile-dashboard] client lookup:', clientError.message);
    return NextResponse.json({ ok: false, error: 'lookup_failed' }, { status: 500 });
  }

  if (!clientRaw || (clientRaw as { id?: unknown }).id == null) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  const clientRow = clientRaw as Record<string, unknown>;
  const clientId = clientRow.id as string | number;
  const clientDbId = coerceQuotationIdForDb(clientId);
  const keys = clientIdKeys(clientId);
  const referral =
    pickString(clientRow, ['ref_code', 'referral_code', 'referralCode']) || null;
  const passportRaw = pickString(clientRow, [
    'passport_expiry',
    'passportExpiry',
    'passport_expire',
  ]);
  const passportExpiry = passportRaw ? passportRaw.slice(0, 10) : null;

  const [
    { bundle, error: tripsError },
    { trips: unifiedTrips, error: unifiedError },
    { memories, error: memoriesError },
    quotesRes,
    invoicesRes,
    itinerariesFinanceRes,
  ] = await Promise.all([
    loadClientItinerariesBundleAdmin(admin, clientId),
    fetchUnifiedClientTripsAdmin(admin, clientId),
    fetchClientMemoriesAdmin(admin, clientId),
    // Try both coerced id and raw keys — client_id type mismatches are common
    admin.from(CRM_QUOTATIONS_TABLE).select('*').in('client_id', keys),
    admin.from(CRM_INVOICES_TABLE).select('*').in('client_id', keys),
    // select('*') avoids PGRST204 when amount_paid / paid_amount columns are missing
    admin
      .from('itineraries')
      .select('*')
      .in('client_id', keys)
      .or('is_template.is.null,is_template.eq.false'),
  ]);

  if (tripsError) console.warn('[profile-dashboard] trips lookup:', tripsError);
  if (unifiedError) console.warn('[profile-dashboard] unified trips:', unifiedError);
  if (memoriesError) console.warn('[profile-dashboard] memories:', memoriesError);
  if (quotesRes.error) {
    console.warn('[profile-dashboard] quotations:', quotesRes.error.message);
  }
  if (invoicesRes.error) {
    console.warn('[profile-dashboard] invoices:', invoicesRes.error.message);
  }
  if (itinerariesFinanceRes.error) {
    console.warn('[profile-dashboard] itineraries finance:', itinerariesFinanceRes.error.message);
  }

  // Fallback single-eq if .in failed
  let quoteRows = (quotesRes.data ?? []) as Record<string, unknown>[];
  let invoiceRows = (invoicesRes.data ?? []) as Record<string, unknown>[];
  let itineraryFinanceRows = (itinerariesFinanceRes.data ?? []) as Record<string, unknown>[];

  if (quotesRes.error || (quoteRows.length === 0 && invoicesRes.error)) {
    const q2 = await admin.from(CRM_QUOTATIONS_TABLE).select('*').eq('client_id', clientDbId);
    if (!q2.error && q2.data) quoteRows = q2.data as Record<string, unknown>[];
  }
  if (invoicesRes.error || invoiceRows.length === 0) {
    const i2 = await admin.from(CRM_INVOICES_TABLE).select('*').eq('client_id', clientDbId);
    if (!i2.error && i2.data) invoiceRows = i2.data as Record<string, unknown>[];
  }
  if (itinerariesFinanceRes.error) {
    const t2 = await admin
      .from('itineraries')
      .select('*')
      .eq('client_id', clientDbId)
      .or('is_template.is.null,is_template.eq.false');
    if (!t2.error && t2.data) itineraryFinanceRows = t2.data as Record<string, unknown>[];
  }

  // Many invoices only store quote_id — pull paid invoices for this client's quotes too.
  if (quoteRows.length > 0) {
    const quoteIds = quoteRows
      .map((q) => String(q.id ?? '').trim())
      .filter(Boolean);
    if (quoteIds.length) {
      const byQuote = await admin
        .from(CRM_INVOICES_TABLE)
        .select('*')
        .in('quote_id', quoteIds);
      if (!byQuote.error && byQuote.data?.length) {
        const byId = new Map<string, Record<string, unknown>>();
        for (const row of invoiceRows) {
          const id = String(row.id ?? '').trim();
          if (id) byId.set(id, row);
        }
        for (const row of byQuote.data as Record<string, unknown>[]) {
          const id = String(row.id ?? '').trim();
          if (id) byId.set(id, row);
        }
        invoiceRows = [...byId.values()];
      }
    }
  }

  const safeBundle = tripsError
    ? {
        activeTrip: null as typeof bundle.activeTrip,
        pastTrips: [] as typeof bundle.pastTrips,
        allTrips: [] as typeof bundle.allTrips,
      }
    : bundle;

  const legacyTripCost = roundMoney(
    unifiedTrips.reduce((sum, trip) => sum + (Number(trip.cost) || 0), 0),
  );

  const clientStoredSpent = money(clientRow.total_spent);

  const { totalCost, amountPaid, remainingBalance, debug } = aggregateClientFinancials({
    quoteRows,
    invoiceRows,
    itineraryRows: itineraryFinanceRows,
    legacyTripCost,
    clientStoredSpent,
  });

  // Server-side diagnostic (visible in Vercel / terminal logs)
  console.log(
    '[profile-dashboard] RAW FINANCE SOURCES',
    JSON.stringify(
      {
        clientId,
        clientDbId,
        keys,
        quotes: quoteRows.length,
        invoices: invoiceRows.length,
        itineraries: itineraryFinanceRows.length,
        debug,
      },
      null,
      2,
    ),
  );

  const totalSpent = amountPaid;

  const storedTripsCount = Number(clientRow.total_trips) || 0;
  const tripsCount = Math.max(
    unifiedTrips.length,
    safeBundle.allTrips.length,
    storedTripsCount,
  );

  const payload: ClientProfileDashboardPayload = {
    ok: true,
    client: {
      id: clientId,
      name: pickString(clientRow, ['name', 'full_name']) || 'عميل VIP',
      vipTier: normalizeVipSpendingTier(
        clientRow.vip_tier != null ? String(clientRow.vip_tier) : null,
        totalSpent > 0 ? totalSpent : null,
      ),
      referralCode: referral,
      passportExpiry,
      walletBalance: parseWalletBalance(clientRow.wallet_balance),
      totalSpent,
      totalTripCost: totalCost,
      remainingBalance,
      tripsCount,
    },
    trips: safeBundle.allTrips,
    activeTrip: safeBundle.activeTrip,
    pastTrips: safeBundle.pastTrips,
    memories,
  };

  return NextResponse.json(
    {
      ...payload,
      clientId,
      profileCode: String(clientRow.profile_code ?? code),
      activeItinerarySlug: safeBundle.activeTrip?.slug ?? null,
      // Browser console: open F12 → Console after refresh
      _financeDebug: debug,
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    },
  );
}
