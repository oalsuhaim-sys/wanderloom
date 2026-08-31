import type { SupabaseClient } from '@supabase/supabase-js';

import {
  applyItineraryTripDatesToPayload,
  normalizeIsoDateOnly,
} from '@/lib/itinerary-builder-model';

/**
 * When quotation trip dates change, mirror them onto linked itineraries
 * (quote_id match) so the client app stop showing "رحلة مكتملة" on stale end_date.
 */
export async function cascadeQuotationDatesToItineraries(
  sb: SupabaseClient,
  quoteId: string,
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): Promise<{ updated: number; error?: string }> {
  const qid = String(quoteId ?? '').trim();
  if (!qid) return { updated: 0 };

  const from = normalizeIsoDateOnly(startDate);
  const to = normalizeIsoDateOnly(endDate);
  if (!from && !to) return { updated: 0 };

  const patch = applyItineraryTripDatesToPayload({}, from, to || from, {
    resetStatusWhenFuture: true,
  });

  const { data, error } = await sb
    .from('itineraries')
    .update(patch)
    .eq('quote_id', qid)
    .select('id');

  if (error) {
    // Schema lag: retry without optional columns mentioned in the error
    const lower = error.message.toLowerCase();
    const retry = { ...patch };
    for (const key of ['start_date', 'end_date', 'status', 'dates'] as const) {
      if (lower.includes(key)) delete retry[key];
    }
    if (Object.keys(retry).length === 0) {
      console.error('[cascade-quotation-dates]', error.message);
      return { updated: 0, error: error.message };
    }
    const second = await sb.from('itineraries').update(retry).eq('quote_id', qid).select('id');
    if (second.error) {
      console.error('[cascade-quotation-dates]', second.error.message);
      return { updated: 0, error: second.error.message };
    }
    return { updated: second.data?.length ?? 0 };
  }

  return { updated: data?.length ?? 0 };
}
