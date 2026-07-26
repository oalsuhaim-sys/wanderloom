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
import { buildQuotationEditPath, resolveQuotationRouteId, type QuotationRow } from '@/lib/crm-quotations';
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
    }
  | { ok: false; error: string };

/** Server Action — اعتماد العرض (status = approved) عبر service_role */
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
    return {
      ok: true,
      row: result.row,
      intake: result.intake,
      table: CRM_QUOTATIONS_TABLE,
    };
  } catch (err) {
    console.error('Approval Update Error:', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر اعتماد العرض.',
    };
  }
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
