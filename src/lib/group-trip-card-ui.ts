import { resolveDestinationCoverImage } from '@/lib/destination-cover-image';

/** صور بانر سينمائية لبطاقات القروبات في الـ CRM */
export function resolveGroupTripBannerUrl(titleAr: string, titleEn?: string | null): string {
  return resolveDestinationCoverImage(`${titleAr} ${titleEn ?? ''}`, { width: 900 });
}

export function parseGroupTripPriceNumber(raw: string | null | undefined): number {
  const digits = String(raw ?? '').replace(/[^\d.]/g, '');
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Prefer live confirmed member count; fall back to booked_seats / registered ids. */
export function resolveConfirmedSeatCount(trip: {
  confirmed_seats_count?: number | null;
  booked_seats?: number | null;
  registered_client_ids?: Array<string | number> | null;
}): number {
  if (
    trip.confirmed_seats_count != null &&
    Number.isFinite(Number(trip.confirmed_seats_count))
  ) {
    return Math.max(0, Math.trunc(Number(trip.confirmed_seats_count)));
  }
  const fromRegistered = Array.isArray(trip.registered_client_ids)
    ? trip.registered_client_ids.length
    : 0;
  const fromBooked = Number(trip.booked_seats);
  if (Number.isFinite(fromBooked)) {
    return Math.max(0, Math.trunc(Math.max(fromBooked, fromRegistered)));
  }
  return Math.max(0, fromRegistered);
}

export function formatSeatRatio(confirmed: number, capacity: number): string {
  if (capacity > 0) return `${confirmed} / ${capacity}`;
  return `${confirmed} / —`;
}

export type GroupSeatStatus = 'open' | 'full' | 'ended' | 'hidden';

export function resolveGroupSeatStatus(input: {
  isActive: boolean;
  booked: number;
  capacity: number;
  endIso?: string | null;
}): GroupSeatStatus {
  if (input.endIso) {
    const end = new Date(`${input.endIso}T23:59:59`);
    if (!Number.isNaN(end.getTime()) && end.getTime() < Date.now()) {
      return 'ended';
    }
  }
  if (!input.isActive) return 'hidden';
  if (input.capacity > 0 && input.booked >= input.capacity) return 'full';
  return 'open';
}

export function groupSeatStatusBadge(status: GroupSeatStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case 'open':
      return {
        label: 'متاح للتسجيل',
        className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
      };
    case 'full':
      return {
        label: 'مكتمل',
        className: 'bg-rose-50 text-rose-700 ring-rose-600/20',
      };
    case 'ended':
      return {
        label: 'منتهي',
        className: 'bg-slate-50 text-slate-600 ring-slate-600/15',
      };
    case 'hidden':
      return {
        label: 'مخفي',
        className: 'bg-slate-50 text-slate-500 ring-slate-600/10',
      };
  }
}
