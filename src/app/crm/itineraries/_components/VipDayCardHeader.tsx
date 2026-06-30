'use client';

import DayPacingBadge from '@/app/crm/itineraries/_components/DayPacingBadge';
import DayWeatherBadge from '@/app/crm/itineraries/_components/DayWeatherBadge';
import type { DayPacingInput } from '@/lib/vip-builder-day-insights';

type Props = {
  dayTitle: string;
  city?: string;
  dayIndex?: number;
  activities?: DayPacingInput[];
  totalHoursOverride?: number;
  weatherLabelOverride?: string;
  maxHours?: number;
  fatigueWarningMessage?: string;
  /** تحذير وقت البداية قبل الاستيقاظ */
  showWakeUpWarning?: boolean;
};

/** عنوان اليوم + طقس + مؤشر الإجهاد */
export default function VipDayCardHeader({
  dayTitle,
  city = '',
  dayIndex = 0,
  activities = [],
  totalHoursOverride,
  weatherLabelOverride,
  maxHours,
  fatigueWarningMessage,
  showWakeUpWarning = false,
}: Props) {
  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-lg text-[#1E2720]">{dayTitle}</h3>
        <DayWeatherBadge
          city={city}
          dayIndex={dayIndex}
          labelOverride={weatherLabelOverride}
        />
      </div>
      <DayPacingBadge
        activities={activities}
        totalHoursOverride={totalHoursOverride}
        maxHours={maxHours}
        fatigueWarningMessage={fatigueWarningMessage}
      />
      {showWakeUpWarning ? (
        <span className="inline-flex items-center rounded-full border border-amber-400 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-900">
          ⚠️ تنبيه: النشاط يبدأ قبل وقت استيقاظ العميل المفضل!
        </span>
      ) : null}
    </div>
  );
}
