const SAUDI_E164 = /^9665\d{8}$/;

export const SAUDI_PHONE_ERROR =
  'يرجى إدخال رقم جوال سعودي صحيح (مثال: 0512345678 أو 966512345678)';

export const INTL_PHONE_ERROR =
  'يرجى إدخال رقم واتساب صحيح بعد اختيار مفتاح الدولة';

export const WHATSAPP_INCOMPLETE_ERROR =
  'يرجى إكمال رقم الواتساب بالشكل الصحيح قبل الإرسال.';

export type WhatsAppCountry = {
  code: string;
  flag: string;
  country: string;
  digits: number;
  /** أول رقم محلي مطلوب، مثل جوال السعودية الذي يبدأ بـ 5. */
  localPrefix?: string;
};

export const WHATSAPP_COUNTRIES: WhatsAppCountry[] = [
  { code: '+966', flag: '🇸🇦', country: 'السعودية', digits: 9, localPrefix: '5' },
  { code: '+971', flag: '🇦🇪', country: 'الإمارات', digits: 9 },
  { code: '+965', flag: '🇰🇼', country: 'الكويت', digits: 8 },
  { code: '+974', flag: '🇶🇦', country: 'قطر', digits: 8 },
  { code: '+968', flag: '🇴🇲', country: 'عُمان', digits: 8 },
  { code: '+973', flag: '🇧🇭', country: 'البحرين', digits: 8 },
  { code: '+20', flag: '🇪🇬', country: 'مصر', digits: 10 },
  { code: '+962', flag: '🇯🇴', country: 'الأردن', digits: 9 },
];

export function whatsAppCountryDigits(country: WhatsAppCountry): string {
  return country.code.replace('+', '');
}

export function isWhatsAppLocalValid(country: WhatsAppCountry, local: string): boolean {
  if (local.length !== country.digits) return false;
  if (country.localPrefix && !local.startsWith(country.localPrefix)) return false;
  return true;
}

export function whatsAppLocalError(
  country: WhatsAppCountry,
  local: string,
  required: boolean,
): string {
  if (local.length === 0) return required ? 'رقم الواتساب إجباري' : '';
  if (local.length !== country.digits) {
    return `يجب أن يتكون الرقم المحلي من ${country.digits} أرقام بعد اختيار مفتاح الدولة`;
  }
  if (country.localPrefix && !local.startsWith(country.localPrefix)) {
    return 'رقم الجوال السعودي يبدأ بالرقم 5';
  }
  return '';
}

export function composeWhatsAppNumber(country: WhatsAppCountry, local: string): string {
  return `${whatsAppCountryDigits(country)}${local}`;
}

export function splitWhatsAppNumber(fullNumber: string): {
  country: WhatsAppCountry;
  local: string;
} {
  const digits = digitsOnlyPhone(fullNumber).replace(/^00/, '');
  const sorted = [...WHATSAPP_COUNTRIES].sort(
    (a, b) => whatsAppCountryDigits(b).length - whatsAppCountryDigits(a).length,
  );
  for (const country of sorted) {
    const prefix = whatsAppCountryDigits(country);
    if (digits.startsWith(prefix)) {
      return { country, local: digits.slice(prefix.length) };
    }
  }
  return { country: WHATSAPP_COUNTRIES[0], local: digits };
}

function toAsciiDigits(raw: string): string {
  return String(raw ?? '')
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** Strip everything except digits (Arabic-Indic numerals converted first). */
export function digitsOnlyPhone(phoneInput: string): string {
  return toAsciiDigits(phoneInput).replace(/\D/g, '');
}

/**
 * Convert local Saudi / +00 prefixes into E.164 digits without validation.
 * 05XXXXXXXX → 9665XXXXXXXX · 5XXXXXXXX → 9665XXXXXXXX · 00966… → 966…
 */
export function sanitizePhoneDigits(phoneInput: string): string {
  let cleaned = digitsOnlyPhone(phoneInput);
  if (cleaned.startsWith('00')) cleaned = cleaned.slice(2);

  if (cleaned.startsWith('05') && cleaned.length === 10) {
    cleaned = `966${cleaned.substring(1)}`;
  } else if (cleaned.startsWith('5') && cleaned.length === 9) {
    cleaned = `966${cleaned}`;
  }

  return cleaned;
}

export type PhoneValidationResult = {
  isValid: boolean;
  formattedPhone: string;
  error?: string;
};

/**
 * Validate + format for public registration.
 * Converts 05XXXXXXXX / 5XXXXXXXX → 9665XXXXXXXX.
 * Accepts only exactly 12 digits starting with 9665.
 */
export function validateAndFormatSaudiPhone(phoneInput: string): PhoneValidationResult {
  const cleaned = sanitizePhoneDigits(phoneInput);

  if (cleaned.length === 12 && cleaned.startsWith('9665') && SAUDI_E164.test(cleaned)) {
    return { isValid: true, formattedPhone: cleaned };
  }

  return {
    isValid: false,
    formattedPhone: cleaned,
    error: SAUDI_PHONE_ERROR,
  };
}

function matchWhatsAppCountryNumber(digits: string): string | null {
  const sorted = [...WHATSAPP_COUNTRIES].sort(
    (a, b) => whatsAppCountryDigits(b).length - whatsAppCountryDigits(a).length,
  );
  for (const country of sorted) {
    const prefix = whatsAppCountryDigits(country);
    if (!digits.startsWith(prefix)) continue;
    const local = digits.slice(prefix.length);
    if (isWhatsAppLocalValid(country, local)) return digits;
    return null;
  }
  return null;
}

export function requireValidPhone(phoneInput: string): PhoneValidationResult {
  const rawDigits = digitsOnlyPhone(phoneInput);
  const digits = rawDigits.startsWith('00') ? rawDigits.slice(2) : rawDigits;
  const international = matchWhatsAppCountryNumber(digits);
  if (international) {
    return { isValid: true, formattedPhone: international };
  }

  const result = validateAndFormatSaudiPhone(phoneInput);
  if (
    result.isValid &&
    result.formattedPhone.length === 12 &&
    result.formattedPhone.startsWith('9665')
  ) {
    return result;
  }

  const knownPrefix = [...WHATSAPP_COUNTRIES]
    .sort((a, b) => whatsAppCountryDigits(b).length - whatsAppCountryDigits(a).length)
    .find((country) => digits.startsWith(whatsAppCountryDigits(country)));

  const prefixError = knownPrefix
    ? whatsAppLocalError(knownPrefix, digits.slice(whatsAppCountryDigits(knownPrefix).length), true)
    : '';

  return {
    isValid: false,
    formattedPhone: result.formattedPhone || digits,
    error: prefixError || result.error || INTL_PHONE_ERROR,
  };
}
