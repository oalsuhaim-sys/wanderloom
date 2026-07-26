'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Luggage } from 'lucide-react';

import VipClientFinancialSummary from '@/app/itinerary/_components/VipClientFinancialSummary';
import VipClientWalletLedger from '@/app/itinerary/_components/VipClientWalletLedger';
import {
  DEFAULT_VIP_PACKING_ITEMS,
  loadPackingChecked,
  packingStorageKey,
  savePackingChecked,
  type VipPackingCheckItem,
} from '@/lib/vip-client-packing';
import type { PublicItinerary } from '@/lib/public-itinerary';

type Props = {
  trip: PublicItinerary;
  profileUnlocked?: boolean;
};

export default function VipClientPackingTab({ trip, profileUnlocked = false }: Props) {
  const storageKey = packingStorageKey(
    trip.magicLinkId ?? String(trip.id),
  );
  const packingSummary = (trip.packing_summary ?? trip.vipSummaries?.packing ?? '').trim();
  const budgetSummary = (trip.budget_summary ?? trip.vipSummaries?.budget ?? '').trim() || null;

  const items: VipPackingCheckItem[] = useMemo(() => DEFAULT_VIP_PACKING_ITEMS, []);

  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setChecked(loadPackingChecked(storageKey));
  }, [storageKey]);

  const toggle = useCallback(
    (id: string) => {
      setChecked((prev) => {
        const next = { ...prev, [id]: !prev[id] };
        savePackingChecked(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const doneCount = items.filter((i) => checked[i.id]).length;
  const progress = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;

  return (
    <div className="packing-tab space-y-5">
      <VipClientFinancialSummary budget={trip.budget} budgetSummary={budgetSummary} />

      {profileUnlocked ? (
        <VipClientWalletLedger clientId={trip.clientId} />
      ) : (
        <div className="rounded-2xl border border-[#D4AF37]/20 bg-[#FAFAFA] px-4 py-5 text-center text-sm font-semibold text-gray-600">
          المحفظة والعهدة محمية — افتح «الملف الشخصي» وأدخل رمزك الخاص للوصول.
        </div>
      )}

      <div className="rounded-2xl border border-[#D4AF37]/30 bg-white p-5 shadow-md">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-black text-[#D4AF37]">
              <Luggage className="h-5 w-5" aria-hidden />
              قائمة الحقيبة
            </h2>
            <p className="mt-1 text-xs font-medium text-gray-600">
              اضغط لتأشير ما جهّزته — تُحفظ على جهازك
            </p>
          </div>
          <div className="text-end">
            <p className="font-mono text-lg font-black text-gray-900" dir="ltr">
              {progress}%
            </p>
            <p className="text-[10px] font-bold text-gray-500">جاهزية الحقيبة</p>
          </div>
        </div>

        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-gray-200">
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
          {items.map((item) => {
            const isChecked = Boolean(checked[item.id]);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => toggle(item.id)}
                  className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3.5 text-start transition ${
                    isChecked
                      ? 'border-[#D4AF37]/50 bg-[#D4AF37]/10'
                      : 'border-gray-200 bg-[#FAFAFA] hover:border-[#D4AF37]/35'
                  }`}
                  aria-pressed={isChecked}
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition ${
                      isChecked
                        ? 'border-[#D4AF37] bg-[#D4AF37] text-[#1E2720]'
                        : 'border-gray-300 bg-white'
                    }`}
                    aria-hidden
                  >
                    {isChecked ? <Check className="h-4 w-4 stroke-[3]" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-sm font-black ${
                        isChecked ? 'text-gray-500 line-through' : 'text-gray-900'
                      }`}
                    >
                      {item.label}
                    </span>
                    {item.hint ? (
                      <span className="mt-0.5 block text-[11px] font-medium text-gray-600">
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

      {packingSummary ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-2 text-xs font-black uppercase tracking-wider text-[#D4AF37]">
            ملاحظات الكونسيرج
          </h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
            {packingSummary}
          </p>
        </div>
      ) : null}
    </div>
  );
}
