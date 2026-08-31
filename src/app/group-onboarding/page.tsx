'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { submitGroupTripLead } from '@/app/actions/groupOnboardingActions';
import { GroupOnboardingStepNav } from '@/app/group-onboarding/_components/GroupOnboardingStepNav';
import { ReferralCodeField } from '@/components/ReferralCodeField';
import {
  brandGoldBadgeStyle,
  brandGoldButtonStyle,
  brandGoldCalloutStyle,
  brandOliveHeadingStyle,
  brandOliveLabelStyle,
} from '@/lib/brand-gold';
import {
  normalizeAffiliateRef,
  persistAffiliateRef,
} from '@/lib/referral-url';
import { supabaseClient } from '@/lib/supabaseClient';

type TripInfo = {
  id: string;
  title_ar: string;
  title_en: string | null;
  description_ar: string | null;
  badge_ar: string | null;
  price: string | null;
  dates_ar: string | null;
};

const FIELD =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/40';

const FIELD_LABEL = 'block text-xs font-extrabold';

function GroupOnboardingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tripId = String(searchParams.get('tripId') ?? '').trim();

  const [trip, setTrip] = useState<TripInfo | null>(null);
  const [loadingTrip, setLoadingTrip] = useState(Boolean(tripId));
  const [tripError, setTripError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [waitlistSuccess, setWaitlistSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId) {
      setLoadingTrip(false);
      setTripError('رابط التسجيل غير مكتمل — أعد النسخ من لوحة الإدارة.');
      return;
    }

    let cancelled = false;

    async function loadTrip() {
      setLoadingTrip(true);
      setTripError(null);
      try {
        if (!supabaseClient) {
          throw new Error('قاعدة البيانات غير مهيأة.');
        }

        const { data, error } = await supabaseClient
          .from('group_trips')
          .select('id, title_ar, title_en, description_ar, badge_ar, price, dates_ar, is_active')
          .eq('id', tripId)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.error('Error loading trip for onboarding:', error);
          throw error;
        }
        if (!data) {
          setTripError('الرحلة غير موجودة أو لم تعد متاحة.');
          setTrip(null);
          return;
        }
        if ((data as { is_active?: boolean }).is_active === false) {
          setTripError('هذه الرحلة غير مفعّلة حالياً.');
          setTrip(null);
          return;
        }

        setTrip({
          id: String((data as TripInfo).id),
          title_ar: String((data as TripInfo).title_ar ?? 'رحلة جماعية'),
          title_en: (data as TripInfo).title_en,
          description_ar: (data as TripInfo).description_ar,
          badge_ar: (data as TripInfo).badge_ar,
          price: (data as TripInfo).price,
          dates_ar: (data as TripInfo).dates_ar,
        });
      } catch (err) {
        if (!cancelled) {
          setTripError(
            err instanceof Error ? err.message : 'تعذر تحميل تفاصيل الرحلة.',
          );
          setTrip(null);
        }
      } finally {
        if (!cancelled) setLoadingTrip(false);
      }
    }

    void loadTrip();
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!trip) return;

    if (!fullName.trim() || !whatsapp.trim() || !birthDate.trim()) {
      setFormError('يرجى تعبئة كافة الحقول المطلوبة (الاسم، الواتساب، وتاريخ الميلاد)');
      return;
    }
    const emailTrimmed = email.trim();
    if (emailTrimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      setFormError('أدخل بريداً إلكترونياً صالحاً، أو اترك الحقل فارغاً.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const referral = normalizeAffiliateRef(referralCode);
    if (referral) persistAffiliateRef(referral);

    const res = await submitGroupTripLead({
      full_name: fullName.trim(),
      phone_wa: whatsapp.trim(),
      email: emailTrimmed || null,
      birth_date: birthDate.trim(),
      trip_label: trip.title_ar,
      preferred_trip_id: trip.id,
      referral_code: referral,
    });

    setSubmitting(false);

    if (!res.ok) {
      setFormError(res.error);
      return;
    }

    if (res.placement === 'waitlisted' || !res.leadId) {
      setFormError(null);
      setWaitlistSuccess(res.message);
      return;
    }

    router.push(`/dna/${res.leadId}?flow=group_onboarding`);
  }

  return (
    <div
      dir="rtl"
      lang="ar"
      className="min-h-dvh bg-[#FDFBF7] text-[#111]"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(217,119,6,0.14), transparent 55%)',
      }}
    >
      <div className="mx-auto max-w-lg px-4 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))] sm:py-14">
        <GroupOnboardingStepNav
          currentStep={1}
          onBack={() => router.push('/#groups')}
          backDisabled={submitting}
        />

        <header className="mb-6 text-center sm:mb-8">
          <span
            style={brandGoldBadgeStyle}
            className="inline-block rounded-md border px-2.5 py-0.5 text-[11px] font-extrabold"
          >
            Wanderloom · Group Registration
          </span>
          <h1 style={brandOliveHeadingStyle} className="mt-3 text-xl font-black leading-snug sm:text-3xl">
            تسجيل مباشر في رحلة المجموعة
          </h1>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-[#3d4a42]">
            املأ بياناتك لنبدأ مسار الانضمام الخاص بهذه الرحلة.
          </p>
        </header>

        {loadingTrip ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-[#1e3f20]/15 bg-white py-16 text-sm font-bold text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin text-[#C5A059]" aria-hidden />
            جاري تحميل الرحلة…
          </div>
        ) : tripError || !trip ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-10 text-center">
            <p className="text-sm font-black text-rose-900">{tripError ?? 'تعذر التحميل.'}</p>
            <Link
              href="/#groups"
              className="mt-4 inline-flex rounded-xl bg-[#1e3f20] px-5 py-2.5 text-xs font-black text-[#cda04c]"
            >
              تصفّح الرحلات المتاحة
            </Link>
          </div>
        ) : waitlistSuccess ? (
          <div
            style={brandGoldCalloutStyle}
            className="rounded-2xl border px-6 py-10 text-center shadow-sm"
          >
            <p className="text-lg font-black">قائمة الانتظار</p>
            <p className="mt-3 text-sm font-semibold leading-relaxed">
              {waitlistSuccess}
            </p>
            <Link
              href="/#groups"
              className="mt-6 inline-flex rounded-xl bg-[#1e3f20] px-5 py-2.5 text-xs font-black text-[#cda04c]"
            >
              العودة للرحلات
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            <section className="space-y-2 rounded-2xl border border-[#E8D2A7]/80 bg-white p-4 pt-6 text-right shadow-sm sm:p-5 sm:pt-5">
              {trip.badge_ar ? (
                <span className="inline-flex rounded-full bg-[#1e3f20]/8 px-2.5 py-0.5 text-[10px] font-black text-[#1e3f20]">
                  {trip.badge_ar}
                </span>
              ) : null}
              <h2 style={brandOliveHeadingStyle} className="text-base font-extrabold leading-snug sm:text-xl">
                {trip.title_ar}
              </h2>
              {trip.title_en ? (
                <p className="text-xs font-semibold text-gray-500" dir="ltr">
                  {trip.title_en}
                </p>
              ) : null}
              {trip.dates_ar ? (
                <p className="text-xs font-bold text-[#1e3f20]/80">📅 {trip.dates_ar}</p>
              ) : null}
              {trip.price ? (
                <p className="text-sm font-black text-[#8C6D23]" dir="ltr">
                  {trip.price}
                </p>
              ) : null}
              {trip.description_ar ? (
                <p className="text-xs font-semibold leading-relaxed text-slate-600">
                  {trip.description_ar}
                </p>
              ) : null}
            </section>

            <form
              onSubmit={(e) => void onSubmit(e)}
              className="space-y-3 rounded-2xl border border-[#1e3f20]/10 bg-white p-5 shadow-sm"
            >
              <label className={FIELD_LABEL} style={brandOliveLabelStyle}>
                الاسم الكامل
                <input
                  className={`${FIELD} mt-1.5`}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="مثال: سارة العتيبي"
                  autoComplete="name"
                  required
                />
              </label>
              <label className={FIELD_LABEL} style={brandOliveLabelStyle}>
                واتساب
                <input
                  className={`${FIELD} mt-1.5`}
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="05xxxxxxxx"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  dir="ltr"
                />
              </label>
              <label className={FIELD_LABEL} style={brandOliveLabelStyle}>
                البريد الإلكتروني{' '}
                <span className="font-normal text-slate-400">(اختياري)</span>
                <input
                  type="email"
                  className={`${FIELD} mt-1.5 text-left`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  autoComplete="email"
                  dir="ltr"
                />
              </label>
              <div className="space-y-1.5 text-right">
                <label
                  htmlFor="birth_date_picker"
                  className={FIELD_LABEL}
                  style={brandOliveLabelStyle}
                >
                  تاريخ الميلاد <span className="text-rose-500">*</span>
                </label>
                <input
                  id="birth_date_picker"
                  type="date"
                  required
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  onClick={(e) => {
                    try {
                      e.currentTarget.showPicker?.();
                    } catch {
                      /* browsers without showPicker */
                    }
                  }}
                  className={`group-onboarding-date-input ${FIELD} cursor-pointer`}
                  dir="rtl"
                />
              </div>

              <ReferralCodeField
                value={referralCode}
                onChange={setReferralCode}
                inputClassName={FIELD}
                labelClassName={FIELD_LABEL}
                labelStyle={brandOliveLabelStyle}
              />

              {formError ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800">
                  {formError}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                style={brandGoldButtonStyle}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-extrabold shadow-sm transition-all hover:opacity-90 disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    جاري التسجيل…
                  </>
                ) : (
                  'ابدأ التسجيل في هذه الرحلة'
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GroupOnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-[#FDFBF7] text-sm font-bold text-gray-500">
          <Loader2 className="me-2 h-5 w-5 animate-spin text-[#C5A059]" aria-hidden />
          جاري التحميل…
        </div>
      }
    >
      <GroupOnboardingForm />
    </Suspense>
  );
}
