'use client';

import React from 'react';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import { GripVertical } from 'lucide-react';

import SupplierWhatsAppButton from '@/app/crm/itineraries/_components/SupplierWhatsAppButton';
import {
  TRANSPORT_MODES,
  type SimpleItineraryDay,
} from '@/app/crm/itineraries/_components/simple-itinerary-day-utils';
import { formatAdminDayLabel } from '@/lib/itinerary-geography';
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
  onAddDay: () => void;
  onRemovePlace: (dayId: number, placeIndex: number) => void;
  onUpdateDayHotel: (dayId: number, hotelName: string) => void;
  onUpdateDayCity: (dayId: number, city: string) => void;
  onUpdateTransport: (
    dayId: number,
    placeIndex: number,
    field: 'transportToNext' | 'transportDuration',
    value: string,
  ) => void;
  dayDroppableId: (dayId: number) => string;
  supplierBrief?: SupplierBriefClientContext | null;
};

function DayHotelStartCard({ hotelName }: { hotelName: string }) {
  return (
    <div className="mb-3 flex justify-between items-center rounded-lg border-l-4 border-[#D4AF37] bg-[#1A2520] p-4 opacity-90">
      <div>
        <span className="mb-1 block text-xs font-bold text-[#D4AF37]">📍 بداية اليوم (الانطلاق)</span>
        <h4 className="text-lg font-bold text-white">{hotelName}</h4>
      </div>
      <div className="text-sm text-gray-400">فندق الإقامة</div>
    </div>
  );
}

function DayHotelEndCard({ hotelName }: { hotelName: string }) {
  return (
    <div className="mt-3 flex justify-between items-center rounded-lg border-r-4 border-gray-500 bg-[#1A2520] p-4 opacity-90">
      <div>
        <span className="mb-1 block text-xs font-bold text-gray-400">🏁 نهاية اليوم (العودة)</span>
        <h4 className="text-lg font-bold text-white">{hotelName}</h4>
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
  onRemovePlace,
  onUpdateDayHotel,
  onUpdateDayCity,
  onUpdateTransport,
  dayDroppableId,
  supplierBrief,
}: Props) {
  const hotelOptions = hotels.map((h) => h.name.trim()).filter(Boolean);
  return (
    <main className="no-scrollbar w-[65%] bg-white rounded-xl border border-gray-200 shadow-sm p-6 overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-[#1E2720]">مخطط الأيام</h2>
        <button
          type="button"
          onClick={onAddDay}
          className="bg-gray-100 text-[#1E2720] px-4 py-2 rounded-lg font-bold hover:bg-gray-200 transition-colors"
        >
          + إضافة يوم جديد
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {days.map((day, idx) => (
          <button
            key={day.id}
            type="button"
            onClick={() => onActiveDayIdChange(day.id)}
            className={`rounded-xl px-3 py-2 text-xs font-black transition ${
              day.id === activeDayId
                ? 'bg-[#D4AF37] text-[#1E2720]'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {formatAdminDayLabel(day, idx)}
            {day.places.length > 0 ? ` (${day.places.length})` : ''}
          </button>
        ))}
      </div>

      <p className="mb-4 text-xs font-bold text-gray-500">
        زر «إضافة للمسار» يضيف المعلم إلى اليوم المحدّد بالذهبي. اسحب من بنك الأماكن أو بين
        الأيام لإعادة الترتيب.
      </p>

      <div className="flex flex-col gap-4">
          {days.map((day, dayIdx) => (
            <div
              key={day.id}
              className={`rounded-xl border p-5 transition-colors ${
                day.id === activeDayId
                  ? 'border-[#D4AF37]/50 bg-[#FFFBF0]'
                  : 'border-gray-200 bg-[#FAFAFA]'
              }`}
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                  <h3 className="font-bold text-lg text-[#1E2720]">{formatAdminDayLabel(day, dayIdx)}</h3>
                  <label className="flex min-w-[180px] flex-1 items-center gap-2">
                    <span className="shrink-0 text-xs font-bold text-gray-600">مدينة اليوم</span>
                    <input
                      type="text"
                      value={day.city ?? ''}
                      onChange={(e) => onUpdateDayCity(day.id, e.target.value)}
                      placeholder="مثال: باريس"
                      className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-900 outline-none focus:border-[#D4AF37]"
                    />
                  </label>
                </div>
                {day.id === activeDayId ? (
                  <span className="rounded-full bg-[#D4AF37]/20 px-2 py-0.5 text-[10px] font-black text-[#1E2720]">
                    اليوم النشط
                  </span>
                ) : null}
              </div>

              <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <label className="mb-1.5 block text-sm font-bold text-gray-700">
                  فندق الإقامة لهذا اليوم:
                </label>
                <select
                  value={day.hotelName ?? ''}
                  onChange={(e) => onUpdateDayHotel(day.id, e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white p-2 text-sm text-gray-900 outline-none focus:border-[#D4AF37]"
                >
                  <option value="">-- بدون فندق --</option>
                  {hotelOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                {day.hotelName ? (
                  <p className="mt-1.5 text-[11px] font-semibold text-gray-500">
                    سيُعرض للعميل: انطلاق من {day.hotelName} → العودة إلى {day.hotelName}
                  </p>
                ) : null}
              </div>

              {day.hotelName ? <DayHotelStartCard hotelName={day.hotelName} /> : null}

              <Droppable droppableId={dayDroppableId(day.id)}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-h-[72px] rounded-lg transition-colors ${
                      snapshot.isDraggingOver ? 'bg-[#D4AF37]/10 ring-2 ring-[#D4AF37]/30' : ''
                    }`}
                  >
                    {day.places.length === 0 ? (
                      <p className="text-gray-500 text-sm text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
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
                                  className={`bg-white border rounded-lg p-4 shadow-sm flex justify-between items-start gap-3 ${
                                    dragSnapshot.isDragging
                                      ? 'border-[#D4AF37] shadow-lg'
                                      : 'border-gray-200 hover:border-[#D4AF37]'
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
                                      <h4 className="font-bold text-[#1E2720]">{place.name}</h4>
                                      <p className="text-sm text-gray-500 mt-1">
                                        {[place.category, place.city].filter(Boolean).join(' · ')}
                                      </p>
                                      <div className="mt-2 flex flex-wrap items-center gap-2">
                                        {supplierBrief ? (
                                          <SupplierWhatsAppButton
                                            compact
                                            message={buildActivitySupplierBrief(supplierBrief, {
                                              name: place.name,
                                              category: place.category,
                                              city: place.city,
                                              dayTitle: day.title,
                                            })}
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
                                <div className="h-3 w-px border-r-2 border-dashed border-gray-300" />
                                <div className="flex flex-wrap items-center justify-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
                                  {TRANSPORT_MODES.map((mode) => {
                                    const selected = (place.transportToNext ?? 'سيارة') === mode.value;
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
                                            ? 'border-[#D4AF37] bg-[#1E2720] text-[#D4AF37] shadow-sm'
                                            : 'border-gray-200 bg-gray-50 hover:border-[#D4AF37]/60'
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
                                    className="min-w-[8rem] flex-1 bg-gray-50 border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-gray-900 focus:border-[#D4AF37] outline-none"
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
                                <div className="h-3 w-px border-r-2 border-dashed border-gray-300" />
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

              {day.hotelName ? <DayHotelEndCard hotelName={day.hotelName} /> : null}
            </div>
          ))}
        </div>
    </main>
  );
}
