'use client';

import { useMemo } from 'react';

import RouteMapCard from '@/app/itinerary/_components/route-v2/RouteMapCard';
import { buildCityColors } from '@/app/itinerary/_components/route-v2/route-utils';
import type { QuotationItineraryDay } from '@/lib/interactive-quotation';
import type { PublicItineraryActivity, PublicItineraryDay } from '@/lib/public-itinerary';
import { destinationLabel } from '@/lib/trip-destination-normalize';
import { buildDayMarkersSync } from '@/lib/vip-map-coordinates';

/**
 * The proposal's trip map, drawn exactly like the client itinerary's «الرحلة كاملة» map: the real
 * country outline, each city with its day range, joined in route order. Overview only — stops stay
 * private until booking, so no venue is placed or named.
 */
export default function ProposalRouteMap({
  days,
  destination,
  cities,
}: {
  days: QuotationItineraryDay[];
  destination: string;
  /** Route cities in order (the quote's destinations). */
  cities: string[];
}) {
  const routeDays = useMemo<PublicItineraryDay[]>(() => {
    const fromDays = days
      .map((d, i) => {
        const city = destinationLabel(d.city) || cities[0] || destination;
        const count = Math.max(1, d.stops?.length ?? 0);
        const activities = Array.from({ length: count }, (_, k) => ({
          id: `p-${i}-${k}`,
          title: city,
          place_name: city,
          mapsQuery: city,
          lat: null,
          lng: null,
        })) as unknown as PublicItineraryActivity[];
        return { index: i, title: '', cityLabel: city, tabLabel: '', dateLabel: '', mapsQuery: city, activities } as PublicItineraryDay;
      })
      .filter((d) => !cities.length || cities.includes(d.cityLabel));
    if (fromDays.length) return fromDays.map((d, i) => ({ ...d, index: i }));
    // no days yet: one point per destination city
    return cities.map((city, i) => ({
      index: i,
      title: '',
      cityLabel: city,
      tabLabel: '',
      dateLabel: '',
      mapsQuery: city,
      activities: [{ id: `p-${i}`, title: city, place_name: city, mapsQuery: city, lat: null, lng: null }] as unknown as PublicItineraryActivity[],
    })) as PublicItineraryDay[];
  }, [days, cities, destination]);

  const markersByDay = useMemo(() => routeDays.map((d) => buildDayMarkersSync(d, destination)), [routeDays, destination]);
  const cityColors = useMemo(() => buildCityColors(routeDays, destination), [routeDays, destination]);
  const subtitle = `${days.length || routeDays.length} يوم · ${cities.length} ${cities.length === 1 ? 'مدينة' : cities.length === 2 ? 'مدينتان' : 'مدن'}`;

  return (
    <div className="wl-theme" data-theme="light" dir="rtl">
      <RouteMapCard
        days={routeDays}
        destination={destination}
        selected="all"
        markersByDay={markersByDay}
        cityColors={cityColors}
        selectedStopId={null}
        hideUber
        onSelectDay={() => undefined}
        onSelectStop={() => undefined}
        overviewOnly
        subtitle={subtitle}
        aspectClassName="aspect-[4/5] sm:aspect-[16/10]"
      />
    </div>
  );
}
