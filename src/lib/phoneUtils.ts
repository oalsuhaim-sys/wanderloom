const SAUDI_E164 = /^9665\d{8}$/;
const INTL_E164 = /^[1-9]\d{9,14}$/;

export const SAUDI_PHONE_ERROR =
  'يرجى إدخال رقم جوال سعودي صحيح (مثال: 0512345678 أو 966512345678)';

export const INTL_PHONE_ERROR =
  'يرجى إدخال رقم جوال صالح بالصيغة الدولية (مثال: 0512345678 أو +966512345678)';

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

function looksSaudiLocalOrIntl(cleaned: string): boolean {
  return (
    cleaned.startsWith('966') ||
    cleaned.startsWith('05') ||
    (cleaned.startsWith('5') && cleaned.length <= 12)
  );
}

export type PhoneValidationResult = {
  isValid: boolean;
  formattedPhone: string;
  error?: string;
};

/**
 * Validate + format for public registration.
 * Saudi: 05XXXXXXXX / 5XXXXXXXX / 9665XXXXXXXX → 9665XXXXXXXX (12 digits).
 * Other countries: E.164 digits, 10–15 long, no leading 0.
 */
export function validateAndFormatSaudiPhone(phoneInput: string): PhoneValidationResult {
  let cleaned = digitsOnlyPhone(phoneInput);
  if (cleaned.startsWith('00')) cleaned = cleaned.slice(2);

  if (cleaned.startsWith('05') && cleaned.length === 10) {
    cleaned = `966${cleaned.substring(1)}`;
  } else if (cleaned.startsWith('5') && cleaned.length === 9) {
    cleaned = `966${cleaned}`;
  }

  if (SAUDI_E164.test(cleaned)) {
    return { isValid: true, formattedPhone: cleaned };
  }

  if (looksSaudiLocalOrIntl(cleaned) || cleaned.startsWith('966')) {
    return {
      isValid: false,
      formattedPhone: cleaned,
      error: SAUDI_PHONE_ERROR,
    };
  }

  if (INTL_E164.test(cleaned)) {
    return { isValid: true, formattedPhone: cleaned };
  }

  return {
    isValid: false,
    formattedPhone: cleaned,
    error: INTL_PHONE_ERROR,
  };
}

export function requireValidPhone(phoneInput: string): PhoneValidationResult {
  const result = validateAndFormatSaudiPhone(phoneInput);
  if (!result.isValid || !result.formattedPhone) {
    return {
      isValid: false,
      formattedPhone: result.formattedPhone,
      error: result.error ?? INTL_PHONE_ERROR,
    };
  }
  return result;
}
