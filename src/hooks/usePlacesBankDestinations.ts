'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { PlacesBankDestinations } from '@/lib/places-bank';
import { placesBankToTripDestinations } from '@/lib/places-bank';
import type { TripCountryDef } from '@/lib/trip-destination-data';

const EMPTY: PlacesBankDestinations = {
  countries: [],
  citiesByCountry: {},
};

async function fetchDestinations(): Promise<PlacesBankDestinations> {
  const res = await fetch('/api/places-bank/destinations', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`destinations_http_${res.status}`);
  const json = (await res.json()) as PlacesBankDestinations;
  return {
    countries: Array.isArray(json.countries) ? json.countries : [],
    citiesByCountry:
      json.citiesByCountry && typeof json.citiesByCountry === 'object'
        ? json.citiesByCountry
        : {},
  };
}

/** دول ومدن ديناميكية من بنك الأماكن — مصدر الحقيقة للفلاتر والأزرار */
export function usePlacesBankDestinations() {
  const [data, setData] = useState<PlacesBankDestinations>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchDestinations();
      setData(next);
    } catch (err) {
      console.warn('[usePlacesBankDestinations]', err);
      setData(EMPTY);
      setError(err instanceof Error ? err.message : 'تعذر تحميل وجهات بنك الأماكن');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const tripDestinations: TripCountryDef[] = useMemo(
    () => placesBankToTripDestinations(data),
    [data],
  );

  const citiesForCountry = useCallback(
    (country: string) => data.citiesByCountry[country] ?? [],
    [data.citiesByCountry],
  );

  const citiesForCountries = useCallback(
    (countries: string[]) => {
      if (!countries.length) {
        return [...new Set(Object.values(data.citiesByCountry).flat())].sort((a, b) =>
          a.localeCompare(b, 'ar'),
        );
      }
      const out = new Set<string>();
      for (const country of countries) {
        for (const city of data.citiesByCountry[country] ?? []) out.add(city);
      }
      return [...out].sort((a, b) => a.localeCompare(b, 'ar'));
    },
    [data.citiesByCountry],
  );

  return {
    countries: data.countries,
    citiesByCountry: data.citiesByCountry,
    tripDestinations,
    citiesForCountry,
    citiesForCountries,
    loading,
    error,
    reload,
  };
}
