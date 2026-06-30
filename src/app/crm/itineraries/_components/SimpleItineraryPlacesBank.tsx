'use client';

import React from 'react';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import { GripVertical } from 'lucide-react';

import {
  PLACES_BANK_DROPPABLE_ID,
  bankPlaceDraggableId,
} from '@/app/crm/itineraries/_components/simple-itinerary-day-utils';

type PlaceRow = Record<string, unknown> & {
  id?: string | number;
  name?: string;
  category?: string;
  city?: string;
  rating?: string | number;
};

type Props = {
  places: PlaceRow[];
  activeDayLabel: string;
  searchQuery?: string;
  onAddPlace: (place: PlaceRow) => void;
  onQuickAddClick?: () => void;
};

export default function SimpleItineraryPlacesBank({
  places,
  activeDayLabel,
  searchQuery = '',
  onAddPlace,
  onQuickAddClick,
}: Props) {
  return (
    <Droppable droppableId={PLACES_BANK_DROPPABLE_ID} isDropDisabled>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className="no-scrollbar flex flex-1 flex-col gap-4 overflow-y-auto bg-gray-50 p-4"
        >
          {places.length > 0 ? (
            places.map((place, index) => (
              <Draggable
                key={bankPlaceDraggableId(place)}
                draggableId={bankPlaceDraggableId(place)}
                index={index}
              >
                {(dragProvided, dragSnapshot) => (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    className={`rounded-xl border bg-white p-4 shadow-sm transition-all ${
                      dragSnapshot.isDragging
                        ? 'border-[#D4AF37] shadow-lg'
                        : 'border-gray-200 hover:border-[#D4AF37]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
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
                          <span className="mt-1 inline-block rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                            {place.category}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-sm text-gray-500">{place.city}</span>
                      <span className="text-sm font-bold text-[#D4AF37]">
                        ⭐ {place.rating || '4.5'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onAddPlace(place)}
                      className="mt-4 w-full rounded-lg bg-[#1E2720] py-2 text-sm font-bold text-[#D4AF37] transition-colors hover:bg-[#2a362c]"
                    >
                      إضافة إلى {activeDayLabel} ➕
                    </button>
                  </div>
                )}
              </Draggable>
            ))
          ) : searchQuery.trim() && onQuickAddClick ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center">
              <p className="mb-3 text-sm text-gray-500">المعلم غير موجود في بنك المعلومات.</p>
              <button
                type="button"
                onClick={onQuickAddClick}
                className="rounded-lg bg-[#D4AF37] px-4 py-2 text-sm font-bold text-[#1E2720] transition-colors hover:bg-[#b5952f]"
              >
                + إضافة &quot;{searchQuery.trim()}&quot; كمعلم جديد
              </button>
            </div>
          ) : (
            <div className="py-10 text-center font-bold text-gray-500">
              لا توجد أماكن مطابقة للبحث
            </div>
          )}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );
}
