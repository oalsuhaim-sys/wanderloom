'use client';

import { useEffect, useRef, useState } from 'react';

import {
  WHATSAPP_COUNTRIES,
  composeWhatsAppNumber,
  isWhatsAppLocalValid,
  splitWhatsAppNumber,
  whatsAppLocalError,
  type WhatsAppCountry,
} from '@/lib/phoneUtils';

type WhatsAppInputProps = {
  /** الرقم الكامل بدون علامة +، مثل 9665xxxxxxxx */
  value?: string;
  onChange: (fullNumber: string, isValid: boolean) => void;
  required?: boolean;
  /** يكتب الرقم الكامل في النموذج عند الإرسال */
  name?: string;
  hideLabel?: boolean;
  /**
   * Zero-Wait onboarding — guess the country key from the visitor's time zone / locale on
   * first render and switch it automatically when a full international number is typed or
   * pasted (+971…, 00965…, 9665…). Off by default so other forms keep their behaviour.
   */
  autoDetectCountry?: boolean;
};

const TIMEZONE_COUNTRY_CODE: Record<string, string> = {
  'Asia/Riyadh': '+966',
  'Asia/Dubai': '+971',
  'Asia/Kuwait': '+965',
  'Asia/Qatar': '+974',
  'Asia/Muscat': '+968',
  'Asia/Bahrain': '+973',
  'Africa/Cairo': '+20',
  'Asia/Amman': '+962',
};

const REGION_COUNTRY_CODE: Record<string, string> = {
  SA: '+966',
  AE: '+971',
  KW: '+965',
  QA: '+974',
  OM: '+968',
  BH: '+973',
  EG: '+20',
  JO: '+962',
};

function guessVisitorCountry(): WhatsAppCountry | null {
  if (typeof window === 'undefined') return null;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const byTz = TIMEZONE_COUNTRY_CODE[tz];
    if (byTz) return WHATSAPP_COUNTRIES.find((c) => c.code === byTz) ?? null;
  } catch {
    /* ignore */
  }
  for (const lang of navigator.languages ?? [navigator.language]) {
    const region = String(lang ?? '').split('-')[1]?.toUpperCase();
    const code = region ? REGION_COUNTRY_CODE[region] : undefined;
    if (code) return WHATSAPP_COUNTRIES.find((c) => c.code === code) ?? null;
  }
  return null;
}

/** Detects a pasted/typed international number and returns its country + local part. */
function detectInternationalNumber(raw: string, current: WhatsAppCountry): { country: WhatsAppCountry; local: string } | null {
  const trimmed = raw.trim();
  const digits = raw.replace(/\D/g, '');
  const looksInternational = trimmed.startsWith('+') || digits.startsWith('00') || digits.length > current.digits;
  if (!looksInternational) return null;
  const normalized = digits.replace(/^00/, '');
  const sorted = [...WHATSAPP_COUNTRIES].sort((a, b) => b.code.length - a.code.length);
  for (const country of sorted) {
    const prefix = country.code.replace('+', '');
    if (normalized.startsWith(prefix)) {
      let local = normalized.slice(prefix.length);
      if (local.startsWith('0')) local = local.slice(1);
      return { country, local: local.slice(0, country.digits) };
    }
  }
  return null;
}

export function WhatsAppInput({
  value = '',
  onChange,
  required = true,
  name,
  hideLabel = false,
  autoDetectCountry = false,
}: WhatsAppInputProps) {
  const initial = splitWhatsAppNumber(value);
  const [selectedCountry, setSelectedCountry] = useState<WhatsAppCountry>(initial.country);
  const [phoneNumber, setPhoneNumber] = useState(initial.local);
  const [error, setError] = useState('');
  const emittedRef = useRef(value);
  const [autoDetected, setAutoDetected] = useState(false);

  useEffect(() => {
    if (!autoDetectCountry || value.trim()) return;
    const guess = guessVisitorCountry();
    if (guess && guess.code !== selectedCountry.code) {
      // Time zone / locale are browser-only — read once after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedCountry(guess);
      setAutoDetected(true);
    }
    // Run once on mount only — later changes are the visitor's choice
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (value === emittedRef.current) return;
    const next = splitWhatsAppNumber(value);
    const local = value.trim() ? next.local : '';
    setSelectedCountry(next.country);
    setPhoneNumber(local);
    setError(local ? whatsAppLocalError(next.country, local, required) : '');
    emittedRef.current = value;
  }, [required, value]);

  const publish = (country: WhatsAppCountry, local: string, nextError: string) => {
    setError(nextError);
    const fullNumber = local ? composeWhatsAppNumber(country, local) : '';
    emittedRef.current = fullNumber;
    onChange(fullNumber, isWhatsAppLocalValid(country, local));
  };

  const handlePhoneChange = (raw: string) => {
    if (autoDetectCountry) {
      const detected = detectInternationalNumber(raw, selectedCountry);
      if (detected) {
        setSelectedCountry(detected.country);
        setPhoneNumber(detected.local);
        setAutoDetected(true);
        publish(detected.country, detected.local, whatsAppLocalError(detected.country, detected.local, required));
        return;
      }
    }
    let val = raw.replace(/\D/g, '');
    if (val.startsWith('0')) val = val.substring(1);
    setPhoneNumber(val);
    publish(selectedCountry, val, whatsAppLocalError(selectedCountry, val, required));
  };

  const handleCountryChange = (code: string) => {
    const country = WHATSAPP_COUNTRIES.find((c) => c.code === code) || WHATSAPP_COUNTRIES[0];
    setSelectedCountry(country);
    setAutoDetected(false);
    const nextError =
      phoneNumber.length > 0 ? whatsAppLocalError(country, phoneNumber, required) : '';
    publish(country, phoneNumber, nextError);
  };

  const fullNumber = phoneNumber ? composeWhatsAppNumber(selectedCountry, phoneNumber) : '';

  return (
    <div className="w-full space-y-1.5 text-right">
      {hideLabel ? null : (
        <label className="block text-xs font-bold text-[#111827]">
          رقم الواتساب {required ? <span className="text-red-500">*</span> : null}
        </label>
      )}

      <div className="flex items-center gap-2" dir="ltr">
        <select
          value={selectedCountry.code}
          onChange={(e) => handleCountryChange(e.target.value)}
          className="h-12 shrink-0 cursor-pointer rounded-2xl border border-slate-300 bg-white/90 px-3 text-xs font-bold text-slate-800 outline-none transition-all focus:border-[#C59B4B]"
          aria-label="مفتاح الدولة"
        >
          {WHATSAPP_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.code}
            </option>
          ))}
        </select>

        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder={selectedCountry.localPrefix ? 'مثال: 5xxxxxxxx' : 'مثال: رقم محلي'}
          value={phoneNumber}
          required={required}
          onChange={(e) => handlePhoneChange(e.target.value)}
          className={`h-12 w-full rounded-2xl border bg-white/90 px-4 font-mono text-xs font-bold text-[#111827] shadow-sm outline-none transition-all ${
            error
              ? 'border-red-500 bg-red-50/20 focus:border-red-500'
              : 'border-slate-300 focus:border-[#C59B4B]'
          }`}
        />
      </div>

      {name ? <input type="hidden" name={name} value={fullNumber} /> : null}

      {autoDetectCountry && autoDetected && !error ? (
        <p className="mt-1 text-[11px] font-bold text-[#9C7A3C]">
          {selectedCountry.flag} تم ضبط مفتاح {selectedCountry.country} تلقائياً — يمكنك تغييره
        </p>
      ) : null}

      {error ? (
        <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-red-600">⚠️ {error}</p>
      ) : null}
    </div>
  );
}

export default WhatsAppInput;
