'use client';

import { useMemo, useState } from 'react';

import type { PublicItineraryActivity, PublicItineraryDay } from '@/lib/public-itinerary';
import { resolveCityCenter } from '@/lib/vip-map-coordinates';

export type JapanMapRegion = 'all' | 'tokyo' | 'kyoto_osaka' | 'hokkaido';

export type SvgMapPlace = {
  id: string;
  name: string;
  category?: string;
  city?: string;
  svgX: number;
  svgY: number;
  googleSearchQuery?: string;
  googleMapsUrl?: string | null;
};

type CustomSvgJapanMapProps = {
  selectedRegion?: JapanMapRegion;
  places?: SvgMapPlace[];
  /** Real itinerary days — places are projected when `places` is omitted */
  days?: PublicItineraryDay[];
  selectedDay?: PublicItineraryDay | null;
  destination?: string;
  regionLabel?: string;
  regionKanji?: string;
};

const REGION_BOUNDS: Record<JapanMapRegion, { x: number; y: number; w: number; h: number }> = {
  all: { x: 0, y: 0, w: 1000, h: 800 },
  tokyo: { x: 450, y: 380, w: 300, h: 250 },
  kyoto_osaka: { x: 300, y: 450, w: 280, h: 220 },
  hokkaido: { x: 600, y: 50, w: 350, h: 300 },
};

const REGION_KANJI: Record<JapanMapRegion, string> = {
  all: '日本',
  tokyo: '東京',
  kyoto_osaka: '関西',
  hokkaido: '北海道',
};

const REGION_LABEL_AR: Record<JapanMapRegion, string> = {
  all: 'جميع الوجهات (الرحلة كاملة)',
  tokyo: 'طوكيو والجهات المجاورة',
  kyoto_osaka: 'كيوتو · أوساكا',
  hokkaido: 'هوكايدو',
};

/** إسقاط تقريبي لإحداثيات اليابان على مساحة الـ SVG */
export function latLngToJapanSvg(lat: number, lng: number): { svgX: number; svgY: number } {
  const minLng = 128;
  const maxLng = 146;
  const minLat = 30;
  const maxLat = 46;
  const svgX = ((lng - minLng) / (maxLng - minLng)) * 700 + 150;
  const svgY = ((maxLat - lat) / (maxLat - minLat)) * 600 + 50;
  return {
    svgX: Math.max(160, Math.min(860, svgX)),
    svgY: Math.max(70, Math.min(700, svgY)),
  };
}

const CITY_SVG_FALLBACK: Record<string, { svgX: number; svgY: number }> = {
  tokyo: { svgX: 580, svgY: 480 },
  '\u0637\u0648\u0643\u064a\u0648': { svgX: 580, svgY: 480 },
  kyoto: { svgX: 410, svgY: 530 },
  '\u0643\u064a\u0648\u062a\u0648': { svgX: 410, svgY: 530 },
  osaka: { svgX: 400, svgY: 545 },
  '\u0623\u0648\u0633\u0627\u0643\u0627': { svgX: 400, svgY: 545 },
  sapporo: { svgX: 720, svgY: 140 },
  hokkaido: { svgX: 720, svgY: 140 },
  '\u0647\u0648\u0643\u0627\u064a\u062f\u0648': { svgX: 720, svgY: 140 },
};

function citySvgFallback(city: string): { svgX: number; svgY: number } | null {
  const key = city.trim().toLowerCase();
  if (!key) return null;
  if (CITY_SVG_FALLBACK[key]) return CITY_SVG_FALLBACK[key]!;
  for (const [name, coords] of Object.entries(CITY_SVG_FALLBACK)) {
    if (key.includes(name) || name.includes(key)) return coords;
  }
  return null;
}

export function resolveJapanRegion(cityLabel: string, destination = ''): JapanMapRegion {
  const text = `${cityLabel} ${destination}`.toLowerCase();
  if (/hokkaido|sapporo|\u0647\u0648\u0643\u0627\u064a\u062f\u0648|\u0633\u0627\u0628\u0648\u0631\u0648/.test(text)) {
    return 'hokkaido';
  }
  if (/kyoto|osaka|kansai|\u0643\u064a\u0648\u062a\u0648|\u0623\u0648\u0633\u0627\u0643\u0627|\u0643\u0627\u0646\u0633\u0627\u064a/.test(text)) {
    return 'kyoto_osaka';
  }
  if (/tokyo|\u0637\u0648\u0643\u064a\u0648|yokohama|asakusa/.test(text)) {
    return 'tokyo';
  }
  return 'all';
}

export function isJapanDestination(destination: string, days: PublicItineraryDay[] = []): boolean {
  const text = [
    destination,
    ...days.map((d) => `${d.cityLabel} ${d.mapsQuery}`),
  ]
    .join(' ')
    .toLowerCase();
  return /japan|\u0627\u0644\u064a\u0627\u0628\u0627\u0646|tokyo|\u0637\u0648\u0643\u064a\u0648|kyoto|osaka|hokkaido|nippon|nihong/.test(
    text,
  );
}

function activityToPlace(
  activity: PublicItineraryActivity,
  index: number,
  dayCity: string,
  destination: string,
): SvgMapPlace {
  const name =
    activity.place_name?.trim() || activity.title?.trim() || `محطة ${index + 1}`;
  const city = activity.locationLabel?.trim() || dayCity;
  let svgX: number;
  let svgY: number;

  if (activity.lat != null && activity.lng != null) {
    ({ svgX, svgY } = latLngToJapanSvg(activity.lat, activity.lng));
  } else {
    const fallback =
      citySvgFallback(city) ||
      citySvgFallback(destination) ||
      (() => {
        const [lat, lng] = resolveCityCenter(city || destination, destination);
        return latLngToJapanSvg(lat, lng);
      })();
    // تفريق طفيف عند غياب الإحداثيات الدقيقة
    svgX = fallback.svgX + Math.sin(index) * 14;
    svgY = fallback.svgY + Math.cos(index) * 14;
  }

  const searchQuery = [name, city, destination].filter(Boolean).join(' ');

  return {
    id: activity.id || `place-${index}`,
    name,
    category: activity.categoryLabel || undefined,
    city,
    svgX,
    svgY,
    googleSearchQuery: activity.mapsQuery || searchQuery,
    googleMapsUrl: activity.googleMapsUrl,
  };
}

function buildPlacesFromDays(
  days: PublicItineraryDay[],
  selectedDay: PublicItineraryDay | null | undefined,
  destination: string,
): SvgMapPlace[] {
  const scope = selectedDay ? [selectedDay] : days;
  const places: SvgMapPlace[] = [];
  let order = 0;
  for (const day of scope) {
    for (const activity of day.activities) {
      places.push(activityToPlace(activity, order, day.cityLabel, destination));
      order += 1;
    }
  }
  return places;
}

export default function CustomSvgJapanMap({
  selectedRegion,
  places: placesProp,
  days = [],
  selectedDay = null,
  destination = '',
  regionLabel,
  regionKanji,
}: CustomSvgJapanMapProps) {
  const resolvedRegion =
    selectedRegion ||
    (selectedDay
      ? resolveJapanRegion(selectedDay.cityLabel, destination)
      : 'all');

  const places = useMemo(() => {
    if (placesProp?.length) return placesProp;
    return buildPlacesFromDays(days, selectedDay, destination);
  }, [placesProp, days, selectedDay, destination]);

  const activeViewBox = useMemo(() => {
    const b = REGION_BOUNDS[resolvedRegion] || REGION_BOUNDS.all;
    return `${b.x} ${b.y} ${b.w} ${b.h}`;
  }, [resolvedRegion]);

  const [hoveredPlace, setHoveredPlace] = useState<SvgMapPlace | null>(null);

  const kanji = regionKanji || REGION_KANJI[resolvedRegion];
  const label = regionLabel || REGION_LABEL_AR[resolvedRegion];

  return (
    <div
      className="relative w-full overflow-hidden rounded-3xl border border-slate-800 bg-[#0B0F17] p-2 shadow-2xl"
      dir="rtl"
    >
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-5" aria-hidden>
        <pattern id="seigaiha" x="0" y="0" width="40" height="20" patternUnits="userSpaceOnUse">
          <path
            d="M 0 10 A 10 10 0 0 1 20 10 A 10 10 0 0 1 40 10 M -10 20 A 10 10 0 0 1 10 20 A 10 10 0 0 1 30 20"
            fill="none"
            stroke="#C59B4B"
            strokeWidth="1"
          />
        </pattern>
        <rect width="100%" height="100%" fill="url(#seigaiha)" />
      </svg>

      <div className="absolute top-4 right-4 z-20 flex items-center gap-3 rounded-2xl border border-slate-800/80 bg-[#0B0F17]/90 px-4 py-2 shadow-xl backdrop-blur-md">
        <span className="font-serif text-xl text-[#C59B4B]">{kanji}</span>
        <div>
          <span className="block text-[10px] font-bold text-slate-400">منطقة التركيز</span>
          <h3 className="text-xs font-extrabold text-slate-100">{label}</h3>
        </div>
      </div>

      <svg
        viewBox={activeViewBox}
        className="h-72 w-full cursor-grab transition-all duration-1000 ease-in-out active:cursor-grabbing md:h-96"
      >
        <g fill="#151C28" stroke="#8C6D2D" strokeWidth="1.5" strokeLinejoin="round" opacity="0.9">
          <path d="M 620,80 L 780,70 L 850,140 L 790,220 L 680,210 L 600,140 Z" />
          <path d="M 580,240 L 670,300 L 650,420 L 590,490 L 480,520 L 380,560 L 320,540 L 280,480 L 350,450 L 450,440 L 520,380 Z" />
          <path d="M 270,550 L 340,560 L 310,610 L 250,590 Z" />
          <path d="M 200,590 L 260,600 L 240,680 L 180,660 Z" />
        </g>

        {places.length > 1 ? (
          <path
            d={places.reduce(
              (acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.svgX} ${p.svgY}`,
              '',
            )}
            fill="none"
            stroke="#C59B4B"
            strokeWidth="2"
            strokeDasharray="6,6"
            opacity="0.8"
          />
        ) : null}

        {places.map((place, idx) => {
          const existing = place.googleMapsUrl?.trim();
          const googleMapsUrl =
            existing && existing.includes('google.com')
              ? existing
              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  place.googleSearchQuery || place.name,
                )}`;

          return (
            <g
              key={place.id || idx}
              className="group cursor-pointer"
              onClick={() => window.open(googleMapsUrl, '_blank', 'noopener,noreferrer')}
              onMouseEnter={() => setHoveredPlace(place)}
              onMouseLeave={() => setHoveredPlace(null)}
            >
              <circle
                cx={place.svgX}
                cy={place.svgY}
                r="12"
                fill="#C59B4B"
                opacity="0.25"
                className="animate-ping"
              />
              <circle
                cx={place.svgX}
                cy={place.svgY}
                r="9"
                fill="#C59B4B"
                stroke="#0B0F17"
                strokeWidth="2"
                className="transition-transform group-hover:scale-125"
              />
              <text
                x={place.svgX}
                y={place.svgY + 3.5}
                fill="#0B0F17"
                fontSize="9"
                fontWeight="900"
                textAnchor="middle"
              >
                {idx + 1}
              </text>
            </g>
          );
        })}
      </svg>

      {hoveredPlace ? (
        <div className="absolute right-4 bottom-4 left-4 flex animate-in fade-in items-center justify-between rounded-2xl border border-[#C59B4B]/40 bg-[#151C28]/95 p-3 text-xs shadow-xl duration-200">
          <div>
            <h4 className="font-bold text-slate-100">{hoveredPlace.name}</h4>
            <span className="text-[10px] font-medium text-[#C59B4B]">
              {hoveredPlace.category || 'معلم سياحي'}
            </span>
          </div>
          <span className="rounded-xl bg-[#C59B4B] px-3 py-1.5 text-[10px] font-bold text-slate-950">
            فتح بخرائط جوجل
          </span>
        </div>
      ) : null}
    </div>
  );
}
