import { buildDatesFieldFromParts } from '@/lib/itinerary-builder-model';
import { resolveVipSpendingTier, parseTotalProfit, type VipSpendingTier } from '@/lib/vip-spending-tier';
import { supabase } from '@/lib/supabase';

export type LaunchClientTripInput = {
  clientId: string | number;
  clientName: string;
  destination: string;
  startDate: string;
  endDate: string;
  expectedProfit: number;
  currentTotalProfit?: number;
};

export type LaunchClientTripResult = {
  itineraryId: number;
  publicSlug: string;
  newTotalProfit: number;
  newVipTier: VipSpendingTier;
};

/** يدعم id رقمي (clients.id) أو uuid نصي */
export function resolveLaunchClientId(raw: unknown): string | number {
  if (raw == null || raw === '') {
    throw new Error('معرّف العميل غير صالح.');
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  const s = String(raw).trim();
  if (!s || s === 'undefined' || s === 'null') {
    throw new Error('معرّف العميل غير صالح.');
  }
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) return n;
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) {
    return s;
  }
  return s;
}

function stripMissingItineraryColumns(
  message: string,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...payload };
  const lower = message.toLowerCase();
  for (const key of ['start_date', 'end_date', 'expected_profit', 'destination', 'dates', 'status']) {
    if (lower.includes(key)) delete next[key];
  }
  return next;
}

export async function launchClientTrip(
  input: LaunchClientTripInput,
): Promise<LaunchClientTripResult> {
  if (!supabase) throw new Error('Supabase غير مهيأ.');

  const clientKey = resolveLaunchClientId(input.clientId);

  const destination = input.destination.trim();
  const startDate = input.startDate.trim();
  const endDate = input.endDate.trim();
  const expectedProfit = parseTotalProfit(input.expectedProfit);

  if (!destination) throw new Error('أدخل وجهة الرحلة.');
  if (!startDate) throw new Error('أدخل تاريخ البداية.');
  if (!endDate) throw new Error('أدخل تاريخ النهاية.');
  if (endDate < startDate) throw new Error('تاريخ النهاية يجب أن يكون بعد البداية.');

  const dates = buildDatesFieldFromParts(startDate, endDate);
  const customerName = input.clientName.trim() || 'عميل VIP';

  const insertPayload: Record<string, unknown> = {
    client_id: clientKey,
    destination,
    start_date: startDate,
    end_date: endDate,
    expected_profit: expectedProfit,
    dates,
    title: destination,
    customer_name: customerName,
    status: 'active',
    days_data: [],
  };

  console.log('Submitting Trip for Client ID:', clientKey);

  let insertRes = await supabase.from('itineraries').insert(insertPayload).select('id, magic_link_id').single();
  if (insertRes.error && /column|schema cache|does not exist/i.test(insertRes.error.message ?? '')) {
    insertRes = await supabase
      .from('itineraries')
      .insert(stripMissingItineraryColumns(insertRes.error.message ?? '', insertPayload))
      .select('id, magic_link_id')
      .single();
  }
  if (insertRes.error || !insertRes.data?.id) {
    throw new Error(insertRes.error?.message || 'تعذر إنشاء الرحلة في itineraries.');
  }

  const currentProfit = parseTotalProfit(input.currentTotalProfit);
  const newTotalProfit = currentProfit + expectedProfit;
  const newVipTier = resolveVipSpendingTier(newTotalProfit);

  const clientUpdate: Record<string, unknown> = {
    total_profit: newTotalProfit,
    vip_tier: newVipTier,
  };

  let clientRes = await supabase.from('clients').update(clientUpdate).eq('id', clientKey);
  if (clientRes.error && /total_profit|vip_tier|column/i.test(clientRes.error.message ?? '')) {
    clientRes = await supabase.from('clients').update({ vip_tier: newVipTier }).eq('id', clientKey);
  }
  if (clientRes.error) {
    throw new Error(clientRes.error.message || 'تم إنشاء الرحلة لكن تعذر تحديث أرباح العميل.');
  }

  const row = insertRes.data as { id: number | string; magic_link_id?: string | null };
  const itineraryId = Number(row.id);
  const publicSlug = String(row.magic_link_id ?? row.id).trim();

  return {
    itineraryId,
    publicSlug,
    newTotalProfit,
    newVipTier,
  };
}
