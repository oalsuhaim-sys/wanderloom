'use client';

import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';

import 'leaflet/dist/leaflet.css';

export type BuilderMapMarker = {
  id: string;
  lat: number;
  lng: number;
  order: number;
  title: string;
};

function LeafletMapUpdater({ markers }: { markers: BuilderMapMarker[] }) {
  const map = useMap();
  useEffect(() => {
    const valid = markers.filter(
      (m) => Number.isFinite(m.lat) && Number.isFinite(m.lng) && !(m.lat === 0 && m.lng === 0),
    );
    if (valid.length === 0) return;
    const latLngs = valid.map((m) => [m.lat, m.lng] as [number, number]);
    if (latLngs.length === 1) {
      map.flyTo(latLngs[0], 14, { animate: true, duration: 1.5 });
    } else {
      map.fitBounds(L.latLngBounds(latLngs), { padding: [50, 50], animate: true });
    }
  }, [markers, map]);
  return null;
}

type Props = {
  markers: BuilderMapMarker[];
  className?: string;
};

const DEFAULT_CENTER: [number, number] = [25.2048, 55.2708];
const GOLD = '#D4AF37';

function numberedDivIcon(order: number): L.DivIcon {
  return L.divIcon({
    className: 'itinerary-builder-map-marker',
    html: `<span class="itinerary-builder-map-marker__badge">${order}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

export default function ItineraryBuilderLeafletMap({ markers, className = '' }: Props) {
  const validMarkers = useMemo(
    () =>
      markers.filter(
        (m) => Number.isFinite(m.lat) && Number.isFinite(m.lng) && !(m.lat === 0 && m.lng === 0),
      ),
    [markers],
  );

  const polylinePositions = useMemo(
    () => validMarkers.map((m) => [m.lat, m.lng] as [number, number]),
    [validMarkers],
  );

  return (
    <div
      className={`relative min-h-[320px] overflow-hidden rounded-2xl border border-[#1E2720]/10 ${className}`}
    >
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={10}
        className="h-full w-full min-h-[320px] rounded-2xl z-0"
        scrollWheelZoom
        dragging
        touchZoom
        doubleClickZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LeafletMapUpdater markers={markers} />
        {validMarkers.map((m) => (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={numberedDivIcon(m.order)}
            title={m.title}
          />
        ))}
        {polylinePositions.length >= 2 ? (
          <Polyline
            positions={polylinePositions}
            pathOptions={{
              color: GOLD,
              weight: 4,
              opacity: 0.9,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        ) : null}
      </MapContainer>
      <p
        className="pointer-events-none absolute bottom-2 left-2 z-[400] rounded-md bg-white/90 px-2 py-0.5 text-[9px] font-medium text-[#1E2720]/50 shadow-sm"
        dir="ltr"
      >
        © OpenStreetMap
      </p>
    </div>
  );
}
