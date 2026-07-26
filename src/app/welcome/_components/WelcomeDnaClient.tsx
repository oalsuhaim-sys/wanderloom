'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles } from 'lucide-react';

import { submitOnboardingProfileAction } from '@/app/actions/onboardingActions';
import { DnaAlreadySubmittedCard } from '@/app/welcome/_components/DnaAlreadySubmittedCard';
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

const GOLD = '#D4AF37';

const PREMIUM_INTRO =
  'دعنا نتعرف على تفاصيل حلمك، لننسج لك تجربة سفرٍ تشبهك وتلامس حواسك.';

const inputClass =
  'w-full rounded-xl border border-[#D4AF37]/20 bg-[#0D0F0E] px-4 py-3 text-sm text-white placeholder:text-[#6B6760] outline-none focus:border-[#D4AF37]/60 focus:ring-2 focus:ring-[#D4AF37]/20';

function toggleInterest(list: string[], label: string): string[] {
  return list.includes(label) ? list.filter((x) => x !== label) : [...list, label];
}

export type WelcomeDnaClientProps = {
  token: string;
  view: WelcomeDnaView;
  errorMessage?: string | null;
  profile?: OnboardingProfileRow | null;
};

export function WelcomeDnaClient({
  token,
  view,
  errorMessage = null,
  profile = null,
}: WelcomeDnaClientProps) {
  const router = useRouter();
  const displayName = profile?.display_name ?? '';
  const showForm = view === 'form' && Boolean(profile);

  const initialForm = useMemo(() => {
    if (!profile || view !== 'form') return emptyOnboardingForm();
    return onboardingFormFromProfile(profile);
  }, [profile, view]);

  const [submitting, setSubmitting] = useState(false);
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
      const result = await submitOnboardingProfileAction(token, {
        birth_date: '',
        anniversary_date: '',
        passport_expiry: form.passport_expiry,
        dna_activity_level: form.dna_activity_level,
        dna_special_requests: form.dna_special_requests,
        interests: form.interests,
        travelDna,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push('/dna-success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ التفضيلات.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      dir="rtl"
      className="relative min-h-screen overflow-hidden bg-[#0D0F0E] text-[#F5F0E8]"
      style={{ fontFamily: 'var(--font-tajawal), system-ui, sans-serif' }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            'radial-gradient(ellipse 80% 55% at 50% -5%, rgba(212,175,55,0.18), transparent), radial-gradient(ellipse 45% 35% at 100% 100%, rgba(30,39,32,0.9), transparent)',
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.45)_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-10 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-1.5 text-xs font-bold tracking-widest text-[#D4AF37]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            WANDERLOOM VIP
          </div>
          <h1 className="text-2xl font-black leading-relaxed text-white sm:text-3xl">
            مرحباً بك في عالم Wanderloom VIP الفاخر
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-8 text-[#C8C4BC] sm:text-base">
            {displayName ? `${displayName}، ` : ''}
            {view === 'form' ? PREMIUM_INTRO : 'نحن سعداء بانضمامك إلى عائلة Wanderloom VIP.'}
          </p>
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
            className="space-y-8 rounded-3xl border border-[#D4AF37]/25 bg-[#141816]/85 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-md sm:p-8"
          >
            <section className="rounded-2xl border border-[#D4AF37]/15 bg-[#0D0F0E]/60 p-5">
              <h2 className="mb-1 flex items-center gap-2 text-base font-black text-[#D4AF37]">
                <span aria-hidden>✨</span>
                ملف الـ DNA السياحي
              </h2>
              <p className="mb-5 text-xs leading-6 text-[#A8A49C]">
                كل تفصيلة تروينها لنا تُترجم إلى لحظة مدروسة — من مقعدك في السماء إلى كوبك الأول
                عند الوصول.
              </p>
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#A8A49C]">
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
                  <span className="mb-1.5 block text-xs font-bold text-[#A8A49C]">
                    المشروب / القهوة المفضلة
                  </span>
                  <input
                    type="text"
                    value={travelDna.favorite_drink}
                    onChange={(e) =>
                      setTravelDna((d) => ({ ...d, favorite_drink: e.target.value }))
                    }
                    placeholder="إسpresso، شاي أخضر، عصير طبيعي…"
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#A8A49C]">
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
                  <span className="mb-1.5 block text-xs font-bold text-[#A8A49C]">
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
                  <span className="mb-1.5 block text-xs font-bold text-[#A8A49C]">
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
                  <span className="mb-1.5 block text-xs font-bold text-[#A8A49C]">مستوى النشاط</span>
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
                  <span className="mb-1.5 block text-xs font-bold text-[#A8A49C]">طلبات خاصة</span>
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
              <h2 className="mb-4 flex items-center gap-2 text-base font-black text-[#D4AF37]">
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
                          ? 'border-[#D4AF37] bg-[#D4AF37]/15 text-[#D4AF37] shadow-[0_0_20px_rgba(212,175,55,0.15)]'
                          : 'border-[#D4AF37]/20 bg-[#0D0F0E] text-[#C8C4BC] hover:border-[#D4AF37]/45'
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
              className="w-full rounded-2xl py-4 text-base font-black text-[#0D0F0E] transition hover:brightness-110 disabled:opacity-60"
              style={{
                background: `linear-gradient(135deg, ${GOLD} 0%, #E8C96A 50%, ${GOLD} 100%)`,
                boxShadow: '0 8px 32px rgba(212,175,55,0.35)',
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
