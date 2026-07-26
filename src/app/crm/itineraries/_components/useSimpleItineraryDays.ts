'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DropResult } from '@hello-pangea/dnd';

import {
  createEmptyDay,
  dayDroppableId,
  parseDayDroppableId,
  PLACES_BANK_DROPPABLE_ID,
  bankPlaceDraggableId,
  type SimpleItineraryDay,
  withTransportDefaults,
} from '@/app/crm/itineraries/_components/simple-itinerary-day-utils';

export function useSimpleItineraryDays(initialDays?: SimpleItineraryDay[]) {
  const [itineraryDays, setItineraryDays] = useState<SimpleItineraryDay[]>(
    initialDays?.length ? initialDays : [createEmptyDay(0)],
  );
  const [activeDayId, setActiveDayId] = useState<number>(
    () => initialDays?.[0]?.id ?? createEmptyDay(0).id,
  );

  useEffect(() => {
    if (!itineraryDays.some((d) => d.id === activeDayId)) {
      setActiveDayId(itineraryDays[0]?.id ?? createEmptyDay(0).id);
    }
  }, [itineraryDays, activeDayId]);

  const activeDay = useMemo(
    () => itineraryDays.find((d) => d.id === activeDayId) ?? itineraryDays[0],
    [itineraryDays, activeDayId],
  );

  const activeDayLabel = useMemo(() => {
    if (!activeDay) return '—';
    const idx = itineraryDays.findIndex((d) => d.id === activeDay.id);
    return activeDay.title?.trim() || `اليوم ${idx + 1}`;
  }, [activeDay, itineraryDays]);

  const handleAddDay = useCallback((opts?: { title?: string; city?: string }) => {
    setItineraryDays((prev) => {
      const next = createEmptyDay(prev.length);
      if (opts?.title?.trim()) next.title = opts.title.trim();
      if (opts?.city?.trim()) next.city = opts.city.trim();
      return [...prev, next];
    });
  }, []);

  /**
   * Reorder entire day cards (places/hotel/city move with the day).
   * Calendar position = array index; day_number is rewritten on save as index+1.
   */
  const moveDay = useCallback((dayId: number, direction: 'up' | 'down') => {
    setItineraryDays((prev) => {
      const currentIndex = prev.findIndex((d) => d.id === dayId);
      if (currentIndex < 0) return prev;
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;

      const next = [...prev];
      const tmp = next[currentIndex]!;
      next[currentIndex] = next[targetIndex]!;
      next[targetIndex] = tmp;

      // Refresh auto-generated titles so «اليوم الأول» stays chronological
      return next.map((day, index) => {
        const title = String(day.title ?? '').trim();
        const isAuto =
          !title ||
          title === 'اليوم الأول' ||
          /^اليوم\s+\d+$/.test(title);
        if (!isAuto) return day;
        return {
          ...day,
          title: index === 0 ? 'اليوم الأول' : `اليوم ${index + 1}`,
        };
      });
    });
  }, []);

  const handleAddPlace = useCallback(
    (place: Record<string, unknown>, targetDayId?: number) => {
      const dayId = targetDayId ?? activeDayId;
      setItineraryDays((prev) => {
        if (prev.length === 0) return prev;
        const targetIndex = prev.findIndex((d) => d.id === dayId);
        const index = targetIndex >= 0 ? targetIndex : 0;
        return prev.map((day, i) =>
          i === index
            ? { ...day, places: [...day.places, withTransportDefaults(place)] }
            : day,
        );
      });
    },
    [activeDayId],
  );

  const handleRemovePlace = useCallback((dayId: number, placeIndex: number) => {
    setItineraryDays((prev) =>
      prev.map((day) =>
        day.id === dayId
          ? { ...day, places: day.places.filter((_, index) => index !== placeIndex) }
          : day,
      ),
    );
  }, []);

  const updateTransport = useCallback(
    (
      dayId: number,
      placeIndex: number,
      field: 'transportToNext' | 'transportDuration',
      value: string,
    ) => {
      setItineraryDays((prev) =>
        prev.map((day) => {
          if (day.id !== dayId) return day;
          return {
            ...day,
            places: day.places.map((p, index) =>
              index === placeIndex ? { ...p, [field]: value } : p,
            ),
          };
        }),
      );
    },
    [],
  );

  const updateVisitTime = useCallback(
    (dayId: number, placeIndex: number, visit_time: string) => {
      setItineraryDays((prev) =>
        prev.map((day) => {
          if (day.id !== dayId) return day;
          return {
            ...day,
            places: day.places.map((p, index) =>
              index === placeIndex
                ? { ...p, visit_time, time_slot: visit_time }
                : p,
            ),
          };
        }),
      );
    },
    [],
  );

  const updateDayHotel = useCallback((dayId: number, hotelName: string) => {
    const normalized = hotelName.trim();
    setItineraryDays((prev) =>
      prev.map((day) =>
        day.id === dayId
          ? { ...day, hotelName: normalized || undefined }
          : day,
      ),
    );
  }, []);

  const updateDayCity = useCallback((dayId: number, city: string) => {
    const normalized = city.trim();
    setItineraryDays((prev) =>
      prev.map((day) =>
        day.id === dayId ? { ...day, city: normalized || undefined } : day,
      ),
    );
  }, []);

  const updateDayTitle = useCallback((dayId: number, title: string) => {
    const normalized = title.trim();
    setItineraryDays((prev) =>
      prev.map((day, index) => {
        if (day.id !== dayId) return day;
        if (normalized) return { ...day, title: normalized };
        return {
          ...day,
          title: index === 0 ? 'اليوم الأول' : `اليوم ${index + 1}`,
        };
      }),
    );
  }, []);

  const updateSupplierPaid = useCallback((dayId: number, placeIndex: number, paid: boolean) => {
    setItineraryDays((prev) =>
      prev.map((day) => {
        if (day.id !== dayId) return day;
        return {
          ...day,
          places: day.places.map((p, index) =>
            index === placeIndex ? { ...p, supplierPaid: paid } : p,
          ),
        };
      }),
    );
  }, []);

  const onDragEnd = useCallback(
    (result: DropResult, bankPlaces?: Record<string, unknown>[]) => {
      const { source, destination, draggableId } = result;
      if (!destination) return;

      if (source.droppableId === PLACES_BANK_DROPPABLE_ID && bankPlaces?.length) {
        const destDayId = parseDayDroppableId(destination.droppableId);
        const place = bankPlaces.find((p) => bankPlaceDraggableId(p) === draggableId);
        if (destDayId != null && place) {
          setActiveDayId(destDayId);
          setItineraryDays((prev) => {
            const next = prev.map((day) => ({ ...day, places: [...day.places] }));
            const destDay = next.find((d) => d.id === destDayId);
            if (!destDay) return prev;
            destDay.places.splice(destination.index, 0, withTransportDefaults(place));
            return next;
          });
          return;
        }
      }

      const sourceDayId = parseDayDroppableId(source.droppableId);
      const destDayId = parseDayDroppableId(destination.droppableId);
      if (sourceDayId == null || destDayId == null) return;

      setItineraryDays((prev) => {
        const next = prev.map((day) => ({ ...day, places: [...day.places] }));
        const sourceDay = next.find((d) => d.id === sourceDayId);
        const destDay = next.find((d) => d.id === destDayId);
        if (!sourceDay || !destDay) return prev;

        const fromIndex = sourceDay.places.findIndex((p) => p._dragId === draggableId);
        if (fromIndex < 0) return prev;

        const [moved] = sourceDay.places.splice(fromIndex, 1);
        if (!moved) return prev;

        destDay.places.splice(destination.index, 0, moved);
        return next;
      });
    },
    [],
  );

  return {
    itineraryDays,
    setItineraryDays,
    activeDayId,
    setActiveDayId,
    activeDay,
    activeDayLabel,
    handleAddDay,
    moveDay,
    handleAddPlace,
    handleRemovePlace,
    updateTransport,
    updateVisitTime,
    updateDayHotel,
    updateDayCity,
    updateDayTitle,
    updateSupplierPaid,
    onDragEnd,
    dayDroppableId,
  };
}
