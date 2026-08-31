'use server';

import { revalidatePath } from 'next/cache';

import { canonicalizePhoneWa } from '@/lib/client-intake-pipeline';
import { insertInterestLeadAdmin } from '@/lib/interest-lead-insert';

export type SubmitInterestResult =
  | { ok: true; success: true; message: string; leadId?: string }
  | { ok: false; success: false; error: string };

function cleanText(value: FormDataEntryValue | null | undefined, max = 200): string {
  return String(value ?? '')
    .trim()
    .slice(0, max);
}

export async function submitInterestAction(formData: FormData): Promise<SubmitInterestResult> {
  const fullName = cleanText(formData.get('full_name'), 120);
  const phoneRaw = cleanText(formData.get('phone_wa'), 40);
  const destination = cleanText(formData.get('destination'), 120);
  const referralCode = cleanText(formData.get('referral_code'), 64).toUpperCase() || null;

  if (!fullName || fullName.length < 2) {
    return { ok: false, success: false, error: 'يرجى إدخال الاسم الكامل' };
  }

  const phoneWa = canonicalizePhoneWa(phoneRaw);
  const digits = phoneWa.replace(/\D/g, '');
  if (digits.length < 8) {
    return { ok: false, success: false, error: 'يرجى إدخال رقم واتساب صالح' };
  }

  try {
    const result = await insertInterestLeadAdmin({
      fullName,
      phoneWa,
      destination,
      referralCode,
    });

    if (!result.ok) {
      return { ok: false, success: false, error: result.error };
    }

    console.info('[submitInterest] saved lead', {
      leadId: result.leadId,
      status: result.statusUsed,
      phone: phoneWa,
    });

    revalidatePath('/');
    revalidatePath('/crm/radar');

    return {
      ok: true,
      success: true,
      leadId: result.leadId,
      message: 'تم تسجيل اهتمامك بنجاح!',
    };
  } catch (err) {
    console.error('[submitInterest] unexpected error:', err);
    return {
      ok: false,
      success: false,
      error: err instanceof Error ? err.message : 'تعذّر إرسال طلب الاهتمام',
    };
  }
}
