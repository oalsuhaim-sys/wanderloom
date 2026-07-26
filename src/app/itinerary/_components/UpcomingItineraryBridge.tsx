'use client';

import Link from 'next/link';
import { ArrowLeft, MapPin, Plane } from 'lucide-react';

import { formatTripDateRange } from '@/lib/public-itinerary';
import type { ClientItineraryBridge } from '@/lib/client-active-itinerary';

type UpcomingItineraryBridgeProps = {
  trip: ClientItineraryBridge;
  variant?: 'light' | 'dark';
  /** عند فتح الملف من نفس صفحة المسار — إغلاق البوابة بدل التنقل */
  isSameItineraryPage?: boolean;
  onReturnToItinerary?: () => void;
};

export default function UpcomingItineraryBridge({
  trip,
  variant = 'light',
  isSameItineraryPage = false,
  onReturnToItinerary,
}: UpcomingItineraryBridgeProps) {
  const isDark = variant === 'dark';
  const dateRange = formatTripDateRange(trip.startDate, trip.endDate);
  const label = trip.destination
    ? `مسار رحلتك القادمة إلى ${trip.destination}`
    : 'عرض مسار رحلتك القادمة';

  const inner = (
    <>
      <div
        className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-[#D4AF37]/20 blur-3xl"
        aria-hidden
      />
      <div className="relative flex items-center gap-4">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
            isDark
              ? 'bg-[#D4AF37]/15 ring-1 ring-[#D4AF37]/35'
              : 'bg-[#1E2720] shadow-[0_0_18px_rgba(212,175,55,0.35)]'
          }`}
        >
          <Plane
            className={`h-6 w-6 ${isDark ? 'text-[#D4AF37]' : 'text-[#D4AF37]'}`}
            aria-hidden
          />
        </span>
        <div className="min-w-0 flex-1 text-start">
          <p
            className={`text-[10px] font-black uppercase tracking-[0.28em] ${
              isDark ? 'text-[#D4AF37]/75' : 'text-[#D4AF37]'
            }`}
          >
            رحلتك القادمة
          </p>
          <p className={`mt-0.5 text-base font-black leading-snug ${isDark ? 'text-white' : 'text-[#1E2720]'}`}>
            {label}
          </p>
          {dateRange ? (
            <p
              className={`mt-1 text-xs font-bold ${isDark ? 'text-white/55' : 'text-gray-600'}`}
              dir="ltr"
            >
              {dateRange}
            </p>
          ) : null}
          {trip.title && trip.title !== trip.destination ? (
            <p className={`mt-0.5 truncate text-[11px] font-semibold ${isDark ? 'text-white/45' : 'text-gray-500'}`}>
              {trip.title}
            </p>
          ) : null}
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-black ${
            isDark
              ? 'bg-[#D4AF37] text-[#1E2720] shadow-[0_0_16px_rgba(212,175,55,0.45)]'
              : 'bg-[#D4AF37] text-[#1E2720] shadow-md'
          }`}
        >
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {isSameItineraryPage ? 'العودة للمسار' : 'عرض المسار'}
          <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </span>
      </div>
    </>
  );

  const shellClass = `relative overflow-hidden rounded-2xl border p-4 transition duration-300 sm:p-5 ${
    isDark
      ? 'border-[#D4AF37]/40 bg-gradient-to-l from-[#1E2720] via-[#243029] to-[#1A2520] shadow-[0_0_24px_rgba(212,175,55,0.22)] hover:border-[#D4AF37]/55 hover:shadow-[0_0_32px_rgba(212,175,55,0.32)]'
      : 'border-[#D4AF37]/35 bg-gradient-to-l from-[#FFFBF0] via-white to-[#FDFBF7] shadow-[0_8px_30px_rgba(30,39,32,0.08)] hover:border-[#D4AF37]/50 hover:shadow-[0_12px_36px_rgba(212,175,55,0.18)]'
  }`;

  if (isSameItineraryPage && onReturnToItinerary) {
    return (
      <button
        type="button"
        onClick={onReturnToItinerary}
        className={`${shellClass} w-full text-start`}
        aria-label={label}
      >
        {inner}
      </button>
    );
  }

  return (
    <Link href={trip.viewUrl} className={`${shellClass} block`} aria-label={label}>
      {inner}
    </Link>
  );
}
