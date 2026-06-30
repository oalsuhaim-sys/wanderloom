'use client';

import { CheckCircle2, Wallet } from 'lucide-react';

import type { PublicBudgetSummary } from '@/lib/public-itinerary';

type Props = {
  budget: PublicBudgetSummary;
  budgetSummary?: string | null;
};

function formatAmount(amount: number, currency: string): string {
  const value = Math.max(0, amount);
  const formatted = new Intl.NumberFormat('ar-SA', {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
  return `${formatted} ${currency}`;
}

export default function VipClientFinancialSummary({ budget, budgetSummary }: Props) {
  const totalBudget = budget.total;
  const amountPaid = budget.spent;
  const amountRemaining = Math.max(0, budget.remaining);
  const currency = budget.currency;

  const fullyPaid = totalBudget > 0 && amountRemaining <= 0;
  const hasFinancials = totalBudget > 0 || amountPaid > 0;

  return (
    <section
      className="overflow-hidden rounded-2xl border border-[#D4AF37]/30 bg-white shadow-md"
      aria-labelledby="vip-financial-summary-title"
    >
      <div className="border-b border-[#D4AF37]/20 bg-[#1E2720] px-5 py-4">
        <h2
          id="vip-financial-summary-title"
          className="flex items-center gap-2 text-base font-black text-[#D4AF37]"
        >
          <Wallet className="h-5 w-5 shrink-0" aria-hidden />
          الملخص المالي
        </h2>
        <p className="mt-1 text-[11px] font-medium text-white/55">
          حالة الدفع لرحلتك — محدّثة من فريق Wanderloom
        </p>
      </div>

      <div className="space-y-3 p-5">
        {!hasFinancials ? (
          <p className="rounded-xl border border-gray-200 bg-[#FAFAFA] px-4 py-5 text-center text-sm font-medium text-gray-600">
            لم تُحدَّد ميزانية بعد — سيتواصل معك الكونسيرج عند جاهزية التفاصيل.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-[#FAFAFA] px-4 py-3.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                  الميزانية الإجمالية
                </p>
                <p className="mt-1 font-mono text-lg font-black text-gray-900" dir="ltr">
                  {formatAmount(totalBudget, currency)}
                </p>
              </div>
              <div className="rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/8 px-4 py-3.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                  المبلغ المدفوع
                </p>
                <p className="mt-1 font-mono text-lg font-black text-gray-900" dir="ltr">
                  {formatAmount(amountPaid, currency)}
                </p>
              </div>
            </div>

            <div
              className={`rounded-xl border px-4 py-4 ${
                fullyPaid
                  ? 'border-emerald-500/35 bg-gradient-to-l from-emerald-50/90 to-[#D4AF37]/10'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                    المبلغ المتبقي
                  </p>
                  <p
                    className={`mt-1 font-mono text-xl font-black ${
                      fullyPaid ? 'text-emerald-800' : 'text-gray-900'
                    }`}
                    dir="ltr"
                  >
                    {formatAmount(fullyPaid ? 0 : amountRemaining, currency)}
                  </p>
                </div>
                {fullyPaid ? (
                  <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-white/80 px-3 py-2 shadow-sm">
                    <CheckCircle2
                      className="h-6 w-6 shrink-0 text-emerald-600"
                      strokeWidth={2.5}
                      aria-hidden
                    />
                    <span className="text-sm font-black text-emerald-800">مدفوع بالكامل ✅</span>
                  </div>
                ) : null}
              </div>
              {!fullyPaid && amountRemaining > 0 ? (
                <p className="mt-2 text-[11px] font-medium text-gray-600">
                  يُستكمل السداد حسب جدول الكونسيرج — للاستفسار استخدم زر واتساب.
                </p>
              ) : null}
            </div>
          </>
        )}

        {budgetSummary?.trim() ? (
          <div className="rounded-xl border border-gray-200 bg-[#FAFAFA] px-4 py-3">
            <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-[#D4AF37]">
              ملاحظات مالية
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
              {budgetSummary.trim()}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
