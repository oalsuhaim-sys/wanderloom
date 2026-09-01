'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import Cal, { getCalApi, type EmbedEvent } from '@calcom/embed-react';
import { Calendar, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  confirmInterviewBooked,
  type ConfirmInterviewBookedPayload,
  saveInterviewDate,
} from '@/app/actions/groupOnboardingActions';
import { GroupOnboardingStepNav } from '@/app/group-onboarding/_components/GroupOnboardingStepNav';
import { BRAND_GOLD_BUTTON_CLASS, BRAND_OLIVE_HEADING_CLASS } from '@/lib/brand-gold';
import { DEFAULT_INTAKE_BOOKING_URL } from '@/lib/client-intake-pipeline';
import { parseInterviewSlotFromIso } from '@/lib/crm-leads';
import {
  buildGroupTermsHref,
  patchGroupRegistrationDraft,
} from '@/lib/group-registration-contact';

type Props = {
  leadId?: string;
  onBooked: () => void;
  onWaitlisted?: () => void;
  /** Group onboarding — show direct booking fast track + optional calendar accordion */
  enableDirectBooking?: boolean;
  /** Hold interview slot in localStorage until terms confirmation (no lead row yet). */
  draftMode?: boolean;
  onBack?: () => void;
};

type CapturedSlot = ConfirmInterviewBookedPayload & { display: string };

function resolveCalLink(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_CAL_EMBED_URL ?? '').trim();
  const base = (fromEnv || DEFAULT_INTAKE_BOOKING_URL).replace(/\/$/, '');
  try {
    const url = new URL(base.includes('://') ? base : `https://${base}`);
    return url.pathname.replace(/^\//, '');
  } catch {
    return 'omar-alsuhaim-jv2uy2/30min';
  }
}

/** Pull startTime from every known Cal.com embed payload shape. */
function extractStartTimeFromUnknown(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw === 'string') return raw.trim();

  const obj = raw as Record<string, unknown>;

  const data = obj.data;
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    const fromData = String(
      d.startTime ?? d.start ?? d.date ?? (d.booking as { startTime?: string } | undefined)?.startTime ?? '',
    ).trim();
    if (fromData) return fromData;

    const nestedBooking = d.booking;
    if (nestedBooking && typeof nestedBooking === 'object') {
      const b = nestedBooking as Record<string, unknown>;
      const fromBooking = String(b.startTime ?? b.start ?? b.date ?? '').trim();
      if (fromBooking) return fromBooking;
    }
  }

  const direct = String(
    obj.startTime ??
      obj.start ??
      obj.date ??
      (obj.booking as { startTime?: string } | undefined)?.startTime ??
      '',
  ).trim();
  if (direct) return direct;

  return '';
}

function captureSlotFromRaw(raw: unknown): CapturedSlot | null {
  const startTime = extractStartTimeFromUnknown(raw);
  if (!startTime) return null;

  const parsed = parseInterviewSlotFromIso(startTime);
  if (!parsed) return null;

  return {
    interviewDate: parsed.interviewDate,
    interviewTime: parsed.interviewTime,
    display: parsed.display ?? `${parsed.interviewDate} — ${parsed.interviewTime}`,
  };
}

function captureSlotFromBookingEvent(
  detail: EmbedEvent<'bookingSuccessfulV2'>['detail'],
): CapturedSlot | null {
  return captureSlotFromRaw(detail);
}

function captureSlotFromLegacyBookingEvent(detail: unknown): CapturedSlot | null {
  return captureSlotFromRaw(detail);
}

const CAL_EMBED_HEIGHT_PX = 400;
const CAL_EMBED_SCALE = 0.9;
const CAL_VISIBLE_HEIGHT_PX = Math.round(CAL_EMBED_HEIGHT_PX * CAL_EMBED_SCALE);
const CAL_ACCORDION_MAX_HEIGHT_PX = 420;
const CAL_ACCORDION_VISIBLE_PX = Math.round(CAL_ACCORDION_MAX_HEIGHT_PX * CAL_EMBED_SCALE);

function CalEmbed({
  leadId,
  onSlotCaptured,
  embedded = false,
}: {
  leadId: string;
  onSlotCaptured: (slot: CapturedSlot) => void;
  /** Inline mode — no outer card wrapper (for accordion body) */
  embedded?: boolean;
}) {
  const calLink = resolveCalLink();

  useEffect(() => {
    let cancelled = false;

    const bookingSuccessCallback = async (event: EmbedEvent<'bookingSuccessfulV2'>) => {
      if (cancelled) return;
      const slot =
        captureSlotFromBookingEvent(event.detail) ||
        captureSlotFromRaw(event) ||
        captureSlotFromRaw((event as unknown as { detail?: unknown }).detail);
      if (slot) {
        onSlotCaptured(slot);
      } else {
        console.warn('[InterviewCalendar] bookingSuccessfulV2 without startTime', event?.detail);
      }
    };

    const legacyBookingSuccessCallback = async (event: Event) => {
      if (cancelled) return;
      const custom = event as CustomEvent<unknown>;
      const slot = captureSlotFromLegacyBookingEvent(custom.detail) || captureSlotFromRaw(custom);
      if (slot) {
        onSlotCaptured(slot);
      } else {
        console.warn('[InterviewCalendar] bookingSuccessful without startTime', custom?.detail);
      }
    };

    (async () => {
      const cal = await getCalApi({ namespace: 'group-interview' });
      if (cancelled) return;

      cal('ui', {
        theme: 'light',
        hideEventTypeDetails: false,
        layout: 'month_view',
      });

      cal('on', {
        action: 'bookingSuccessfulV2',
        callback: bookingSuccessCallback,
      });

      cal('on', {
        action: 'bookingSuccessful',
        callback: legacyBookingSuccessCallback,
      });
    })();

    return () => {
      cancelled = true;
      void getCalApi({ namespace: 'group-interview' }).then((cal) => {
        cal('off', {
          action: 'bookingSuccessfulV2',
          callback: bookingSuccessCallback,
        });
        cal('off', {
          action: 'bookingSuccessful',
          callback: legacyBookingSuccessCallback,
        });
      });
    };
  }, [leadId, onSlotCaptured]);

  const embedHeight = embedded ? CAL_ACCORDION_MAX_HEIGHT_PX : CAL_EMBED_HEIGHT_PX;
  const visibleHeight = embedded ? CAL_ACCORDION_VISIBLE_PX : CAL_VISIBLE_HEIGHT_PX;
  const scrollMaxHeight = embedded ? `${CAL_ACCORDION_MAX_HEIGHT_PX}px` : '460px';

  const calInner = (
    <div
      className={
        embedded
          ? 'max-h-[420px] overflow-y-auto overflow-x-hidden rounded-xl border border-slate-100 p-2'
          : 'max-h-[460px] overflow-y-auto overflow-x-hidden rounded-xl'
      }
    >
      <div className="flex items-start justify-center">
        <div className="w-full overflow-hidden" style={{ height: `${visibleHeight}px` }}>
          <div
            className="w-full origin-top"
            style={{
              transform: `scale(${CAL_EMBED_SCALE})`,
              height: `${embedHeight}px`,
            }}
          >
            <Cal
              namespace="group-interview"
              calLink={calLink}
              config={{
                theme: 'light',
                layout: 'month_view',
                metadata: {
                  leadId,
                  lead_id: leadId,
                  wanderloomLeadId: leadId,
                },
              }}
              style={{
                width: '100%',
                height: `${embedHeight}px`,
                minHeight: `${embedHeight}px`,
                overflow: 'hidden',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return <div className="flex w-full justify-center">{calInner}</div>;
  }

  return (
    <div className="mx-auto w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm sm:p-4">
      <div style={{ maxHeight: scrollMaxHeight }} className="overflow-y-auto overflow-x-hidden rounded-xl">
        {calInner}
      </div>
    </div>
  );
}

export function InterviewCalendar({
  leadId = '',
  onBooked,
  onWaitlisted,
  enableDirectBooking = false,
  draftMode = false,
  onBack,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [capturedSlot, setCapturedSlot] = useState<CapturedSlot | null>(null);
  const [slotSaved, setSlotSaved] = useState(false);
  const [savingSlot, setSavingSlot] = useState(false);
  const [showCalendar, setShowCalendar] = useState(!enableDirectBooking);
  const [pending, startTransition] = useTransition();

  const handleSlotCaptured = useCallback((slot: CapturedSlot) => {
    void (async () => {
      setCapturedSlot(slot);
      setError('');
      setSavingSlot(true);

      if (draftMode) {
        patchGroupRegistrationDraft({
          interview_date: String(slot.interviewDate ?? ''),
          interview_time: String(slot.interviewTime ?? ''),
        });
        setSlotSaved(true);
        setSavingSlot(false);
        return;
      }

      if (!leadId) {
        setError('معرّف الطلب غير متوفر.');
        setSlotSaved(false);
        setSavingSlot(false);
        return;
      }

      const saved = await saveInterviewDate(
        leadId,
        String(slot.interviewDate ?? ''),
        String(slot.interviewTime ?? ''),
      );
      if (!saved.ok) {
        setError(saved.error);
        setSlotSaved(false);
      } else {
        setSlotSaved(true);
      }
      setSavingSlot(false);
    })();
  }, [draftMode, leadId]);

  function handleConfirmBooked() {
    setError('');
    startTransition(async () => {
      if (draftMode) {
        if (capturedSlot) {
          patchGroupRegistrationDraft({
            interview_date: String(capturedSlot.interviewDate ?? ''),
            interview_time: String(capturedSlot.interviewTime ?? ''),
          });
        }
        onBooked();
        return;
      }

      const payload: ConfirmInterviewBookedPayload | undefined = capturedSlot
        ? {
            interviewDate: capturedSlot.interviewDate,
            interviewTime: capturedSlot.interviewTime,
          }
        : undefined;

      const result = await confirmInterviewBooked(leadId, payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onBooked();
    });
  }

  function handleConfirmAppointment() {
    setError('');
    if (!capturedSlot && !slotSaved) {
      setError('يرجى اختيار موعد في التقويم أولاً، ثم اضغطي تأكيد الموعد.');
      return;
    }

    startTransition(async () => {
      if (draftMode) {
        if (capturedSlot) {
          patchGroupRegistrationDraft({
            interview_date: String(capturedSlot.interviewDate ?? ''),
            interview_time: String(capturedSlot.interviewTime ?? ''),
          });
        }
        router.push(buildGroupTermsHref());
        return;
      }

      const payload: ConfirmInterviewBookedPayload | undefined = capturedSlot
        ? {
            interviewDate: capturedSlot.interviewDate,
            interviewTime: capturedSlot.interviewTime,
          }
        : undefined;

      const result = await confirmInterviewBooked(leadId, payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.push(`/group-onboarding/terms?leadId=${encodeURIComponent(leadId)}`);
    });
  }

  function handleGoToTermsPage() {
    setError('');
    router.push(draftMode ? buildGroupTermsHref() : `/group-onboarding/terms?leadId=${encodeURIComponent(leadId)}`);
  }

  if (enableDirectBooking) {
    return (
      <div className="mx-auto w-full max-w-2xl overflow-x-hidden px-3 pb-6 sm:px-4" dir="rtl">
        <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          {onBack ? (
            <GroupOnboardingStepNav
              currentStep={2}
              onBack={onBack}
              backDisabled={pending}
            />
          ) : null}

          <div className="mb-5 text-center sm:mb-6">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-amber-300/60 bg-amber-50/60 text-amber-800">
              <Calendar className="h-6 w-6" aria-hidden />
            </div>
            <h2 className={`text-base font-black sm:text-xl ${BRAND_OLIVE_HEADING_CLASS}`}>خطوة التأكيد الأخيرة</h2>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-600 sm:text-sm">
              شكراً لتعبئة ملفك! اختاري الطريقة الأنسب لكِ — الحجز المباشر أو لقاء تعارف اختياري.
            </p>
          </div>

          <div className="mx-auto mb-6 w-full max-w-2xl space-y-4 text-right sm:mb-8">
            <div className="mx-auto w-full max-w-2xl space-y-4 rounded-3xl border border-amber-300/80 bg-amber-50/60 p-6 text-right shadow-sm">
              <div className="flex flex-col items-center justify-between gap-4 sm:flex-row sm:items-start">
                <div className="min-w-0 space-y-1">
                  <span className="inline-block rounded-md border border-amber-300/60 bg-white/80 px-2.5 py-1 text-[10px] font-extrabold text-amber-900">
                    ⚡ الخيار الأسرع
                  </span>
                  <h3 className={`pt-1 text-base font-extrabold ${BRAND_OLIVE_HEADING_CLASS}`}>
                    تأكيد الحجز المباشر (بدون لقاء)
                  </h3>
                  <p className="text-xs font-semibold text-amber-900/80">
                    جاهزة للانضمام؟ اضغطي لتأكيد حجزك والانتقال لمراجعة الشروط وتأكيد المقعد.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleGoToTermsPage}
                  className={`flex w-full shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-xs font-extrabold shadow-sm transition-all sm:w-auto ${BRAND_GOLD_BUTTON_CLASS}`}
                >
                  <span>تأكيد الحجز والانتقال للشروط</span>
                  <span aria-hidden>➔</span>
                </button>
              </div>
            </div>

            <div className="mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white text-right shadow-sm">
              <button
                type="button"
                onClick={() => setShowCalendar((open) => !open)}
                aria-expanded={showCalendar}
                className={`flex w-full cursor-pointer items-center justify-between gap-3 border-slate-100 p-4 transition-all sm:p-5 ${
                  showCalendar
                    ? 'border-b bg-amber-50/40'
                    : 'bg-amber-50/40 hover:bg-amber-50/60'
                }`}
              >
                <div className="min-w-0 space-y-0.5 text-right">
                  <h4 className={`flex items-center gap-2 text-xs font-extrabold sm:text-sm ${BRAND_OLIVE_HEADING_CLASS}`}>
                    <span aria-hidden>☕</span>
                    <span>عندك أسئلة وتفضّلين دردشة تعارف أولاً؟ (اختياري)</span>
                  </h4>
                  <p className="text-[11px] font-semibold text-slate-500">
                    اضغطي هنا لاختيار موعد لقاء خفيف لمدة 15 دقيقة مع قائدة الرحلة
                  </p>
                </div>
                <span className="shrink-0 whitespace-nowrap rounded-lg border border-amber-300/60 bg-amber-50/60 px-3 py-1.5 text-xs font-bold text-amber-800">
                  {showCalendar ? '▲ إخفاء التقويم' : '▼ عرض التقويم'}
                </span>
              </button>

              {showCalendar ? (
                <div className="space-y-4 bg-white p-4 sm:p-6">
                  <CalEmbed leadId={leadId} onSlotCaptured={handleSlotCaptured} embedded />

                  {capturedSlot ? (
                    <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-center text-[11px] font-bold text-emerald-900 sm:text-xs">
                      📅 تم اختيار الموعد: {capturedSlot.display}
                      {savingSlot ? ' · جاري الحفظ...' : slotSaved ? ' · تم الحفظ' : ''}
                    </p>
                  ) : null}

                  <p className="pt-1 text-center text-[11px] font-bold text-slate-500">
                    بعد اختيار الموعد المناسب في التقويم، اضغطي الزر أدناه للتأكيد
                  </p>

                  <button
                    type="button"
                    disabled={pending}
                    onClick={handleConfirmAppointment}
                    className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl py-3.5 text-xs font-extrabold shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-60 ${BRAND_GOLD_BUTTON_CLASS}`}
                  >
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                    <span>✅ تأكيد الموعد والانتقال للشروط</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {error ? (
            <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className="mx-auto w-full max-w-4xl overflow-x-hidden rounded-xl bg-white p-2 shadow-sm sm:rounded-2xl sm:p-4 sm:shadow-md md:p-8 md:shadow-lg"
      dir="rtl"
    >
      <div className="px-2 pb-3 pt-3 text-center sm:px-4 sm:pb-4 sm:pt-2 md:px-0">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#D4AF37]/15 text-[#1e3f20]">
          <Calendar className="h-6 w-6" aria-hidden />
        </div>
        <h2 className="text-lg font-black text-[#1e3f20] sm:text-xl">اختر موعد المقابلة</h2>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-gray-600">
          شكراً لتعبئة ملفك! خطوتك الأخيرة هي اختيار وقت مناسب لمقابلة التعارف (15 دقيقة).
        </p>
      </div>

      <CalEmbed leadId={leadId} onSlotCaptured={handleSlotCaptured} />

      <div className="space-y-3 px-2 py-4 sm:px-4 sm:pb-2 md:px-0 md:pt-5">
        {capturedSlot ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-black text-emerald-900">
            📅 تم اختيار الموعد: {capturedSlot.display}
            {savingSlot ? ' · جاري الحفظ...' : slotSaved ? ' · تم الحفظ' : ''}
          </p>
        ) : (
          <p className="text-center text-[11px] font-semibold text-gray-500">
            بعد اختيار الموعد في التقويم أعلاه، اضغط الزر لتأكيد الحجز في نظام Wanderloom.
          </p>
        )}

        {error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          disabled={pending}
          onClick={handleConfirmBooked}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1e3f20] py-3.5 text-sm font-black text-[#cda04c] transition hover:bg-[#163018] disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
          ✅ لقد قمت بحجز الموعد
        </button>
      </div>
    </div>
  );
}

export function InterviewBookedSuccess({ variant = 'interview' }: { variant?: 'interview' | 'waitlisted' }) {
  const isWaitlist = variant === 'waitlisted';

  return (
    <div
      className="mx-auto flex max-w-lg flex-col items-center rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-8 text-center shadow-lg"
      dir="rtl"
    >
      <CheckCircle2 className="h-16 w-16 text-emerald-600" aria-hidden />
      <h2 className="mt-4 text-xl font-black text-emerald-900">
        {isWaitlist ? 'تم تسجيلك في قائمة الانتظار!' : 'تم تأكيد موعد المقابلة بنجاح!'}
      </h2>
      <p className="mt-2 text-sm font-semibold leading-relaxed text-emerald-800">
        {isWaitlist
          ? 'سنتواصل معك فور توفر مقعد في الرحلة. شكراً لصبرك!'
          : 'سنرسل لك رابط الاجتماع قريباً.'}
      </p>
      <Link
        href="/"
        className="mt-8 rounded-full bg-[#1B3320] px-8 py-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-opacity-90"
      >
        العودة للصفحة الرئيسية
      </Link>
    </div>
  );
}
