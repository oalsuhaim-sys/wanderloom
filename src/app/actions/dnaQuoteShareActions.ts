'use server';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { CRM_QUOTATIONS_TABLE } from '@/lib/crm-quotations-server';
import { buildQuotationPublicLink } from '@/lib/whatsapp-templates';
import { siteOrigin } from '@/lib/bank-checkout';
import { assertServiceRoleKeyConfigured } from '@/lib/supabase/server-action-auth';

export type DnaQuoteShareResult = {
  ok: boolean;
  quotationUrl: string | null;
  clientName: string | null;
  clientPhone: string | null;
  tripTitle: string | null;
  error?: string;
};

/** Lightweight share payload for DNA success WhatsApp / preview actions */
export async function getDnaQuoteShareAction(quoteId: string): Promise<DnaQuoteShareResult> {
  const id = String(quoteId ?? '').trim();
  if (!id) {
    return {
      ok: false,
      quotationUrl: null,
      clientName: null,
      clientPhone: null,
      tripTitle: null,
      error: 'معرّف العرض غير صالح.',
    };
  }

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) {
    return {
      ok: false,
      quotationUrl: buildQuotationPublicLink(id, siteOrigin()),
      clientName: null,
      clientPhone: null,
      tripTitle: null,
      error: serviceKeyError,
    };
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from(CRM_QUOTATIONS_TABLE)
      .select('id, title, client_id, clients(id, name, phone_wa)')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      return {
        ok: false,
        quotationUrl: buildQuotationPublicLink(id, siteOrigin()),
        clientName: null,
        clientPhone: null,
        tripTitle: null,
        error: error?.message || 'تعذر قراءة العرض.',
      };
    }

    const row = data as Record<string, unknown>;
    const clientsRaw = row.clients;
    const client =
      clientsRaw && typeof clientsRaw === 'object' && !Array.isArray(clientsRaw)
        ? (clientsRaw as Record<string, unknown>)
        : Array.isArray(clientsRaw) && clientsRaw[0] && typeof clientsRaw[0] === 'object'
          ? (clientsRaw[0] as Record<string, unknown>)
          : null;

    let phone = String(client?.phone_wa ?? '').trim();
    let name = String(client?.name ?? '').trim();

    if ((!phone || !name) && row.client_id != null) {
      const { data: clientRow } = await admin
        .from('clients')
        .select('name, phone_wa')
        .eq('id', row.client_id)
        .maybeSingle();
      if (clientRow) {
        phone = phone || String((clientRow as { phone_wa?: string }).phone_wa ?? '').trim();
        name = name || String((clientRow as { name?: string }).name ?? '').trim();
      }
    }

    return {
      ok: true,
      quotationUrl: buildQuotationPublicLink(id, siteOrigin()),
      clientName: name || 'عزيزي العميل',
      clientPhone: phone || null,
      tripTitle: String(row.title ?? '').trim() || 'رحلتك',
    };
  } catch (err) {
    return {
      ok: false,
      quotationUrl: buildQuotationPublicLink(id, siteOrigin()),
      clientName: null,
      clientPhone: null,
      tripTitle: null,
      error: err instanceof Error ? err.message : 'تعذر تجهيز بيانات المشاركة.',
    };
  }
}
