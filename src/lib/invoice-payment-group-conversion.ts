import 'server-only';

import { canonicalizePhoneWa } from '@/lib/client-intake-pipeline';
import { ensureLeadClientIntakeAdmin } from '@/lib/client-intake-pipeline-server';
import { resolveLeadPreferredTripId } from '@/lib/crm-leads';
import { coerceQuotationIdForDb } from '@/lib/crm-quotations';
import { fetchGroupTripCapacity } from '@/lib/group-members';
import type { SupabaseClient } from '@supabase/supabase-js';

function sanitizePhoneDigits(phoneRaw: string): string {
  return String(phoneRaw ?? '').replace(/\D/g, '');
}

export type PaymentGroupConversionResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  clientId?: string;
  tripId?: string;
  memberStatus?: 'confirmed_seat' | 'waitlisted';
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string | null;
  tripTitle?: string;
};

function coerceId(raw: string): string | number {
  return /^\d+$/.test(raw) ? Number(raw) : raw;
}

function isGroupStyleLead(row: Record<string, unknown>): boolean {
  const style = String(row.travel_style ?? '').trim();
  if (style === 'Private') return false;
  if (style === 'Group' || style === 'Group Trip Onboarding') return true;
  if (/^group(\s+trip)?(\s+onboarding)?$/i.test(style)) return true;
  if (String(row.form_type ?? '').trim() === 'group_trip') return true;
  const preferred = String(row.preferred_trip_id ?? '').trim();
  if (preferred) return true;
  const thoughts = String(row.final_thoughts ?? '');
  return /رحلة جماعية|Group Trip Onboarding|preferred_trip:/i.test(thoughts);
}

async function loadLeadRow(
  admin: SupabaseClient,
  leadId: string,
): Promise<Record<string, unknown> | null> {
  const selects = [
    'id, full_name, phone_wa, email, status, client_id, travel_style, form_type, preferred_trip_id, destinations, final_thoughts',
    'id, full_name, phone_wa, email, status, client_id, form_type, preferred_trip_id, final_thoughts',
    'id, full_name, phone_wa, email, status, client_id, final_thoughts',
  ];
  for (const select of selects) {
    const { data, error } = await admin
      .from('leads')
      .select(select)
      .eq('id', leadId)
      .maybeSingle();
    if (!error && data) return data as unknown as Record<string, unknown>;
    if (error && !/column|schema cache|does not exist/i.test(error.message ?? '')) {
      console.warn('[payment-group-convert] lead load:', error.message);
      return null;
    }
  }
  return null;
}

async function resolveTripIdForPayment(
  admin: SupabaseClient,
  opts: {
    lead: Record<string, unknown> | null;
    invoiceTripTitle?: string | null;
    quoteTitle?: string | null;
    existingClientId?: string | null;
  },
): Promise<string | null> {
  if (opts.lead) {
    const fromCol = String(opts.lead.preferred_trip_id ?? '').trim();
    if (fromCol) return fromCol;
    const fromResolver = resolveLeadPreferredTripId({
      preferred_trip_id: null,
      final_thoughts:
        opts.lead.final_thoughts != null ? String(opts.lead.final_thoughts) : '',
    });
    if (fromResolver) return fromResolver;
    const thoughts = String(opts.lead.final_thoughts ?? '');
    const numeric = thoughts.match(/preferred_trip:(\d+)/i);
    if (numeric?.[1]) return numeric[1];
  }

  if (opts.existingClientId) {
    const clientKey = coerceId(String(opts.existingClientId));
    for (const fk of ['group_id', 'group_trip_id'] as const) {
      const { data, error } = await admin
        .from('group_members')
        .select(`${fk}`)
        .eq('client_id', clientKey)
        .limit(1)
        .maybeSingle();
      if (error && /column|schema cache|does not exist/i.test(error.message ?? '')) continue;
      const trip = String((data as Record<string, unknown> | null)?.[fk] ?? '').trim();
      if (trip) return trip;
    }
  }

  const titleHint = String(opts.invoiceTripTitle || opts.quoteTitle || '')
    .trim()
    .toLowerCase();
  if (titleHint.length >= 2) {
    const { data: trips } = await admin
      .from('group_trips')
      .select('id, title_ar, title_en')
      .eq('is_active', true)
      .limit(80);
    for (const trip of trips ?? []) {
      const row = trip as Record<string, unknown>;
      const ar = String(row.title_ar ?? '').trim().toLowerCase();
      const en = String(row.title_en ?? '').trim().toLowerCase();
      if ((ar && titleHint.includes(ar)) || (en && titleHint.includes(en))) {
        return String(row.id ?? '').trim() || null;
      }
      if ((ar && ar.includes(titleHint)) || (en && en.includes(titleHint))) {
        return String(row.id ?? '').trim() || null;
      }
    }
  }

  return null;
}

async function ensureCustomersProfile(
  admin: SupabaseClient,
  input: { fullName: string; phoneWa: string; email?: string | null },
): Promise<void> {
  const phone = sanitizePhoneDigits(input.phoneWa);
  if (!phone || !input.fullName.trim()) return;
  const phoneWa = canonicalizePhoneWa(phone) || phone;

  const { data: existing } = await admin
    .from('customers')
    .select('id')
    .eq('phone_wa', phoneWa)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return;

  const payloads: Record<string, unknown>[] = [
    {
      full_name: input.fullName.trim(),
      phone_wa: phoneWa,
      email: input.email ?? null,
      source: 'invoice_payment',
      status: 'new',
    },
    { full_name: input.fullName.trim(), phone_wa: phoneWa, status: 'new' },
    { full_name: input.fullName.trim(), phone_wa: phoneWa },
  ];

  for (const payload of payloads) {
    const { error } = await admin.from('customers').insert(payload);
    if (!error) return;
    if (error.code === '23505' || /duplicate|unique/i.test(error.message ?? '')) return;
    if (/column|schema cache|does not exist/i.test(error.message ?? '')) continue;
    console.warn('[payment-group-convert] customers insert:', error.message);
    return;
  }
}

async function upsertPaidGroupMember(
  admin: SupabaseClient,
  input: {
    clientId: string;
    tripId: string;
    customerName: string;
    customerPhone: string;
  },
): Promise<
  | { ok: true; status: 'confirmed_seat' | 'waitlisted' }
  | { ok: false; error: string }
> {
  const capacity = await fetchGroupTripCapacity(admin, input.tripId);
  if (!capacity.ok) return { ok: false, error: capacity.error };

  const tripId = /^\d+$/.test(capacity.data.tripId)
    ? Number(capacity.data.tripId)
    : capacity.data.tripId;
  const clientKey = coerceId(input.clientId);
  const phoneWa = input.customerPhone
    ? canonicalizePhoneWa(sanitizePhoneDigits(input.customerPhone)) ||
      sanitizePhoneDigits(input.customerPhone)
    : '';

  let existingMember: Record<string, unknown> | null = null;
  {
    const primary = await admin
      .from('group_members')
      .select('id, status, group_id')
      .eq('client_id', clientKey)
      .limit(1)
      .maybeSingle();
    if (!primary.error) {
      existingMember = (primary.data as Record<string, unknown> | null) ?? null;
    } else {
      const lean = await admin
        .from('group_members')
        .select('id, status')
        .eq('client_id', clientKey)
        .limit(1)
        .maybeSingle();
      existingMember = (lean.data as Record<string, unknown> | null) ?? null;
    }
  }

  const existingStatus = String(
    (existingMember as { status?: unknown } | null)?.status ?? '',
  );
  const alreadyConfirmed = existingStatus === 'confirmed_seat';
  const hasCapacity = alreadyConfirmed || capacity.data.hasConfirmedCapacity;
  const status: 'confirmed_seat' | 'waitlisted' = hasCapacity
    ? 'confirmed_seat'
    : capacity.data.allowWaitlist
      ? 'waitlisted'
      : 'confirmed_seat'; // paid passenger: still place them if waitlist off

  const confirmedCount = capacity.data.confirmedCount;
  const nextBooked =
    status === 'confirmed_seat' && !alreadyConfirmed ? confirmedCount + 1 : confirmedCount;

  const payload: Record<string, unknown> = {
    client_id: clientKey,
    group_id: tripId,
    status,
    payment_status: 'paid',
    payment_deadline: null,
    updated_at: new Date().toISOString(),
  };
  if (input.customerName) payload.customer_name = input.customerName;
  if (phoneWa) payload.customer_phone = phoneWa;

  const tryUpdate = async (): Promise<string | null> => {
    let { error } = await admin.from('group_members').update(payload).eq('client_id', clientKey);
    if (error && /payment_|column|schema cache|does not exist/i.test(error.message ?? '')) {
      const lean = { ...payload };
      delete lean.payment_deadline;
      delete lean.payment_status;
      const retry = await admin.from('group_members').update(lean).eq('client_id', clientKey);
      error = retry.error;
    }
    return error ? error.message : null;
  };

  if (existingMember) {
    const updMsg = await tryUpdate();
    if (updMsg) return { ok: false, error: updMsg };
  } else {
    let { error } = await admin.from('group_members').insert(payload);
    if (error && /payment_|column|schema cache|does not exist/i.test(error.message ?? '')) {
      const lean = { ...payload };
      delete lean.payment_deadline;
      delete lean.payment_status;
      const retry = await admin.from('group_members').insert(lean);
      error = retry.error;
    }
    if (error) {
      if (error.code === '23505' || /duplicate|unique/i.test(error.message ?? '')) {
        const updMsg = await tryUpdate();
        if (updMsg) return { ok: false, error: updMsg };
      } else {
        return { ok: false, error: error.message };
      }
    }
  }

  if (status === 'confirmed_seat' && nextBooked !== confirmedCount) {
    await admin
      .from('group_trips')
      .update({ booked_seats: nextBooked })
      .eq('id', tripId);
  }

  return { ok: true, status };
}

/**
 * Payment confirmation → CRM conversion for Group trips:
 * 1) ensure clients (+ customers) profile
 * 2) insert/update group_members (confirmed + payment_status=paid)
 * 3) leads.status stays/moves to payment_confirmed (caller also syncs Kanban)
 */
export async function convertGroupPassengerOnInvoicePaid(
  admin: SupabaseClient,
  input: {
    leadId?: string | null;
    clientId?: string | null;
    quoteTripCategory?: string | null;
    invoiceTripTitle?: string | null;
    quoteTitle?: string | null;
  },
): Promise<PaymentGroupConversionResult> {
  const leadId = String(input.leadId ?? '').trim() || null;
  let clientId = input.clientId != null ? String(input.clientId).trim() : '';
  if (clientId === '') clientId = '';

  const lead = leadId ? await loadLeadRow(admin, leadId) : null;
  const tripCategory = String(input.quoteTripCategory ?? '')
    .trim()
    .toLowerCase();

  let hasExistingGroupSeat = false;
  if (clientId) {
    const { data: seat } = await admin
      .from('group_members')
      .select('id')
      .eq('client_id', coerceId(clientId))
      .limit(1)
      .maybeSingle();
    hasExistingGroupSeat = Boolean(seat?.id);
  }

  const isGroupContext =
    tripCategory === 'group' ||
    (lead != null && isGroupStyleLead(lead)) ||
    hasExistingGroupSeat;

  if (!isGroupContext) {
    return { ok: true, skipped: true, reason: 'not_group_context' };
  }

  // A) Ensure clients row
  if (leadId) {
    try {
      const ensured = await ensureLeadClientIntakeAdmin(leadId);
      clientId = String(ensured.clientId);
    } catch (err) {
      console.warn('[payment-group-convert] ensure client from lead:', err);
    }
  }

  if (!clientId && lead?.client_id != null) {
    clientId = String(lead.client_id).trim();
  }

  if (!clientId) {
    return { ok: false, reason: 'client_missing', skipped: false };
  }

  // Verify client exists
  const { data: clientRow } = await admin
    .from('clients')
    .select('id, name, phone_wa, email')
    .eq('id', coerceQuotationIdForDb(clientId))
    .maybeSingle();

  if (!clientRow) {
    return { ok: false, reason: 'client_not_found' };
  }

  const customerName =
    String((clientRow as { name?: unknown }).name ?? '').trim() ||
    String(lead?.full_name ?? '').trim() ||
    'عميل Wanderloom';
  const customerPhone =
    String((clientRow as { phone_wa?: unknown }).phone_wa ?? '').trim() ||
    String(lead?.phone_wa ?? '').trim();
  const customerEmail =
    String((clientRow as { email?: unknown }).email ?? '').trim() ||
    String(lead?.email ?? '').trim() ||
    null;

  // Soft mirror into customers (legacy CRM table)
  await ensureCustomersProfile(admin, {
    fullName: customerName,
    phoneWa: customerPhone,
    email: customerEmail,
  }).catch((err) => console.warn('[payment-group-convert] customers:', err));

  // C) Lead → Paid/Confirmed (Kanban SSOT) + link client
  if (leadId) {
    const { error: leadUpdErr } = await admin
      .from('leads')
      .update({
        client_id: coerceQuotationIdForDb(clientId),
        status: 'payment_confirmed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId);
    if (leadUpdErr) {
      console.warn('[payment-group-convert] lead update:', leadUpdErr.message);
    }
  }

  const tripId = await resolveTripIdForPayment(admin, {
    lead,
    invoiceTripTitle: input.invoiceTripTitle,
    quoteTitle: input.quoteTitle,
    existingClientId: clientId,
  });

  if (!tripId) {
    // Group context without resolvable trip — client/lead updated; seat deferred
    if (tripCategory === 'group' || (lead && isGroupStyleLead(lead))) {
      console.warn('[payment-group-convert] trip_id unresolved for paid invoice', {
        leadId,
        clientId,
      });
      return {
        ok: true,
        skipped: true,
        reason: 'trip_unresolved',
        clientId,
      };
    }
    return { ok: true, skipped: true, reason: 'no_trip', clientId };
  }

  // B) group_members confirmed + paid
  const member = await upsertPaidGroupMember(admin, {
    clientId,
    tripId,
    customerName,
    customerPhone,
  });

  if (!member.ok) {
    console.error('[payment-group-convert] group_members:', member.error);
    return { ok: false, reason: member.error, clientId, tripId };
  }

  let tripTitle = String(input.invoiceTripTitle || input.quoteTitle || '').trim();
  try {
    const { data: tripRow } = await admin
      .from('group_trips')
      .select('title_ar')
      .eq('id', /^\d+$/.test(tripId) ? Number(tripId) : tripId)
      .maybeSingle();
    const ar = String((tripRow as { title_ar?: unknown } | null)?.title_ar ?? '').trim();
    if (ar) tripTitle = ar;
  } catch {
    /* optional */
  }

  return {
    ok: true,
    clientId,
    tripId,
    memberStatus: member.status,
    customerName,
    customerPhone,
    customerEmail,
    tripTitle: tripTitle || undefined,
  };
}
