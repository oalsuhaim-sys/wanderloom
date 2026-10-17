'use client';

import React, { useEffect, useRef, useState } from 'react';

type ReferralCodeInputProps = {
  value: string;
  onChange: (val: string, isValid: boolean) => void;
  onGenerate?: () => void;
};

export const ReferralCodeInput = ({ value, onChange, onGenerate }: ReferralCodeInputProps) => {
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [checking, setChecking] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const code = value.trim().toUpperCase();
    if (!code) {
      setChecking(false);
      setIsDuplicate(false);
      onChangeRef.current(value, true);
      return;
    }

    let cancelled = false;
    onChangeRef.current(code, false);
    setChecking(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/crm/referral-codes/check?code=${encodeURIComponent(code)}`,
            { cache: 'no-store' },
          );
          const payload = (await res.json().catch(() => ({}))) as { duplicate?: boolean };
          if (cancelled) return;
          const duplicate = Boolean(payload.duplicate);
          setIsDuplicate(duplicate);
          onChangeRef.current(code, !duplicate);
        } catch {
          if (cancelled) return;
          setIsDuplicate(false);
          onChangeRef.current(code, true);
        } finally {
          if (!cancelled) setChecking(false);
        }
      })();
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [value]);

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold text-[#111827]">
        كود الإحالة{' '}
        <span className="font-normal text-slate-400">(اختياري - ينشأ تلقائياً عند التّرك)</span>
      </label>

      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="مثال: WNDR-2026"
          value={value}
          onChange={(e) => {
            const formatted = e.target.value.toUpperCase();
            onChange(formatted, !isDuplicate);
          }}
          className={`w-full flex-1 rounded-xl border bg-white px-4 py-3 font-mono text-xs font-bold uppercase outline-none transition-all placeholder:normal-case placeholder:text-slate-400 ${
            isDuplicate
              ? 'border-red-500 bg-red-50/30 text-red-600'
              : 'border-slate-300 text-[#111827] focus:border-[#BA8E48]'
          }`}
        />
        {onGenerate ? (
          <button
            type="button"
            onClick={onGenerate}
            className="flex shrink-0 items-center gap-1 rounded-xl border border-amber-300/60 bg-amber-100/90 px-4 py-3 text-xs font-bold text-[#BA8E48] shadow-sm transition-all hover:bg-amber-200"
          >
            <span>⚡</span>
            <span>توليد كود</span>
          </button>
        ) : null}
      </div>

      {checking ? (
        <p className="text-[11px] font-medium text-amber-600">جاري فحص توفر الكود...</p>
      ) : null}
      {isDuplicate ? (
        <p className="flex items-center gap-1 text-[11px] font-bold text-red-600">
          ⚠️ عذراً، كود الإحالة هذا موجود ومسجل لشخص آخر مسبقاً.
        </p>
      ) : null}
    </div>
  );
};
