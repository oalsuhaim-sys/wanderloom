'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles } from 'lucide-react';

import { submitOnboardingProfileAction } from '@/app/actions/onboardingActions';
import { DnaAlreadySubmittedCard } from '@/app/welcome/_components/DnaAlreadySubmittedCard';
import { clearPendingDna } from '@/lib/instant-dna-status';
import {
  CLIENT_DNA_ACTIVITY_OPTIONS,
  emptyOnboardingForm,
  ONBOARDING_HOTEL_TYPE_OPTIONS,
  ONBOARDING_INTEREST_OPTIONS,
  onboardingFormFromProfile,
  WELCOME_DNA_SUCCESS_MESSAGE,
  type OnboardingProfileRow,
  type OnboardingTravelDna,
  type WelcomeDnaView,
} from '@/lib/client-onboarding';

const GOLD = '#D9B238';

const PREMIUM_INTRO =
  'دعنا نتعرف على تفاصيل حلمك، لننسج لك تجربة سفرٍ تشبهك وتلامس حواسك.';

const inputClass =
  'w-full rounded-xl border border-[#D9B238]/20 bg-[#15232C] px-4 py-3 text-sm text-white placeholder:text-[#7D8A93] outline-none focus:border-[#D9B238]/60 focus:ring-2 focus:ring-[#D9B238]/20';

function toggleInterest(list: string[], label: string): string[] {
  return list.includes(label) ? list.filter((x) => x !== label) : [...list, label];
}

export type WelcomeDnaClientProps = {
  token: string;
  view: WelcomeDnaView;
  errorMessage?: string | null;
  profile?: OnboardingProfileRow | null;
  /** Zero-Wait onboarding — visitor was redirected here right after «سجّل رحلتك» */
  arrivedFromRequest?: boolean;
};

export function WelcomeDnaClient({
  token,
  view,
  errorMessage = null,
  profile = null,
  arrivedFromRequest = false,
}: WelcomeDnaClientProps) {
  const router = useRouter();
  const displayName = profile?.display_name ?? '';
  const showForm = view === 'form' && Boolean(profile);

  const initialForm = useMemo(() => {
    if (!profile || view !== 'form') return emptyOnboardingForm();
    return onboardingFormFromProfile(profile);
  }, [profile, view]);

  const [submitting, setSubmitting] = useState(false);

  // DNA already on file → drop the «أكملها لاحقاً» reminder on this device
  useEffect(() => {
    if (view === 'success') clearPendingDna();
  }, [view]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(() => ({
    passport_expiry: initialForm.passport_expiry,
    dna_activity_level: initialForm.dna_activity_level,
    dna_special_requests: initialForm.dna_special_requests,
    interests: initialForm.interests,
  }));
  const [travelDna, setTravelDna] = useState<OnboardingTravelDna>(() => ({
    ...initialForm.travelDna,
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('رابط التعارف غير صالح.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitOnboardingProfileAction(
        token,
        {
          birth_date: '',
          anniversary_date: '',
          passport_expiry: form.passport_expiry,
          dna_activity_level: form.dna_activity_level,
          dna_special_requests: form.dna_special_requests,
          interests: form.interests,
          travelDna,
        },
        { origin: typeof window !== 'undefined' ? window.location.origin : null },
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      clearPendingDna();
      const params = new URLSearchParams();
      const leadId = String(result.leadId ?? '').trim();
      const quoteId = String(result.quoteId ?? '').trim();
      if (leadId) params.set('leadId', leadId);
      if (quoteId) params.set('quoteId', quoteId);
      if (result.quotationUrl) params.set('quoteUrl', result.quotationUrl);
      router.push(params.toString() ? `/dna-success?${params.toString()}` : '/dna-success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ التفضيلات.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      dir="rtl"
      className="wl-weave-dark relative min-h-screen overflow-hidden text-[#F4EFE6]"
      style={{ fontFamily: 'var(--font-tajawal), system-ui, sans-serif' }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            'radial-gradient(ellipse 80% 55% at 50% -5%, rgba(217,178,56,0.18), transparent), radial-gradient(ellipse 45% 35% at 100% 100%, rgba(28,46,58,0.6), transparent)',
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.22)_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-10 sm:px-6 sm:py-14">
        {arrivedFromRequest && view === 'form' ? (
          <div
            role="status"
            className="mb-8 flex items-center gap-3 rounded-2xl border border-[#D9B238]/30 bg-[#D9B238]/[0.07] px-4 py-3 text-right"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#D9B238] text-sm font-black text-[#1C2E3A]" aria-hidden>
              ✓
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-white">استلمنا طلب رحلتك</p>
              <p className="mt-0.5 text-xs font-bold text-[#C9D1D6]">الخطوة الأخيرة: بصمة سفرك (Travel DNA) — بعدها مباشرة نبدأ تفصيل مسارك وتسعير رحلتك.</p>
            </div>
            <div className="hidden shrink-0 gap-1 sm:flex" aria-hidden>
              <span className="h-1.5 w-6 rounded-full bg-[#D9B238]" />
              <span className="h-1.5 w-6 rounded-full bg-[#D9B238]/40" />
            </div>
          </div>
        ) : null}

        <header className="mb-10 text-center">
          <span className="mx-auto mb-5 flex h-[74px] w-[74px] items-center justify-center rounded-[22px] bg-[#F4EFE6] shadow-[0_0_0_6px_rgba(217,178,56,0.18)]">
            <Image src="/brand/wanderloom-mark.png" alt="" width={52} height={52} priority className="h-[52px] w-[52px] object-contain" />
          </span>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#D9B238]/30 bg-[#D9B238]/10 px-4 py-1.5 text-xs font-bold tracking-widest text-[#D9B238]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            WANDERLOOM VIP
          </div>
          <h1 className="text-2xl font-black leading-relaxed text-white sm:text-3xl">
            مرحباً بك في عالم Wanderloom VIP الفاخر
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-8 text-[#C9D1D6] sm:text-base">
            {displayName ? `${displayName}، ` : ''}
            {view === 'form' ? PREMIUM_INTRO : 'نحن سعداء بانضمامك إلى عائلة Wanderloom VIP.'}
          </p>
          <svg aria-hidden width="240" height="18" viewBox="0 0 240 18" className="mx-auto mt-5 block">
            <path d="M0 9 C 20 0 40 18 60 9 S 100 0 120 9 S 160 18 180 9 S 220 0 240 9" fill="none" stroke="#D9B238" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </header>

        {view === 'not_found' ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-950/40 px-6 py-8 text-center text-sm font-bold text-red-200">
            {errorMessage || 'رابط التعارف غير موجود أو تأكد من صحة الرابط.'}
          </div>
        ) : view === 'success' ? (
          <DnaAlreadySubmittedCard displayName={displayName} message={WELCOME_DNA_SUCCESS_MESSAGE} />
        ) : showForm ? (
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="space-y-8 rounded-3xl border border-[#D9B238]/25 bg-[#101C24]/75 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-md sm:p-8"
          >
            <section className="rounded-2xl border border-[#D9B238]/15 bg-[#1C2E3A]/60 p-5">
              <h2 className="mb-1 flex items-center gap-2 text-base font-black text-[#D9B238]">
                <span aria-hidden>✨</span>
                ملف الـ DNA السياحي
              </h2>
              <p className="mb-5 text-xs leading-6 text-[#AEB8BF]">
                كل تفصيلة تروينها لنا تُترجم إلى لحظة مدروسة — من مقعدك في السماء إلى كوبك الأول
                عند الوصول.
              </p>
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#AEB8BF]">
                    الحساسية أو تفضيل الطعام
                  </span>
                  <textarea
                    value={travelDna.food_preference}
                    onChange={(e) =>
                      setTravelDna((d) => ({ ...d, food_preference: e.target.value }))
                    }
                    placeholder="مثال: نباتي، حلال، بدون بصل…"
                    rows={3}
                    className={`${inputClass} resize-y`}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#AEB8BF]">
                    المشروب / القهوة المفضلة
                  </span>
                  <input
                    type="text"
                    value={travelDna.favorite_drink}
                    onChange={(e) =>
                      setTravelDna((d) => ({ ...d, favorite_drink: e.target.value }))
                    }
                    placeholder="إسبريسو، شاي أخضر، عصير طبيعي…"
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#AEB8BF]">
                    المقعد المفضل في الطيران
                  </span>
                  <input
                    type="text"
                    value={travelDna.flight_seat}
                    onChange={(e) =>
                      setTravelDna((d) => ({ ...d, flight_seat: e.target.value }))
                    }
                    placeholder="نافذة، ممر، مقعد أمامي…"
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#AEB8BF]">
                    نوع الفنادق المفضلة
                  </span>
                  <select
                    value={travelDna.hotel_type}
                    onChange={(e) =>
                      setTravelDna((d) => ({ ...d, hotel_type: e.target.value }))
                    }
                    className={inputClass}
                  >
                    <option value="">— لم يحدد —</option>
                    {ONBOARDING_HOTEL_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#AEB8BF]">
                    تاريخ انتهاء الجواز
                  </span>
                  <input
                    type="date"
                    value={form.passport_expiry}
                    onChange={(e) => setForm((f) => ({ ...f, passport_expiry: e.target.value }))}
                    dir="ltr"
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#AEB8BF]">مستوى النشاط</span>
                  <select
                    value={form.dna_activity_level}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, dna_activity_level: e.target.value }))
                    }
                    className={inputClass}
                  >
                    <option value="">— لم يحدد —</option>
                    {CLIENT_DNA_ACTIVITY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#AEB8BF]">طلبات خاصة</span>
                  <textarea
                    value={form.dna_special_requests}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, dna_special_requests: e.target.value }))
                    }
                    placeholder="أي تفاصيل إضافية تود أن يعرفها فريق الكونسيرج…"
                    rows={3}
                    className={`${inputClass} resize-y`}
                  />
                </label>
              </div>
            </section>

            <section>
              <h2 className="mb-4 flex items-center gap-2 text-base font-black text-[#D9B238]">
                <span aria-hidden>🌟</span>
                اهتمامات السفر
              </h2>
              <div className="flex flex-wrap gap-2">
                {ONBOARDING_INTEREST_OPTIONS.map((label) => {
                  const selected = form.interests.includes(label);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({ ...f, interests: toggleInterest(f.interests, label) }))
                      }
                      className={`rounded-full border px-4 py-2 text-xs font-bold transition sm:text-sm ${
                        selected
                          ? 'border-[#D9B238] bg-[#D9B238]/15 text-[#D9B238] shadow-[0_0_20px_rgba(217,178,56,0.15)]'
                          : 'border-[#D9B238]/20 bg-[#15232C] text-[#C9D1D6] hover:border-[#D9B238]/45'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </section>

            {error ? (
              <p className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm font-bold text-red-200">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-2xl py-4 text-base font-black text-[#1C2E3A] transition hover:brightness-110 disabled:opacity-60"
              style={{
                background: `linear-gradient(135deg, ${GOLD} 0%, #E8C96A 50%, ${GOLD} 100%)`,
                boxShadow: '0 8px 32px rgba(217,178,56,0.35)',
              }}
            >
              {submitting ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  جاري الحفظ…
                </span>
              ) : (
                'حفظ التفضيلات الفاخرة ✨'
              )}
            </button>
          </form>
        ) : (
          <div className="rounded-2xl border border-red-500/30 bg-red-950/40 px-6 py-8 text-center text-sm font-bold text-red-200">
            {errorMessage ||
              'تعذر تحميل نموذج التعارف. يرجى التحقق من الرابط أو التواصل مع الكونسيرج.'}
          </div>
        )}

        <footer className="mt-10 text-center text-[10px] font-bold tracking-[0.2em] text-[#5C5850]">
          WANDERLOOM · VIP CONCIERGE
        </footer>
      </div>
    </main>
  );
}
