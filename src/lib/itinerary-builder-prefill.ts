import {
  formatDestinationsLabel,
  normalizeQuotationId,
  type QuotationRow,
} from '@/lib/crm-quotations';
import { inferGeographyFromLabel, type GeoTripType } from '@/lib/itinerary-geography';

export type ItineraryBuilderPrefillInput = {
  clientId?: string | number | null;
  quoteId?: string | number | null;
  tripTitle?: string;
  destination?: string;
  destinations?: string | string[];
  startDate?: string | null;
  endDate?: string | null;
  clientName?: string;
  from?: 'lead' | 'quote' | 'client';
};

export type ItineraryBuilderPrefill = {
  hasAny: boolean;
  clientId: string;
  quoteId: string;
  tripTitle: string;
  destinations: string[];
  startDate: string;
  endDate: string;
  clientName: string;
  from: string;
};

export function parseDestinationPrefill(raw: string): string[] {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed || trimmed === '—') return [];
  return trimmed
    .split(/\s·\s|,|،/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function geographyFromDestinationLabels(labels: string[]): {
  geoTripType: GeoTripType;
  countries: string[];
  cities: string[];
} {
  if (!labels.length) {
    return { geoTripType: 'single', countries: [], cities: [] };
  }
  const inferred = inferGeographyFromLabel(labels.join('، '));
  const countries = inferred.countries;
  const cities = inferred.cities.length ? inferred.cities : labels;
  return {
    geoTripType: countries.length > 1 ? 'multi' : 'single',
    countries,
    cities,
  };
}

function firstSearchParam(searchParams: URLSearchParams, ...keys: string[]): string {
  for (const key of keys) {
    const value = String(searchParams.get(key) ?? '').trim();
    if (value) return value;
  }
  return '';
}

export function parseItineraryBuilderPrefill(
  searchParams: URLSearchParams,
): ItineraryBuilderPrefill {
  const clientId = normalizeQuotationId(
    searchParams.get('clientId') ?? searchParams.get('client_id') ?? '',
  );
  const quoteId = normalizeQuotationId(
    searchParams.get('quoteId') ?? searchParams.get('quote_id') ?? searchParams.get('edit'),
  );
  const tripTitle = firstSearchParam(searchParams, 'tripTitle', 'title');
  const destinationRaw = firstSearchParam(searchParams, 'destinations', 'destination');
  const destinations = parseDestinationPrefill(destinationRaw);
  const startDate = firstSearchParam(searchParams, 'startDate', 'start_date').slice(0, 10);
  const endDate = firstSearchParam(searchParams, 'endDate', 'end_date').slice(0, 10);
  const clientName = firstSearchParam(searchParams, 'clientName', 'client_name');
  const from = firstSearchParam(searchParams, 'from');

  const hasAny = Boolean(
    clientId ||
      quoteId ||
      tripTitle ||
      destinations.length ||
      startDate ||
      endDate ||
      clientName,
  );

  return {
    hasAny,
    clientId,
    quoteId,
    tripTitle,
    destinations,
    startDate,
    endDate,
    clientName,
    from,
  };
}

export function buildItineraryBuilderPath(input: ItineraryBuilderPrefillInput): string {
  const params = new URLSearchParams();

  const cid =
    input.clientId != null && String(input.clientId).trim() !== ''
      ? normalizeQuotationId(input.clientId)
      : '';
  if (cid) {
    params.set('clientId', cid);
    params.set('client_id', cid);
  }

  const qid =
    input.quoteId != null && String(input.quoteId).trim() !== ''
      ? normalizeQuotationId(input.quoteId)
      : '';
  if (qid) {
    params.set('quoteId', qid);
    params.set('quote_id', qid);
  }

  const tripTitle = String(input.tripTitle ?? '').trim();
  if (tripTitle) {
    params.set('tripTitle', tripTitle);
    params.set('title', tripTitle);
  }

  let destination = '';
  if (Array.isArray(input.destinations)) {
    destination = input.destinations.filter(Boolean).join(' · ');
  } else {
    destination = String(input.destinations ?? input.destination ?? '').trim();
  }
  if (destination && destination !== '—') {
    params.set('destinations', destination);
    params.set('destination', destination);
  }

  const startDate = String(input.startDate ?? '').trim().slice(0, 10);
  if (startDate) {
    params.set('startDate', startDate);
    params.set('start_date', startDate);
  }

  const endDate = String(input.endDate ?? '').trim().slice(0, 10);
  if (endDate) {
    params.set('endDate', endDate);
    params.set('end_date', endDate);
  }

  const clientName = String(input.clientName ?? '').trim();
  if (clientName) {
    params.set('clientName', clientName);
    params.set('client_name', clientName);
  }

  if (input.from) params.set('from', input.from);

  const qs = params.toString();
  return qs ? `/crm/itineraries/builder?${qs}` : '/crm/itineraries/builder';
}

export function buildItineraryBuilderPathFromQuotation(
  row: Pick<
    QuotationRow,
    'id' | 'client_id' | 'title' | 'destinations' | 'start_date' | 'end_date'
  >,
): string {
  return buildItineraryBuilderPath({
    from: 'quote',
    quoteId: row.id,
    clientId: row.client_id,
    tripTitle: row.title,
    destinations: formatDestinationsLabel(row.destinations),
    startDate: row.start_date,
    endDate: row.end_date,
  });
}
