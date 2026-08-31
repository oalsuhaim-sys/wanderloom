'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  DEFAULT_COUNTRIES,
  fetchActiveCountries,
  mergeTripDestinationsWithCountries,
  type CountryOption,
} from '@/lib/countries';
import type { TripCountryDef } from '@/lib/trip-destination-data';

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

/** دول + مدن للنماذج التي تحتاج اختيار مدينة (سجّل رحلتك، المسارات، إلخ) */
export function useTripDestinations() {
  const { countries, loading, error, reload } = useCountries();

  const tripDestinations = useMemo(
    () => mergeTripDestinationsWithCountries(countries),
    [countries],
  );

  return { countries, tripDestinations, loading, error, reload };
}

export type { CountryOption, TripCountryDef };
