'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';

import { CrmSlideOver, CRM_DRAWER_SAVE } from '@/app/crm/_components/CrmSlideOver';
import SimpleItineraryDayCard from '@/app/crm/itineraries/_components/SimpleItineraryDayCard';
import {
  type SimpleItineraryDay,
} from '@/app/crm/itineraries/_components/simple-itinerary-day-utils';
import AiPredictiveWishesCard from '@/app/crm/itineraries/_components/AiPredictiveWishesCard';
import type { PredictiveWishContext } from '@/lib/ai-predictive-wishes';
import { formatAdminDayLabel } from '@/lib/itinerary-geography';
import { CRM_INPUT, CRM_TIMELINE } from '@/lib/crm-luxury-ui';
import type { SupplierBriefClientContext } from '@/lib/supplier-whatsapp-brief';

type Props = {
  days: SimpleItineraryDay[];
  hotels: Array<{ name: string }>;
  activeDayId: number;
  onActiveDayIdChange: (dayId: number) => void;
  onAddDay: (opts?: { title?: string; city?: string }) => void;
  onMoveDay?: (dayId: number, direction: 'up' | 'down') => void;
  onRemovePlace: (dayId: number, placeIndex: number) => void;
  onMovePlaceToDay: (currentDayId: number, placeIndex: number, targetDayId: number) => void;
  onUpdateDayHotel: (dayId: number, hotelName: string) => void;
  onUpdateDayCity: (dayId: number, city: string) => void;
  onUpdateDayTitle: (dayId: number, title: string) => void;
  onUpdateTransport: (
    dayId: number,
    placeIndex: number,
    field: 'transportToNext' | 'transportDuration',
    value: string,
  ) => void;
  onUpdateVisitTime: (dayId: number, placeIndex: number, visit_time: string) => void;
  onUpdatePlaceNotes: (dayId: number, placeIndex: number, notes: string) => void;
  dayDroppableId: (dayId: number) => string;
  supplierBrief?: SupplierBriefClientContext | null;
  predictiveWishContext?: PredictiveWishContext | null;
  onApplyPredictiveWish?: (place: Record<string, unknown>) => void;
};

export default function SimpleItineraryDayPlanner({
  days,
  hotels,
  activeDayId,
  onActiveDayIdChange,
  onAddDay,
  onMoveDay,
  onRemovePlace,
  onMovePlaceToDay,
  onUpdateDayHotel,
  onUpdateDayCity,
  onUpdateDayTitle,
  onUpdateTransport,
  onUpdateVisitTime,
  onUpdatePlaceNotes,
  dayDroppableId,
  supplierBrief,
  predictiveWishContext,
  onApplyPredictiveWish,
}: Props) {
  const hotelOptions = useMemo(
    () => hotels.map((h) => h?.name?.trim()).filter(Boolean) as string[],
    [hotels],
  );
  const [dayDrawerOpen, setDayDrawerOpen] = useState(false);
  const [dayTitle, setDayTitle] = useState('');
  const [dayCity, setDayCity] = useState('');
  const [editingDayId, setEditingDayId] = useState<number | null>(null);
  const [editDayTitle, setEditDayTitle] = useState('');
  const skipTitleBlurSaveRef = useRef(false);

  const activeDayLabel = useMemo(() => {
    const activeDay = days.find((d) => d.id === activeDayId) ?? days[0];
    if (!activeDay) return 'اليوم';
    const idx = days.findIndex((d) => d.id === activeDay.id);
    return activeDay.title?.trim() || formatAdminDayLabel(activeDay, idx >= 0 ? idx : 0);
  }, [days, activeDayId]);

  function openAddDayDrawer() {
    setDayTitle('');
    setDayCity('');
    setDayDrawerOpen(true);
  }

  function confirmAddDay() {
    onAddDay({
      title: dayTitle.trim() || undefined,
      city: dayCity.trim() || undefined,
    });
    setDayDrawerOpen(false);
    setDayTitle('');
    setDayCity('');
  }

  const startEditDayTitle = useCallback((day: SimpleItineraryDay, dayIdx: number) => {
    setEditingDayId(day.id);
    setEditDayTitle(day.title?.trim() || (dayIdx === 0 ? 'اليوم الأول' : `اليوم ${dayIdx + 1}`));
  }, []);

  const handleSaveDayTitle = useCallback(
    (dayId: number) => {
      if (skipTitleBlurSaveRef.current) {
        skipTitleBlurSaveRef.current = false;
        return;
      }
      onUpdateDayTitle(dayId, editDayTitle);
      setEditingDayId(null);
      setEditDayTitle('');
    },
    [editDayTitle, onUpdateDayTitle],
  );

  const cancelEditDayTitle = useCallback(() => {
    skipTitleBlurSaveRef.current = true;
    setEditingDayId(null);
    setEditDayTitle('');
  }, []);

  return (
    <main className="no-scrollbar w-full min-h-[420px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:w-[65%] lg:min-h-0">
      <div className="sticky top-0 z-40 mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-slate-800 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#D4AF37]/80">
              Timeline
            </p>
            <h2 className="text-lg font-bold text-[#D4AF37]">خط زمني للمسار</h2>
          </div>
          <button
            type="button"
            onClick={openAddDayDrawer}
            className="inline-flex items-center gap-2 rounded-xl border border-[#D4AF37]/40 bg-white px-4 py-2 text-sm font-bold text-[#D4AF37] transition hover:border-[#D4AF37] hover:bg-slate-50"
          >
            <Plus className="h-4 w-4 text-[#D4AF37]" aria-hidden />
            إضافة يوم جديد
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {days.map((day, idx) => (
            <button
              key={day.id}
              type="button"
              onClick={() => onActiveDayIdChange(day.id)}
              className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                day.id === activeDayId
                  ? 'bg-[#D4AF37] text-[#0F172A]'
                  : 'border border-slate-200 bg-white text-slate-700 hover:border-[#D4AF37]/40'
              }`}
            >
              {formatAdminDayLabel(day, idx)}
              {day.places.length > 0 ? ` (${day.places.length})` : ''}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-4 text-xs font-bold text-slate-600">
        زر «إضافة للمسار» يضيف المعلم إلى اليوم المحدّد بالذهبي. اسحب من بنك الأماكن أو بين
        الأيام لإعادة ترتيب الأماكن. استخدم ✏️ لتسمية اليوم، و⬆️⬇️ لنقل اليوم بالكامل
        (الأماكن والأوقات والنقل معه).
      </p>

      {predictiveWishContext ? (
        <AiPredictiveWishesCard
          className="mb-5"
          context={{
            ...predictiveWishContext,
            activeDayLabel,
          }}
          onApply={onApplyPredictiveWish}
          storageKey={`predictive-wish-day-${activeDayId}`}
        />
      ) : null}

      <div className={CRM_TIMELINE}>
        {days.map((day, dayIdx) => (
          <SimpleItineraryDayCard
            key={day.id}
            day={day}
            dayIdx={dayIdx}
            daysCount={days.length}
            allDays={days}
            isActive={day.id === activeDayId}
            hotelOptions={hotelOptions}
            editingDayId={editingDayId}
            editDayTitle={editDayTitle}
            onActiveDayIdChange={onActiveDayIdChange}
            onMoveDay={onMoveDay}
            onStartEditTitle={startEditDayTitle}
            onEditDayTitleChange={setEditDayTitle}
            onSaveDayTitle={handleSaveDayTitle}
            onCancelEditTitle={cancelEditDayTitle}
            onRemovePlace={onRemovePlace}
            onMovePlaceToDay={onMovePlaceToDay}
            onUpdateDayHotel={onUpdateDayHotel}
            onUpdateDayCity={onUpdateDayCity}
            onUpdateTransport={onUpdateTransport}
            onUpdateVisitTime={onUpdateVisitTime}
            onUpdatePlaceNotes={onUpdatePlaceNotes}
            dayDroppableId={dayDroppableId}
            supplierBrief={supplierBrief}
          />
        ))}
      </div>

      <CrmSlideOver
        open={dayDrawerOpen}
        onClose={() => setDayDrawerOpen(false)}
        title="إضافة يوم جديد"
        subtitle="أضف عقدة جديدة إلى الخط الزمني للمسار."
        labelledBy="add-day-title"
        footer={
          <div className="flex gap-2">
            <button type="button" onClick={confirmAddDay} className={CRM_DRAWER_SAVE}>
              حفظ اليوم
            </button>
            <button
              type="button"
              onClick={() => setDayDrawerOpen(false)}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-600 transition hover:bg-gray-50"
            >
              إلغاء
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[#1A3B2A]/80">عنوان اليوم</span>
            <input
              value={dayTitle}
              onChange={(e) => setDayTitle(e.target.value)}
              placeholder="مثال: اليوم الأول · الوصول"
              className={CRM_INPUT}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[#1A3B2A]/80">مدينة اليوم</span>
            <input
              value={dayCity}
              onChange={(e) => setDayCity(e.target.value)}
              placeholder="مثال: باريس"
              className={CRM_INPUT}
            />
          </label>
        </div>
      </CrmSlideOver>
    </main>
  );
}
