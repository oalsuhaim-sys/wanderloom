'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, Polyline, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './InteractiveItineraryMap.css';

import type { PublicItineraryDay } from '@/lib/public-itinerary';
import { buildGoogleMapsPlaceSearchUrl } from '@/lib/public-itinerary';
import {
  buildDayMarkersSync,
  refineDayMarkersWithGeocoding,
  resolveCityCenter,
  type VipMapMarker,
} from '@/lib/vip-map-coordinates';

export type InteractiveItineraryMapProps = {
  selectedDay: PublicItineraryDay | null;
  allDays: PublicItineraryDay[];
  destination?: string;
  className?: string;
};

type DisplayMarker = VipMapMarker & {
  displayLat: number;
  displayLng: number;
};

const DEFAULT_CENTER: [number, number] = [35.6762, 139.6503];
const GOLD = '#C59B4B';

function createGoldPin(number: number | string) {
  return L.divIcon({
    className: 'custom-gold-marker-pin',
    html: `
      <div style="
        background-color:${GOLD};
        color:#0B0F17;
        width:28px;
        height:28px;
        border-radius:50%;
        display:flex;
        align-items:center;
        justify-content:center;
        font-weight:800;
        font-size:11px;
        border:2px solid #0B0F17;
        box-shadow:0 0 12px rgba(197,155,75,0.9);
        cursor:pointer;
      ">${number}</div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function applyOverlapOffsets(markers: VipMapMarker[]): DisplayMarker[] {
  const keyOf = (lat: number, lng: number) => `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const groups = new Map<string, number[]>();

  markers.forEach((m, i) => {
    const k = keyOf(m.lat, m.lng);
    const list = groups.get(k) ?? [];
    list.push(i);
    groups.set(k, list);
  });

  return markers.map((m, i) => {
    const group = groups.get(keyOf(m.lat, m.lng)) ?? [i];
    if (group.length <= 1) {
      return { ...m, displayLat: m.lat, displayLng: m.lng };
    }
    const idxInGroup = group.indexOf(i);
    const angle = (idxInGroup / group.length) * Math.PI * 2;
    const spread = 0.0035;
    return {
      ...m,
      displayLat: m.lat + Math.sin(angle) * spread,
      displayLng: m.lng + Math.cos(angle) * spread,
    };
  });
}

function AutoFitBounds({ markers }: { markers: DisplayMarker[] }) {
  const map = useMap();

  useEffect(() => {
    const validCoords = markers
      .map((m) => [m.displayLat, m.displayLng] as [number, number])
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));

    if (validCoords.length === 1) {
      map.flyTo(validCoords[0]!, 13, { duration: 1.2 });
      return;
    }
    if (validCoords.length > 1) {
      const bounds = L.latLngBounds(validCoords);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15, animate: true });
    }
  }, [markers, map]);

  return null;
}

function placeGoogleMapsUrl(
  marker: DisplayMarker,
  destination: string,
  dayCity?: string,
): string {
  const existing = marker.activity.googleMapsUrl?.trim();
  if (existing && existing.includes('google.com')) return existing;

  const name =
    marker.activity.place_name?.trim() ||
    marker.activity.title?.trim() ||
    '';
  const location =
    marker.activity.locationLabel?.trim() ||
    dayCity?.trim() ||
    destination.trim() ||
    '';
  const searchQuery = [name, location].filter(Boolean).join(' ').trim();

  if (searchQuery) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`;
  }

  return buildGoogleMapsPlaceSearchUrl(marker.activity.mapsQuery || name);
}

export default function InteractiveItineraryMap({
  selectedDay,
  allDays = [],
  destination = '',
  className,
}: InteractiveItineraryMapProps) {
  const scopeDays = useMemo(
    () => (selectedDay ? [selectedDay] : allDays),
    [selectedDay, allDays],
  );

  const dayKey = selectedDay
    ? `day-${selectedDay.index}`
    : `all-${allDays.map((d) => d.index).join('-')}`;

  const [markers, setMarkers] = useState<VipMapMarker[]>([]);

  useEffect(() => {
    const initial = scopeDays.flatMap((day) => buildDayMarkersSync(day, destination));
    setMarkers(initial.map((m, i) => ({ ...m, order: i + 1 })));

    let cancelled = false;
    void (async () => {
      const refined: VipMapMarker[] = [];
      for (const day of scopeDays) {
        const dayMarkers = buildDayMarkersSync(day, destination);
        const next = await refineDayMarkersWithGeocoding(dayMarkers, destination);
        refined.push(...next);
      }
      if (cancelled) return;
      setMarkers(refined.map((m, i) => ({ ...m, order: i + 1 })));
    })();

    return () => {
      cancelled = true;
    };
  }, [dayKey, scopeDays, destination]);

  const displayMarkers = useMemo(
    () =>
      applyOverlapOffsets(
        markers.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng)),
      ),
    [markers],
  );

  const polylineCoords = useMemo(
    () =>
      displayMarkers.map(
        (m) => [m.displayLat, m.displayLng] as [number, number],
      ),
    [displayMarkers],
  );

  const fallbackCenter = useMemo(() => {
    if (polylineCoords[0]) return polylineCoords[0];
    const city = selectedDay?.cityLabel || allDays[0]?.cityLabel || destination;
    return city ? resolveCityCenter(city, destination) : DEFAULT_CENTER;
  }, [polylineCoords, selectedDay, allDays, destination]);

  const dayCity = selectedDay?.cityLabel || allDays[0]?.cityLabel || '';

  return (
    <div className={className ?? 'h-[340px] w-full'}>
      <MapContainer
        key={dayKey}
        center={fallbackCenter}
        zoom={11}
        scrollWheelZoom
        dragging
        touchZoom
        zoomControl={false}
        className="z-0 h-full w-full"
        style={{ height: '100%', width: '100%', backgroundColor: '#0B0F17' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="dark-custom-tile-filter"
          maxZoom={19}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        {displayMarkers.length > 0 ? (
          <AutoFitBounds markers={displayMarkers} />
        ) : null}

        {polylineCoords.length > 1 ? (
          <Polyline
            positions={polylineCoords}
            pathOptions={{
              color: GOLD,
              weight: 3,
              dashArray: '6, 6',
              opacity: 0.85,
            }}
          />
        ) : null}

        {displayMarkers.map((marker) => {
          const name =
            marker.activity.place_name?.trim() ||
            marker.activity.title?.trim() ||
            'معلم سياحي';
          const category =
            marker.activity.categoryLabel?.trim() || 'معلم سياحي';
          const googleMapsUrl = placeGoogleMapsUrl(marker, destination, dayCity);

          return (
            <Marker
              key={`${marker.activity.id}-${marker.order}`}
              position={[marker.displayLat, marker.displayLng]}
              icon={createGoldPin(marker.order)}
            >
              <Popup className="custom-dark-popup">
                <div className="space-y-1 p-2 text-right font-sans" dir="rtl">
                  <h4 className="text-xs font-bold text-slate-900">{name}</h4>
                  <p className="text-[10px] text-slate-500">{category}</p>
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block rounded-lg bg-[#1B242F] px-3 py-1 text-[10px] font-bold text-white transition-all hover:bg-slate-800"
                  >
                    فتح بخرائط جوجل
                  </a>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
