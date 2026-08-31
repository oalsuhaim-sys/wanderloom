'use client';

import { MapPinned, Ticket } from 'lucide-react';

import { WL_TOGGLE_ACTIVE, WL_TOGGLE_INACTIVE } from '@/lib/itinerary-builder-ui';

export type ItineraryPlacesSource = 'bank' | 'experiences';

type Props = {
  value: ItineraryPlacesSource;
  onChange: (value: ItineraryPlacesSource) => void;
  placesCount?: number;
};

export default function ItineraryPlacesSourceTabs({ value, onChange, placesCount }: Props) {
  return (
    <div className="flex gap-2 rounded-xl border border-slate-200 bg-white p-1">
      <button
        type="button"
        onClick={() => onChange('bank')}
        className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold transition-colors ${
          value === 'bank' ? WL_TOGGLE_ACTIVE : `${WL_TOGGLE_INACTIVE} border-0`
        }`}
      >
        <MapPinned className="h-4 w-4 shrink-0" aria-hidden />
        بنك الأماكن
        {placesCount != null ? (
          <span className="text-xs font-semibold opacity-80">
            ({placesCount.toLocaleString('ar-SA')})
          </span>
        ) : null}
      </button>
      <button
        type="button"
        onClick={() => onChange('experiences')}
        className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold transition-colors ${
          value === 'experiences' ? WL_TOGGLE_ACTIVE : `${WL_TOGGLE_INACTIVE} border-0`
        }`}
      >
        <Ticket className="h-4 w-4 shrink-0" aria-hidden />
        تجارب وأنشطة حية (API)
      </button>
    </div>
  );
}
