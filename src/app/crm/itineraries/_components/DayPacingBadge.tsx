'use client';

import {
  estimateDayActivityHours,
  isDayPacingStrenuous,
  PACING_WARN_THRESHOLD_HOURS,
  type DayPacingInput,
} from '@/lib/vip-builder-day-insights';

type Props = {
  activities?: DayPacingInput[];
  /** للصفحات الثابتة بدون أنشطة */
  totalHoursOverride?: number;
  /** سقف ديناميكي حسب ملف العميل */
  maxHours?: number;
  /** رسالة مخصصة عند تجاوز السقف */
  fatigueWarningMessage?: string;
};

export default function DayPacingBadge({
  activities = [],
  totalHoursOverride,
  maxHours,
  fatigueWarningMessage,
}: Props) {
  const totalHours =
    totalHoursOverride ?? estimateDayActivityHours(activities);
  const threshold = maxHours ?? undefined;
  const strenuous = isDayPacingStrenuous(totalHours, threshold);

  return (
    <div className="flex flex-col items-start gap-1">
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${
          strenuous
            ? 'border-amber-400 bg-amber-50 text-amber-900'
            : 'border-[#1E2720]/10 bg-white text-[#1E2720]'
        }`}
      >
        ⏱️ إجمالي الأنشطة: {totalHours} {totalHours === 1 ? 'ساعة' : 'ساعات'}
      </span>
      {strenuous ? (
        <span className="text-[10px] font-semibold text-red-700">
          {fatigueWarningMessage ??
            `⚠️ الجدول قد يكون مجهداً للعميل (أكثر من ${maxHours ?? PACING_WARN_THRESHOLD_HOURS} ساعات)`}
        </span>
      ) : null}
    </div>
  );
}
