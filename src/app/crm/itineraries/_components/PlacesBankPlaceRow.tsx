'use client';

import React, { memo } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { GripVertical } from 'lucide-react';

import { bankPlaceDraggableId } from '@/app/crm/itineraries/_components/simple-itinerary-day-utils';
import { WL_BTN_PRIMARY, WL_CARD } from '@/lib/itinerary-builder-ui';

export type PlacesBankPlaceRowData = Record<string, unknown> & {
  id?: string | number;
  name?: string;
  category?: string;
  city?: string;
  branch_name?: string | null;
  rating?: string | number;
};

type Props = {
  place: PlacesBankPlaceRowData;
  index: number;
  activeDayLabel: string;
  onAddPlace: (place: PlacesBankPlaceRowData) => void;
};

function PlacesBankPlaceRowInner({ place, index, activeDayLabel, onAddPlace }: Props) {
  const branchName = String(place.branch_name ?? '').trim();

  return (
    <Draggable draggableId={bankPlaceDraggableId(place)} index={index}>
      {(dragProvided, dragSnapshot) => (
        <div
          ref={dragProvided.innerRef}
          {...dragProvided.draggableProps}
          className={`${WL_CARD} transition-all ${
            dragSnapshot.isDragging
              ? 'border-[#D4AF37] shadow-lg'
              : 'hover:border-[#D4AF37]/50'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-start gap-2">
              <span
                {...dragProvided.dragHandleProps}
                className="mt-0.5 cursor-grab text-slate-500 active:cursor-grabbing"
                aria-hidden
              >
                <GripVertical className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {branchName ? (
                    <span className="rounded-md border border-amber-200 bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                      {branchName}
                    </span>
                  ) : null}
                  <h4 className="text-base font-extrabold text-slate-900">{place.name}</h4>
                </div>
                <span className="mt-1 inline-block rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600">
                  {place.category}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500">
              {place.city ? <span>{place.city}</span> : <span>—</span>}
              {branchName ? (
                <>
                  <span aria-hidden>•</span>
                  <span className="rounded border border-amber-200/60 bg-amber-50 px-1.5 py-0.5 font-bold text-amber-700">
                    {branchName}
                  </span>
                </>
              ) : null}
            </div>
            <span className="shrink-0 text-sm font-bold text-[#D4AF37]">⭐ {place.rating || '4.5'}</span>
          </div>
          <button
            type="button"
            onClick={() => onAddPlace(place)}
            className={`mt-4 w-full ${WL_BTN_PRIMARY}`}
          >
            إضافة إلى {activeDayLabel} ➕
          </button>
        </div>
      )}
    </Draggable>
  );
}

const PlacesBankPlaceRow = memo(PlacesBankPlaceRowInner);
export default PlacesBankPlaceRow;
