'use server';

import { revalidatePath } from 'next/cache';

import { insertInterestLeadAdmin } from '@/lib/interest-lead-insert';
import { requireValidPhone } from '@/lib/phoneUtils';

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

  const phoneCheck = requireValidPhone(phoneRaw);
  if (!phoneCheck.isValid) {
    return { ok: false, success: false, error: phoneCheck.error ?? 'يرجى إدخال رقم واتساب صالح' };
  }
  const phoneWa = phoneCheck.formattedPhone;

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
