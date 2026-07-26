import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  coerceQuotationIdForDb,
  findQuotationInList,
  isQuotationStatusApproved,
  isQuotationUuid,
  mapQuotationClientEmbed,
  mapQuotationRow,
  normalizeQuotationId,
  quotationClientName,
  quotationClientPhone,
  quotationEditId,
  QUOTATION_CLIENT_EMBED_SELECTS,
  type QuotationRow,
} from '@/lib/crm-quotations';
import {
  convertLeadToQuotation,
  formatWhatsAppPhone,
  mapLeadRowToQuotationDraft,
  resolveClientIdForLead,
} from '@/lib/crm-lead-actions';
import type { CrmLeadRow } from '@/lib/crm-leads';
import { runQuoteAcceptedIntakeAutomation } from '@/lib/client-intake-pipeline';
import { processReferralRewardForQuotation } from '@/lib/referral-rewards';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/** جدول قائمة /crm/quotations */
export const CRM_QUOTATIONS_TABLE = 'quotations' as const;
/** جدول صندوق الوارد في الرادار — معرّف UUID في الرابط */
export const CRM_LEADS_TABLE = 'leads' as const;

export type QuotationEditSource = typeof CRM_QUOTATIONS_TABLE | typeof CRM_LEADS_TABLE;

export type QuotationForEditResult = {
  row: QuotationRow;
  source: QuotationEditSource;
};

function quotationIdVariants(id: string): Array<string | number> {
  const key = normalizeQuotationId(id);
  if (!key) return [];
  const variants: Array<string | number> = [key];
  const coerced = coerceQuotationIdForDb(id);
  if (coerced !== key) variants.push(coerced);
  if (/^\d+$/.test(key)) {
    const n = Number(key);
    if (Number.isSafeInteger(n) && !variants.includes(n)) variants.push(n);
  }
  return variants;
}

async function fetchClientRowsByIdsAdmin(
  admin: SupabaseClient,
  clientIds: Array<string | number>,
): Promise<Record<string, unknown>[]> {
  if (!clientIds.length) return [];

  let lastError = '';
  for (const select of QUOTATION_CLIENT_EMBED_SELECTS) {
    const result = await admin.from('clients').select(select).in('id', clientIds);
    if (!result.error) {
      return (result.data as Record<string, unknown>[]) ?? [];
    }
    lastError = result.error.message;
  }
  console.warn('[quotations-admin] clients lookup:', lastError);
  return [];
}

async function attachClientRow(
  admin: SupabaseClient,
  row: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const rawClientId = row.client_id;
  if (rawClientId == null || rawClientId === '') return row;

  const clientId = coerceQuotationIdForDb(rawClientId);
  const clients = await fetchClientRowsByIdsAdmin(admin, [clientId]);
  return clients[0] ? { ...row, client: clients[0] } : row;
}

function mergeQuotationClient(
  row: QuotationRow,
  client: NonNullable<QuotationRow['clients']>,
): QuotationRow {
  return {
    ...row,
    clients: {
      ...row.clients,
      ...client,
      phone_wa: client.phone_wa || row.clients?.phone_wa || null,
      name: client.name || row.clients?.name || null,
    },
  };
}

async function attachClientsToQuotationRowsAdmin(
  admin: SupabaseClient,
  rows: QuotationRow[],
): Promise<QuotationRow[]> {
  if (!rows.length) return rows;

  // اربط كل صف له client_id — لا تعتمد على الـ embed وحده
  const clientIds = [
    ...new Set(
      rows
        .map((r) => r.client_id)
        .filter((id): id is string => Boolean(id))
        .map((id) => coerceQuotationIdForDb(id)),
    ),
  ];
  if (!clientIds.length) return rows;

  const clients = await fetchClientRowsByIdsAdmin(admin, clientIds);

  const byId = new Map<string, NonNullable<QuotationRow['clients']>>();
  for (const record of clients) {
    const key = normalizeQuotationId(record.id);
    if (!key) continue;
    const mapped = mapQuotationClientEmbed(record);
    if (mapped) byId.set(key, mapped);
  }

  return rows.map((row) => {
    const cid = row.client_id ? normalizeQuotationId(row.client_id) : '';
    const client = cid ? byId.get(cid) : undefined;
    return client ? mergeQuotationClient(row, client) : row;
  });
}

/** إن بقي العرض بلا اسم أو هاتف — خذ البيانات من leads عبر lead_id */
async function attachLeadPhonesToQuotationRowsAdmin(
  admin: SupabaseClient,
  rows: QuotationRow[],
): Promise<QuotationRow[]> {
  const missing = rows.filter(
    (r) => r.lead_id && (quotationClientName(r) === '—' || !quotationClientPhone(r)),
  );
  if (!missing.length) return rows;

  const leadIds = [...new Set(missing.map((r) => r.lead_id!).filter(Boolean))];
  const { data: leads, error } = await admin
    .from(CRM_LEADS_TABLE)
    .select('id, full_name, phone_wa')
    .in('id', leadIds);

  if (error || !leads?.length) {
    if (error) console.warn('[quotations-admin] leads phone fallback:', error.message);
    return rows;
  }

  const leadById = new Map<string, Record<string, unknown>>();
  for (const lead of leads) {
    const key = normalizeQuotationId((lead as { id: unknown }).id);
    if (key) leadById.set(key, lead as Record<string, unknown>);
  }

  // إن وُجد client_id على الـ lead ولم يُربط العرض — اجلب العميل
  const leadClientIds = [
    ...new Set(
      leads
        .map((l) => (l as { client_id?: unknown }).client_id)
        .filter((id) => id != null && id !== '')
        .map((id) => coerceQuotationIdForDb(id as string | number)),
    ),
  ];
  const leadClients = await fetchClientRowsByIdsAdmin(admin, leadClientIds);
  const clientById = new Map<string, NonNullable<QuotationRow['clients']>>();
  for (const record of leadClients) {
    const key = normalizeQuotationId(record.id);
    const mapped = mapQuotationClientEmbed(record);
    if (key && mapped) clientById.set(key, mapped);
  }

  return rows.map((row) => {
    if (!row.lead_id) return row;
    const needsName = quotationClientName(row) === '—';
    const needsPhone = !quotationClientPhone(row);
    if (!needsName && !needsPhone) return row;

    const lead = leadById.get(normalizeQuotationId(row.lead_id));
    if (!lead) return row;

    const leadClientId =
      lead.client_id != null ? normalizeQuotationId(lead.client_id) : '';
    const fromLeadClient = leadClientId ? clientById.get(leadClientId) : undefined;
    const leadName = String(lead.full_name ?? '').trim();
    const leadPhone = String(lead.phone_wa ?? '').trim();
    const phone = (needsPhone ? fromLeadClient?.phone_wa || leadPhone : quotationClientPhone(row)) || '';
    const name =
      (!needsName ? row.clients?.name : null) ||
      fromLeadClient?.name ||
      leadName ||
      row.clients?.name ||
      null;

    if (!phone && !name) return row;

    return mergeQuotationClient(row, {
      id: fromLeadClient?.id ?? row.clients?.id,
      name,
      phone_wa: phone || row.clients?.phone_wa || null,
    });
  });
}

/** قائمة عروض الأسعار — جدول quotations + هاتف العميل */
export async function fetchQuotationsListAdmin(): Promise<QuotationRow[]> {
  const admin = createSupabaseAdminClient();
  const rows = await fetchAllQuotationsAdmin(admin);
  const withClients = await attachClientsToQuotationRowsAdmin(admin, rows);
  return attachLeadPhonesToQuotationRowsAdmin(admin, withClients);
}

async function fetchAllQuotationsAdmin(admin: SupabaseClient): Promise<QuotationRow[]> {
  let data: unknown[] | null = null;
  let errorMessage = '';

  for (const cols of QUOTATION_CLIENT_EMBED_SELECTS) {
    const embedded = await admin
      .from(CRM_QUOTATIONS_TABLE)
      .select(`*, client:clients(${cols}), lead:leads(id, full_name, phone_wa)`)
      .order('created_at', { ascending: false });

    if (!embedded.error) {
      data = (embedded.data as unknown[]) ?? [];
      break;
    }
    errorMessage = embedded.error.message;

    // Retry without lead embed if FK relationship isn't exposed
    const clientsOnly = await admin
      .from(CRM_QUOTATIONS_TABLE)
      .select(`*, client:clients(${cols})`)
      .order('created_at', { ascending: false });
    if (!clientsOnly.error) {
      data = (clientsOnly.data as unknown[]) ?? [];
      break;
    }
    errorMessage = clientsOnly.error.message;
  }

  if (!data) {
    const plain = await admin
      .from(CRM_QUOTATIONS_TABLE)
      .select('*')
      .order('created_at', { ascending: false });

    if (plain.error) {
      throw new Error(
        plain.error.message || errorMessage || 'تعذر تحميل عروض الأسعار من quotations.',
      );
    }
    data = (plain.data as unknown[]) ?? [];
  }

  return (data ?? [])
    .map((raw) => {
      const record = raw as Record<string, unknown>;
      const mapped = mapQuotationRow(record);
      return {
        ...mapped,
        id: normalizeQuotationId(record.id),
        lead_id:
          record.lead_id != null ? normalizeQuotationId(record.lead_id) || null : null,
      };
    })
    .filter((row) => Boolean(quotationEditId(row)));
}

async function fetchQuotationRowAdmin(
  admin: SupabaseClient,
  column: 'id' | 'lead_id',
  value: string | number,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await admin
    .from(CRM_QUOTATIONS_TABLE)
    .select('*')
    .eq(column, value)
    .maybeSingle();

  if (error) {
    console.error(`[quotations-admin] ${column} lookup:`, error.message, { value });
    return null;
  }
  return (data as Record<string, unknown> | null) ?? null;
}

async function fetchLeadDraftForEditAdmin(
  admin: SupabaseClient,
  leadId: string,
): Promise<QuotationRow | null> {
  const { data, error } = await admin.from(CRM_LEADS_TABLE).select('*').eq('id', leadId).maybeSingle();
  if (error || !data) {
    if (error) console.error('[leads-admin] lookup:', error.message, { leadId });
    return null;
  }

  const lead = data as CrmLeadRow;
  let client: { id?: number; name?: string | null; phone_wa?: string | null } | null = null;

  if (lead.client_id != null) {
    const clients = await fetchClientRowsByIdsAdmin(admin, [
      coerceQuotationIdForDb(lead.client_id),
    ]);
    if (clients[0]) client = mapQuotationClientEmbed(clients[0]);
  } else if (lead.phone_wa) {
    const phone = String(lead.phone_wa).trim();
    const normalized = formatWhatsAppPhone(phone);
    for (const value of [phone, normalized]) {
      if (!value) continue;
      let clientRow: Record<string, unknown> | null = null;
      for (const select of QUOTATION_CLIENT_EMBED_SELECTS) {
        const primary = await admin
          .from('clients')
          .select(select)
          .eq('phone_wa', value)
          .maybeSingle();
        if (!primary.error && primary.data) {
          clientRow = primary.data as Record<string, unknown>;
          break;
        }
      }
      if (clientRow) {
        client = mapQuotationClientEmbed(clientRow);
        break;
      }
    }
  }

  return mapLeadRowToQuotationDraft(lead, client);
}

/** مسودة عرض سعر من طلب DNA — يُنشئ ملف عميل إن لزم (بدون إدراج quotation) */
export async function fetchLeadQuotationDraftAdmin(leadId: string): Promise<QuotationRow | null> {
  const key = normalizeQuotationId(leadId);
  if (!key || !isQuotationUuid(key)) return null;

  const admin = createSupabaseAdminClient();

  const existingQuoteId = await fetchQuotationIdByLeadIdAdmin(key);
  if (existingQuoteId) return null;

  const { data, error } = await admin.from(CRM_LEADS_TABLE).select('*').eq('id', key).maybeSingle();
  if (error || !data) return null;

  const lead = data as CrmLeadRow;
  const clientId = await resolveClientIdForLead(admin, lead);

  if (lead.client_id !== clientId) {
    await admin
      .from(CRM_LEADS_TABLE)
      .update({ client_id: clientId })
      .eq('id', key)
      .then(({ error }) => {
        if (error) console.warn('[crm-quotations-server] lead client_id link:', error.message);
      });
  }

  const clients = await fetchClientRowsByIdsAdmin(admin, [clientId]);
  const client = clients[0] ? mapQuotationClientEmbed(clients[0]) : { id: clientId, name: lead.full_name };

  return mapLeadRowToQuotationDraft(lead, client);
}

/**
 * جلب بيانات محرر العرض — service_role يتجاوز RLS.
 * 1) quotations (قائمة /crm/quotations)
 * 2) leads (رادار — عندما يكون المعرّف UUID لطلب لم يُحفظ بعد كعرض)
 */
export async function fetchQuotationForEditAdmin(id: string): Promise<QuotationRow | null> {
  const result = await fetchQuotationForEditWithSourceAdmin(id);
  return result?.row ?? null;
}

export async function fetchQuotationForEditWithSourceAdmin(
  id: string,
): Promise<QuotationForEditResult | null> {
  const key = normalizeQuotationId(id);
  if (!key) return null;

  const admin = createSupabaseAdminClient();

  const list = await fetchAllQuotationsAdmin(admin);
  const fromList = findQuotationInList(list, key);
  if (fromList) return { row: fromList, source: CRM_QUOTATIONS_TABLE };

  for (const dbId of quotationIdVariants(key)) {
    const raw = await fetchQuotationRowAdmin(admin, 'id', dbId);
    if (raw) {
      const withClient = await attachClientRow(admin, raw);
      return { row: mapQuotationRow(withClient), source: CRM_QUOTATIONS_TABLE };
    }
  }

  if (isQuotationUuid(key)) {
    const raw = await fetchQuotationRowAdmin(admin, 'lead_id', key);
    if (raw) {
      const withClient = await attachClientRow(admin, raw);
      return { row: mapQuotationRow(withClient), source: CRM_QUOTATIONS_TABLE };
    }

    const fromLead = await fetchLeadDraftForEditAdmin(admin, key);
    if (fromLead) return { row: fromLead, source: CRM_LEADS_TABLE };
  }

  return null;
}

/** جلب quotations.id المرتبط بطلب leads — لا يُرجع lead.id أبداً */
export async function fetchQuotationIdByLeadIdAdmin(leadId: string): Promise<string | null> {
  const key = normalizeQuotationId(leadId);
  if (!key || !isQuotationUuid(key)) return null;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from(CRM_QUOTATIONS_TABLE)
    .select('id, lead_id')
    .eq('lead_id', key)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const quotationId = normalizeQuotationId((data as { id?: unknown }).id);
  const linkedLeadId = normalizeQuotationId((data as { lead_id?: unknown }).lead_id);
  if (!quotationId || quotationId === key || quotationId === linkedLeadId) return null;
  return quotationId;
}

/** إنشاء عرض في quotations من طلب leads — عبر service_role */
export async function convertLeadToQuotationAdmin(leadId: string): Promise<string> {
  const key = normalizeQuotationId(leadId);
  if (!key || !isQuotationUuid(key)) {
    throw new Error('معرّف الطلب غير صالح.');
  }

  const admin = createSupabaseAdminClient();

  const existingQuotationId = await fetchQuotationIdByLeadIdAdmin(key);
  if (existingQuotationId) return existingQuotationId;

  const { data, error } = await admin.from(CRM_LEADS_TABLE).select('*').eq('id', key).single();
  if (error || !data) {
    throw new Error(error?.message || 'تعذر العثور على الطلب في leads.');
  }

  const insertedId = await convertLeadToQuotation(admin, data as CrmLeadRow);
  if (normalizeQuotationId(insertedId) !== key) {
    return insertedId;
  }

  const resolvedId = await fetchQuotationIdByLeadIdAdmin(key);
  if (resolvedId) return resolvedId;

  throw new Error('تعارض معرّفات: لم يُعثر على quotations.id بعد إنشاء العرض.');
}

export type ApproveQuotationAdminResult = {
  row: QuotationRow;
  intake: Awaited<ReturnType<typeof runQuoteAcceptedIntakeAutomation>>;
};

/**
 * اعتماد عرض السعر عبر service_role — يتجاوز RLS ويحدّث status إلى approved.
 */
export async function approveQuotationAdmin(id: string): Promise<ApproveQuotationAdminResult> {
  const key = normalizeQuotationId(id);
  if (!key) throw new Error('معرّف العرض غير صالح.');

  const admin = createSupabaseAdminClient();

  const existing = await fetchQuotationForEditWithSourceAdmin(key);
  if (!existing || existing.source !== CRM_QUOTATIONS_TABLE) {
    throw new Error('تعذر العثور على عرض السعر في جدول quotations.');
  }

  const quotation = existing.row;
  const quotePk = quotationEditId(quotation) || normalizeQuotationId(quotation.id);
  if (!quotePk) throw new Error('معرّف العرض غير صالح.');

  if (isQuotationStatusApproved(quotation.status)) {
    return { row: { ...quotation, status: 'approved' }, intake: null };
  }

  const payloads: Record<string, unknown>[] = [
    { status: 'approved', updated_at: new Date().toISOString() },
    { status: 'approved' },
  ];

  let updatedRaw: Record<string, unknown> | null = null;
  let lastError = '';

  for (const payload of payloads) {
    for (const dbId of quotationIdVariants(quotePk)) {
      const { data, error } = await admin
        .from(CRM_QUOTATIONS_TABLE)
        .update(payload)
        .eq('id', dbId)
        .select('*')
        .maybeSingle();

      if (error) {
        lastError = error.message;
        console.error('[quotations-admin] approve update:', error.message, { dbId, payload });
        continue;
      }
      if (data) {
        updatedRaw = data as Record<string, unknown>;
        break;
      }
    }
    if (updatedRaw) break;
  }

  if (!updatedRaw) {
    throw new Error(lastError || 'لم يُحفظ الاعتماد — تعذر تحديث حالة العرض في قاعدة البيانات.');
  }

  const updated = mapQuotationRow(updatedRaw);
  if (!isQuotationStatusApproved(updated.status)) {
    throw new Error('لم يُحفظ الاعتماد — قيمة الحالة في قاعدة البيانات غير متوقعة.');
  }

  const row: QuotationRow = {
    ...quotation,
    ...updated,
    status: 'approved',
    clients: quotation.clients ?? updated.clients,
  };

  let intake: ApproveQuotationAdminResult['intake'] = null;
  if (row.client_id) {
    try {
      intake = await runQuoteAcceptedIntakeAutomation(admin, {
        clientId: row.client_id,
        clientName: quotationClientName(row),
        phoneWa: quotationClientPhone(row),
      });
    } catch (intakeErr) {
      console.error('[quote-intake] after approval:', intakeErr);
    }
  }

  try {
    await processReferralRewardForQuotation(admin, quotePk);
  } catch (rewardError) {
    console.error('[referral-reward] after approval:', rewardError);
  }

  return { row, intake };
}

/** يتحقق أن quotations.id موجود فعلياً في قاعدة البيانات — للفواتير والملخص المالي */
export async function fetchQuotationDbRecordAdmin(
  quoteId: string,
): Promise<{ id: string; created_at: string; client_id: string | null } | null> {
  const key = normalizeQuotationId(quoteId);
  if (!key) return null;

  const admin = createSupabaseAdminClient();
  const variants = [key, coerceQuotationIdForDb(key)];

  for (const v of variants) {
    const { data, error } = await admin
      .from(CRM_QUOTATIONS_TABLE)
      .select('id, created_at, client_id')
      .eq('id', v)
      .maybeSingle();

    if (error) continue;
    if (!data?.id || !data.created_at) continue;

    const persistedId = quotationEditId({
      id: normalizeQuotationId(data.id),
      lead_id: null,
    });
    if (!persistedId) continue;

    return {
      id: persistedId,
      created_at: String(data.created_at),
      client_id: data.client_id != null ? normalizeQuotationId(data.client_id) || null : null,
    };
  }

  return null;
}
