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
