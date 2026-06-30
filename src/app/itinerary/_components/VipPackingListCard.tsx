'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Luggage } from 'lucide-react';

import {
  DEFAULT_VIP_PACKING_ITEMS,
  loadPackingChecked,
  savePackingChecked,
} from '@/lib/vip-client-packing';

const STORAGE_KEY = 'wl-vip-packing:overview';

export default function VipPackingListCard() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setChecked(loadPackingChecked(STORAGE_KEY));
  }, []);

  const toggle = useCallback((id: string) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      savePackingChecked(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const doneCount = DEFAULT_VIP_PACKING_ITEMS.filter((i) => checked[i.id]).length;
  const progress =
    DEFAULT_VIP_PACKING_ITEMS.length > 0
      ? Math.round((doneCount / DEFAULT_VIP_PACKING_ITEMS.length) * 100)
      : 0;

  return (
    <div className="rounded-2xl border border-[#D4AF37]/30 bg-[#2A362C] p-5 shadow-md">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-black text-[#D4AF37]">
            <Luggage className="h-5 w-5" aria-hidden />
            قائمة الحقيبة
          </h2>
          <p className="mt-1 text-xs font-medium text-white/70">
            اضغط لتأشير ما جهّزته — تُحفظ على جهازك
          </p>
        </div>
        <div className="text-end">
          <p className="font-mono text-lg font-black text-white" dir="ltr">
            {progress}%
          </p>
          <p className="text-[10px] font-bold text-white/50">جاهزية الحقيبة</p>
        </div>
      </div>

      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[#D4AF37] transition-all duration-300"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      <ul className="space-y-2">
        {DEFAULT_VIP_PACKING_ITEMS.map((item) => {
          const isChecked = Boolean(checked[item.id]);
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => toggle(item.id)}
                className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-start transition ${
                  isChecked
                    ? 'border-[#D4AF37]/50 bg-[#D4AF37]/10'
                    : 'border-white/10 bg-white/5 hover:border-[#D4AF37]/30'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                    isChecked
                      ? 'border-[#D4AF37] bg-[#D4AF37] text-[#1E2720]'
                      : 'border-white/30 bg-transparent'
                  }`}
                  aria-hidden
                >
                  {isChecked ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm font-bold ${
                      isChecked ? 'text-white/60 line-through' : 'text-white'
                    }`}
                  >
                    {item.label}
                  </span>
                  {item.hint ? (
                    <span className="mt-0.5 block text-[11px] font-medium text-white/45">
                      {item.hint}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
