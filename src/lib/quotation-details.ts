export type QuotationDetails = {
  enabled: boolean;
  hotelsEstimate: string;
  flightsEstimate: string;
  serviceFee: string;
};

export const emptyQuotationDetails = (): QuotationDetails => ({
  enabled: false,
  hotelsEstimate: '',
  flightsEstimate: '',
  serviceFee: '',
});

export function parseQuotationDetails(raw: unknown): QuotationDetails {
  if (raw == null) return emptyQuotationDetails();

  let data: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return emptyQuotationDetails();
    try {
      data = JSON.parse(trimmed) as unknown;
    } catch {
      return emptyQuotationDetails();
    }
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return emptyQuotationDetails();
  }

  const o = data as Record<string, unknown>;
  return {
    enabled: o.enabled === true,
    hotelsEstimate: String(o.hotels_estimate ?? o.hotelsEstimate ?? '').trim(),
    flightsEstimate: String(o.flights_estimate ?? o.flightsEstimate ?? '').trim(),
    serviceFee: String(o.service_fee ?? o.serviceFee ?? '').trim(),
  };
}

export function serializeQuotationDetails(q: QuotationDetails): Record<string, unknown> {
  return {
    enabled: q.enabled,
    hotels_estimate: q.hotelsEstimate.trim() || null,
    flights_estimate: q.flightsEstimate.trim() || null,
    service_fee: q.serviceFee.trim() || null,
  };
}

export function quotationTotalEstimate(q: QuotationDetails): number {
  const hotels = Number(q.hotelsEstimate.replace(/,/g, '')) || 0;
  const flights = Number(q.flightsEstimate.replace(/,/g, '')) || 0;
  const fee = Number(q.serviceFee.replace(/,/g, '')) || 0;
  return hotels + flights + fee;
}
