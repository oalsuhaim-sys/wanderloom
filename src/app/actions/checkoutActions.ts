'use server';

import type { CheckoutClientProfile } from '@/lib/bank-checkout';
import { SALES_STAGE_PAYMENT_VERIFYING } from '@/lib/client-sales-stage';
import { fetchAgencyBankDetailsAction } from '@/app/actions/systemSettingsActions';
import { parseGroupTripPriceNumber } from '@/lib/group-trip-card-ui';
import type { AgencyBankDetails } from '@/lib/system-settings';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { assertServiceRoleKeyConfigured } from '@/lib/supabase/server-action-auth';

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

type CheckoutExtras = {
  amount: number | null;
  datesLabel: string | null;
  destination: string | null;
};

function resolveClientQueryId(clientId: string): string | number {
  const id = String(clientId ?? '').trim();
  return /^\d+$/.test(id) ? Number(id) : id;
}

function coalesceExtras(...parts: CheckoutExtras[]): CheckoutExtras {
  let amount: number | null = null;
  let datesLabel: string | null = null;
  let destination: string | null = null;
  for (const part of parts) {
    if (amount == null && part.amount != null && part.amount > 0) amount = part.amount;
    if (!datesLabel && part.datesLabel?.trim()) datesLabel = part.datesLabel.trim();
    if (!destination && part.destination?.trim()) destination = part.destination.trim();
  }
  return { amount, datesLabel, destination };
}

function mapCheckoutRow(
  id: string,
  raw: Record<string, unknown> | null | undefined,
  extras?: {
    amountDue?: number | null;
    datesLabel?: string | null;
    destination?: string | null;
  },
): CheckoutClientProfile | null {
  if (!raw) return null;
  const fromClient = String(raw.target_trip ?? '').trim();
  const fromExtras = String(extras?.destination ?? '').trim();
  const tripLabel =
    (fromClient && fromClient !== 'رحلتك الحصرية' ? fromClient : '') ||
    fromExtras ||
    'رحلتك الحصرية';
  return {
    id: String(raw.id ?? id),
    name: String(raw.name ?? raw.full_name ?? 'ضيفنا الكريم').trim() || 'ضيفنا الكريم',
    target_trip: tripLabel,
    receipt_url: raw.receipt_url ? String(raw.receipt_url) : null,
    sales_stage: raw.sales_stage != null ? String(raw.sales_stage) : null,
    amount_due:
      extras?.amountDue != null && Number.isFinite(Number(extras.amountDue)) && Number(extras.amountDue) > 0
        ? Number(extras.amountDue)
        : null,
    dates_label: extras?.datesLabel?.trim() || null,
    destination: fromExtras || (fromClient && fromClient !== 'رحلتك الحصرية' ? fromClient : null),
  };
}

const CHECKOUT_SELECT =
  'id, name, full_name, target_trip, receipt_url, sales_stage';

async function resolveFromQuotations(
  admin: AdminClient,
  clientId: string | number,
): Promise<CheckoutExtras> {
  const quote = await admin
    .from('quotations')
    .select('grand_total, total_estimated_cost, destinations, start_date, end_date, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (quote.error || !quote.data) {
    return { amount: null, datesLabel: null, destination: null };
  }

  const row = quote.data as Record<string, unknown>;
  const amount = Number(row.grand_total) || Number(row.total_estimated_cost) || null;
  const start = String(row.start_date ?? '').slice(0, 10);
  const end = String(row.end_date ?? '').slice(0, 10);
  const datesLabel = start && end ? `${start} → ${end}` : start || end || null;
  const dest = Array.isArray(row.destinations)
    ? (row.destinations as unknown[]).map(String).filter(Boolean).join(' · ')
    : String(row.destinations ?? '').trim() || null;
  return {
    amount: amount && amount > 0 ? amount : null,
    datesLabel,
    destination: dest,
  };
}

async function resolveFromItineraries(
  admin: AdminClient,
  clientId: string | number,
): Promise<CheckoutExtras> {
  const selects = [
    'title, destination, dates, start_date, end_date, total_price, grand_total, total_estimated_cost, created_at, is_template',
    'title, destination, dates, start_date, end_date, total_price, created_at',
  ];

  for (const select of selects) {
    let q = admin
      .from('itineraries')
      .select(select)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (select.includes('is_template')) {
      q = q.not('is_template', 'eq', true);
    }

    const trip = await q.maybeSingle();
    if (trip.error) {
      if (/column|schema cache|does not exist/i.test(trip.error.message ?? '')) continue;
      return { amount: null, datesLabel: null, destination: null };
    }
    if (!trip.data) return { amount: null, datesLabel: null, destination: null };

    const row = trip.data as Record<string, unknown>;
    const amount =
      Number(row.grand_total) ||
      Number(row.total_price) ||
      Number(row.total_estimated_cost) ||
      null;
    const start = String(row.start_date ?? '').slice(0, 10);
    const end = String(row.end_date ?? '').slice(0, 10);
    const datesLabel =
      String(row.dates ?? '').trim() ||
      (start && end ? `${start} → ${end}` : start || end || null);
    return {
      amount: amount && amount > 0 ? amount : null,
      datesLabel,
      destination: String(row.destination ?? row.title ?? '').trim() || null,
    };
  }

  return { amount: null, datesLabel: null, destination: null };
}

/**
 * Group passengers: no quotation — join group_members → group_trips for title + price.
 */
async function resolveFromGroupTrip(
  admin: AdminClient,
  clientId: string | number,
): Promise<CheckoutExtras> {
  const memberSelects = [
    'id, group_id, status, created_at, group_trips ( id, title_ar, title_en, price, dates_ar )',
    'id, group_id, status, created_at',
    'id, group_trip_id, status, created_at',
  ];

  type MemberRow = {
    group_id?: unknown;
    group_trip_id?: unknown;
    status?: unknown;
    created_at?: unknown;
    group_trips?: Record<string, unknown> | Record<string, unknown>[] | null;
  };

  let members: MemberRow[] = [];

  for (const select of memberSelects) {
    const result = await admin
      .from('group_members')
      .select(select)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (result.error) {
      if (/column|schema cache|does not exist|relationship|embed/i.test(result.error.message ?? '')) {
        continue;
      }
      console.warn('[resolveFromGroupTrip] members:', result.error.message);
      return { amount: null, datesLabel: null, destination: null };
    }

    members = (result.data ?? []) as unknown as MemberRow[];
    break;
  }

  if (members.length === 0) {
    return { amount: null, datesLabel: null, destination: null };
  }

  const statusRank = (status: unknown) => {
    const s = String(status ?? '').trim();
    if (s === 'confirmed_seat') return 0;
    if (s === 'approved') return 1;
    if (s === 'waitlisted') return 2;
    if (s === 'pending_interview') return 3;
    return 9;
  };

  members.sort((a, b) => {
    const rank = statusRank(a.status) - statusRank(b.status);
    if (rank !== 0) return rank;
    return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
  });

  const pick = members[0];
  const tripIdRaw = pick.group_id ?? pick.group_trip_id;
  const tripId =
    tripIdRaw != null && String(tripIdRaw).trim() !== ''
      ? /^\d+$/.test(String(tripIdRaw).trim())
        ? Number(String(tripIdRaw).trim())
        : String(tripIdRaw).trim()
      : null;

  let tripRow: Record<string, unknown> | null = null;
  const embedded = pick.group_trips;
  if (embedded && !Array.isArray(embedded)) {
    tripRow = embedded;
  } else if (Array.isArray(embedded) && embedded[0]) {
    tripRow = embedded[0];
  }

  if (!tripRow && tripId != null) {
    const tripSelects = [
      'id, title_ar, title_en, price, dates_ar',
      'id, title_ar, price, dates_ar',
      'id, title_ar, price',
    ];
    for (const select of tripSelects) {
      const trip = await admin.from('group_trips').select(select).eq('id', tripId).maybeSingle();
      if (trip.error) {
        if (/column|schema cache|does not exist/i.test(trip.error.message ?? '')) continue;
        console.warn('[resolveFromGroupTrip] trip:', trip.error.message);
        break;
      }
      tripRow = (trip.data as Record<string, unknown> | null) ?? null;
      break;
    }
  }

  if (!tripRow) {
    return { amount: null, datesLabel: null, destination: null };
  }

  const title =
    String(tripRow.title_ar ?? '').trim() ||
    String(tripRow.title_en ?? '').trim() ||
    null;
  const amount = parseGroupTripPriceNumber(
    tripRow.price != null ? String(tripRow.price) : null,
  );
  const datesLabel = String(tripRow.dates_ar ?? '').trim() || null;

  return {
    amount: amount > 0 ? amount : null,
    datesLabel,
    destination: title,
  };
}

async function resolveAmountDue(
  admin: AdminClient,
  clientId: string | number,
): Promise<CheckoutExtras> {
  // Coalesce: VIP quotes/itineraries first, then group trip package (title + 15000 etc.)
  const [fromQuote, fromItinerary, fromGroup] = await Promise.all([
    resolveFromQuotations(admin, clientId),
    resolveFromItineraries(admin, clientId),
    resolveFromGroupTrip(admin, clientId),
  ]);

  // Prefer group package when the client is seated on a group trip and quote has no amount
  const merged = coalesceExtras(fromQuote, fromItinerary, fromGroup);
  if (
    fromGroup.destination &&
    (merged.amount == null || merged.amount <= 0) &&
    fromGroup.amount != null
  ) {
    return coalesceExtras(fromGroup, fromQuote, fromItinerary);
  }
  if (fromGroup.destination && !merged.destination) {
    return { ...merged, destination: fromGroup.destination, datesLabel: merged.datesLabel || fromGroup.datesLabel };
  }

  return merged;
}

export type CheckoutPagePayload = {
  client: CheckoutClientProfile;
  bank: AgencyBankDetails;
};

/** قراءة بيانات صفحة السداد + تفاصيل البنك — service_role. */
export async function fetchCheckoutClientAction(
  clientId: string,
): Promise<
  | { ok: true; client: CheckoutClientProfile; bank: AgencyBankDetails }
  | { ok: false; error: string }
> {
  const id = String(clientId ?? '').trim();
  if (!id) return { ok: false, error: 'معرّف غير صالح' };

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  try {
    const admin = createSupabaseAdminClient();
    const queryId = resolveClientQueryId(id);

    let { data, error } = await admin
      .from('clients')
      .select(CHECKOUT_SELECT)
      .eq('id', queryId)
      .maybeSingle();

    if (error && /column|schema cache|does not exist/i.test(error.message ?? '')) {
      const fallback = await admin
        .from('clients')
        .select('id, name, sales_stage')
        .eq('id', queryId)
        .maybeSingle();
      if (fallback.error) {
        return { ok: false, error: fallback.error.message || 'تعذّر تحميل بيانات الحجز' };
      }
      data = fallback.data
        ? ({
            ...(fallback.data as Record<string, unknown>),
            full_name: null,
            target_trip: null,
            receipt_url: null,
          } as typeof data)
        : null;
      error = null;
    }

    if (error) {
      return { ok: false, error: error.message || 'تعذّر تحميل بيانات الحجز' };
    }

    const extras = await resolveAmountDue(admin, queryId);
    const client = mapCheckoutRow(id, data as Record<string, unknown> | null, {
      amountDue: extras.amount,
      datesLabel: extras.datesLabel,
      destination: extras.destination,
    });
    if (!client) {
      return { ok: false, error: 'لم يتم العثور على بيانات الحجز' };
    }

    const bankRes = await fetchAgencyBankDetailsAction(null, { requireAdmin: false });
    if (!bankRes.ok || !bankRes.data) {
      return { ok: false, error: bankRes.ok === false ? bankRes.error : 'تعذّر تحميل بيانات البنك' };
    }

    return { ok: true, client, bank: bankRes.data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذّر تحميل بيانات الحجز',
    };
  }
}

/** حفظ إيصال التحويل — مرحلة «جاري التحقق من السداد». */
export async function submitBankReceiptAction(
  clientId: string,
  receiptUrl: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = String(clientId ?? '').trim();
  const url = String(receiptUrl ?? '').trim();
  if (!id || !url) return { ok: false, error: 'بيانات غير مكتملة' };

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  try {
    const admin = createSupabaseAdminClient();
    const queryId = resolveClientQueryId(id);

    const existing = await admin
      .from('clients')
      .select('id, sales_stage')
      .eq('id', queryId)
      .maybeSingle();

    if (existing.error) {
      return { ok: false, error: existing.error.message || 'تعذّر التحقق من العميل' };
    }
    if (!existing.data) {
      return { ok: false, error: 'العميل غير موجود' };
    }

    const nextStage = SALES_STAGE_PAYMENT_VERIFYING;

    const { error } = await admin
      .from('clients')
      .update({
        receipt_url: url,
        sales_stage: nextStage,
      })
      .eq('id', queryId);

    if (error) {
      if (/receipt_url|column|schema cache/i.test(error.message ?? '')) {
        const retry = await admin
          .from('clients')
          .update({ sales_stage: nextStage })
          .eq('id', queryId);
        if (retry.error) {
          return { ok: false, error: error.message || retry.error.message };
        }
        return {
          ok: false,
          error:
            'عمود receipt_url غير موجود — نفّذ supabase/sql/clients_bank_checkout.sql في محرّر SQL.',
        };
      }
      return { ok: false, error: error.message || 'تعذّر حفظ الإيصال' };
    }

    // Best-effort: mirror on linked lead if present
    try {
      await admin
        .from('leads')
        .update({ status: 'payment_verifying' })
        .eq('client_id', queryId);
    } catch {
      /* optional */
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذّر حفظ الإيصال',
    };
  }
}
