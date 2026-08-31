'use client';

import Link from 'next/link';

import { brandGoldButtonStyle } from '@/lib/brand-gold';

type Props = {
  fullName: string;
  tripTitle: string;
  placement: 'confirmed_seat' | 'waitlisted';
  checkoutPath?: string;
  waitlistMessage?: string;
};

export function RegistrationSuccessStep({
  fullName,
  tripTitle,
  placement,
  checkoutPath,
  waitlistMessage,
}: Props) {
  const isWaitlisted = placement === 'waitlisted';
  const displayName = fullName.trim() || 'مسافر';

  return (
    <div
      className="crm-animate-in mx-auto max-w-xl space-y-6 rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8"
      dir="rtl"
      lang="ar"
    >
      <div className="space-y-2">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-200/80 bg-emerald-50 text-2xl text-emerald-600">
          🎉
        </div>
        <h2 className="text-xl font-extrabold text-slate-900">
          تم تسجيل طلبك بنجاح، أهلاً بك يا {displayName}!
        </h2>
        <p className="text-xs font-semibold leading-relaxed text-slate-600">
          {isWaitlisted
            ? waitlistMessage ||
              'تم استلام بياناتك وتوقيع وثيقة الرحلة. سنبلغك فور توفر مقعد في قائمة الانتظار.'
            : 'تم استلام بياناتك وتوقيع ميثاق الرحلة بنجاح. يمكنك الآن تأكيد المقعد بالدفع الفوري، أو الانتظار وتلقي تفاصيل الحجز عبر الواتساب.'}
        </p>
      </div>

      <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-right text-xs">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/60 pb-2">
          <span className="shrink-0 font-bold text-slate-500">الرحلة:</span>
          <span className="text-end font-extrabold leading-snug text-slate-900">{tripTitle}</span>
        </div>
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="shrink-0 font-bold text-slate-500">حالة الطلب:</span>
          <span
            className={`rounded px-2.5 py-0.5 text-[11px] font-extrabold ${
              isWaitlisted ? 'bg-sky-100/80 text-sky-900' : ''
            }`}
            style={
              isWaitlisted
                ? undefined
                : {
                    backgroundColor: '#F7F0E1',
                    color: '#8C6D23',
                  }
            }
          >
            {isWaitlisted ? 'في قائمة الانتظار ⏳' : 'تم التسجيل – بانتظار تأكيد المقعد'}
          </span>
        </div>
      </div>

      <div className="space-y-3 pt-2">
        {!isWaitlisted && checkoutPath ? (
          <Link
            href={checkoutPath}
            style={brandGoldButtonStyle}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl py-3.5 text-xs font-extrabold shadow-sm transition-all hover:opacity-90"
          >
            <span>💳 الدفع الآن وتأكيد المقعد فوراً</span>
            <span aria-hidden>➔</span>
          </Link>
        ) : null}

        <Link
          href="/"
          className="block w-full cursor-pointer rounded-xl bg-slate-100 py-3 text-xs font-bold text-slate-700 transition-all hover:bg-slate-200"
        >
          {isWaitlisted ? 'العودة للموقع الرئيسي' : 'سأقوم بالدفع لاحقاً والعودة للموقع'}
        </Link>
      </div>
    </div>
  );
}
