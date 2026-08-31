'use server';

import {
  fetchWelcomeDnaPageDataAdmin,
  submitOnboardingProfileAdmin,
  ensureLeadMeetingAfterDnaAdmin,
} from '@/lib/client-onboarding-server';
import {
  WELCOME_DNA_NOT_FOUND_MESSAGE,
  type OnboardingProfilePayload,
  type OnboardingProfileRow,
} from '@/lib/client-onboarding';
import { assertServiceRoleKeyConfigured } from '@/lib/supabase/server-action-auth';

export type OnboardingProfileActionResult =
  | { ok: true; profile: OnboardingProfileRow }
  | { ok: false; error: string; notFound?: boolean };

/** جلب ملف DNA للصفحة العامة — service_role يتجاوز RLS */
export async function getOnboardingProfileAction(
  token: string,
): Promise<OnboardingProfileActionResult> {
  const key = String(token ?? '').trim();
  if (!key) {
    return { ok: false, error: 'رابط التعارف غير صالح.', notFound: true };
  }

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) {
    return { ok: false, error: serviceKeyError };
  }

  try {
    const data = await fetchWelcomeDnaPageDataAdmin(key);
    if (!data) {
      return {
        ok: false,
        error: WELCOME_DNA_NOT_FOUND_MESSAGE,
        notFound: true,
      };
    }
    return { ok: true, profile: data.profile };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر تحميل النموذج.',
    };
  }
}

export type SubmitOnboardingActionResult =
  | {
      ok: true;
      leadId?: string | null;
      quoteId?: string | null;
      quotationUrl?: string | null;
      clientName?: string | null;
      clientPhone?: string | null;
      tripTitle?: string | null;
      autoQuoteMessage?: string;
    }
  | { ok: false; error: string };

/** حفظ ملف DNA من الصفحة العامة — service_role يتجاوز RLS */
export async function submitOnboardingProfileAction(
  token: string,
  payload: OnboardingProfilePayload,
  options?: { origin?: string | null },
): Promise<SubmitOnboardingActionResult> {
  const key = String(token ?? '').trim();
  if (!key) {
    return { ok: false, error: 'رابط التعارف غير صالح.' };
  }

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) {
    return { ok: false, error: serviceKeyError };
  }

  try {
    const saved = await submitOnboardingProfileAdmin(key, payload);
    if (!saved) {
      return { ok: false, error: 'تعذر حفظ التفضيلات. تحقق من الرابط أو تواصل مع الكونسيرج.' };
    }
    // Explicit pipeline bump: DNA (+ embedded calendar) → meeting column
    const meeting = await ensureLeadMeetingAfterDnaAdmin(key);

    // Auto-create / activate quotation with DNA preferences injected
    const { autoCreateQuotationAfterDnaAdmin } = await import(
      '@/app/actions/dnaQuotationAutomation'
    );
    const autoQuote = await autoCreateQuotationAfterDnaAdmin({
      clientId: meeting.clientId,
      leadId: meeting.leadId,
      origin: options?.origin ?? null,
    });

    if (!autoQuote.ok) {
      console.warn('[submitOnboardingProfileAction] auto quotation:', autoQuote.error);
    }

    return {
      ok: true,
      leadId: meeting.leadId,
      quoteId: autoQuote.quoteId,
      quotationUrl: autoQuote.quotationUrl ?? null,
      clientName: autoQuote.clientName ?? null,
      clientPhone: autoQuote.clientPhone ?? null,
      tripTitle: autoQuote.tripTitle ?? null,
      autoQuoteMessage:
        autoQuote.message || 'تم إكمال الـ DNA بنجاح! عرض السعر جاهز الآن للعميل.',
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر حفظ التفضيلات.',
    };
  }
}
