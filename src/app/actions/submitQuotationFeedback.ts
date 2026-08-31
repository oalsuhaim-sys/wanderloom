'use server';

import {
  coerceQuotationIdForDb,
  mapQuotationRow,
  resolveQuotationRouteId,
  type QuotationRow,
} from '@/lib/crm-quotations';
import {
  parseActivityOptions,
  parseClientFeedback,
  parseHotelOptions,
  parseTransportOptions,
  serializeActivityOptionsForSave,
  serializeHotelOptionsForSave,
  serializeTransportOptionsForSave,
  type QuotationActivityOption,
  type QuotationClientFeedback,
  type QuotationHotelOption,
  type QuotationTransportOption,
} from '@/lib/interactive-quotation';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { assertServiceRoleKeyConfigured } from '@/lib/supabase/server-action-auth';

export type SubmitQuotationFeedbackInput = {
  quoteId: string;
  hotelOptions: QuotationHotelOption[];
  transportOptions: QuotationTransportOption[];
  activityOptions?: QuotationActivityOption[];
  feedback: QuotationClientFeedback;
};

export type SubmitQuotationFeedbackResult =
  | { ok: true; row: QuotationRow }
  | { ok: false; error: string };

/** Client brochure → needs_revision + selections + contextual notes */
export async function submitQuotationClientFeedbackAction(
  input: SubmitQuotationFeedbackInput,
): Promise<SubmitQuotationFeedbackResult> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const quoteId = resolveQuotationRouteId(input.quoteId);
  if (!quoteId) return { ok: false, error: 'معرّف العرض غير صالح.' };

  try {
    const admin = createSupabaseAdminClient();
    const dbId = coerceQuotationIdForDb(quoteId);

    const existing = await admin
      .from('quotations')
      .select(
        'id, status, hotel_options, transport_options, activity_options, client_feedback',
      )
      .eq('id', dbId)
      .maybeSingle();

    if (existing.error || !existing.data?.id) {
      return {
        ok: false,
        error: existing.error?.message || 'لم يُعثر على عرض السعر.',
      };
    }

    const selectedHotels = serializeHotelOptionsForSave(
      (input.hotelOptions ?? []).map((h) => ({
        ...h,
        is_selected_by_client: Boolean(h.is_selected_by_client),
      })),
    );
    const selectedTransport = serializeTransportOptionsForSave(
      (input.transportOptions ?? []).map((t) => ({
        ...t,
        is_selected_by_client: Boolean(t.is_selected_by_client),
      })),
    );
    const selectedActivities = serializeActivityOptionsForSave(
      (input.activityOptions ?? []).map((a) => ({
        ...a,
        is_selected_by_client: Boolean(a.is_selected_by_client),
      })),
    );

    const hotelsPayload =
      selectedHotels.length > 0
        ? selectedHotels
        : serializeHotelOptionsForSave(parseHotelOptions(existing.data.hotel_options));
    const transportPayload =
      selectedTransport.length > 0
        ? selectedTransport
        : serializeTransportOptionsForSave(
            parseTransportOptions(existing.data.transport_options),
          );
    const activitiesPayload =
      selectedActivities.length > 0
        ? selectedActivities
        : serializeActivityOptionsForSave(
            parseActivityOptions(existing.data.activity_options),
          );

    const prevFeedback = parseClientFeedback(existing.data.client_feedback);
    const feedback: QuotationClientFeedback = {
      ...prevFeedback,
      ...input.feedback,
      days: { ...(prevFeedback.days ?? {}), ...(input.feedback.days ?? {}) },
      hotels: { ...(prevFeedback.hotels ?? {}), ...(input.feedback.hotels ?? {}) },
      transport: {
        ...(prevFeedback.transport ?? {}),
        ...(input.feedback.transport ?? {}),
      },
      activities: {
        ...(prevFeedback.activities ?? {}),
        ...(input.feedback.activities ?? {}),
      },
      submitted_at: new Date().toISOString(),
    };

    const updatePayload: Record<string, unknown> = {
      status: 'needs_revision',
      hotel_options: hotelsPayload,
      transport_options: transportPayload,
      client_feedback: feedback,
      updated_at: new Date().toISOString(),
    };
    if (activitiesPayload.length > 0 || existing.data.activity_options != null) {
      updatePayload.activity_options = activitiesPayload;
    }

    const { data, error } = await admin
      .from('quotations')
      .update(updatePayload)
      .eq('id', dbId)
      .select('*')
      .single();

    if (error || !data) {
      if (error && /activity_options|column/i.test(error.message)) {
        delete updatePayload.activity_options;
        const retryNoActivity = await admin
          .from('quotations')
          .update(updatePayload)
          .eq('id', dbId)
          .select('*')
          .single();
        if (!retryNoActivity.error && retryNoActivity.data) {
          return {
            ok: true,
            row: mapQuotationRow(retryNoActivity.data as Record<string, unknown>),
          };
        }
      }
      if (error && /needs_revision|check|constraint/i.test(error.message)) {
        const retry = await admin
          .from('quotations')
          .update({
            ...updatePayload,
            status: 'client_responded',
          })
          .eq('id', dbId)
          .select('*')
          .single();
        if (retry.error || !retry.data) {
          return {
            ok: false,
            error: retry.error?.message || error.message,
          };
        }
        return { ok: true, row: mapQuotationRow(retry.data as Record<string, unknown>) };
      }
      return { ok: false, error: error?.message || 'تعذر حفظ ملاحظاتكم.' };
    }

    return { ok: true, row: mapQuotationRow(data as Record<string, unknown>) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر إرسال الملاحظات.',
    };
  }
}
