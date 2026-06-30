'use client';

import { mockDayWeatherLabel } from '@/lib/vip-builder-day-insights';

type Props = {
  city?: string;
  dayIndex?: number;
  /** نص مخصص بدل placeholder */
  labelOverride?: string;
};

export default function DayWeatherBadge({ city = '', dayIndex = 0, labelOverride }: Props) {
  const label = labelOverride ?? mockDayWeatherLabel(city, dayIndex);

  return (
    <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-900">
      {label}
    </span>
  );
}
