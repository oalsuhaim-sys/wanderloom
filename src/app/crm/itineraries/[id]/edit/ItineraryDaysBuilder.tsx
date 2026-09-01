'use client';

import type React from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from '@hello-pangea/dnd';
import { Car, GripVertical, MapPin, Trash2 } from 'lucide-react';

import {
  VIP_BTN_GHOST,
  VIP_INPUT,
  VIP_PANEL,
  VIP_PANEL_BODY,
  VIP_PANEL_HEAD,
  VIP_SELECT,
} from '@/app/crm/itineraries/[id]/edit/vip-crm-theme';
import {
  activityMapCoordinates,
  createTransportActivity,
  dayToActivities,
  kindLabel,
  mapableActivities,
  moveActivityBetweenDays,
  patchDayActivities,
  sortActivitiesByVisitTime,
} from '@/lib/itinerary-day-activities';
import type { ProximityOrigin } from '@/lib/places-proximity';
import { placeBankCategoryLabel } from '@/lib/places-bank';
import type { ItineraryDayDraft } from '@/lib/itinerary-builder-model';

type Props = {
  days: ItineraryDayDraft[];
  onDaysChange: (days: ItineraryDayDraft[]) => void;
  activeDayId: string;
  onActiveDayIdChange: (id: string) => void;
  proximityActivityId?: string | null;
  onFindNearby?: (origin: ProximityOrigin) => void;
};

type Act = ReturnType<typeof mapableActivities>[number];

function TimelineCard({
  day,
  act,
  index,
  innerRef,
  draggableProps,
  dragHandleProps,
  isDragging,
  isOrigin,
  onRemove,
  onUpdate,
  onFindNearby,
}: {
  day: ItineraryDayDraft;
  act: Act;
  index: number;
  innerRef: (el: HTMLElement | null) => void;
  draggableProps: React.HTMLAttributes<HTMLDivElement>;
  dragHandleProps: React.HTMLAttributes<HTMLSpanElement> | null | undefined;
  isDragging: boolean;
  isOrigin: boolean;
  onRemove: (dayId: string, id: string) => void;
  onUpdate: (dayId: string, id: string, patch: Partial<Act>) => void;
  onFindNearby?: (origin: ProximityOrigin) => void;
}) {
  const coords = act.kind === 'place' ? activityMapCoordinates(act) : null;
  const img = act.image_url?.trim();

  return (
    <div ref={innerRef} {...draggableProps} className="flex gap-3 pb-1">
      <div className="flex w-9 shrink-0 flex-col items-center pt-1">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
            isOrigin ? 'bg-[#D4AF37] text-[#1E2720] ring-2 ring-[#1E2720]' : 'bg-slate-100 text-[#D4AF37]'
          }`}
        >
          {index + 1}
        </span>
        <div className="mt-1 w-0.5 flex-1 bg-[#D4AF37]" />
      </div>

      <article
        className={`mb-3 min-w-0 flex-1 rounded-xl border bg-white p-3 shadow-sm ${
          isDragging
            ? 'border-[#1E2720] shadow-md'
            : isOrigin
              ? 'border-[#1E2720] ring-2 ring-[#D4AF37]'
              : 'border-[#D4AF37]'
        }`}
      >
        <div className="flex gap-3">
          <span {...dragHandleProps} className="cursor-grab pt-1 text-[#1E2720]/30">
            <GripVertical className="h-4 w-4" />
          </span>
          {act.kind === 'place' ? (
            img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={img}
                alt=""
                className="h-14 w-14 shrink-0 rounded-lg border border-[#D4AF37] object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-[#D4AF37] bg-[#FAFAFA]">
                <MapPin className="h-5 w-5 text-[#D4AF37]" />
              </div>
            )
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[#1E2720]">
                  {act.place_name || kindLabel(act.kind)}
                </h3>
                {act.kind === 'place' ? (
                  <div className="mt-0.5 space-y-0.5">
                    {act.category ? (
                      <p className="text-[10px] font-bold text-slate-700">
                        {placeBankCategoryLabel(act.category)}
                      </p>
                    ) : null}
                    {act.city ? (
                      <span className="block text-xs font-bold text-slate-700">
                        • {act.city}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => onRemove(day.id, act.id)}
                className="rounded p-1 text-red-700 hover:bg-red-50"
                aria-label="حذف"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {act.kind === 'place' || act.kind === 'transport' ? (
              <div className="mt-2 flex items-center gap-2">
                <label className="text-[10px] font-bold text-slate-700">وقت الزيارة:</label>
                <input
                  type="time"
                  className={VIP_INPUT}
                  value={act.visit_time || act.time_slot || ''}
                  onChange={(e) => {
                    const visit_time = e.target.value;
                    onUpdate(day.id, act.id, { visit_time, time_slot: visit_time });
                  }}
                />
              </div>
            ) : null}

            {act.kind === 'place' ? (
              <div className="mt-2">
                <input
                  type="text"
                  placeholder="ملاحظات المحطة (اختياري)..."
                  value={act.note || ''}
                  onChange={(e) => onUpdate(day.id, act.id, { note: e.target.value })}
                  className="w-full rounded border border-gray-200 p-2 text-xs focus:border-[#C5A059] focus:outline-none"
                />
              </div>
            ) : null}

            {act.kind === 'place' ? (
              <button
                type="button"
                disabled={!coords || !onFindNearby}
                onClick={() => {
                  if (!coords || !onFindNearby) return;
                  onFindNearby({
                    activityId: act.id,
                    placeName: act.place_name || 'محطة',
                    lat: coords.lat,
                    lng: coords.lng,
                  });
                }}
                className={`mt-2 w-full rounded-lg border px-2 py-2 text-[11px] font-bold transition ${
                  isOrigin
                    ? 'border-[#1E2720] bg-[#D4AF37] text-[#1E2720]'
                    : 'border-[#D4AF37] bg-[#FAFAFA] text-[#1E2720] hover:bg-[#D4AF37]/15 disabled:opacity-40'
                }`}
              >
                📍 أماكن قريبة
              </button>
            ) : null}

            {index > 0 && act.kind !== 'transport' ? (
              <div className="mt-3 rounded-lg border border-[#D4AF37] bg-[#FAFAFA] p-2.5">
                <p className="mb-2 text-[10px] font-bold text-[#1E2720]">الانتقال</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label>
                    <span className="mb-0.5 block text-[10px] font-bold text-[#1E2720]/70">
                      الوسيلة
                    </span>
                    <select
                      className={VIP_SELECT}
                      value={act.transit_mode || 'car'}
                      onChange={(e) =>
                        onUpdate(day.id, act.id, {
                          transit_mode: e.target.value as Act['transit_mode'],
                        })
                      }
                    >
                      <option value="car">سيارة</option>
                      <option value="walk">مشي</option>
                      <option value="metro">مترو</option>
                    </select>
                  </label>
                  <label>
                    <span className="mb-0.5 block text-[10px] font-bold text-[#1E2720]/70">
                      المدة
                    </span>
                    <input
                      className={VIP_INPUT}
                      value={act.transit_duration}
                      placeholder="25 دقيقة"
                      onChange={(e) =>
                        onUpdate(day.id, act.id, { transit_duration: e.target.value })
                      }
                    />
                  </label>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </article>
    </div>
  );
}

export default function ItineraryDaysBuilder({
  days,
  onDaysChange,
  activeDayId,
  onActiveDayIdChange,
  proximityActivityId = null,
  onFindNearby,
}: Props) {
  useEffect(() => {
    if (!days.some((d) => d.id === activeDayId)) {
      onActiveDayIdChange(days[0]?.id ?? '');
    }
  }, [days, activeDayId, onActiveDayIdChange]);

  const activeDay = useMemo(
    () => days.find((d) => d.id === activeDayId) ?? days[0],
    [days, activeDayId],
  );

  const patchDay = useCallback(
    (dayId: string, fn: (d: ItineraryDayDraft) => ItineraryDayDraft) => {
      onDaysChange(days.map((d) => (d.id === dayId ? fn(d) : d)));
    },
    [days, onDaysChange],
  );

  const onDragEnd = useCallback(
    (result: DropResult) => {
      const { source, destination: dest, draggableId } = result;
      if (!dest) return;
      if (source.droppableId === dest.droppableId) {
        patchDay(source.droppableId, (day) => {
          const all = dayToActivities(day);
          const pinned = all.filter((a) => a.kind === 'hotel' || a.kind === 'experience');
          const route = mapableActivities(all);
          const [moved] = route.splice(source.index, 1);
          if (!moved) return day;
          route.splice(dest.index, 0, moved);
          return patchDayActivities(day, [...pinned, ...route]);
        });
      } else {
        onDaysChange(
          moveActivityBetweenDays(days, source.droppableId, dest.droppableId, draggableId, dest.index),
        );
      }
    },
    [days, onDaysChange, patchDay],
  );

  const remove = (dayId: string, id: string) => {
    patchDay(dayId, (day) => {
      const next = dayToActivities(day).filter((a) => a.id !== id);
      return patchDayActivities(day, next);
    });
  };

  const update = (dayId: string, id: string, patch: Partial<Act>) => {
    patchDay(dayId, (day) => {
      const acts = dayToActivities(day).map((a) => (a.id === id ? { ...a, ...patch } : a));
      const next =
        'visit_time' in patch || 'time_slot' in patch
          ? sortActivitiesByVisitTime(acts)
          : acts;
      return patchDayActivities(day, next);
    });
  };

  return (
    <section className={VIP_PANEL} aria-label="منصة بناء المسار">
      <div className={VIP_PANEL_HEAD}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-[#1E2720]">منصة بناء المسار</h2>
            <p className="text-[11px] font-medium text-slate-600">The Builder — اسحب المحطات لإعادة الترتيب</p>
          </div>
          {activeDay ? (
            <button
              type="button"
              className={VIP_BTN_GHOST}
              onClick={() =>
                patchDay(activeDay.id, (day) =>
                  patchDayActivities(day, [...dayToActivities(day), createTransportActivity()]),
                )
              }
            >
              <Car className="h-4 w-4" aria-hidden />
              انتقال
            </button>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {days.map((day, i) => (
            <button
              key={day.id}
              type="button"
              onClick={() => onActiveDayIdChange(day.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                day.id === activeDayId
                  ? 'bg-[#D4AF37] text-[#1E2720]'
                  : 'border border-[#D4AF37] bg-white text-[#1E2720] hover:bg-[#D4AF37]/15'
              }`}
            >
              اليوم {i + 1}
              {day.city ? ` · ${day.city}` : ''}
            </button>
          ))}
        </div>
        {activeDay ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input
              className={VIP_INPUT}
              placeholder="عنوان اليوم"
              value={activeDay.title}
              onChange={(e) => patchDay(activeDay.id, (d) => ({ ...d, title: e.target.value }))}
            />
            <input
              className={VIP_INPUT}
              placeholder="المدينة"
              value={activeDay.city}
              onChange={(e) => patchDay(activeDay.id, (d) => ({ ...d, city: e.target.value }))}
            />
          </div>
        ) : null}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className={`${VIP_PANEL_BODY} bg-[#FAFAFA]`}>
          {activeDay ? (
            <Droppable
              droppableId={activeDay.id}
              key={`${activeDay.id}:${mapableActivities(dayToActivities(activeDay))
                .map((a) => a.id)
                .join(',')}`}
            >
              {(provided, snap) => {
                const acts = mapableActivities(dayToActivities(activeDay));
                return (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-h-[240px] rounded-lg p-1 ${snap.isDraggingOver ? 'bg-[#D4AF37]/10' : ''}`}
                  >
                    {acts.length === 0 ? (
                      <p className="py-24 text-center text-sm font-semibold text-slate-600">
                        اضغط «إضافة للمسار ➕» من الخزنة (يمين) لبناء اليوم
                      </p>
                    ) : (
                      acts.map((act, index) => (
                        <Draggable key={act.id} draggableId={act.id} index={index}>
                          {(dp, ds) => (
                            <TimelineCard
                              day={activeDay}
                              act={act}
                              index={index}
                              innerRef={dp.innerRef}
                              draggableProps={dp.draggableProps}
                              dragHandleProps={dp.dragHandleProps}
                              isDragging={ds.isDragging}
                              isOrigin={proximityActivityId === act.id}
                              onRemove={remove}
                              onUpdate={update}
                              onFindNearby={onFindNearby}
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
            .map((day, i) => (
              <Droppable key={day.id} droppableId={day.id}>
                {(provided, snap) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`mt-2 rounded-lg border border-dashed px-2 py-2 ${
                      snap.isDraggingOver
                        ? 'border-[#1E2720] bg-[#D4AF37]/15'
                        : 'border-[#D4AF37]/50'
                    }`}
                  >
                    <p className="text-[10px] font-bold text-slate-600">
                      إفلات في اليوم {i + 1}
                    </p>
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            ))}
        </div>
      </DragDropContext>
    </section>
  );
}
