import { TRIP_DESTINATIONS } from '@/lib/trip-destination-data';
import {
  filterSuppliersForItinerary,
  type CrmSupplier,
} from '@/lib/crm-suppliers';

export { filterSuppliersForItinerary } from '@/lib/crm-suppliers';

export type GeoTripType = 'single' | 'multi';

export type ItineraryGeography = {
  geoTripType: GeoTripType;
  countries: string[];
  cities: string[];
};

function normGeo(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function parseStringArray(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v ?? '').trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) return parseStringArray(parsed);
      } catch {
        /* fall through */
      }
    }
    return trimmed
      .split(/[,،|/·]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function parseGeoTripType(raw: unknown): GeoTripType {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'multi' || s === 'multiple' || s === 'دول متعددة') return 'multi';
  return 'single';
}

export function parseItineraryGeography(
  row?: Record<string, unknown> | null,
  flightDetails?: Record<string, unknown> | null,
): ItineraryGeography {
  const fd = flightDetails ?? {};
  const countries = parseStringArray(
    row?.countries ?? fd.countries ?? fd.trip_countries,
  );
  const cities = parseStringArray(row?.cities ?? fd.cities ?? fd.trip_cities);
  const geoTripType = parseGeoTripType(
    row?.geo_trip_type ??
      row?.destination_trip_type ??
      fd.geo_trip_type ??
      fd.destination_trip_type ??
      fd.trip_type_geo ??
      (countries.length > 1 ? 'multi' : 'single'),
  );

  if (countries.length || cities.length) {
    return { geoTripType, countries, cities };
  }

  const legacyDestination = String(row?.destination ?? fd.flight_to ?? fd.to_city ?? '').trim();
  if (!legacyDestination) {
    return { geoTripType: 'single', countries: [], cities: [] };
  }

  const inferred = inferGeographyFromLabel(legacyDestination);
  return {
    geoTripType: inferred.countries.length > 1 ? 'multi' : 'single',
    countries: inferred.countries,
    cities: inferred.cities.length ? inferred.cities : [legacyDestination],
  };
}

export function inferGeographyFromLabel(label: string): { countries: string[]; cities: string[] } {
  const parts = label
    .split(/[,،|/·]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const countries = new Set<string>();
  const cities = new Set<string>();

  for (const part of parts) {
    const n = normGeo(part);
    let matched = false;
    for (const country of TRIP_DESTINATIONS) {
      if (normGeo(country.labelAr) === n) {
        countries.add(country.labelAr);
        matched = true;
        break;
      }
      for (const city of country.cities) {
        if (normGeo(city.labelAr) === n) {
          cities.add(city.labelAr);
          countries.add(country.labelAr);
          matched = true;
          break;
        }
      }
      if (matched) break;
    }
    if (!matched) cities.add(part);
  }

  return { countries: [...countries], cities: [...cities] };
}

export function buildDestinationSummary(cities: string[], countries: string[] = []): string {
  if (cities.length) return cities.join(' · ');
  if (countries.length) return countries.join(' · ');
  return '';
}

export function cityOptionsForCountries(countryLabels: string[]): string[] {
  if (!countryLabels.length) {
    return TRIP_DESTINATIONS.flatMap((c) => c.cities.map((city) => city.labelAr));
  }
  const normalized = new Set(countryLabels.map(normGeo));
  const out = new Set<string>();
  for (const country of TRIP_DESTINATIONS) {
    if (!normalized.has(normGeo(country.labelAr))) continue;
    for (const city of country.cities) out.add(city.labelAr);
  }
  return [...out].sort((a, b) => a.localeCompare(b, 'ar'));
}

export function filterSuppliersByCountries(
  suppliers: CrmSupplier[],
  countries: string[],
  options?: { destination?: string; cities?: string[] },
): CrmSupplier[] {
  return filterSuppliersForItinerary(suppliers, {
    countries,
    destination: options?.destination,
    cities: options?.cities,
  });
}

export function placeMatchesCities(
  place: { city?: string | null; country?: string | null },
  cities: string[],
): boolean {
  if (!cities.length) return true;
  const placeCity = normGeo(String(place.city ?? ''));
  if (!placeCity) return false;
  return cities.some((city) => {
    const c = normGeo(city);
    return c === placeCity || placeCity.includes(c) || c.includes(placeCity);
  });
}

export function filterPlacesByCities<T extends { city?: string | null; country?: string | null }>(
  places: T[],
  cities: string[],
): T[] {
  if (!cities.length) return places;
  return places.filter((place) => placeMatchesCities(place, cities));
}

export function formatAdminDayLabel(day: { title?: string; city?: string }, index: number): string {
  const base = day.title?.trim() || `اليوم ${index + 1}`;
  const city = day.city?.trim();
  return city ? `${base} - ${city}` : base;
}
