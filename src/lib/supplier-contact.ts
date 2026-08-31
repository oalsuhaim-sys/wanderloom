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

const KAKAO_WEB_FALLBACK =
  'https://www.kakaocorp.com/page/service/service/KakaoTalk';

/** WhatsApp / phone digits only */
function cleanContactDigits(phone: string | null | undefined): string {
  return String(phone ?? '').replace(/[^\d+]/g, '');
}

/** LINE / Kakao IDs — keep letters, digits, and common ID separators */
function normalizeMessagingId(raw: string | null | undefined): string {
  return String(raw ?? '')
    .trim()
    .replace(/^@+/, '')
    .replace(/^~+/, '');
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isCustomAppScheme(url: string): boolean {
  return /^(kakaotalk|kakao|line):\/\//i.test(url);
}

function looksLikePhoneNumber(value: string): boolean {
  const digits = value.replace(/[^\d]/g, '');
  return digits.length >= 8 && /^[+]?[\d\s()-]+$/.test(value.trim());
}

async function copyTextSafe(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* clipboard may be blocked */
  }
  return false;
}

/**
 * Trigger a native app URI without opening a blank browser tab.
 * Desktops that lack the app simply no-op; mobile may hand off to the app.
 */
function triggerAppSchemeViaIframe(schemeUrl: string): void {
  if (!schemeUrl || typeof document === 'undefined') return;
  try {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.src = schemeUrl;
    document.body.appendChild(iframe);
    window.setTimeout(() => {
      try {
        iframe.remove();
      } catch {
        /* ignore */
      }
    }, 1000);
  } catch (err) {
    console.warn('[supplier-contact] custom URI iframe fallback:', err);
  }
}

/** Only open real web URLs in a new tab — never kakaotalk:// etc. */
function openWebUrlInNewTab(url: string): void {
  if (!url || typeof window === 'undefined') return;
  if (!isHttpUrl(url)) {
    console.warn('[supplier-contact] refused to window.open non-http URL:', url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function normalizePreferredApp(raw: unknown): SupplierContactApp {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'line') return 'line';
  if (s === 'kakao' || s === 'kakaotalk' || s === 'kakao talk') return 'kakao';
  return 'whatsapp';
}

/**
 * Public https URL for each app (safe for window.open).
 * Kakao native scheme is handled separately via iframe — never returned here.
 */
export function buildSupplierContactUrl(input: ContactUrlInput): string {
  const encodedMsg = encodeURIComponent(input.message);
  const raw = String(input.phone ?? '').trim();

  if (input.app === 'whatsapp') {
    const contact = cleanContactDigits(raw);
    return contact
      ? `https://wa.me/${contact}?text=${encodedMsg}`
      : `https://wa.me/?text=${encodedMsg}`;
  }

  if (input.app === 'line') {
    if (isHttpUrl(raw)) return raw;
    const id = normalizeMessagingId(raw);
    if (id && !looksLikePhoneNumber(id)) {
      return `https://line.me/ti/p/~${encodeURIComponent(id)}`;
    }
    return `https://line.me/R/msg/text/?${encodedMsg}`;
  }

  if (input.app === 'kakao') {
    if (isHttpUrl(raw)) return raw;
    // Ignore raw custom schemes as browser tab targets
    if (isCustomAppScheme(raw)) return KAKAO_WEB_FALLBACK;
    const id = normalizeMessagingId(raw);
    if (id && !looksLikePhoneNumber(id) && /^[a-zA-Z0-9_-]{4,}$/.test(id)) {
      return `https://open.kakao.com/o/${encodeURIComponent(id)}`;
    }
    return KAKAO_WEB_FALLBACK;
  }

  return '';
}

function kakaoNativeScheme(message: string): string {
  return `kakaotalk://send?text=${encodeURIComponent(message)}`;
}

function successMessage(app: SupplierContactApp, copied: boolean): string {
  if (app === 'kakao') {
    return copied
      ? 'تم نسخ رسالة الفندق ومحاولة فتح KakaoTalk!'
      : 'تم محاولة فتح KakaoTalk — انسخ الرسالة يدوياً إن لزم.';
  }
  if (app === 'line') {
    return copied
      ? 'تم نسخ الرسالة وفتح LINE!'
      : 'تم فتح LINE — إن تعذّر النسخ، انسخ الرسالة يدوياً.';
  }
  return copied
    ? 'تم نسخ الرسالة وفتح WhatsApp!'
    : 'تم فتح تطبيق التواصل.';
}

/**
 * Copy message (best-effort), try native app scheme safely, then open https URL only.
 */
export async function openSupplierContact(input: ContactUrlInput): Promise<SupplierContactResult> {
  const webUrl = buildSupplierContactUrl(input);
  if (!webUrl) {
    return { ok: false, error: 'تطبيق التواصل غير مدعوم.' };
  }

  const copied = await copyTextSafe(input.message);

  if (input.app === 'kakao') {
    // 1) Attempt native handoff without a blank tab
    triggerAppSchemeViaIframe(kakaoNativeScheme(input.message));
    // 2) Open only https targets (Open Chat link or Kakao web fallback)
    openWebUrlInNewTab(webUrl);
  } else if (input.app === 'line') {
    openWebUrlInNewTab(webUrl);
  } else {
    openWebUrlInNewTab(webUrl);
  }

  return {
    ok: true,
    mode: copied ? 'copied' : 'opened',
    message: successMessage(input.app, copied),
  };
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
    return 'border-[#25D366]/40 bg-[#128C7E] text-white hover:bg-[#0E7A6D] shadow-sm';
  }
  if (app === 'line') {
    return 'border-[#06C755]/50 bg-[#06C755] text-white hover:bg-[#05B34C] shadow-sm';
  }
  return 'border-[#FEE500]/60 bg-[#FEE500] text-[#191919] hover:bg-[#F5DC00] shadow-sm';
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
  const webUrl = buildSupplierContactUrl({ app, phone: contactRaw, message });
  if (!webUrl) {
    return { ok: false, error: 'تطبيق التواصل غير مدعوم.' };
  }

  void copyTextSafe(message);

  if (app === 'kakao') {
    triggerAppSchemeViaIframe(kakaoNativeScheme(message));
  }
  openWebUrlInNewTab(webUrl);

  return {
    ok: true,
    mode: 'opened',
    message: successMessage(app, true),
  };
}

export async function runSupplierContact(
  app: SupplierContactApp,
  hotel: SupplierContactHotel,
): Promise<SupplierContactResult> {
  const contactRaw = String(hotel.supplier_contact ?? '').trim();
  if (!contactRaw) {
    return { ok: false, error: 'الرجاء إدخال رقم أو معرّف المورد أولاً.' };
  }

  const message = buildSupplierUpdateMessage(hotel);
  return openSupplierContact({ app, phone: contactRaw, message });
}
