'use server';

import {
  approveQuotationAdmin,
  convertLeadToQuotationAdmin,
  fetchLeadQuotationDraftAdmin,
  fetchQuotationForEditWithSourceAdmin,
  fetchQuotationIdByLeadIdAdmin,
  fetchQuotationsListAdmin,
  CRM_LEADS_TABLE,
  CRM_QUOTATIONS_TABLE,
  type QuotationEditSource,
} from '@/lib/crm-quotations-server';
import {
  buildQuotationEditPath,
  coerceQuotationIdForDb,
  mapQuotationRow,
  resolveQuotationRouteId,
  type QuotationRow,
} from '@/lib/crm-quotations';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { assertServiceRoleKeyConfigured } from '@/lib/supabase/server-action-auth';
import type { ClientIntakeAutomationResult } from '@/lib/client-intake-pipeline';

export type QuotationEditActionResult =
  | { ok: true; row: QuotationRow; table: QuotationEditSource }
  | { ok: false; error: string; table: QuotationEditSource | 'unknown' };

/** Server Action — جلب عرض السعر للتعديل عبر service_role (يتجاوز RLS) */
export async function getQuotationForEditAction(
  rawId: string,
): Promise<QuotationEditActionResult> {
  const id = resolveQuotationRouteId(rawId);
  if (!id) {
    return { ok: false, error: 'معرّف العرض غير صالح.', table: 'unknown' };
  }

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) {
    return { ok: false, error: serviceKeyError, table: 'unknown' };
  }

  try {
    const result = await fetchQuotationForEditWithSourceAdmin(id);
    if (!result) {
      return {
        ok: false,
        error: `لم يُعثر على سجل في ${CRM_QUOTATIONS_TABLE} أو ${CRM_LEADS_TABLE} للمعرّف: ${id}`,
        table: 'unknown',
      };
    }
    return { ok: true, row: result.row, table: result.source };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر تحميل عرض السعر.',
      table: 'unknown',
    };
  }
}

export type QuotationsListActionResult =
  | { ok: true; rows: QuotationRow[]; table: typeof CRM_QUOTATIONS_TABLE }
  | { ok: false; error: string; table: 'unknown' };

/** Server Action — قائمة عروض الأسعار من جدول quotations فقط (service_role) */
export async function getQuotationsListAction(): Promise<QuotationsListActionResult> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) {
    return { ok: false, error: serviceKeyError, table: 'unknown' };
  }

  try {
    const rows = await fetchQuotationsListAdmin();
    return { ok: true, rows, table: CRM_QUOTATIONS_TABLE };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر تحميل عروض الأسعار.',
      table: 'unknown',
    };
  }
}

export type QuotationIdForLeadResult =
  | { ok: true; quoteId: string; table: typeof CRM_QUOTATIONS_TABLE }
  | { ok: false; error: string };

/** Server Action — quotations.id المرتبط بـ leads.id (للتوجيه للتعديل) */
export async function getQuotationIdForLeadAction(leadId: string): Promise<QuotationIdForLeadResult> {
  const id = resolveQuotationRouteId(leadId);
  if (!id) {
    return { ok: false, error: 'معرّف الطلب غير صالح.' };
  }

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) {
    return { ok: false, error: serviceKeyError };
  }

  try {
    const quoteId = await fetchQuotationIdByLeadIdAdmin(id);
    if (!quoteId) {
      return { ok: false, error: 'لا يوجد عرض سعر مرتبط بهذا الطلب بعد.' };
    }
    return { ok: true, quoteId, table: CRM_QUOTATIONS_TABLE };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر البحث عن عرض السعر.',
    };
  }
}

export type CreateQuotationFromLeadResult =
  | { ok: true; quoteId: string; table: typeof CRM_QUOTATIONS_TABLE }
  | { ok: false; error: string };

export type LeadQuotationDraftActionResult =
  | { ok: true; draft: QuotationRow; existingQuoteId: null }
  | { ok: true; draft: null; existingQuoteId: string }
  | { ok: false; error: string };

/** مسودة عرض من طلب DNA — للتوجيه إلى /crm/quotations/new */
export async function getLeadQuotationDraftAction(
  leadId: string,
): Promise<LeadQuotationDraftActionResult> {
  const id = resolveQuotationRouteId(leadId);
  if (!id) {
    return { ok: false, error: 'معرّف الطلب غير صالح.' };
  }

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) {
    return { ok: false, error: serviceKeyError };
  }

  try {
    const existingQuoteId = await fetchQuotationIdByLeadIdAdmin(id);
    if (existingQuoteId) {
      return { ok: true, draft: null, existingQuoteId };
    }

    const draft = await fetchLeadQuotationDraftAdmin(id);
    if (!draft) {
      return { ok: false, error: 'تعذر تحميل بيانات الطلب.' };
    }
    return { ok: true, draft, existingQuoteId: null };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر تحميل مسودة العرض.',
    };
  }
}

/** Server Action — تحويل طلب leads إلى عرض في quotations (service_role) */
export async function createQuotationFromLeadAction(
  leadId: string,
): Promise<CreateQuotationFromLeadResult> {
  const id = resolveQuotationRouteId(leadId);
  if (!id) {
    return { ok: false, error: 'معرّف الطلب غير صالح.' };
  }

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) {
    return { ok: false, error: serviceKeyError };
  }

  try {
    const quoteId = await convertLeadToQuotationAdmin(id);
    return { ok: true, quoteId, table: CRM_QUOTATIONS_TABLE };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر إنشاء عرض السعر.',
    };
  }
}

export type ApproveQuotationActionResult =
  | {
      ok: true;
      row: QuotationRow;
      intake: ClientIntakeAutomationResult | null;
      table: typeof CRM_QUOTATIONS_TABLE;
      itineraryId: string | number | null;
    }
  | { ok: false; error: string };

/** Server Action — اعتماد العرض (status = approved) عبر service_role + مسار نشط */
export async function approveQuotationAction(
  rawId: string,
): Promise<ApproveQuotationActionResult> {
  const id = resolveQuotationRouteId(rawId);
  if (!id) {
    return { ok: false, error: 'معرّف العرض غير صالح.' };
  }

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) {
    return { ok: false, error: serviceKeyError };
  }

  try {
    const result = await approveQuotationAdmin(id);
    const { revalidatePath } = await import('next/cache');
    revalidatePath('/crm/quotations');
    revalidatePath('/crm/itineraries');
    revalidatePath('/crm/pipeline');
    if (result.itinerary?.itineraryId != null) {
      revalidatePath(
        `/crm/itineraries/${encodeURIComponent(String(result.itinerary.itineraryId))}/edit`,
      );
    }
    return {
      ok: true,
      row: result.row,
      intake: result.intake,
      table: CRM_QUOTATIONS_TABLE,
      itineraryId: result.itinerary?.itineraryId ?? null,
    };
  } catch (err) {
    console.error('Approval Update Error:', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر اعتماد العرض.',
    };
  }
}

/**
 * Public brochure — client accepts the quote.
 * Sets quotations.status = approved and Kanban leads.status = awaiting_payment.
 */
export async function clientAcceptQuotationAction(
  rawId: string,
): Promise<ApproveQuotationActionResult> {
  return approveQuotationAction(rawId);
}

export type VerifyQuotationForInvoiceResult =
  | { ok: true; quoteId: string; created_at: string; client_id: string | null }
  | { ok: false; error: string };

/** يتحقق من وجود quotations.id في قاعدة البيانات قبل إصدار فاتورة */
export async function verifyQuotationForInvoiceAction(
  rawQuoteId: string,
): Promise<VerifyQuotationForInvoiceResult> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const quoteId = resolveQuotationRouteId(rawQuoteId);
  if (!quoteId) {
    return { ok: false, error: 'معرّف العرض غير صالح.' };
  }

  try {
    const { fetchQuotationDbRecordAdmin } = await import('@/lib/crm-quotations-server');
    const record = await fetchQuotationDbRecordAdmin(quoteId);
    if (!record) {
      return {
        ok: false,
        error: 'يجب حفظ عرض السعر في قاعدة البيانات قبل إصدار الفاتورة.',
      };
    }
    return {
      ok: true,
      quoteId: record.id,
      created_at: record.created_at,
      client_id: record.client_id,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر التحقق من عرض السعر.',
    };
  }
}

export type UpdateQuotationReviewStatusResult =
  | { ok: true; row: QuotationRow }
  | { ok: false; error: string };

const LIFECYCLE_STATUSES = [
  'draft',
  'pending_client',
  'needs_revision',
  'client_responded',
  'approved',
  'awaiting_payment',
  'payment_confirmed',
  'deposit_paid',
  'fully_paid',
] as const;

export type QuotationLifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

function isLifecycleStatus(raw: string): raw is QuotationLifecycleStatus {
  return (LIFECYCLE_STATUSES as readonly string[]).includes(raw);
}

/**
 * Admin lifecycle control (service_role) — forces status + optional feedback clear.
 * Used after form save so RLS cannot leave the quote stuck in needs_revision.
 * When status becomes approved/confirmed, auto-creates an active itinerary route.
 */
export async function setQuotationLifecycleAction(
  rawId: string,
  nextStatus: QuotationLifecycleStatus | string,
  opts?: { clearFeedback?: boolean },
): Promise<UpdateQuotationReviewStatusResult> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const id = resolveQuotationRouteId(rawId);
  if (!id) return { ok: false, error: 'معرّف العرض غير صالح.' };

  const status = String(nextStatus ?? '').trim();
  if (!isLifecycleStatus(status)) {
    return { ok: false, error: `حالة غير مدعومة: ${status || '—'}` };
  }

  try {
    // Authoritative approve path — creates active itinerary + intake + pipeline
    if (status === 'approved') {
      const approved = await approveQuotationAdmin(id);
      const { revalidatePath } = await import('next/cache');
      revalidatePath('/crm/quotations');
      revalidatePath('/crm/itineraries');
      revalidatePath('/crm/pipeline');
      if (opts?.clearFeedback) {
        try {
          const admin = createSupabaseAdminClient();
          const dbId = coerceQuotationIdForDb(id);
          await admin
            .from('quotations')
            .update({ client_feedback: null, updated_at: new Date().toISOString() })
            .eq('id', dbId);
        } catch (clearErr) {
          console.warn('[lifecycle] clear feedback after approve:', clearErr);
        }
      }
      return { ok: true, row: approved.row };
    }

    const admin = createSupabaseAdminClient();
    const dbId = coerceQuotationIdForDb(id);
    const clearFeedback = opts?.clearFeedback === true;
    const patch: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (clearFeedback) {
      patch.client_feedback = null;
    }

    let { data, error } = await admin
      .from('quotations')
      .update(patch)
      .eq('id', dbId)
      .select('*')
      .single();

    if (error && clearFeedback && /client_feedback/i.test(error.message)) {
      const retry = await admin
        .from('quotations')
        .update({
          status,
          client_feedback: {},
          updated_at: new Date().toISOString(),
        })
        .eq('id', dbId)
        .select('*')
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error && /check|constraint|status/i.test(error.message) && status === 'pending_client') {
      const retry = await admin
        .from('quotations')
        .update({
          status: 'pending_client',
          ...(clearFeedback ? { client_feedback: {} } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', dbId)
        .select('*')
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error || !data) {
      return { ok: false, error: error?.message || 'تعذر تحديث حالة العرض.' };
    }

    const row = mapQuotationRow(data as Record<string, unknown>);
    const { revalidatePath } = await import('next/cache');
    revalidatePath('/crm/quotations');
    return { ok: true, row };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر تحديث حالة العرض.',
    };
  }
}

/** Review mode: تم تنفيذ التعديلات واعتماد العرض نهائياً */
export async function resolveAndApproveQuotationAction(
  rawId: string,
): Promise<UpdateQuotationReviewStatusResult> {
  return setQuotationLifecycleAction(rawId, 'approved', { clearFeedback: true });
}

/** Review mode: إرسال النسخة المحدّثة للعميل وإعادة الحالة إلى انتظار العميل */
export async function sendUpdatedQuotationAction(
  rawId: string,
): Promise<UpdateQuotationReviewStatusResult> {
  return setQuotationLifecycleAction(rawId, 'pending_client', { clearFeedback: true });
}
