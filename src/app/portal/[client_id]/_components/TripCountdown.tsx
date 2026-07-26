'use client';

import { useEffect, useState } from 'react';

import {
  calculateTripCountdown,
  formatCountdownArabic,
  type CountdownParts,
} from '@/lib/client-teaser-portal';

type TripCountdownProps = {
  startDate: string | null;
};

export function TripCountdown({ startDate }: TripCountdownProps) {
  const [parts, setParts] = useState<CountdownParts>(() =>
    calculateTripCountdown(startDate),
  );

  useEffect(() => {
    setParts(calculateTripCountdown(startDate));
    const timer = window.setInterval(() => {
      setParts(calculateTripCountdown(startDate));
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [startDate]);

  if (!startDate) {
    return (
      <p className="text-center text-lg font-black leading-relaxed text-[#d4af37] sm:text-2xl">
        تاريخ الرحلة يُعلن قريباً… جهّز روحك للمفاجأة ✨
      </p>
    );
  }

  if (parts.started) {
    return (
      <p className="text-center text-2xl font-black leading-relaxed text-[#d4af37] sm:text-3xl">
        {formatCountdownArabic(parts)}
      </p>
    );
  }

  return (
    <div className="text-center">
      <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-white/40">
        Countdown
      </p>
      <p className="mt-3 text-xl font-black leading-relaxed text-white sm:text-3xl">
        تبدأ رحلتك الاستثنائية بعد:
      </p>
      <div className="mt-5 flex items-center justify-center gap-3 sm:gap-5">
        <TimeBlock value={parts.days} label="أيام" />
        <span className="text-2xl font-black text-[#d4af37]/50">:</span>
        <TimeBlock value={parts.hours} label="ساعات" />
        <span className="text-2xl font-black text-[#d4af37]/50">:</span>
        <TimeBlock value={parts.minutes} label="دقائق" />
      </div>
      <p className="mt-5 text-sm font-bold text-[#d4af37]/80 sm:text-base">
        {formatCountdownArabic(parts)}
      </p>
    </div>
  );
}

function TimeBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-[4.5rem] rounded-2xl border border-[#d4af37]/25 bg-black/30 px-3 py-4 sm:min-w-[5.5rem] sm:px-4">
      <p className="text-3xl font-black tabular-nums text-[#d4af37] sm:text-4xl" dir="ltr">
        {String(value).padStart(2, '0')}
      </p>
      <p className="mt-1 text-[10px] font-bold text-white/45">{label}</p>
    </div>
  );
}
