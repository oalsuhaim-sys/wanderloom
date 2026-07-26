'use client';

import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from '@hello-pangea/dnd';
import { Car, GripVertical, Plus, Trash2 } from 'lucide-react';

import PlacesBankPickerModal from '@/app/crm/itineraries/_components/PlacesBankPickerModal';
import { geocodeAddress } from '@/lib/nominatim-geocoding';
import {
  activityFromPlaceBank,
  activityHasCoords,
  applyPickerToDay,
  createTransportActivity,
  dayToActivities,
  geocodeQueryForActivity,
  kindLabel,
  mapableActivities,
  moveActivityBetweenDays,
  patchDayActivities,
  pickPlaceBankCoordinates,
} from '@/lib/itinerary-day-activities';
import { placeBankCategoryLabel } from '@/lib/places-bank';
import type { ItineraryDayDraft } from '@/lib/itinerary-builder-model';
import type { PlaceBankRow } from '@/types/place';

export type { ItineraryDayDraft };

type Props = {
  days: ItineraryDayDraft[];
  onDaysChange: (days: ItineraryDayDraft[]) => void;
  destination?: string;
  /** light = صفحة /edit (خلفية #F9F9F6) · dark = داخل لوحة CRM الداكنة */
  theme?: 'light' | 'dark';
};

const inputClass =
  'w-full rounded-md border border-gray-300 bg-white p-2 font-bold text-gray-900 placeholder-gray-400 outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]';
const selectClass = inputClass;

type ActivityCardProps = {
  day: ItineraryDayDraft;
  act: ReturnType<typeof mapableActivities>[number];
  index: number;
  innerRef: (element: HTMLElement | null) => void;
  draggableProps: React.HTMLAttributes<HTMLDivElement>;
  dragHandleProps: React.HTMLAttributes<HTMLSpanElement> | null | undefined;
  isDragging: boolean;
  onRemove: (dayId: string, activityId: string) => void;
  onUpdate: (
    dayId: string,
    activityId: string,
    patch: Partial<ReturnType<typeof mapableActivities>[number]>,
  ) => void;
};

function ActivityCard({
  day,
  act,
  index,
  innerRef,
  draggableProps,
  dragHandleProps,
  isDragging,
  onRemove,
  onUpdate,
}: ActivityCardProps) {
  return (
    <div
      ref={innerRef}
      {...draggableProps}
      className={`mb-2 rounded-xl border bg-[#F9F9F6] p-3 ${
        isDragging ? 'border-[#D4AF37] shadow-lg' : 'border-[#1E2720]/10'
      }`}
    >
      <div className="flex items-start gap-2">
        <span
          {...dragHandleProps}
          className="mt-1 cursor-grab text-[#1E2720]/30 active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </span>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#D4AF37] text-xs font-black text-[#1E2720]">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-black text-[#1E2720]">
                {act.place_name || kindLabel(act.kind)}
              </p>
              {act.kind === 'place' && act.category ? (
                <p className="text-[10px] font-medium text-[#1E2720]/50">
                  {placeBankCategoryLabel(act.category)}
                  {act.city ? ` · ${act.city}` : ''}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onRemove(day.id, act.id)}
              className="rounded-lg p-1 text-red-500 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          {(act.kind === 'place' || act.kind === 'transport') ? (
            <div className="mt-2 flex items-center gap-2">
              <label className="text-[10px] font-bold text-[#1E2720]/60">وقت الزيارة:</label>
              <input
                type="time"
                value={act.visit_time || act.time_slot || ''}
                onChange={(e) => {
                  const visit_time = e.target.value;
                  onUpdate(day.id, act.id, { visit_time, time_slot: visit_time });
                }}
                className={inputClass}
              />
            </div>
          ) : null}
          {index > 0 && act.kind !== 'transport' ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <select
                value={act.transit_mode || 'car'}
                onChange={(e) =>
                  onUpdate(day.id, act.id, {
                    transit_mode: e.target.value as typeof act.transit_mode,
                  })
                }
                className={selectClass}
              >
                <option value="car">سيارة</option>
                <option value="walk">مشي</option>
                <option value="metro">مترو</option>
              </select>
              <input
                value={act.transit_duration}
                onChange={(e) =>
                  onUpdate(day.id, act.id, { transit_duration: e.target.value })
                }
                placeholder="مدة الانتقال"
                className={inputClass}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function ItineraryBuilderDaysPanel({
  days,
  onDaysChange,
  destination = '',
  theme = 'dark',
}: Props) {
  const isLight = theme === 'light';
  const [activeDayId, setActiveDayId] = useState(() => days[0]?.id ?? '');
  const [pickerDayId, setPickerDayId] = useState<string | null>(null);
  const geocodingInFlight = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!days.some((d) => d.id === activeDayId)) {
      setActiveDayId(days[0]?.id ?? '');
    }
  }, [days, activeDayId]);

  const activeDay = useMemo(
    () => days.find((d) => d.id === activeDayId) ?? days[0],
    [days, activeDayId],
  );

  const activeActivities = useMemo(
    () => (activeDay ? mapableActivities(dayToActivities(activeDay)) : []),
    [activeDay],
  );

  const patchDay = useCallback(
    (dayId: string, updater: (day: ItineraryDayDraft) => ItineraryDayDraft) => {
      onDaysChange(days.map((d) => (d.id === dayId ? updater(d) : d)));
    },
    [days, onDaysChange],
  );

  const enrichCoords = useCallback(
    async (dayId: string, activityId: string, query: string) => {
      if (!query.trim()) return;
      if (geocodingInFlight.current.has(activityId)) return;
      geocodingInFlight.current.add(activityId);
      try {
        const coords = await geocodeAddress(query);
        if (!coords) return;
        patchDay(dayId, (day) => {
          const acts = dayToActivities(day).map((a) =>
            a.id === activityId
              ? { ...a, lat: String(coords.lat), lng: String(coords.lng) }
              : a,
          );
          return patchDayActivities(day, acts);
        });
      } finally {
        geocodingInFlight.current.delete(activityId);
      }
    },
    [patchDay],
  );

  const resolveCoordsForActivity = useCallback(
    (dayId: string, act: ReturnType<typeof mapableActivities>[number]) => {
      if (act.kind !== 'place' || activityHasCoords(act)) return;
      void enrichCoords(dayId, act.id, geocodeQueryForActivity(act));
    },
    [enrichCoords],
  );

  const handleSelectPlace = useCallback(
    (place: PlaceBankRow) => {
      if (!pickerDayId) return;
      const day = days.find((d) => d.id === pickerDayId);
      if (!day) return;

      const bankCoords = pickPlaceBankCoordinates(place);
      let act = activityFromPlaceBank(place);
      if (bankCoords && !activityHasCoords(act)) {
        act = { ...act, lat: String(bankCoords.lat), lng: String(bankCoords.lng) };
      }

      patchDay(pickerDayId, (d) =>
        patchDayActivities(d, [...dayToActivities(d), act]),
      );

      if (!activityHasCoords(act)) {
        resolveCoordsForActivity(pickerDayId, act);
      }
      setPickerDayId(null);
    },
    [pickerDayId, days, patchDay, resolveCoordsForActivity],
  );

  const missingCoordsKey = useMemo(
    () =>
      activeActivities
        .filter((a) => a.kind === 'place' && !activityHasCoords(a))
        .map((a) => a.id)
        .join(','),
    [activeActivities],
  );

  useEffect(() => {
    if (!activeDay || !missingCoordsKey) return;
    for (const act of activeActivities) {
      if (act.kind === 'place' && !activityHasCoords(act)) {
        resolveCoordsForActivity(activeDay.id, act);
      }
    }
  }, [activeDay?.id, missingCoordsKey, activeActivities, resolveCoordsForActivity]);

  const onDragEnd = useCallback(
    (result: DropResult) => {
      const { source, destination: dest, draggableId } = result;
      if (!dest) return;

      const sourceDayId = source.droppableId;
      const destDayId = dest.droppableId;

      if (sourceDayId === destDayId) {
        patchDay(sourceDayId, (day) => {
          const all = dayToActivities(day);
          const pinned = all.filter((a) => a.kind === 'hotel' || a.kind === 'experience');
          const route = mapableActivities(all);
          const [removed] = route.splice(source.index, 1);
          if (!removed) return day;
          route.splice(dest.index, 0, removed);
          return patchDayActivities(day, [...pinned, ...route]);
        });
        return;
      }

      onDaysChange(moveActivityBetweenDays(days, sourceDayId, destDayId, draggableId, dest.index));
    },
    [days, onDaysChange, patchDay],
  );

  const addTransport = (dayId: string) => {
    patchDay(dayId, (day) =>
      patchDayActivities(day, [...dayToActivities(day), createTransportActivity()]),
    );
  };

  const removeActivity = (dayId: string, activityId: string) => {
    patchDay(dayId, (day) => {
      const next = dayToActivities(day).filter((a) => a.id !== activityId);
      return patchDayActivities(day, next.length > 0 ? next : []);
    });
  };

  const updateActivity = (
    dayId: string,
    activityId: string,
    patch: Partial<(typeof activeActivities)[number]>,
  ) => {
    patchDay(dayId, (day) => {
      const acts = dayToActivities(day).map((a) => (a.id === activityId ? { ...a, ...patch } : a));
      return patchDayActivities(day, acts);
    });
  };

  const pickerDay = days.find((d) => d.id === pickerDayId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {days.map((day, idx) => (
          <button
            key={day.id}
            type="button"
            onClick={() => setActiveDayId(day.id)}
            className={`rounded-xl px-3 py-2 text-xs font-black transition ${
              day.id === activeDayId
                ? 'bg-[#D4AF37] text-[#1E2720]'
                : isLight
                  ? 'bg-white text-[#1E2720]/70 ring-1 ring-[#1E2720]/10 hover:ring-[#D4AF37]/40'
                  : 'bg-white/10 text-gray-200 ring-1 ring-white/15 hover:bg-white/15'
            }`}
          >
            اليوم {idx + 1}
            {day.city ? ` · ${day.city}` : ''}
          </button>
        ))}
      </div>

      {activeDay ? (
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            value={activeDay.title}
            onChange={(e) =>
              patchDay(activeDay.id, (d) => ({ ...d, title: e.target.value }))
            }
            placeholder="عنوان اليوم"
            className={inputClass}
          />
          <input
            value={activeDay.city}
            onChange={(e) => patchDay(activeDay.id, (d) => ({ ...d, city: e.target.value }))}
            placeholder="المدينة"
            className={inputClass}
          />
        </div>
      ) : null}

      <div
        dir="rtl"
        className={`flex min-h-[min(60vh,520px)] flex-col rounded-2xl border p-4 ${
          isLight
            ? 'border-[#1E2720]/10 bg-white shadow-sm'
            : 'border-[#D4AF37]/20 bg-[#060b14]/40'
        }`}
      >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className={`text-sm font-black ${isLight ? 'text-[#1E2720]' : 'text-gray-100'}`}>
              جدول اليوم — اسحب لإعادة الترتيب
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => activeDay && setPickerDayId(activeDay.id)}
                className="inline-flex items-center gap-1 rounded-xl bg-[#D4AF37] px-3 py-2 text-xs font-black text-[#1E2720]"
              >
                <Plus className="h-3.5 w-3.5" />
                إضافة نشاط
              </button>
              <button
                type="button"
                onClick={() => activeDay && addTransport(activeDay.id)}
                className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold ${
                  isLight
                    ? 'border-[#1E2720]/15 text-[#1E2720]/70'
                    : 'border-white/20 text-gray-200'
                }`}
              >
                <Car className="h-3.5 w-3.5" />
                انتقال
              </button>
            </div>
          </div>

          <DragDropContext onDragEnd={onDragEnd}>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pe-1">
              {activeDay ? (
                <Droppable droppableId={activeDay.id}>
                  {(provided, snapshot) => {
                    const acts = mapableActivities(dayToActivities(activeDay));
                    return (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-[200px] rounded-xl border p-2 transition ${
                          snapshot.isDraggingOver
                            ? 'border-[#D4AF37]/50 bg-[#D4AF37]/10'
                            : isLight
                              ? 'border-[#1E2720]/10 bg-[#F9F9F6]'
                              : 'border-[#D4AF37]/30 bg-white/5'
                        }`}
                      >
                        {acts.length === 0 ? (
                          <p
                            className={`py-8 text-center text-xs ${isLight ? 'text-[#1E2720]/40' : 'text-white/40'}`}
                          >
                            لا أنشطة — اضغط «إضافة نشاط» واختر من جدول places
                          </p>
                        ) : (
                          acts.map((act, index) => (
                            <Draggable key={act.id} draggableId={act.id} index={index}>
                              {(dragProvided, dragSnapshot) => (
                                <ActivityCard
                                  day={activeDay}
                                  act={act}
                                  index={index}
                                  dragHandleProps={dragProvided.dragHandleProps}
                                  draggableProps={dragProvided.draggableProps}
                                  innerRef={dragProvided.innerRef}
                                  isDragging={dragSnapshot.isDragging}
                                  onRemove={removeActivity}
                                  onUpdate={updateActivity}
                                />
                              )}
                            </Draggable>
                          ))
                        )}
                        {provided.placeholder}
                      </div>
                    );
                  }}
                </Droppable>
              ) : null}

              {days
                .filter((d) => d.id !== activeDayId)
                .map((day) => {
                  const dayIndex = days.findIndex((d) => d.id === day.id);
                  return (
                  <Droppable key={day.id} droppableId={day.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-[52px] rounded-lg border border-dashed px-3 py-2 transition ${
                          snapshot.isDraggingOver
                            ? 'border-[#D4AF37] bg-[#D4AF37]/10'
                            : isLight
                              ? 'border-[#1E2720]/15 bg-[#F9F9F6]'
                              : 'border-white/15 bg-white/5'
                        }`}
                      >
                        <p
                          className={`text-[10px] font-bold ${isLight ? 'text-[#1E2720]/45' : 'text-white/45'}`}
                        >
                          إفلات في اليوم {dayIndex + 1}
                          {day.city ? ` (${day.city})` : ''}
                        </p>
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                  );
                })}
            </div>
          </DragDropContext>
      </div>

      <PlacesBankPickerModal
        open={pickerDayId !== null}
        cityBias={pickerDay?.city}
        countryBias={destination}
        onClose={() => setPickerDayId(null)}
        onSelect={handleSelectPlace}
      />
    </div>
  );
}

/** @deprecated — للتوافق مع استيراد قديم */
export function applyPickerToDayLegacy(
  day: ItineraryDayDraft,
  mode: 'place',
  payload: { place: PlaceBankRow },
): ItineraryDayDraft {
  return applyPickerToDay(day, mode, payload);
}
