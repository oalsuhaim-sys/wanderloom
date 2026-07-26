'use server';

import type { LeadKanbanColumnId } from '@/lib/leads-kanban';
import type { CrmLeadRow } from '@/lib/crm-leads';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  buildKanbanActiveTripWhatsAppMessage,
  buildKanbanAwaitingPaymentWhatsAppMessage,
  sendWhatsAppMessage,
} from '@/lib/whatsapp-send-server';

export type KanbanStatusNotifyResult =
  | { ok: true; sent: true; simulated?: boolean; status: LeadKanbanColumnId }
  | { ok: true; sent: false; skipped: true; reason: string; status: LeadKanbanColumnId }
  | { ok: false; error: string; status: LeadKanbanColumnId };

function siteBase(origin?: string): string {
  return (
    String(origin ?? '').trim() ||
    String(process.env.NEXT_PUBLIC_SITE_URL ?? '').trim() ||
    'https://wanderloom-travel.vercel.app'
  ).replace(/\/$/, '');
}

async function resolvePaymentOrReviewLink(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  lead: CrmLeadRow,
  origin?: string,
): Promise<string> {
  const base = siteBase(origin);
  const leadId = String(lead.id ?? '').trim();
  const clientId =
    lead.client_id != null && Number.isFinite(Number(lead.client_id))
      ? Number(lead.client_id)
      : null;

  // Prefer public quote page linked to this lead
  if (leadId) {
    const { data: byLead } = await admin
      .from('quotations')
      .select('id')
      .eq('lead_id', leadId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const quoteId = String((byLead as { id?: unknown } | null)?.id ?? '').trim();
    if (quoteId) return `${base}/quote/${encodeURIComponent(quoteId)}`;
  }

  if (clientId != null) {
    const { data: byClient } = await admin
      .from('quotations')
      .select('id')
      .eq('client_id', clientId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const quoteId = String((byClient as { id?: unknown } | null)?.id ?? '').trim();
    if (quoteId) return `${base}/quote/${encodeURIComponent(quoteId)}`;

    // Client teaser / portal as review surface
    return `${base}/portal/${clientId}`;
  }

  return `${base}/`;
}

/**
 * يُستدعى بعد سحب بطاقة الكانبان إلى عمود جديد — يرسل واتساب تلقائياً عند الحاجة.
 */
export async function notifyLeadKanbanStatusAction(
  leadId: string,
  status: LeadKanbanColumnId,
  origin?: string,
): Promise<KanbanStatusNotifyResult> {
  const key = String(leadId ?? '').trim();
  if (!key) {
    return { ok: false, error: 'معرّف الطلب غير صالح.', status };
  }

  // Only automate these operational columns
  if (status !== 'awaiting_payment' && status !== 'delivered') {
    return {
      ok: true,
      sent: false,
      skipped: true,
      reason: 'no_automation_for_status',
      status,
    };
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return { ok: false, error: 'إعدادات الخادم غير مكتملة (service role).', status };
  }

  try {
    const { data, error } = await admin.from('leads').select('*').eq('id', key).maybeSingle();
    if (error) {
      return { ok: false, error: error.message || 'تعذر قراءة الطلب.', status };
    }
    if (!data) {
      return { ok: false, error: 'لم يُعثر على الطلب.', status };
    }

    const lead = data as CrmLeadRow;
    const phone = String(lead.phone_wa ?? '').trim();
    const name = String(lead.full_name ?? '').trim() || 'ضيفنا الكريم';
    if (!phone) {
      return {
        ok: true,
        sent: false,
        skipped: true,
        reason: 'missing_phone',
        status,
      };
    }

    let message = '';
    if (status === 'awaiting_payment') {
      const paymentLink = await resolvePaymentOrReviewLink(admin, lead, origin);
      message = buildKanbanAwaitingPaymentWhatsAppMessage(name, paymentLink);
    } else if (status === 'delivered') {
      message = buildKanbanActiveTripWhatsAppMessage(name);
    }

    if (!message) {
      return {
        ok: true,
        sent: false,
        skipped: true,
        reason: 'empty_message',
        status,
      };
    }

    const wa = await sendWhatsAppMessage({ phone, name, message });
    if (!wa.ok) {
      return { ok: false, error: wa.error || 'فشل إرسال واتساب.', status };
    }

    return {
      ok: true,
      sent: true,
      simulated: Boolean(wa.simulated),
      status,
    };
  } catch (err) {
    console.error('[notifyLeadKanbanStatusAction]', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر إرسال إشعار الواتساب.',
      status,
    };
  }
}
