'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';

import type { PublicItineraryDay } from '@/lib/public-itinerary';
import { getVipPlaceCategoryMeta } from '@/lib/vip-place-category';

const InteractiveItineraryMap = dynamic(
  () => import('@/components/InteractiveItineraryMap'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-80 w-full items-center justify-center rounded-3xl bg-[#0B0F17] text-xs font-bold text-slate-500 animate-pulse">
        جاري تحميل الخريطة التفاعلية...
      </div>
    ),
  },
);

const WEEKDAY_SHORT_AR = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const WEEKDAY_KANJI = ['日', '月', '火', '水', '木', '金', '土'];
const GOLD = '#C59B4B';

type ClientItineraryMapViewProps = {
  days: PublicItineraryDay[];
  tripTitle?: string;
  destination?: string;
  startDate?: string | null;
  endDate?: string | null;
  subtitle?: string;
  /** When embedded under LuxuryItineraryHero, skip the duplicate title block */
  hideTitle?: boolean;
};

function parseStartDate(startDate?: string | null): Date | null {
  if (!startDate) return null;
  const d = new Date(`${String(startDate).slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dayChipMeta(day: PublicItineraryDay, index: number, start: Date | null) {
  const date = start
    ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
    : null;
  const weekDay = date?.getDay() ?? index % 7;
  const dateNumber = date
    ? String(date.getDate())
    : String(day.index || index + 1);
  const dateStr = date
    ? date.toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'long' })
    : day.dateLabel || `اليوم ${index + 1}`;
  const dayName = date
    ? date.toLocaleDateString('ar-SA-u-ca-gregory', { weekday: 'long' })
    : day.tabLabel || `اليوم ${index + 1}`;

  return {
    dayNumber: index + 1,
    dayOfWeekShort: WEEKDAY_SHORT_AR[weekDay] ?? 'يوم',
    dateNumber,
    kanji: WEEKDAY_KANJI[weekDay] ?? '・',
    dateStr,
    dayName,
    city: day.cityLabel || '—',
    summary: day.title || day.tabLabel || '',
  };
}

/** اسم المدينة من أول معلم فعلي إن وُجد، وإلا مدينة اليوم */
function getDisplayCityName(
  currentDay: PublicItineraryDay | null,
  destination: string,
): string {
  if (!currentDay) return 'جميع الوجهات';

  const firstPlaceCity = currentDay.activities
    .map((a) => a.locationLabel?.trim())
    .find(Boolean);
  if (firstPlaceCity) {
    // إن كان التسمية «مدينة · دولة» نأخذ الجزء الأول فقط للشارة
    return firstPlaceCity.split('·')[0]?.trim() || firstPlaceCity;
  }

  return currentDay.cityLabel?.trim() || destination.trim() || '—';
}

export default function ClientItineraryMapView({
  days,
  tripTitle = '',
  destination = '',
  startDate = null,
  endDate = null,
  subtitle,
  hideTitle = false,
}: ClientItineraryMapViewProps) {
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(0);
  const start = useMemo(() => parseStartDate(startDate), [startDate]);
  const currentDay = selectedDayIndex != null ? days[selectedDayIndex] ?? null : null;
  const currentMeta =
    currentDay && selectedDayIndex != null
      ? dayChipMeta(currentDay, selectedDayIndex, start)
      : null;

  const displayCity = getDisplayCityName(currentDay, destination);

  const computedSubtitle =
    subtitle ||
    [destination, days.length ? `${days.length} يوم` : '']
      .filter(Boolean)
      .join(' · ');

  return (
    <div className="mx-auto max-w-md space-y-5 p-4 font-sans text-white" dir="rtl">
      {!hideTitle ? (
        <div className="space-y-1 pt-2 text-center">
          <h1 className="text-xl font-extrabold tracking-tight text-slate-100">
            {tripTitle || destination || 'مسار الرحلة'}
          </h1>
          {computedSubtitle ? (
            <p className="text-xs font-medium text-slate-400">{computedSubtitle}</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setSelectedDayIndex(null)}
          className={`shrink-0 rounded-2xl border px-4 py-3 text-xs font-bold transition-all ${
            selectedDayIndex === null
              ? 'border-[#C59B4B] bg-[#C59B4B] text-slate-950'
              : 'border-slate-800 bg-[#151C28] text-slate-400'
          }`}
        >
          الرحلة كاملة
        </button>

        {days.map((day, idx) => {
          const meta = dayChipMeta(day, idx, start);
          const isSelected = selectedDayIndex === idx;
          return (
            <button
              key={`map-day-${day.index}-${idx}`}
              type="button"
              onClick={() => setSelectedDayIndex(idx)}
              className={`min-w-[65px] shrink-0 rounded-2xl border p-3 text-center transition-all ${
                isSelected
                  ? 'border-[#C59B4B] bg-[#1E293B] text-white ring-1 ring-[#C59B4B]'
                  : 'border-slate-800 bg-[#151C28] text-slate-400'
              }`}
            >
              <span className="block text-[10px] text-slate-500">{meta.dayOfWeekShort}</span>
              <span
                className="block font-mono text-lg font-bold"
                style={{ color: isSelected ? GOLD : undefined }}
              >
                {meta.dateNumber}
              </span>
              <span className="block text-[9px] text-slate-500">{meta.kanji}</span>
            </button>
          );
        })}
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-[#0B0F17] shadow-2xl">
        <div className="absolute top-4 right-4 z-20 rounded-2xl border border-slate-800 bg-[#0B0F17]/90 px-4 py-2 shadow-xl backdrop-blur-md">
          <span className="block text-[10px] font-bold text-[#C59B4B]">منطقة التركيز</span>
          <h3 className="text-xs font-extrabold text-slate-100">{displayCity}</h3>
        </div>

        <InteractiveItineraryMap
          selectedDay={currentDay}
          allDays={days}
          destination={destination}
        />
      </div>

      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold text-slate-300">
            {currentMeta
              ? `تفاصيل ${currentMeta.dayName} (${currentMeta.dateStr})`
              : 'جدول الرحلة الكاملة'}
          </h2>
          <span className="text-[11px] font-bold text-[#C59B4B]">
            {currentDay
              ? `${currentDay.activities.length} أماكن`
              : `${days.length} أيام`}
          </span>
        </div>

        {currentDay ? (
          <div className="space-y-2">
            {currentDay.activities.map((place, i) => {
              const meta = getVipPlaceCategoryMeta(place.category ?? 'o');
              const name =
                place.place_name?.trim() || place.title?.trim() || 'محطة';
              const city =
                place.locationLabel?.trim() ||
                currentDay.cityLabel?.trim() ||
                destination.trim() ||
                '';
              const existingUrl = place.googleMapsUrl?.trim();
              const googleMapsUrl =
                existingUrl && existingUrl.includes('google.com')
                  ? existingUrl
                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      [name, city].filter(Boolean).join(' '),
                    )}`;

              return (
                <a
                  key={place.id || `${currentDay.index}-${i}`}
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex cursor-pointer items-center justify-between rounded-2xl border border-slate-800/80 bg-[#151C28] p-4 transition-all hover:border-[#C59B4B]"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#C59B4B]/40 bg-[#C59B4B]/20 font-mono text-xs font-bold text-[#C59B4B] transition-all group-hover:bg-[#C59B4B] group-hover:text-slate-950">
                      {i + 1}
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-100 transition-colors group-hover:text-[#C59B4B]">
                        {name}
                      </h4>
                      <span className="text-[10px] font-medium text-slate-500">
                        {place.categoryLabel || meta.label || 'معلم'}
                      </span>
                    </div>
                  </div>

                  <span className="rounded-xl bg-slate-800 px-3 py-1.5 text-[10px] font-bold text-slate-400 transition-all group-hover:bg-[#C59B4B] group-hover:text-slate-950">
                    فتح المكان
                  </span>
                </a>
              );
            })}
            {!currentDay.activities.length ? (
              <p className="rounded-2xl border border-slate-800 bg-[#151C28] p-4 text-center text-xs text-slate-500">
                لا أماكن مسجّلة لهذا اليوم بعد.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2">
            {days.map((day, idx) => {
              const meta = dayChipMeta(day, idx, start);
              return (
                <button
                  key={`full-${day.index}-${idx}`}
                  type="button"
                  onClick={() => setSelectedDayIndex(idx)}
                  className="flex w-full items-center justify-between rounded-2xl border border-slate-800/80 bg-[#151C28] p-4 text-right transition-all hover:border-[#C59B4B]"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C59B4B] text-xs font-bold text-slate-950 shadow-md">
                      {meta.dayNumber}
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-100">
                        {meta.dayName}، {meta.dateStr}
                      </h4>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {meta.city}
                        {meta.summary ? ` · ${meta.summary}` : ''}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-800 px-2.5 py-1 text-[10px] font-bold text-slate-400">
                    {day.activities.length} أماكن
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
