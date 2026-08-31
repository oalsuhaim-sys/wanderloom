'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Sparkles } from 'lucide-react';

import {
  submitGroupLeadDnaAction,
  type GroupLeadDnaPayload,
} from '@/app/actions/groupOnboardingActions';
import {
  InterviewBookedSuccess,
  InterviewCalendar,
} from '@/app/dna/_components/InterviewCalendar';
import { ONBOARDING_INTEREST_OPTIONS } from '@/lib/client-onboarding';
import { BRAND_GOLD_TAG_CLASS } from '@/lib/brand-gold';

type Step = 'dna' | 'schedule_interview' | 'done';
type DoneVariant = 'interview' | 'waitlisted';

type Props = {
  leadId: string;
  leadName: string;
  tripLabel: string;
  initialInterests: string[];
  initialPace: string | null;
  initialFood: string[];
  initialNotes: string;
  onBack?: () => void;
};

const INPUT =
  'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-[#111] outline-none focus:border-[#cda04c] focus:ring-2 focus:ring-[#cda04c]/20';

function toggle(list: string[], item: string) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export function GroupOnboardingDnaClient({
  leadId,
  leadName,
  tripLabel,
  initialInterests,
  initialPace,
  initialFood,
  initialNotes,
  onBack,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isGroupFlow = searchParams.get('flow') === 'group_onboarding';
  const confirmStep = searchParams.get('step') === 'confirm';

  const [step, setStep] = useState<Step>(() =>
    isGroupFlow && confirmStep ? 'schedule_interview' : 'dna',
  );
  const [doneVariant, setDoneVariant] = useState<DoneVariant>('interview');
  const [interests, setInterests] = useState(initialInterests);
  const [dailyPace, setDailyPace] = useState(initialPace ?? '');
  const [foodPrefs, setFoodPrefs] = useState(initialFood);
  const [notes, setNotes] = useState(initialNotes);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const interestOptions = useMemo(() => ONBOARDING_INTEREST_OPTIONS.slice(0, 12), []);

  useEffect(() => {
    const outcome = searchParams.get('outcome');
    if (outcome === 'waitlisted') {
      setDoneVariant('waitlisted');
      setStep('done');
    }
  }, [searchParams]);

  function handleGoBack() {
    if (onBack) {
      onBack();
      return;
    }
    router.push('/#groups');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const payload: GroupLeadDnaPayload = {
      interests,
      daily_pace: dailyPace,
      food_preferences: foodPrefs,
      final_thoughts: notes.trim() || `ملف DNA — رحلة جماعية: ${tripLabel}`,
    };

    startTransition(async () => {
      const result = await submitGroupLeadDnaAction(leadId, payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (isGroupFlow) {
        setStep('schedule_interview');
      }
    });
  }

  if (step === 'done') {
    return (
      <main className="min-h-screen bg-[#F9F9F6] px-4 py-16 font-[family-name:var(--font-tajawal),system-ui,sans-serif]">
        <InterviewBookedSuccess variant={doneVariant} />
      </main>
    );
  }

  if (step === 'schedule_interview') {
    return (
      <main className="min-h-screen overflow-x-hidden bg-[#F9F9F6] px-3 py-6 font-[family-name:var(--font-tajawal),system-ui,sans-serif] sm:px-4 sm:py-10 md:py-16">
        <InterviewCalendar
          leadId={leadId}
          enableDirectBooking={isGroupFlow}
          onBack={() => setStep('dna')}
          onBooked={() => {
            setDoneVariant('interview');
            setStep('done');
          }}
          onWaitlisted={() => {
            setDoneVariant('waitlisted');
            setStep('done');
          }}
        />
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#F9F9F6] px-4 py-10 font-[family-name:var(--font-tajawal),system-ui,sans-serif] text-[#111]"
    >
      <div className="mx-auto max-w-2xl">
        {isGroupFlow ? (
          <div className="mx-auto mb-2 flex w-full max-w-xl items-center justify-between border-b border-slate-100 pb-4">
            <button
              type="button"
              onClick={handleGoBack}
              disabled={pending}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200/60 bg-slate-100 px-4 py-2 text-xs font-extrabold text-[#1c382b] transition-all hover:bg-amber-50 hover:text-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span aria-hidden>➔</span>
              <span>إلى الخلف</span>
            </button>

            <span
              className={`rounded-lg px-3 py-1 text-xs font-extrabold ${BRAND_GOLD_TAG_CLASS}`}
            >
              تخصيص التفضيلات
            </span>
          </div>
        ) : null}

        <header className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#1e3f20]/15 bg-white px-4 py-1.5 text-xs font-black text-[#1e3f20]">
            <Sparkles className="h-3.5 w-3.5 text-[#cda04c]" aria-hidden />
            ملف DNA — رحلة جماعية
          </div>
          <h1 className="text-2xl font-black text-[#1e3f20]">مرحباً {leadName}</h1>
          <p className="mt-2 text-sm font-semibold text-gray-600">
            {tripLabel} — ساعدنا على تخصيص تجربتك في المجموعة
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-2xl border border-[#1e3f20]/10 bg-white p-6 shadow-sm sm:p-8"
        >
          <fieldset>
            <legend className="mb-3 text-sm font-black text-[#cda04c]">اهتماماتك</legend>
            <div className="flex flex-wrap gap-2">
              {interestOptions.map((opt) => {
                const selected = interests.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setInterests((prev) => toggle(prev, opt))}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                      selected
                        ? 'bg-[#1e3f20] text-[#cda04c]'
                        : 'border border-gray-200 bg-gray-50 text-gray-700 hover:border-[#cda04c]/40'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="block">
            <span className="mb-2 block text-sm font-black text-[#cda04c]">إيقاع اليوم المفضل</span>
            <select
              value={dailyPace}
              onChange={(e) => setDailyPace(e.target.value)}
              className={INPUT}
            >
              <option value="">اختر…</option>
              <option value="هادئ">هادئ — وقت للراحة</option>
              <option value="متوازن">متوازن</option>
              <option value="نشيط">نشيط — برنامج مزدحم</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-black text-[#cda04c]">تفضيلات غذائية</span>
            <input
              type="text"
              value={foodPrefs.join('، ')}
              onChange={(e) =>
                setFoodPrefs(
                  e.target.value
                    .split(/[،,]/)
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
              placeholder="مثال: نباتي، بدون مكسرات…"
              className={INPUT}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-black text-[#cda04c]">ملاحظات إضافية</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي تفاصيل تهمنا قبل المقابلة…"
              className={`${INPUT} resize-y`}
            />
          </label>

          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1e3f20] py-3.5 text-sm font-black text-[#cda04c] transition hover:bg-[#163018] disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
            {isGroupFlow ? 'التالي — تأكيد الحجز' : 'حفظ الملف'}
          </button>
        </form>
      </div>
    </main>
  );
}
