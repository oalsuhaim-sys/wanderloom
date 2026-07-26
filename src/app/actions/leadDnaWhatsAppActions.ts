'use server';

import { revalidatePath } from 'next/cache';

import type { CrmLeadRow } from '@/lib/crm-leads';
import { ensureLeadClientIntakeAdmin } from '@/lib/client-intake-pipeline-server';
import {
  assertUsableLeadClientFields,
  markDnaLinkSent,
  provisionIntakeForExistingClient,
} from '@/lib/client-intake-pipeline';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  buildRadarApprovalDnaWhatsAppMessage,
  sendWhatsAppMessage,
} from '@/lib/whatsapp-send-server';
import { setLeadPipelineStatus } from '@/lib/lead-pipeline-automation';

export type SendLeadDnaWhatsAppResult =
  | { ok: true; dnaUrl: string; simulated?: boolean; clientId: number }
  | { ok: false; error: string; clientId?: number };

function revalidateCrmAfterRadarApproval() {
  revalidatePath('/crm', 'layout');
  revalidatePath('/crm');
  revalidatePath('/crm/clients');
  revalidatePath('/crm/pipeline');
  revalidatePath('/crm/radar');
}

/** Cache bust for Dashboard / Clients / Pipeline after radar approval */
export async function revalidateCrmAfterRadarApprovalAction(): Promise<{ ok: true }> {
  revalidateCrmAfterRadarApproval();
  return { ok: true };
}

/**
 * Explicit / manual DNA WhatsApp send only.
 * Do NOT call from page load, fetch loops, or silent approve side-effects.
 * Wire exclusively to a user click (e.g. «إرسال رابط DNA»).
 */
export async function sendLeadDnaWhatsAppAction(
  leadId: string,
  origin?: string,
): Promise<SendLeadDnaWhatsAppResult> {
  const key = String(leadId ?? '').trim();
  if (!key) {
    return { ok: false, error: 'معرّف الطلب غير صالح.' };
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return { ok: false, error: 'إعدادات الخادم غير مكتملة (service role).' };
  }

  try {
    const { data, error } = await admin.from('leads').select('*').eq('id', key).maybeSingle();
    if (error) {
      return { ok: false, error: error.message || 'تعذر قراءة الطلب.' };
    }
    if (!data) {
      return { ok: false, error: 'لم يُعثر على الطلب.' };
    }

    const lead = data as CrmLeadRow;
    try {
      assertUsableLeadClientFields({
        name: lead.full_name,
        phone: lead.phone_wa,
      });
    } catch (validationErr) {
      return {
        ok: false,
        error:
          validationErr instanceof Error
            ? validationErr.message
            : 'بيانات العميل ناقصة أو غير صالحة. تأكد من وجود رقم الجوال.',
      };
    }
    const phone = String(lead.phone_wa ?? '').trim();

    const ensured = await ensureLeadClientIntakeAdmin(key);
    const clientId = ensured.clientId;

    const site =
      String(origin ?? '').trim() ||
      String(process.env.NEXT_PUBLIC_SITE_URL ?? '').trim() ||
      undefined;

    const intake = await provisionIntakeForExistingClient(
      admin,
      clientId,
      {
        id: lead.id,
        full_name: lead.full_name,
        phone_wa: phone,
      },
      { origin: site },
    );

    if (!intake?.dnaUrl) {
      return { ok: false, error: 'تعذر تجهيز رابط DNA للعميل.', clientId };
    }

    const name = String(lead.full_name ?? '').trim() || 'ضيفنا الكريم';
    const message = buildRadarApprovalDnaWhatsAppMessage(name, intake.dnaUrl);
    const wa = await sendWhatsAppMessage({
      phone,
      name,
      dnaLink: intake.dnaUrl,
      message,
    });

    if (!wa.ok) {
      return { ok: false, error: wa.error || 'فشل إرسال واتساب.', clientId };
    }

    await markDnaLinkSent(admin, clientId).catch((err) => {
      console.warn('[sendLeadDnaWhatsAppAction] markDnaLinkSent:', err);
    });

    await setLeadPipelineStatus(admin, { leadId: key, clientId }, 'awaiting_dna').catch((err) => {
      console.warn('[sendLeadDnaWhatsAppAction] set awaiting_dna:', err);
    });

    revalidateCrmAfterRadarApproval();

    return {
      ok: true,
      dnaUrl: intake.dnaUrl,
      clientId,
      simulated: Boolean(wa.simulated),
    };
  } catch (err) {
    console.error('[sendLeadDnaWhatsAppAction]', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر إرسال رابط DNA عبر واتساب.',
    };
  }
}
