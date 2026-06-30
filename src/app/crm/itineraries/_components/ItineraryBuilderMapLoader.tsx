'use client';

import dynamic from 'next/dynamic';

import type { BuilderMapMarker } from '@/app/crm/itineraries/_components/ItineraryBuilderLeafletMap';

export type { BuilderMapMarker };

function MapLoading({ className = '' }: { className?: string }) {
  return (
    <div
      className={`flex h-full min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-[#D4AF37]/40 bg-[#F9F9F6] ${className}`}
    >
      <p className="text-sm font-bold text-[#1E2720]/50">جاري تحميل الخريطة…</p>
    </div>
  );
}

const ItineraryBuilderLeafletMap = dynamic(
  () => import('@/app/crm/itineraries/_components/ItineraryBuilderLeafletMap'),
  {
    ssr: false,
    loading: () => <MapLoading />,
  },
);

type Props = {
  markers: BuilderMapMarker[];
  className?: string;
};

export default function ItineraryBuilderMap({ markers, className }: Props) {
  return <ItineraryBuilderLeafletMap markers={markers} className={className} />;
}
