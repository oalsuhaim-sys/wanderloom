'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import { GripVertical, ChevronUp, ChevronDown, Pencil, Plus } from 'lucide-react';

import { CrmSlideOver, CRM_DRAWER_SAVE } from '@/app/crm/_components/CrmSlideOver';
import SupplierWhatsAppButton from '@/app/crm/itineraries/_components/SupplierWhatsAppButton';
import {
  TRANSPORT_MODES,
  type SimpleItineraryDay,
} from '@/app/crm/itineraries/_components/simple-itinerary-day-utils';
import AiPredictiveWishesCard from '@/app/crm/itineraries/_components/AiPredictiveWishesCard';
import type { PredictiveWishContext } from '@/lib/ai-predictive-wishes';
import { formatAdminDayLabel } from '@/lib/itinerary-geography';
import {
  CRM_INPUT,
  CRM_SELECT,
  CRM_TIMELINE,
  CRM_TIMELINE_CARD,
  CRM_TIMELINE_DOT,
} from '@/lib/crm-luxury-ui';
import {
  buildActivitySupplierBrief,
  buildDriverSupplierBrief,
  type SupplierBriefClientContext,
} from '@/lib/supplier-whatsapp-brief';

type Props = {
  days: SimpleItineraryDay[];
  hotels: Array<{ name: string }>;
  activeDayId: number;
  onActiveDayIdChange: (dayId: number) => void;
  onAddDay: (opts?: { title?: string; city?: string }) => void;
  onMoveDay?: (dayId: number, direction: 'up' | 'down') => void;
  onRemovePlace: (dayId: number, placeIndex: number) => void;
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
  dayDroppableId: (dayId: number) => string;
  supplierBrief?: SupplierBriefClientContext | null;
  predictiveWishContext?: PredictiveWishContext | null;
  onApplyPredictiveWish?: (place: Record<string, unknown>) => void;
};

function DayHotelStartCard({ hotelName }: { hotelName: string }) {
  return (
    <div className="mb-3 flex items-center justify-between rounded-xl border border-[#C5A059]/30 bg-[#1A3B2A] p-4">
      <div>
        <span className="mb-1 block text-xs font-bold text-[#C5A059]">📍 بداية اليوم (الانطلاق)</span>
        <h4 className="text-lg font-bold text-white">{hotelName}</h4>
      </div>
      <div className="text-sm text-white/50">فندق الإقامة</div>
    </div>
  );
}

function DayHotelEndCard({ hotelName }: { hotelName: string }) {
  return (
    <div className="mt-3 flex items-center justify-between rounded-xl border border-gray-200 bg-[#F9F9F6] p-4">
      <div>
        <span className="mb-1 block text-xs font-bold text-gray-500">🏁 نهاية اليوم (العودة)</span>
        <h4 className="text-lg font-bold text-[#1A3B2A]">{hotelName}</h4>
      </div>
      <div className="text-sm text-gray-400">فندق الإقامة</div>
    </div>
  );
}

export default function SimpleItineraryDayPlanner({
  days,
  hotels,
  activeDayId,
  onActiveDayIdChange,
  onAddDay,
  onMoveDay,
  onRemovePlace,
  onUpdateDayHotel,
  onUpdateDayCity,
  onUpdateDayTitle,
  onUpdateTransport,
  onUpdateVisitTime,
  dayDroppableId,
  supplierBrief,
  predictiveWishContext,
  onApplyPredictiveWish,
}: Props) {
  const hotelOptions = hotels.map((h) => h?.name?.trim()).filter(Boolean);
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

  function startEditDayTitle(day: SimpleItineraryDay, dayIdx: number) {
    setEditingDayId(day.id);
    setEditDayTitle(day.title?.trim() || (dayIdx === 0 ? 'اليوم الأول' : `اليوم ${dayIdx + 1}`));
  }

  function handleSaveDayTitle(dayId: number) {
    if (skipTitleBlurSaveRef.current) {
      skipTitleBlurSaveRef.current = false;
      return;
    }
    onUpdateDayTitle(dayId, editDayTitle);
    setEditingDayId(null);
    setEditDayTitle('');
  }

  function cancelEditDayTitle() {
    skipTitleBlurSaveRef.current = true;
    setEditingDayId(null);
    setEditDayTitle('');
  }

  return (
    <main className="no-scrollbar w-[65%] overflow-y-auto rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="sticky top-0 z-40 -mx-6 mb-6 border-b border-gray-100 bg-white/90 px-6 py-4 backdrop-blur-md">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#C5A059]">
              Timeline
            </p>
            <h2 className="text-2xl font-bold text-[#1A3B2A]">خط زمني للمسار</h2>
          </div>
          <button
            type="button"
            onClick={openAddDayDrawer}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1A3B2A] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#152e21]"
          >
            <Plus className="h-4 w-4 text-[#C5A059]" aria-hidden />
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
                  ? 'bg-[#C5A059] text-[#1A3B2A]'
                  : 'bg-[#F9F9F6] text-gray-600 hover:bg-gray-100'
              }`}
            >
              {formatAdminDayLabel(day, idx)}
              {day.places.length > 0 ? ` (${day.places.length})` : ''}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-4 text-xs font-bold text-gray-500">
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
        {days.map((day, dayIdx) => {
          const isActive = day.id === activeDayId;
          return (
            <div key={day.id} className="relative">
              <span className={CRM_TIMELINE_DOT} aria-hidden />
              <div
                className={`${CRM_TIMELINE_CARD} ${
                  isActive ? 'ring-2 ring-[#C5A059]/35' : ''
                }`}
                onClick={() => onActiveDayIdChange(day.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onActiveDayIdChange(day.id);
                }}
                role="button"
                tabIndex={0}
              >
                <div className="mb-4 flex w-full items-center justify-between gap-3">
                  {editingDayId === day.id ? (
                    <div
                      className="min-w-0 flex-1"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        autoFocus
                        value={editDayTitle}
                        onChange={(e) => setEditDayTitle(e.target.value)}
                        onBlur={() => handleSaveDayTitle(day.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveDayTitle(day.id);
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            cancelEditDayTitle();
                          }
                        }}
                        placeholder="مثال: اليوم الأول - وصول سيول"
                        aria-label="تعديل عنوان اليوم"
                        className={`${CRM_INPUT} h-10 w-full py-0 text-base font-bold text-[#1A3B2A]`}
                      />
                    </div>
                  ) : (
                    <div className="flex min-w-0 items-center gap-2">
                      <h3 className="truncate text-lg font-bold text-[#1A3B2A]">
                        {formatAdminDayLabel(day, dayIdx)}
                      </h3>
                      <button
                        type="button"
                        title="تعديل عنوان اليوم"
                        aria-label="تعديل عنوان اليوم"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditDayTitle(day, dayIdx);
                        }}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#C5A059]/30 bg-[#FEFBF3] text-[#8A6B2A] transition hover:bg-[#C5A059]/20"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  )}

                  <div
                    className="flex shrink-0 items-center gap-3"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    {onMoveDay ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={dayIdx === 0}
                          onClick={() => onMoveDay(day.id, 'up')}
                          title="نقل اليوم للأعلى"
                          aria-label="نقل اليوم للأعلى"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#C5A059]/35 bg-[#FEFBF3] text-[#1A3B2A] transition hover:bg-[#C5A059]/20 disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          <ChevronUp className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          disabled={dayIdx >= days.length - 1}
                          onClick={() => onMoveDay(day.id, 'down')}
                          title="نقل اليوم للأسفل"
                          aria-label="نقل اليوم للأسفل"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#C5A059]/35 bg-[#FEFBF3] text-[#1A3B2A] transition hover:bg-[#C5A059]/20 disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          <ChevronDown className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    ) : null}
                    {isActive ? (
                      <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">
                        اليوم النشط
                      </span>
                    ) : null}
                  </div>
                </div>

                <div
                  className="mb-4 grid grid-cols-1 gap-4 rounded-lg border border-gray-100 bg-[#F9F9F6] p-4 md:grid-cols-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-[#1A3B2A]/80">مدينة اليوم</span>
                    <input
                      type="text"
                      value={day.city ?? ''}
                      onChange={(e) => onUpdateDayCity(day.id, e.target.value)}
                      placeholder="مثال: باريس"
                      className={`${CRM_INPUT} h-10 w-full px-3 py-0`}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-[#1A3B2A]/80">
                      فندق الإقامة لهذا اليوم:
                    </span>
                    <select
                      value={day.hotelName ?? ''}
                      onChange={(e) => onUpdateDayHotel(day.id, e.target.value)}
                      className={`${CRM_SELECT} h-10 w-full px-3 py-0`}
                    >
                      <option value="">-- بدون فندق --</option>
                      {hotelOptions.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {day.hotelName ? (
                    <p className="text-[11px] font-semibold text-gray-500 md:col-span-2">
                      سيُعرض للعميل: انطلاق من {day.hotelName} → العودة إلى {day.hotelName}
                    </p>
                  ) : null}
                </div>

                {day.hotelName ? <DayHotelStartCard hotelName={day.hotelName} /> : null}

                <div onClick={(e) => e.stopPropagation()}>
                  <Droppable droppableId={dayDroppableId(day.id)}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-[72px] rounded-xl transition-colors ${
                          snapshot.isDraggingOver
                            ? 'bg-[#C5A059]/10 ring-2 ring-[#C5A059]/30'
                            : ''
                        }`}
                      >
                        {day.places.length === 0 ? (
                          <p className="rounded-xl border-2 border-dashed border-gray-200 py-8 text-center text-sm text-gray-500">
                            اسحب الأماكن هنا أو اضغط «إضافة للمسار» (اليوم النشط)
                          </p>
                        ) : (
                          <div className="flex flex-col gap-3">
                            {day.places.map((place, placeIndex) => (
                              <React.Fragment key={place._dragId}>
                                <Draggable draggableId={place._dragId} index={placeIndex}>
                                  {(dragProvided, dragSnapshot) => (
                                    <div
                                      ref={dragProvided.innerRef}
                                      {...dragProvided.draggableProps}
                                      className={`flex items-start justify-between gap-3 rounded-xl border bg-white p-4 shadow-sm ${
                                        dragSnapshot.isDragging
                                          ? 'border-[#C5A059] shadow-lg'
                                          : 'border-gray-100 hover:border-[#C5A059]/40'
                                      } transition-colors`}
                                    >
                                      <div className="flex min-w-0 flex-1 items-start gap-2">
                                        <span
                                          {...dragProvided.dragHandleProps}
                                          className="mt-0.5 cursor-grab text-gray-400 active:cursor-grabbing"
                                          aria-hidden
                                        >
                                          <GripVertical className="h-4 w-4" />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                          <h4 className="font-bold text-[#1A3B2A]">{place.name}</h4>
                                          <p className="mt-1 text-sm text-gray-500">
                                            {[place.category, place.city]
                                              .filter(Boolean)
                                              .join(' · ')}
                                          </p>
                                          <div className="mt-2 flex items-center gap-2">
                                            <label className="text-xs text-gray-500">
                                              وقت الزيارة:
                                            </label>
                                            <input
                                              type="time"
                                              value={place.visit_time || ''}
                                              onChange={(e) =>
                                                onUpdateVisitTime(
                                                  day.id,
                                                  placeIndex,
                                                  e.target.value,
                                                )
                                              }
                                              className="rounded border border-gray-200 px-2 py-1 text-sm outline-none focus:border-[#1A3B2A]"
                                            />
                                          </div>
                                          <div className="mt-2 flex flex-wrap items-center gap-2">
                                            {supplierBrief ? (
                                              <SupplierWhatsAppButton
                                                compact
                                                message={buildActivitySupplierBrief(
                                                  supplierBrief,
                                                  {
                                                    name: place.name,
                                                    category: place.category,
                                                    city: place.city,
                                                    dayTitle: day.title,
                                                  },
                                                )}
                                              />
                                            ) : null}
                                          </div>
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => onRemovePlace(day.id, placeIndex)}
                                        className="shrink-0 text-xs font-bold text-red-600 hover:text-red-800 hover:underline"
                                      >
                                        حذف
                                      </button>
                                    </div>
                                  )}
                                </Draggable>

                                {placeIndex < day.places.length - 1 ? (
                                  <div className="flex flex-col items-center gap-1 py-1">
                                    <div className="h-3 w-px border-r-2 border-dashed border-[#C5A059]/30" />
                                    <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-gray-100 bg-white px-3 py-2 shadow-sm">
                                      {TRANSPORT_MODES.map((mode) => {
                                        const selected =
                                          (place.transportToNext ?? 'سيارة') === mode.value;
                                        return (
                                          <button
                                            key={mode.value}
                                            type="button"
                                            title={mode.value}
                                            onClick={() =>
                                              onUpdateTransport(
                                                day.id,
                                                placeIndex,
                                                'transportToNext',
                                                mode.value,
                                              )
                                            }
                                            className={`min-w-[2.5rem] rounded-lg border px-2 py-1.5 text-base transition-colors ${
                                              selected
                                                ? 'border-[#C5A059] bg-[#1A3B2A] text-[#C5A059] shadow-sm'
                                                : 'border-gray-200 bg-[#F9F9F6] hover:border-[#C5A059]/60'
                                            }`}
                                          >
                                            {mode.icon}
                                          </button>
                                        );
                                      })}
                                      <input
                                        type="text"
                                        value={place.transportDuration ?? ''}
                                        onChange={(e) =>
                                          onUpdateTransport(
                                            day.id,
                                            placeIndex,
                                            'transportDuration',
                                            e.target.value,
                                          )
                                        }
                                        placeholder="المدة (مثال: 15 د)"
                                        className={`${CRM_INPUT} min-w-[8rem] flex-1 py-1.5 text-xs`}
                                      />
                                      {supplierBrief &&
                                      (place.transportToNext ?? 'سيارة') === 'سيارة' &&
                                      day.places[placeIndex + 1] ? (
                                        <SupplierWhatsAppButton
                                          compact
                                          label="إبلاغ السائق 💬"
                                          message={buildDriverSupplierBrief(supplierBrief, {
                                            fromLabel: place.name,
                                            toLabel: day.places[placeIndex + 1].name,
                                            mode: place.transportToNext ?? 'سيارة',
                                            duration: place.transportDuration,
                                            serviceDate: supplierBrief.tripDateFrom,
                                          })}
                                        />
                                      ) : null}
                                    </div>
                                    <div className="h-3 w-px border-r-2 border-dashed border-[#C5A059]/30" />
                                  </div>
                                ) : null}
                              </React.Fragment>
                            ))}
                          </div>
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>

                {day.hotelName ? <DayHotelEndCard hotelName={day.hotelName} /> : null}
              </div>
            </div>
          );
        })}
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
            <span className="mb-1.5 block text-xs font-bold text-[#1A3B2A]/80">
              عنوان اليوم
            </span>
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
