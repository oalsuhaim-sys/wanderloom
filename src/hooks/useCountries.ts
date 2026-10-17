'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  DEFAULT_COUNTRIES,
  fetchActiveCountries,
  mergeTripDestinationsWithCountries,
  type CountryOption,
} from '@/lib/countries';
import type { TripCountryDef } from '@/lib/trip-destination-data';
import { usePlacesBankDestinations } from '@/hooks/usePlacesBankDestinations';

export function useCountries() {
  const [countries, setCountries] = useState<CountryOption[]>(DEFAULT_COUNTRIES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchActiveCountries();
      setCountries(rows);
    } catch (err) {
      console.warn('[useCountries] load failed:', err);
      setCountries(DEFAULT_COUNTRIES);
      setError(err instanceof Error ? err.message : 'تعذر تحميل قائمة الدول');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { countries, loading, error, reload };
}

/**
 * دول + مدن للنماذج العامة — مصدر الحقيقة: بنك الأماكن (`places`).
 * عند فراغ البنك يُستخدم الدمج الاحتياطي (countries + TRIP_DESTINATIONS).
 */
export function useTripDestinations() {
  const places = usePlacesBankDestinations();
  const { countries, loading: countriesLoading, error: countriesError, reload: reloadCountries } =
    useCountries();

  const tripDestinations = useMemo(() => {
    if (places.tripDestinations.length > 0) return places.tripDestinations;
    return mergeTripDestinationsWithCountries(countries);
  }, [places.tripDestinations, countries]);

  const reload = useCallback(async () => {
    await Promise.all([places.reload(), reloadCountries()]);
  }, [places, reloadCountries]);

  return {
    countries,
    tripDestinations,
    placesCountries: places.countries,
    citiesByCountry: places.citiesByCountry,
    loading: places.loading || countriesLoading,
    error: places.error || countriesError,
    reload,
  };
}

export type { CountryOption, TripCountryDef };
