'use client';

import { AlertTriangle, Clock } from 'lucide-react';

import {
  checkVisit,
  formatDayHoursAr,
  hoursForWeekday,
  weekdayLabelAr,
  type StoredPlaceHours,
} from '@/lib/place-hours';

/** Staff-only: the place's hours on this trip day, with a warning when the visit falls outside them. */
export default function PlaceHoursHint({
  hours,
  weekday,
  visitTime,
}: {
  hours: StoredPlaceHours | undefined;
  weekday: number | null;
  visitTime?: string;
}) {
  if (!hours || weekday == null) return null;
  const line = formatDayHoursAr(hoursForWeekday(hours, weekday));
  if (!line) return null;
  const check = checkVisit(hours, weekday, visitTime);
  const dayName = weekdayLabelAr(weekday);

  return (
    <div className="mt-2 space-y-1">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
        <Clock className="h-3.5 w-3.5 shrink-0 text-[#b8952d]" aria-hidden />
        <span>
          {dayName}: {line}
        </span>
      </p>
      {check === 'closed_day' ? (
        <p className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-bold text-red-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          المكان مغلق يوم {dayName} — انقله ليوم آخر.
        </p>
      ) : check === 'outside_hours' ? (
        <p className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-bold text-red-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          وقت الزيارة خارج ساعات العمل — عدّل الوقت.
        </p>
      ) : null}
    </div>
  );
}
