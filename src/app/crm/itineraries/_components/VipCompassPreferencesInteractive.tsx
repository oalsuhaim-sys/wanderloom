'use client';

import {
  compassBadgesFromPrefs,
  type ClientProfilePrefs,
} from '@/lib/vip-builder-day-insights';

const SELECT =
  'rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-semibold text-gray-900 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]';

type Props = {
  prefs: ClientProfilePrefs;
  onChange: (prefs: ClientProfilePrefs) => void;
  maxHours: number;
  /** شارات من قاعدة البيانات (تغذية، ملاحظات سرية، …) */
  extraBadges?: string[];
  loading?: boolean;
};

export default function VipCompassPreferencesInteractive({
  prefs,
  onChange,
  maxHours,
  extraBadges = [],
  loading = false,
}: Props) {
  const badges = compassBadgesFromPrefs(prefs);

  return (
    <div className="mb-5 rounded-xl border border-[#D4AF37]/35 bg-gradient-to-l from-[#FAFAFA] via-white to-[#FAFAFA] px-4 py-3 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-black tracking-wide text-[#1E2720]">
          🎯 بوصلة تفضيلات الـ VIP
        </p>
        <span className="rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-2 py-0.5 text-[10px] font-bold text-[#1E2720]">
          حدّ اليوم: {maxHours} س
        </span>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-gray-600">نوع العميل</span>
          <select
            className={SELECT}
            value={prefs.type}
            onChange={(e) =>
              onChange({
                ...prefs,
                type: e.target.value as ClientProfilePrefs['type'],
              })
            }
          >
            <option value="عائلة">عائلة</option>
            <option value="شباب">شباب</option>
            <option value="رياضي">رياضي</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-gray-600">وقت الاستيقاظ</span>
          <select
            className={SELECT}
            value={prefs.wakeUpTime}
            onChange={(e) => onChange({ ...prefs, wakeUpTime: e.target.value })}
          >
            <option value="07:00">07:00</option>
            <option value="09:00">09:00</option>
            <option value="10:00">10:00</option>
            <option value="11:00">11:00</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-gray-600">مستوى النشاط</span>
          <select
            className={SELECT}
            value={prefs.activityLevel}
            onChange={(e) =>
              onChange({
                ...prefs,
                activityLevel: e.target.value as ClientProfilePrefs['activityLevel'],
              })
            }
          >
            <option value="خفيف">خفيف</option>
            <option value="متوسط">متوسط</option>
            <option value="عالي">عالي</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {loading ? (
          <span className="text-[10px] font-bold text-gray-500">جاري تحميل ملف العميل…</span>
        ) : null}
        {badges.map((badge) => (
          <span
            key={badge}
            className="inline-flex items-center rounded-full border border-[#1E2720]/12 bg-white px-3 py-1.5 text-xs font-bold text-[#1E2720] shadow-sm"
          >
            {badge}
          </span>
        ))}
        {extraBadges.map((badge) => (
          <span
            key={badge}
            className="inline-flex items-center rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/8 px-3 py-1.5 text-xs font-bold text-[#1E2720] shadow-sm"
          >
            {badge}
          </span>
        ))}
      </div>
    </div>
  );
}
