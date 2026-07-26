/** صور بانر سينمائية لبطاقات القروبات في الـ CRM */

const BANNERS: Array<{ keys: string[]; url: string }> = [
  {
    keys: ['japan', 'tokyo', 'kyoto', 'osaka', 'اليابان', 'طوكيو', 'كيوتو', 'اوساكا', 'أوساكا'],
    url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=900&auto=format&fit=crop',
  },
  {
    keys: ['korea', 'seoul', 'كوريا', 'سيول'],
    url: 'https://images.unsplash.com/photo-1517154429939-022a2f2b3b0e?q=80&w=900&auto=format&fit=crop',
  },
  {
    keys: ['france', 'paris', 'فرنسا', 'باريس'],
    url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=900&auto=format&fit=crop',
  },
  {
    keys: ['italy', 'rome', 'milan', 'venice', 'إيطاليا', 'ايطاليا', 'روما'],
    url: 'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?q=80&w=900&auto=format&fit=crop',
  },
  {
    keys: ['spain', 'barcelona', 'madrid', 'إسبانيا', 'اسبانيا', 'برشلونة'],
    url: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?q=80&w=900&auto=format&fit=crop',
  },
  {
    keys: ['maldives', 'المالديف'],
    url: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?q=80&w=900&auto=format&fit=crop',
  },
  {
    keys: ['turkey', 'istanbul', 'تركيا', 'اسطنبول', 'إسطنبول'],
    url: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?q=80&w=900&auto=format&fit=crop',
  },
  {
    keys: ['swiss', 'switzerland', 'سويسرا', 'جبال'],
    url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=900&auto=format&fit=crop',
  },
];

const DEFAULT_BANNER =
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=900&auto=format&fit=crop';

export function resolveGroupTripBannerUrl(titleAr: string, titleEn?: string | null): string {
  const hay = `${titleAr} ${titleEn ?? ''}`.toLowerCase();
  for (const row of BANNERS) {
    if (row.keys.some((k) => hay.includes(k.toLowerCase()))) return row.url;
  }
  return DEFAULT_BANNER;
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
      return { label: 'متاح للتسجيل', className: 'bg-emerald-500 text-white' };
    case 'full':
      return { label: 'مكتمل', className: 'bg-red-500 text-white' };
    case 'ended':
      return { label: 'منتهي', className: 'bg-gray-500 text-white' };
    case 'hidden':
      return { label: 'مخفي', className: 'bg-slate-600 text-white' };
  }
}
