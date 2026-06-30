'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, Sparkles } from 'lucide-react';

import {
  CLIENT_DNA_ACTIVITY_OPTIONS,
  emptyOnboardingForm,
  fetchOnboardingProfileByToken,
  ONBOARDING_HOTEL_TYPE_OPTIONS,
  ONBOARDING_INTEREST_OPTIONS,
  onboardingFormFromProfile,
  submitOnboardingProfile,
  type OnboardingTravelDna,
} from '@/lib/client-onboarding';

const GOLD = '#D4AF37';

const inputClass =
  'w-full rounded-xl border border-[#D4AF37]/20 bg-[#0D0F0E] px-4 py-3 text-sm text-white placeholder:text-[#6B6760] outline-none focus:border-[#D4AF37]/60 focus:ring-2 focus:ring-[#D4AF37]/20';

function toggleInterest(list: string[], label: string): string[] {
  return list.includes(label) ? list.filter((x) => x !== label) : [...list, label];
}

export default function VipOnboardingPage() {
  const params = useParams();
  const token = String(params?.token ?? '').trim();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [completed, setCompleted] = useState(false);
  const [form, setForm] = useState(() => {
    const empty = emptyOnboardingForm();
    return {
      birth_date: empty.birth_date,
      anniversary_date: empty.anniversary_date,
      passport_expiry: empty.passport_expiry,
      dna_activity_level: empty.dna_activity_level,
      interests: empty.interests,
    };
  });
  const [travelDna, setTravelDna] = useState<OnboardingTravelDna>({
    flight_seat: '',
    food_preference: '',
    hotel_type: '',
    favorite_drink: '',
  });

  const loadProfile = useCallback(async () => {
    if (!token) {
      setError('رابط التعارف غير صالح.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const row = await fetchOnboardingProfileByToken(token);
      if (!row) {
        setError('رابط التعارف غير موجود أو منتهي الصلاحية.');
        return;
      }
      setDisplayName(row.display_name);
      setCompleted(row.onboarding_completed);
      const loaded = onboardingFormFromProfile(row);
      setForm({
        birth_date: loaded.birth_date,
        anniversary_date: loaded.anniversary_date,
        passport_expiry: loaded.passport_expiry,
        dna_activity_level: loaded.dna_activity_level,
        interests: loaded.interests,
      });
      setTravelDna(loaded.travelDna);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل النموذج.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const ok = await submitOnboardingProfile(token, {
        birth_date: form.birth_date,
        anniversary_date: form.anniversary_date,
        passport_expiry: form.passport_expiry,
        dna_activity_level: form.dna_activity_level,
        interests: form.interests,
        travelDna,
      });
      if (!ok) {
        setError('تعذر حفظ التفضيلات. تحقق من الرابط أو تواصل مع الكونسيرج.');
        return;
      }
      setCompleted(true);
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
          <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-[#C8C4BC] sm:text-base">
            {displayName ? `${displayName}، ` : ''}
            يرجى تزويدنا بتفضيلاتك لنصنع لك رحلة لا تُنسى.
          </p>
        </header>

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-[#D4AF37]" aria-label="جاري التحميل" />
          </div>
        ) : error && !completed ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-950/40 px-6 py-8 text-center text-sm font-bold text-red-200">
            {error}
          </div>
        ) : completed ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-3xl border border-[#D4AF37]/35 bg-[#141816]/90 px-6 py-14 text-center shadow-[0_0_60px_rgba(212,175,55,0.12)] backdrop-blur-sm">
            <div className="mb-6 text-5xl" aria-hidden>
              🦅🌿
            </div>
            <h2 className="text-xl font-black text-[#D4AF37] sm:text-2xl">شكراً لثقتك</h2>
            <p className="mt-4 max-w-md text-sm leading-8 text-[#E8E4DC] sm:text-base">
              تم حفظ تفضيلاتك بنظام الكونسيرج الخاص بنا بنجاح. مستشار السفر الخاص بك بدأ العمل على
              دلالك الآن. 🦅🌿
            </p>
          </div>
        ) : (
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="space-y-8 rounded-3xl border border-[#D4AF37]/25 bg-[#141816]/85 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-md sm:p-8"
          >
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-base font-black text-[#D4AF37]">
                <span aria-hidden>🎂</span>
                التواريخ السعيدة
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#A8A49C]">يوم الميلاد</span>
                  <input
                    type="date"
                    value={form.birth_date}
                    onChange={(e) => setForm((f) => ({ ...f, birth_date: e.target.value }))}
                    dir="ltr"
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#A8A49C]">ذكرى الزواج</span>
                  <input
                    type="date"
                    value={form.anniversary_date}
                    onChange={(e) => setForm((f) => ({ ...f, anniversary_date: e.target.value }))}
                    dir="ltr"
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#A8A49C]">تاريخ انتهاء الجواز</span>
                  <input
                    type="date"
                    value={form.passport_expiry}
                    onChange={(e) => setForm((f) => ({ ...f, passport_expiry: e.target.value }))}
                    dir="ltr"
                    className={inputClass}
                  />
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-[#D4AF37]/15 bg-[#0D0F0E]/60 p-5">
              <h2 className="mb-1 flex items-center gap-2 text-base font-black text-[#D4AF37]">
                <span aria-hidden>✨</span>
                تفضيلاتك الشخصية (Travel DNA)
              </h2>
              <p className="mb-5 text-xs leading-6 text-[#A8A49C]">
                نستخدم هذه التفاصيل لضبط مقعدك، وجباتك، فندقك، واستقبالك — بسرية تامة.
              </p>
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#A8A49C]">
                    المقعد المفضل في الطيران (نافذة، ممر…)
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
                    الحساسية أو تفضيلات الطعام
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
                  <span className="mb-1.5 block text-xs font-bold text-[#A8A49C]">طابع الفنادق المفضل</span>
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
                    مستوى النشاط في السفر
                  </span>
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
                  <span className="mb-1.5 block text-xs font-bold text-[#A8A49C]">
                    مشروبك أو قهوتك المفضلة (لنستقبلك بها)
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
              </div>
            </section>

            <section>
              <h2 className="mb-4 flex items-center gap-2 text-base font-black text-[#D4AF37]">
                <span aria-hidden>🌟</span>
                الاهتمامات والشغف
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
        )}

        <footer className="mt-10 text-center text-[10px] font-bold tracking-[0.2em] text-[#5C5850]">
          WANDERLOOM · VIP CONCIERGE
        </footer>
      </div>
    </main>
  );
}
