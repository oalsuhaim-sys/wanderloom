'use client';

import { useEffect, useRef, type CSSProperties } from 'react';

import {
  normalizeAffiliateRef,
  persistAffiliateRef,
  readPersistedAffiliateRef,
} from '@/lib/referral-url';

type ReferralCodeFieldProps = {
  value: string;
  onChange: (value: string) => void;
  /** Prefill from ?ref= / ?referral= or persisted affiliate storage (once). */
  autoPrefill?: boolean;
  /** Optional native form field name when used inside uncontrolled FormData flows. */
  name?: string;
  className?: string;
  inputClassName?: string;
  labelClassName?: string;
  labelStyle?: CSSProperties;
};

export function ReferralCodeField({
  value,
  onChange,
  autoPrefill = true,
  name = 'referral_code',
  className = '',
  inputClassName = '',
  labelClassName = 'block text-xs font-bold text-slate-700',
  labelStyle,
}: ReferralCodeFieldProps) {
  const prefilledRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!autoPrefill || prefilledRef.current) return;
    if (String(value ?? '').trim()) {
      prefilledRef.current = true;
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const refFromUrl =
      urlParams.get('ref') || urlParams.get('referral') || urlParams.get('code');
    const fromUrl = normalizeAffiliateRef(refFromUrl);
    if (fromUrl) {
      persistAffiliateRef(fromUrl);
      onChangeRef.current(fromUrl.toUpperCase());
      prefilledRef.current = true;
      return;
    }

    const stored = readPersistedAffiliateRef();
    if (stored) {
      onChangeRef.current(stored.toUpperCase());
      prefilledRef.current = true;
    }
  }, [autoPrefill, value]);

  return (
    <div className={`space-y-1 text-right ${className}`}>
      <label className={labelClassName} style={labelStyle}>
        كود الإحالة{' '}
        <span className="font-normal text-slate-500">(اختياري)</span>
      </label>
      <div className="relative flex items-center">
        <input
          type="text"
          name={name}
          placeholder="مثال: LEADER-12345 أو EXPERT-98765"
          value={value}
          onChange={(e) => {
            const next = e.target.value.toUpperCase();
            onChange(next);
            const normalized = normalizeAffiliateRef(next);
            if (normalized) persistAffiliateRef(normalized);
          }}
          autoComplete="off"
          spellCheck={false}
          className={`w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-right font-mono text-sm font-bold uppercase text-slate-800 outline-none placeholder:font-sans placeholder:font-normal placeholder:normal-case placeholder:text-slate-400 focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]/40 ${inputClassName}`}
          dir="rtl"
        />
        <span className="pointer-events-none absolute left-3 text-sm text-slate-400">
          🎁
        </span>
      </div>
    </div>
  );
}
