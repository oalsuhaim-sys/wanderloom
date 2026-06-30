import type { CrmSupplier } from '@/lib/crm-suppliers';

export type SupplierContactApp = 'whatsapp' | 'line' | 'kakao';

/** @alias SupplierContactApp */
export type SupplierPreferredApp = SupplierContactApp;

export type SupplierContactHotel = {
  name: string;
  pnr?: string;
  check_in?: string;
  check_out?: string;
  checkIn?: string;
  checkOut?: string;
  supplier_contact?: string;
};

export type SupplierContactResult =
  | { ok: true; mode: 'opened' | 'copied'; message: string }
  | { ok: false; error: string };

type ContactUrlInput = {
  app: SupplierContactApp;
  phone?: string | null;
  message: string;
};

function cleanContactDigits(phone: string | null | undefined): string {
  return String(phone ?? '').replace(/[^a-zA-Z0-9+]/g, '');
}

export function normalizePreferredApp(raw: unknown): SupplierContactApp {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'line') return 'line';
  if (s === 'kakao' || s === 'kakaotalk' || s === 'kakao talk') return 'kakao';
  return 'whatsapp';
}

export function buildSupplierContactUrl(input: ContactUrlInput): string {
  const encodedMsg = encodeURIComponent(input.message);
  const contact = cleanContactDigits(input.phone);

  if (input.app === 'whatsapp') {
    return contact
      ? `https://wa.me/${contact}?text=${encodedMsg}`
      : `https://wa.me/?text=${encodedMsg}`;
  }
  if (input.app === 'line') {
    return `https://line.me/R/msg/text/?${encodedMsg}`;
  }
  return '';
}

export async function openSupplierContact(input: ContactUrlInput): Promise<void> {
  if (input.app === 'kakao') {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(input.message);
    }
    return;
  }

  const url = buildSupplierContactUrl(input);
  if (url && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export function findSupplierForRequest(
  suppliers: CrmSupplier[],
  request: { supplier_id?: string; supplier_name?: string; title?: string },
): CrmSupplier | undefined {
  if (request.supplier_id) {
    const byId = suppliers.find((s) => String(s.id) === String(request.supplier_id));
    if (byId) return byId;
  }

  const name = String(request.supplier_name || request.title || '').trim();
  if (!name) return undefined;
  return suppliers.find((s) => s.name === name);
}

export function resolveSupplierPreferredApp(
  request: { preferred_app?: string | SupplierContactApp },
  supplier?: CrmSupplier,
): SupplierContactApp {
  if (request.preferred_app) {
    return normalizePreferredApp(request.preferred_app);
  }
  if (supplier?.preferred_app) {
    return normalizePreferredApp(supplier.preferred_app);
  }
  const country = supplier?.country ?? '';
  if (country.includes('كور') || /korea/i.test(country)) return 'kakao';
  if (/japan|اليابان/i.test(country)) return 'line';
  return 'whatsapp';
}

export function supplierContactButtonClass(app: SupplierContactApp): string {
  if (app === 'whatsapp') {
    return 'border-[#163018] bg-[#1e3f20] text-white hover:bg-[#163018] shadow-sm';
  }
  if (app === 'line') {
    return 'border-green-300 bg-green-100 text-green-700 hover:bg-green-200';
  }
  return 'border-[#cda04c]/70 bg-[#cda04c] text-white hover:bg-[#b3893d] shadow-sm';
}

export function supplierContactLabel(app: SupplierContactApp): string {
  if (app === 'whatsapp') return 'WhatsApp';
  if (app === 'line') return 'LINE';
  return 'KakaoTalk';
}

function buildSupplierUpdateMessage(hotel: SupplierContactHotel): string {
  const checkIn = hotel.check_in ?? hotel.checkIn ?? '';
  const checkOut = hotel.check_out ?? hotel.checkOut ?? '';
  return [
    'Hello, this is Wanderloom. Kindly note this booking update:',
    `Hotel: ${hotel.name || '—'}`,
    `PNR: ${hotel.pnr || '—'}`,
    `Check-in: ${checkIn || '—'}`,
    `Check-out: ${checkOut || '—'}`,
  ].join('\n');
}

export function contactSupplier(
  app: SupplierContactApp,
  hotel: SupplierContactHotel,
): SupplierContactResult {
  const contactRaw = String(hotel.supplier_contact ?? '').trim();
  if (!contactRaw) {
    return { ok: false, error: 'الرجاء إدخال رقم أو معرّف المورد أولاً.' };
  }

  const message = buildSupplierUpdateMessage(hotel);
  const contact = cleanContactDigits(contactRaw);

  if (app === 'kakao') {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      return { ok: false, error: 'تعذر نسخ الرسالة إلى الحافظة.' };
    }
    return {
      ok: true,
      mode: 'copied',
      message: 'تم نسخ الرسالة! يمكنك الآن لصقها في KakaoTalk.',
    };
  }

  const url = buildSupplierContactUrl({ app, phone: contact, message });
  if (!url) {
    return { ok: false, error: 'تطبيق التواصل غير مدعوم.' };
  }

  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return { ok: true, mode: 'opened', message: 'تم فتح تطبيق التواصل.' };
}

export async function runSupplierContact(
  app: SupplierContactApp,
  hotel: SupplierContactHotel,
): Promise<SupplierContactResult> {
  if (app === 'kakao') {
    const result = contactSupplier(app, hotel);
    if (!result.ok) return result;
    const message = buildSupplierUpdateMessage(hotel);
    try {
      await navigator.clipboard.writeText(message);
      return result;
    } catch {
      return { ok: false, error: 'تعذر نسخ الرسالة إلى الحافظة.' };
    }
  }
  return contactSupplier(app, hotel);
}
