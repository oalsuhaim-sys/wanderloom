'use client';

import { Wallet } from 'lucide-react';

import { CRM_LUXURY_INPUT } from '@/app/crm/itineraries/[id]/edit/crm-input-styles';
import type { BudgetOptionsDraft, BudgetTrackingDraft } from '@/lib/itinerary-builder-model';

type Props = {
  budgetTracking: BudgetTrackingDraft;
  budgetOptions: BudgetOptionsDraft;
  onBudgetTrackingChange: (budgetTracking: BudgetTrackingDraft) => void;
  onCurrencyChange: (currency: string) => void;
};

const labelClass = 'mb-1 block text-[9px] font-black uppercase tracking-wider text-[#D4AF37]';

export default function FinancialDetailsBar({
  budgetTracking,
  budgetOptions,
  onBudgetTrackingChange,
  onCurrencyChange,
}: Props) {
  return (
    <section
      className="rounded-xl border border-[#D4AF37]/35 bg-white p-4 shadow-sm ring-1 ring-[#1E2720]/5 sm:p-5"
      aria-labelledby="financial-bar-title"
    >
      <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-[#1E2720]/8 pb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
          <Wallet className="h-4 w-4 text-[#D4AF37]" aria-hidden />
        </div>
        <div>
          <h2 id="financial-bar-title" className="text-sm font-black text-[#1E2720]">
            المالية
          </h2>
          <p className="text-[10px] font-medium text-[#1E2720]/50">
            تُحفظ في Supabase عند «حفظ المسار»
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className={labelClass}>الميزانية الإجمالية</span>
          <input
            type="number"
            min={0}
            step="any"
            value={budgetTracking.totalBudget}
            onChange={(e) =>
              onBudgetTrackingChange({ ...budgetTracking, totalBudget: e.target.value })
            }
            className={CRM_LUXURY_INPUT}
            placeholder="150000"
            dir="ltr"
          />
        </label>
        <label className="block">
          <span className={labelClass}>المبلغ المدفوع</span>
          <input
            type="number"
            min={0}
            step="any"
            value={budgetTracking.spentAmount}
            onChange={(e) =>
              onBudgetTrackingChange({ ...budgetTracking, spentAmount: e.target.value })
            }
            className={CRM_LUXURY_INPUT}
            placeholder="75000"
            dir="ltr"
          />
        </label>
        <label className="block">
          <span className={labelClass}>العملة</span>
          <input
            value={budgetOptions.currency}
            onChange={(e) => onCurrencyChange(e.target.value.toUpperCase())}
            className={CRM_LUXURY_INPUT}
            placeholder="SAR"
            dir="ltr"
            maxLength={6}
          />
        </label>
      </div>
    </section>
  );
}
