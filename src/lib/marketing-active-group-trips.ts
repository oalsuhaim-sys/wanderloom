/**
 * Active group trips for marketing campaigns (open seats / upcoming).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  resolveConfirmedSeatCount,
  resolveGroupSeatStatus,
} from '@/lib/group-trip-card-ui';
import { parseGroupTripStoredDates } from '@/lib/group-trip-dates';
import { siteOrigin } from '@/lib/bank-checkout';

export type MarketingActiveGroupTrip = {
  id: string;
  title: string;
  titleEn: string;
  destination: string;
  datesLabel: string;
  startDate: string | null;
  endDate: string | null;
  price: string;
  highlights: string[];
  description: string;
  maxSeats: number;
  bookedSeats: number;
  openSeats: number | null;
  bookingUrl: string;
  badge: string;
};

/** Safe columns — never select confirmed_seats_count (not in all schemas). */
export const GROUP_TRIPS_MARKETING_SELECT =
  'id, title_ar, title_en, description_ar, description_en, badge_ar, badge_en, dates_ar, dates_en, price, includes_ar, includes_en, is_active, max_seats, booked_seats, registered_client_ids, sort_order';

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function splitHighlights(raw: string): string[] {
  return String(raw ?? '')
    .split(/[\n•·|,،]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);
}

export function mapGroupTripToMarketingTrip(
  row: Record<string, unknown>,
  origin?: string,
): MarketingActiveGroupTrip | null {
  const id = String(row.id ?? '').trim();
  if (!id) return null;

  const titleAr = String(row.title_ar ?? row.title ?? '').trim();
  const titleEn = String(row.title_en ?? '').trim();
  const title = titleAr || titleEn || `رحلة #${id}`;
  const isActive = row.is_active !== false && row.is_active !== 0;

  const dates = parseGroupTripStoredDates(
    row.dates_ar != null ? String(row.dates_ar) : null,
    row.dates_en != null ? String(row.dates_en) : null,
  );
  const endIso = dates.to || null;
  const startIso = dates.from || null;
  const booked = resolveConfirmedSeatCount({
    booked_seats: row.booked_seats as number | null,
    registered_client_ids: row.registered_client_ids as Array<string | number> | null,
  });
  const capacity = Math.max(0, Math.trunc(Number(row.max_seats) || 0));
  const seatStatus = resolveGroupSeatStatus({
    isActive,
    booked,
    capacity,
    endIso,
  });

  // Marketing targets open / upcoming trips with seats (or unlimited capacity)
  if (seatStatus === 'ended' || seatStatus === 'hidden' || seatStatus === 'full') {
    return null;
  }
  if (!isActive) return null;

  const includes = String(row.includes_ar ?? row.includes_en ?? '').trim();
  const description = String(row.description_ar ?? row.description_en ?? '').trim();
  const openSeats = capacity > 0 ? Math.max(0, capacity - booked) : null;
  const base = (origin || siteOrigin()).replace(/\/$/, '');

  return {
    id,
    title,
    titleEn,
    destination: titleEn || titleAr || title,
    datesLabel:
      String(row.dates_ar ?? '').trim() ||
      String(row.dates_en ?? '').trim() ||
      (startIso && endIso ? `${startIso} → ${endIso}` : ''),
    startDate: startIso,
    endDate: endIso,
    price: String(row.price ?? '').trim(),
    highlights: splitHighlights(includes || description),
    description,
    maxSeats: capacity,
    bookedSeats: booked,
    openSeats,
    bookingUrl: `${base}/group-onboarding?tripId=${encodeURIComponent(id)}`,
    badge: String(row.badge_ar ?? row.badge_en ?? '').trim(),
  };
}

export async function fetchActiveMarketingGroupTrips(
  client: SupabaseClient,
  opts?: { origin?: string; limit?: number },
): Promise<MarketingActiveGroupTrip[]> {
  const limit = Math.min(50, Math.max(1, opts?.limit ?? 24));
  const { data, error } = await client
    .from('group_trips')
    .select(GROUP_TRIPS_MARKETING_SELECT)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(80);

  if (error) {
    throw new Error(error.message || 'تعذر جلب الرحلات الجماعية.');
  }

  const trips = ((data ?? []) as Record<string, unknown>[])
    .map((row) => mapGroupTripToMarketingTrip(asRecord(row), opts?.origin))
    .filter((t): t is MarketingActiveGroupTrip => t != null);

  return trips.slice(0, limit);
}
