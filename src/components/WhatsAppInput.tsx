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
};

export function WhatsAppInput({
  value = '',
  onChange,
  required = true,
  name,
  hideLabel = false,
}: WhatsAppInputProps) {
  const initial = splitWhatsAppNumber(value);
  const [selectedCountry, setSelectedCountry] = useState<WhatsAppCountry>(initial.country);
  const [phoneNumber, setPhoneNumber] = useState(initial.local);
  const [error, setError] = useState('');
  const emittedRef = useRef(value);

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
    let val = raw.replace(/\D/g, '');
    if (val.startsWith('0')) val = val.substring(1);
    setPhoneNumber(val);
    publish(selectedCountry, val, whatsAppLocalError(selectedCountry, val, required));
  };

  const handleCountryChange = (code: string) => {
    const country = WHATSAPP_COUNTRIES.find((c) => c.code === code) || WHATSAPP_COUNTRIES[0];
    setSelectedCountry(country);
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

      {error ? (
        <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-red-600">⚠️ {error}</p>
      ) : null}
    </div>
  );
}

export default WhatsAppInput;
