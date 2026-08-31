'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Wallet } from 'lucide-react';

import { getQuoteLedgerAction } from '@/app/actions/invoiceActions';
import { formatInvoiceAmount } from '@/lib/crm-invoices';

type QuoteFinancialSummaryCardProps = {
  quoteId: string;
  /** إجمالي ديناميكي من محرك التسعير في النموذج */
  liveTotalCost?: number;
  /** زِد هذا الرقم بعد إصدار فاتورة لإعادة تحميل الملخص */
  refreshKey?: number;
};

export function QuoteFinancialSummaryCard({
  quoteId,
  liveTotalCost,
  refreshKey = 0,
}: QuoteFinancialSummaryCardProps) {
  const [paidAmount, setPaidAmount] = useState(0);
  const [dbTotalCost, setDbTotalCost] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!quoteId) {
      setPaidAmount(0);
      setDbTotalCost(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const result = await getQuoteLedgerAction(quoteId);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      setPaidAmount(0);
      setDbTotalCost(0);
      return;
    }
    setPaidAmount(result.ledger.paidAmount);
    setDbTotalCost(result.ledger.totalCost);
  }, [quoteId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const totalCost = useMemo(() => {
    if (liveTotalCost != null && Number.isFinite(liveTotalCost) && liveTotalCost > 0) {
      return liveTotalCost;
    }
    return dbTotalCost;
  }, [liveTotalCost, dbTotalCost]);

  const remaining = useMemo(
    () => Math.max(0, Math.round((totalCost - paidAmount) * 100) / 100),
    [totalCost, paidAmount],
  );

  if (!quoteId) return null;

  return (
    <section
      className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      aria-label="الملخص المالي"
      dir="rtl"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37]/10">
            <Wallet className="h-4 w-4 text-[#b8952d]" aria-hidden />
          </span>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-widest text-[#b8952d]">
              Financial Ledger
            </p>
            <h2 className="text-lg font-extrabold text-slate-900">الملخص المالي للرحلة</h2>
          </div>
        </div>
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-[#b8952d]" aria-hidden /> : null}
      </div>

      {error ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
          {error}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
              <span className="mb-1 block text-xs font-bold text-slate-500">إجمالي تكلفة الرحلة</span>
              <span className="text-xl font-black text-slate-900" dir="ltr">
                {formatInvoiceAmount(totalCost)}
              </span>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-center">
              <span className="mb-1 block text-xs font-bold text-emerald-700">المدفوع</span>
              <span className="text-xl font-black text-emerald-700" dir="ltr">
                {formatInvoiceAmount(paidAmount)}
              </span>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-center">
              <span className="mb-1 block text-xs font-bold text-amber-700">المتبقي</span>
              <span className="text-xl font-black text-amber-700" dir="ltr">
                {formatInvoiceAmount(remaining)}
              </span>
            </div>
          </div>

          <p className="mt-4 text-center text-[11px] font-medium leading-relaxed text-slate-500">
            إجمالي تكلفة الرحلة: {formatInvoiceAmount(totalCost)}
            <span className="mx-2 text-slate-300">|</span>
            المدفوع: {formatInvoiceAmount(paidAmount)}
            <span className="mx-2 text-slate-300">|</span>
            المتبقي: {formatInvoiceAmount(remaining)}
          </p>
        </>
      )}
    </section>
  );
}
