'use client';

import { useState, useTransition } from 'react';
import { Heart, Loader2, MapPin, Phone, User } from 'lucide-react';
import toast from 'react-hot-toast';

import { submitInterestAction } from '@/app/actions/submitInterest';
import { ReferralCodeField } from '@/components/ReferralCodeField';
import { requireValidPhone } from '@/lib/phoneUtils';
import { normalizeAffiliateRef, persistAffiliateRef } from '@/lib/referral-url';

const INPUT_CLASS =
  'h-11 w-full rounded-xl border border-gray-200/90 bg-white/80 px-4 text-sm font-bold text-[#111111] outline-none transition placeholder:text-gray-400 focus:border-[#cda04c]/70 focus:ring-2 focus:ring-[#cda04c]/25';

const FIELD_LABEL = 'mb-2 block text-right text-xs font-black tracking-wide text-[#cda04c]';

type InterestFormProps = {
  variant?: 'default' | 'modal';
  onSuccess?: () => void;
};

export function InterestForm({ variant = 'default', onSuccess }: InterestFormProps) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [destination, setDestination] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    const referral = normalizeAffiliateRef(referralCode);
    if (referral) persistAffiliateRef(referral);

    const phoneCheck = requireValidPhone(phone);
    if (!phoneCheck.isValid) {
      const message = phoneCheck.error ?? 'يرجى إدخال رقم جوال سعودي صحيح';
      setError(message);
      toast.error(message);
      return;
    }

    const fd = new FormData();
    fd.set('full_name', fullName);
    fd.set('phone_wa', phoneCheck.formattedPhone);
    if (destination.trim()) fd.set('destination', destination.trim());
    if (referral) fd.set('referral_code', referral);

    startTransition(async () => {
      const result = await submitInterestAction(fd);
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      setSuccessMessage(result.message);
      toast.success(result.message);
      setFullName('');
      setPhone('');
      setDestination('');
      setReferralCode('');
      onSuccess?.();
    });
  }

  if (successMessage) {
    return (
      <div
        className={
          variant === 'modal'
            ? 'py-4 text-center'
            : 'rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white p-8 text-center shadow-sm'
        }
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Heart className="h-7 w-7" aria-hidden />
        </div>
        <p className="text-base font-black leading-relaxed text-emerald-900 sm:text-lg">
          {successMessage}
        </p>
        <button
          type="button"
          onClick={() => setSuccessMessage('')}
          className="mt-6 text-sm font-bold text-[#9a7b45] underline decoration-[#cda04c]/40 underline-offset-4 transition hover:text-[#cda04c]"
        >
          {variant === 'modal' ? 'إغلاق' : 'تسجيل اهتمام آخر'}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={
        variant === 'modal'
          ? ''
          : 'rounded-2xl border border-[#1e3f20]/10 bg-white/90 p-6 shadow-sm backdrop-blur-sm sm:p-8'
      }
      dir="rtl"
      lang="ar"
    >
      <div className="space-y-5">
        <label className="block">
          <span className={FIELD_LABEL}>الاسم</span>
          <div className="relative">
            <User
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              aria-hidden
            />
            <input
              type="text"
              name="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoComplete="name"
              placeholder="الاسم الكامل"
              className={`${INPUT_CLASS} pr-10`}
            />
          </div>
        </label>

        <label className="block">
          <span className={FIELD_LABEL}>رقم الواتساب</span>
          <div className="relative">
            <Phone
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              aria-hidden
            />
            <input
              type="tel"
              name="phone_wa"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              autoComplete="tel"
              placeholder="05xxxxxxxx"
              dir="ltr"
              className={`${INPUT_CLASS} pr-10 text-left`}
            />
          </div>
        </label>

        <label className="block">
          <span className={FIELD_LABEL}>
            الوجهة المفضلة <span className="font-semibold text-gray-400">(اختياري)</span>
          </span>
          <div className="relative">
            <MapPin
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              aria-hidden
            />
            <input
              type="text"
              name="destination"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="مثال: اليابان، سويسرا، بالي..."
              className={`${INPUT_CLASS} pr-10`}
            />
          </div>
        </label>

        <ReferralCodeField
          value={referralCode}
          onChange={setReferralCode}
          inputClassName="h-11 focus:border-[#cda04c]/70 focus:ring-[#cda04c]/25"
        />
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-right text-sm font-bold text-rose-800">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1e3f20] py-3.5 text-sm font-black text-[#cda04c] transition hover:bg-[#163018] disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
        سجل اهتمامك
      </button>

      <p className="mt-4 text-center text-[11px] font-semibold leading-relaxed text-gray-500">
        بدون تواريخ أو ميزانيات — فقط نبقيك على اطلاع بأفضل العروض والوجهات.
      </p>
    </form>
  );
}
