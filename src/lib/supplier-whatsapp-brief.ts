import { parseTravelDnaForm } from '@/lib/clientsTravelDna';

export type SupplierBriefClientContext = {
  clientName: string;
  interests: string[];
  dna: ReturnType<typeof parseTravelDnaForm>;
  hotelPreferences?: string;
  dietary?: string;
  secretNotes?: string;
  tripDateFrom?: string;
  tripDateTo?: string;
  destination?: string;
};

export function buildSupplierBriefClientContext(input: {
  clientRow?: Record<string, unknown> | null;
  interests?: unknown;
  tripDateFrom?: string;
  tripDateTo?: string;
  destination?: string;
  fallbackName?: string;
}): SupplierBriefClientContext {
  const row = input.clientRow ?? {};
  const dna = parseTravelDnaForm(row.travel_dna);
  const rawInterests = input.interests ?? [];
  const interests = Array.isArray(rawInterests)
    ? rawInterests.map((x) => String(x).trim()).filter(Boolean)
    : [];

  const fullName = String(row.name ?? input.fallbackName ?? '').trim();

  return {
    clientName: fullName || 'VIP Client',
    interests,
    dna,
    hotelPreferences: String(row.hotel_preferences ?? '').trim(),
    dietary: String(row.dietary ?? '').trim(),
    secretNotes: String(row.secret_notes ?? dna.secret_notes ?? '').trim(),
    tripDateFrom: input.tripDateFrom?.trim(),
    tripDateTo: input.tripDateTo?.trim(),
    destination: input.destination?.trim(),
  };
}

function formatPreferencesBlock(ctx: SupplierBriefClientContext): string {
  const lines: string[] = [];

  if (ctx.dna.drink_coffee.trim()) lines.push(`Coffee: ${ctx.dna.drink_coffee.trim()}`);
  if (ctx.dna.hotel_style.trim()) lines.push(`Room / pillows: ${ctx.dna.hotel_style.trim()}`);
  if (ctx.hotelPreferences) lines.push(`Hotel notes: ${ctx.hotelPreferences}`);
  if (ctx.dna.preferred_seat.trim()) lines.push(`Seat preference: ${ctx.dna.preferred_seat.trim()}`);
  if (ctx.dna.food_allergies.trim()) lines.push(`Food allergies: ${ctx.dna.food_allergies.trim()}`);
  if (ctx.dietary) lines.push(`Dietary: ${ctx.dietary}`);
  if (ctx.interests.length) lines.push(`Interests: ${ctx.interests.join(', ')}`);
  if (ctx.secretNotes) lines.push(`VIP notes: ${ctx.secretNotes}`);

  return lines.length ? lines.map((l) => `• ${l}`).join('\n') : '';
}

function formatDateLabel(iso?: string): string {
  if (!iso?.trim()) return 'TBC';
  const d = new Date(iso.trim());
  if (Number.isNaN(d.getTime())) return iso.trim();
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function buildHotelSupplierBrief(
  ctx: SupplierBriefClientContext,
  hotel: { name: string; checkIn?: string; checkOut?: string },
): string {
  const arrival = formatDateLabel(hotel.checkIn || ctx.tripDateFrom);
  const checkout = hotel.checkOut ? formatDateLabel(hotel.checkOut) : '';
  const prefs = formatPreferencesBlock(ctx);
  const property = hotel.name.trim() || ctx.destination || 'your property';

  return [
    'Hello, this is Wanderloom VIP Concierge.',
    '',
    `We have our VIP client ${ctx.clientName} arriving on ${arrival}.`,
    `Property: ${property}.`,
    checkout ? `Check-out: ${checkout}.` : '',
    prefs
      ? `Please ensure the following preferences are met:\n${prefs}`
      : 'Please prepare a VIP welcome in line with our premium standards.',
    '',
    'Thank you.',
    '— Wanderloom VIP',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildActivitySupplierBrief(
  ctx: SupplierBriefClientContext,
  activity: {
    name: string;
    category?: string;
    city?: string;
    dayTitle?: string;
    serviceDate?: string;
  },
): string {
  const prefs = formatPreferencesBlock(ctx);
  const when = formatDateLabel(activity.serviceDate || ctx.tripDateFrom);
  const label = activity.name.trim() || 'scheduled experience';
  const meta = [activity.category, activity.city, activity.dayTitle].filter(Boolean).join(' · ');

  return [
    'Hello, this is Wanderloom VIP Concierge.',
    '',
    `We are confirming arrangements for our VIP client ${ctx.clientName}.`,
    `Service: ${label}${meta ? ` (${meta})` : ''}.`,
    `Date: ${when}.`,
    prefs
      ? `Client preferences:\n${prefs}`
      : 'Please deliver our usual VIP standard of service.',
    '',
    'Thank you.',
    '— Wanderloom VIP',
  ].join('\n');
}

export function buildDriverSupplierBrief(
  ctx: SupplierBriefClientContext,
  segment: {
    fromLabel: string;
    toLabel: string;
    mode?: string;
    duration?: string;
    serviceDate?: string;
  },
): string {
  const prefs = formatPreferencesBlock(ctx);
  const when = formatDateLabel(segment.serviceDate || ctx.tripDateFrom);
  const mode = segment.mode?.trim() || 'private car';

  return [
    'Hello, this is Wanderloom VIP Concierge.',
    '',
    `Transfer request for VIP client ${ctx.clientName}.`,
    `Date: ${when}.`,
    `Route: ${segment.fromLabel} → ${segment.toLabel}.`,
    `Mode: ${mode}${segment.duration ? ` (${segment.duration})` : ''}.`,
    prefs ? `Client notes:\n${prefs}` : '',
    '',
    'Please confirm vehicle readiness and chauffeur briefing.',
    '',
    'Thank you.',
    '— Wanderloom VIP',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildSupplierWhatsAppUrl(message: string, phoneDigits?: string | null): string {
  const encoded = encodeURIComponent(message);
  const digits = phoneDigits?.replace(/\D/g, '') ?? '';
  if (digits.length >= 8) return `https://wa.me/${digits}?text=${encoded}`;
  return `https://wa.me/?text=${encoded}`;
}

export function openSupplierWhatsApp(message: string, phoneDigits?: string | null): void {
  window.open(buildSupplierWhatsAppUrl(message, phoneDigits), '_blank', 'noopener,noreferrer');
}
