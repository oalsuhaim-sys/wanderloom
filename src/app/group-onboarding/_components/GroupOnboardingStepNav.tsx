'use client';

import { brandGoldBadgeStyle } from '@/lib/brand-gold';

type GroupOnboardingStepNavProps = {
  currentStep: 1 | 2 | 3;
  onBack: () => void;
  backDisabled?: boolean;
};

export function GroupOnboardingStepNav({
  currentStep,
  onBack,
  backDisabled = false,
}: GroupOnboardingStepNavProps) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
      <span
        style={brandGoldBadgeStyle}
        className="rounded-xl border px-3 py-1 text-xs font-extrabold"
      >
        خطوة {currentStep} من 3
      </span>

      <button
        type="button"
        onClick={onBack}
        disabled={backDisabled}
        className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-1.5 text-xs font-bold text-slate-600 transition-all hover:bg-slate-200/80 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span>إلى الخلف</span>
        <span aria-hidden>➔</span>
      </button>
    </div>
  );
}
