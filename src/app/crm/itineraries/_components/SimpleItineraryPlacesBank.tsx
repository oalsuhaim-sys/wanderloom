'use client';

import React, { memo } from 'react';
import { Droppable } from '@hello-pangea/dnd';

import PlacesBankPlaceRow, {
  type PlacesBankPlaceRowData,
} from '@/app/crm/itineraries/_components/PlacesBankPlaceRow';
import { PLACES_BANK_DROPPABLE_ID } from '@/app/crm/itineraries/_components/simple-itinerary-day-utils';
import { WL_BTN_PRIMARY, WL_EMPTY } from '@/lib/itinerary-builder-ui';

type PlaceRow = PlacesBankPlaceRowData;

type Props = {
  places: PlaceRow[];
  activeDayLabel: string;
  searchQuery?: string;
  onAddPlace: (place: PlaceRow) => void;
  onQuickAddClick?: () => void;
};

function SimpleItineraryPlacesBankInner({
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
          className="no-scrollbar flex flex-1 flex-col gap-4 overflow-y-auto bg-white p-4"
        >
          {places.length > 0 ? (
            places.map((place, index) => (
              <PlacesBankPlaceRow
                key={String(place.id ?? place.name ?? index)}
                place={place}
                index={index}
                activeDayLabel={activeDayLabel}
                onAddPlace={onAddPlace}
              />
            ))
          ) : searchQuery.trim() && onQuickAddClick ? (
            <div className={`${WL_EMPTY} border-solid`}>
              <p className="mb-3 text-sm text-slate-500">المعلم غير موجود في بنك المعلومات.</p>
              <button
                type="button"
                onClick={onQuickAddClick}
                className={WL_BTN_PRIMARY}
              >
                + إضافة &quot;{searchQuery.trim()}&quot; كمعلم جديد
              </button>
            </div>
          ) : (
            <div className="py-10 text-center font-bold text-slate-500">
              لا توجد أماكن مطابقة للبحث
            </div>
          )}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );
}

const SimpleItineraryPlacesBank = memo(SimpleItineraryPlacesBankInner);
export default SimpleItineraryPlacesBank;
