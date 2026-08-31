import type { InvoiceType, QuoteLedgerSummary } from '@/lib/crm-invoices';

export type ClientTeaserPendingInvoice = {
  id: string;
  amount: number;
  type: InvoiceType;
  url: string;
};

export type ClientTeaserGroupMember = {
  status: 'pending_interview' | 'approved' | 'rejected' | 'confirmed_seat' | 'waitlisted';
  tripTitle: string | null;
  /** ISO deadline when scarcity threshold applies; null = indefinite hold */
  paymentDeadline?: string | null;
};

export type ClientTeaserPortalData = {
  clientId: string;
  clientName: string;
  tripTitle: string;
  startDate: string | null;
  quoteId: string;
  ledger: QuoteLedgerSummary;
  spotifyUrl: string;
  /** أول فاتورة معلّقة — للتوافق */
  pendingInvoice?: ClientTeaserPendingInvoice | null;
  /** كل الفواتير بانتظار السداد */
  pendingInvoices?: ClientTeaserPendingInvoice[];
  /** بوابة مخصّصة للسداد قبل أول دفعة */
  paymentDueOnly?: boolean;
  /** رابط نموذج DNA — /welcome/client/{clients.id} */
  dnaWelcomeUrl: string;
  onboardingCompleted: boolean;
  /** حالة انضمام رحلة المجموعة عبر group_members */
  groupMember?: ClientTeaserGroupMember | null;
  /** بوابة محدودة لحالة المجموعة قبل اكتمال السداد */
  groupStatusOnly?: boolean;
};

export type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  totalMs: number;
  started: boolean;
};

/** فرق الوقت حتى بداية الرحلة */
export function calculateTripCountdown(
  startDate: string | null | undefined,
  now: Date = new Date(),
): CountdownParts {
  if (!startDate) {
    return { days: 0, hours: 0, minutes: 0, totalMs: 0, started: false };
  }

  const start = new Date(`${String(startDate).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(start.getTime())) {
    return { days: 0, hours: 0, minutes: 0, totalMs: 0, started: false };
  }

  const totalMs = start.getTime() - now.getTime();
  if (totalMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, totalMs: 0, started: true };
  }

  const days = Math.floor(totalMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((totalMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));

  return { days, hours, minutes, totalMs, started: false };
}

export function formatCountdownArabic(parts: CountdownParts): string {
  if (parts.started) return 'رحلتك الاستثنائية قد بدأت ✨';
  return `تبدأ رحلتك الاستثنائية بعد: ${parts.days} أيام ${parts.hours} ساعات`;
}

export const TEASER_CARDS = [
  {
    id: 'coordinates',
    title: 'الإحداثيات',
    titleEn: 'The Coordinates',
    icon: 'compass' as const,
    body: 'محطتك القادمة تخفي سراً... 36.2622° N, 136.9064° E. جهز كاميرتك لمشهد لا يُرى إلا في الحكايات.',
  },
  {
    id: 'vibe',
    title: 'أجواء الرحلة',
    titleEn: 'The Vibe',
    icon: 'headphones' as const,
    body: 'لقد جهزنا لك قائمة موسيقية لترافقك في هذه الرحلة. استمع لها لتعيش الأجواء قبل وصولك.',
    hasSpotify: true,
  },
  {
    id: 'packing',
    title: 'التجهيزات الحسية',
    titleEn: 'Packing List',
    icon: 'suitcase' as const,
    body: 'ستحتاج إلى حذاء مريح للمشي على أحجار عمرها مئات السنين، ومساحة فارغة في حقيبتك لأنك ستعود بكنوز لا تقدر بثمن.',
  },
] as const;

export function resolvePortalSpotifyUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_TRIP_SPOTIFY_URL?.trim();
  if (fromEnv) return fromEnv;
  return 'https://open.spotify.com/';
}
