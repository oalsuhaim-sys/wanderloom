'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';

import {
  createEmptyCompanion,
  createEmptyWelcomePayload,
  fetchWelcomeProfileByToken,
  submitWelcomeOnboardingByToken,
  welcomePayloadFromProfile,
  WELCOME_STEP_LABELS,
  type WelcomeOnboardingPayload,
} from '@/lib/vip-welcome-onboarding';

const GOLD = '#D4AF37';
const STEPS = WELCOME_STEP_LABELS.length;

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="mb-8 flex items-center justify-center gap-2 sm:gap-3">
      {WELCOME_STEP_LABELS.map((label, i) => {
        const step = i + 1;
        const active = step === current;
        const done = step < current;
        return (
          <div key={label} className="flex flex-col items-center gap-1.5">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-black transition sm:h-10 sm:w-10 ${
                active
                  ? 'border-[#D4AF37] bg-[#D4AF37] text-[#0D0F0E] shadow-[0_0_20px_rgba(212,175,55,0.35)]'
                  : done
                    ? 'border-[#D4AF37]/60 bg-[#D4AF37]/20 text-[#D4AF37]'
                    : 'border-[#D4AF37]/20 bg-[#0D0F0E] text-[#6B6760]'
              }`}
            >
              {done ? '✓' : step}
            </div>
            <span
              className={`hidden text-[10px] font-bold sm:block ${
                active ? 'text-[#D4AF37]' : 'text-[#6B6760]'
              }`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SliderField({
  label,
  leftLabel,
  rightLabel,
  value,
  onChange,
}: {
  label: string;
  leftLabel: string;
  rightLabel: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-[#D4AF37]/15 bg-[#0D0F0E]/80 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-black text-[#E8E4DC]">{label}</span>
        <span className="font-mono text-xs font-bold text-[#D4AF37]">{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="welcome-range w-full"
      />
      <div className="mt-2 flex justify-between text-[10px] font-bold text-[#6B6760]">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

export default function WelcomePage() {
  const params = useParams();
  const token = String(params?.token ?? '').trim();
  return <VipWelcomeOnboarding token={token} />;
}

function VipWelcomeOnboarding({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [completed, setCompleted] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WelcomeOnboardingPayload>(createEmptyWelcomePayload());

  const loadProfile = useCallback(async () => {
    if (!token) {
      setError('رابط التعارف غير صالح.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const row = await fetchWelcomeProfileByToken(token);
      if (!row) {
        setError('لم يُعثر على ملف العميل — تحقق من الرابط.');
        return;
      }
      setDisplayName(row.display_name);
      setCompleted(row.onboarding_completed);
      setForm(welcomePayloadFromProfile(row));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل النموذج.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const ok = await submitWelcomeOnboardingByToken(token, {
        preferences: form.preferences,
        family_members: form.family_members,
        passport_docs: [],
      });
      if (!ok) {
        setError('تعذر حفظ الملف — تواصل مع الكونسيرج.');
        return;
      }
      setCompleted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر حفظ الملف.');
    } finally {
      setSubmitting(false);
    }
  };

  const updateTravel = (patch: Partial<WelcomeOnboardingPayload['preferences']['travel_style']>) => {
    setForm((f) => ({
      ...f,
      preferences: {
        ...f.preferences,
        travel_style: { ...f.preferences.travel_style, ...patch },
      },
    }));
  };

  const updateWardrobe = (patch: Partial<WelcomeOnboardingPayload['preferences']['wardrobe']>) => {
    setForm((f) => ({
      ...f,
      preferences: {
        ...f.preferences,
        wardrobe: { ...f.preferences.wardrobe, ...patch },
      },
    }));
  };

  return (
    <main
      dir="rtl"
      className="relative min-h-screen overflow-hidden bg-[#0D0F0E] text-[#F5F0E8]"
      style={{ fontFamily: 'var(--font-tajawal), system-ui, sans-serif' }}
    >
      <style jsx global>{`
        .welcome-range {
          accent-color: ${GOLD};
          height: 6px;
        }
      `}</style>

      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(ellipse 85% 50% at 50% -10%, rgba(212,175,55,0.2), transparent), radial-gradient(ellipse 40% 30% at 0% 100%, rgba(30,39,32,0.95), transparent)',
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-6 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-1.5 text-xs font-bold tracking-widest text-[#D4AF37]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            WANDERLOOM VIP
          </div>
          <h1 className="text-2xl font-black leading-relaxed text-white sm:text-3xl">
            مرحباً بك في عالم Wanderloom
            {displayName ? (
              <>
                ، <span className="text-[#D4AF37]">{displayName}</span>
              </>
            ) : null}{' '}
            ✨
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-[#C8C4BC]">
            خطوات قصيرة لنفهم أسلوبك — ونصنع رحلة مصمّمة لك وحدك.
          </p>
        </header>

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-[#D4AF37]" aria-label="جاري التحميل" />
          </div>
        ) : error && !completed && !displayName ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-950/40 px-6 py-8 text-center text-sm font-bold text-red-200">
            {error}
          </div>
        ) : completed ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-3xl border border-[#D4AF37]/40 bg-[#141816]/90 px-6 py-16 text-center shadow-[0_0_80px_rgba(212,175,55,0.15)] backdrop-blur-sm">
            <div className="mb-6 text-6xl" aria-hidden>
              ✨
            </div>
            <h2 className="text-2xl font-black text-[#D4AF37] sm:text-3xl">تم استلام ملفك بنجاح</h2>
            <p className="mt-5 max-w-md text-sm leading-8 text-[#E8E4DC] sm:text-base">
              مصمم رحلتك يعمل الآن على هندسة تجربة لا تُنسى.
            </p>
            <p className="mt-4 text-xs font-bold tracking-[0.25em] text-[#6B6760]">WANDERLOOM CONCIERGE</p>
          </div>
        ) : (
          <>
            <StepIndicator current={step} />

            <div className="flex-1 rounded-3xl border border-[#D4AF37]/25 bg-[#141816]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur-md sm:p-8">
              {step === 1 ? (
                <section className="space-y-5">
                  <h2 className="text-lg font-black text-[#D4AF37]">🌍 أسلوب السفر</h2>
                  <SliderField
                    label="إيقاع الرحلة"
                    leftLabel="استرخاء"
                    rightLabel="مغامرة"
                    value={form.preferences.travel_style.relaxation_vs_adventure}
                    onChange={(v) => updateTravel({ relaxation_vs_adventure: v })}
                  />
                  <SliderField
                    label="البيئة المفضلة"
                    leftLabel="طبيعة"
                    rightLabel="مدينة"
                    value={form.preferences.travel_style.nature_vs_city}
                    onChange={(v) => updateTravel({ nature_vs_city: v })}
                  />
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-[#A8A49C]">تفضيلات الطهي / المطاعم</span>
                    <textarea
                      value={form.preferences.travel_style.culinary_preferences}
                      onChange={(e) => updateTravel({ culinary_preferences: e.target.value })}
                      rows={3}
                      placeholder="مichelin، محلي، نباتي، مأكولات بحرية…"
                      className="w-full resize-y rounded-xl border border-[#D4AF37]/20 bg-[#0D0F0E] px-4 py-3 text-sm text-white placeholder:text-[#6B6760] outline-none focus:border-[#D4AF37]/60"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-[#A8A49C]">قيود غذائية / حساسية</span>
                    <textarea
                      value={form.preferences.travel_style.dietary_restrictions}
                      onChange={(e) => updateTravel({ dietary_restrictions: e.target.value })}
                      rows={2}
                      placeholder="حلال، خالي من الغلuten، حساسية…"
                      className="w-full resize-y rounded-xl border border-[#D4AF37]/20 bg-[#0D0F0E] px-4 py-3 text-sm text-white placeholder:text-[#6B6760] outline-none focus:border-[#D4AF37]/60"
                    />
                  </label>
                </section>
              ) : null}

              {step === 2 ? (
                <section className="space-y-5">
                  <h2 className="text-lg font-black text-[#D4AF37]">👔 أزياء السفر</h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-bold text-[#A8A49C]">مقاس القميص / السترة</span>
                      <input
                        type="text"
                        value={form.preferences.wardrobe.shirt_size}
                        onChange={(e) => updateWardrobe({ shirt_size: e.target.value })}
                        placeholder="M · L · XL · 52…"
                        className="w-full rounded-xl border border-[#D4AF37]/20 bg-[#0D0F0E] px-4 py-3 text-sm text-white outline-none focus:border-[#D4AF37]/60"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-bold text-[#A8A49C]">مقاس الحذاء</span>
                      <input
                        type="text"
                        value={form.preferences.wardrobe.shoe_size}
                        onChange={(e) => updateWardrobe({ shoe_size: e.target.value })}
                        placeholder="EU 42 · US 9…"
                        dir="ltr"
                        className="w-full rounded-xl border border-[#D4AF37]/20 bg-[#0D0F0E] px-4 py-3 text-sm text-white outline-none focus:border-[#D4AF37]/60"
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-[#A8A49C]">الماركات المفضلة</span>
                    <input
                      type="text"
                      value={form.preferences.wardrobe.favorite_brands}
                      onChange={(e) => updateWardrobe({ favorite_brands: e.target.value })}
                      placeholder="Brunello، Loro Piana، Zegna…"
                      className="w-full rounded-xl border border-[#D4AF37]/20 bg-[#0D0F0E] px-4 py-3 text-sm text-white outline-none focus:border-[#D4AF37]/60"
                    />
                  </label>
                </section>
              ) : null}

              {step === 3 ? (
                <section className="space-y-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-black text-[#D4AF37]">👨‍👩‍👧 المرافقون</h2>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          family_members: [...f.family_members, createEmptyCompanion()],
                        }))
                      }
                      className="inline-flex items-center gap-1 rounded-xl border border-[#D4AF37]/40 px-3 py-2 text-xs font-black text-[#D4AF37] transition hover:bg-[#D4AF37]/10"
                    >
                      <Plus className="h-4 w-4" />
                      إضافة
                    </button>
                  </div>
                  {form.family_members.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-[#D4AF37]/25 px-4 py-8 text-center text-sm text-[#6B6760]">
                      لا مرافقين — اضغط «إضافة» إن سافرت مع العائلة.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {form.family_members.map((comp, index) => (
                        <li
                          key={comp.id}
                          className="rounded-2xl border border-[#D4AF37]/15 bg-[#0D0F0E]/70 p-4"
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <span className="text-xs font-black text-[#D4AF37]/80">#{index + 1}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setForm((f) => ({
                                  ...f,
                                  family_members: f.family_members.filter((c) => c.id !== comp.id),
                                }))
                              }
                              className="rounded-lg p-1.5 text-red-400 transition hover:bg-red-950/40"
                              aria-label="حذف"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <input
                              value={comp.name}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  family_members: f.family_members.map((c) =>
                                    c.id === comp.id ? { ...c, name: e.target.value } : c,
                                  ),
                                }))
                              }
                              placeholder="الاسم"
                              className="rounded-lg border border-[#D4AF37]/20 bg-[#141816] px-3 py-2.5 text-sm text-white outline-none"
                            />
                            <input
                              value={comp.age}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  family_members: f.family_members.map((c) =>
                                    c.id === comp.id ? { ...c, age: e.target.value } : c,
                                  ),
                                }))
                              }
                              placeholder="العمر"
                              dir="ltr"
                              className="rounded-lg border border-[#D4AF37]/20 bg-[#141816] px-3 py-2.5 text-sm text-white outline-none"
                            />
                            <input
                              value={comp.relation}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  family_members: f.family_members.map((c) =>
                                    c.id === comp.id ? { ...c, relation: e.target.value } : c,
                                  ),
                                }))
                              }
                              placeholder="القرابة"
                              className="rounded-lg border border-[#D4AF37]/20 bg-[#141816] px-3 py-2.5 text-sm text-white outline-none"
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ) : null}

              {error ? (
                <p className="mt-5 rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm font-bold text-red-200">
                  {error}
                </p>
              ) : null}

              <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={step <= 1}
                  onClick={() => setStep((s) => Math.max(1, s - 1))}
                  className="inline-flex items-center gap-1 rounded-xl border border-[#D4AF37]/25 px-4 py-2.5 text-sm font-bold text-[#C8C4BC] transition hover:border-[#D4AF37]/50 disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                  السابق
                </button>

                {step < STEPS ? (
                  <button
                    type="button"
                    onClick={() => setStep((s) => Math.min(STEPS, s + 1))}
                    className="inline-flex items-center gap-1 rounded-xl px-5 py-2.5 text-sm font-black text-[#0D0F0E]"
                    style={{
                      background: `linear-gradient(135deg, ${GOLD}, #E8C96A)`,
                    }}
                  >
                    التالي
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleSubmit()}
                    className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-black text-[#0D0F0E] disabled:opacity-60"
                    style={{
                      background: `linear-gradient(135deg, ${GOLD}, #E8C96A)`,
                      boxShadow: '0 8px 32px rgba(212,175,55,0.35)',
                    }}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        جاري الإرسال…
                      </>
                    ) : (
                      'إرسال ملفي VIP ✨'
                    )}
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        <footer className="mt-10 text-center text-[10px] font-bold tracking-[0.2em] text-[#5C5850]">
          WANDERLOOM · VIP WELCOME
        </footer>
      </div>
    </main>
  );
}
