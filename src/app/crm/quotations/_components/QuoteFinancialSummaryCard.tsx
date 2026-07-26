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
      className="mb-5 overflow-hidden rounded-2xl border border-[#C9A84C]/35 bg-gradient-to-br from-[#1C4532] via-[#163528] to-[#0f241c] p-5 text-white shadow-lg shadow-[#1C4532]/15"
      aria-label="الملخص المالي"
      dir="rtl"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#C9A84C]/20 ring-1 ring-[#C9A84C]/40">
            <Wallet className="h-4 w-4 text-[#C9A84C]" aria-hidden />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#C9A84C]/80">
              Financial Ledger
            </p>
            <h2 className="text-sm font-black text-white">الملخص المالي للرحلة</h2>
          </div>
        </div>
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-[#C9A84C]" aria-hidden /> : null}
      </div>

      {error ? (
        <p className="text-xs font-bold text-amber-200/90">{error}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[10px] font-bold text-white/50">إجمالي تكلفة الرحلة</p>
              <p className="mt-1 text-lg font-black text-[#C9A84C]" dir="ltr">
                {formatInvoiceAmount(totalCost)}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3">
              <p className="text-[10px] font-bold text-emerald-200/70">المدفوع</p>
              <p className="mt-1 text-lg font-black text-emerald-300" dir="ltr">
                {formatInvoiceAmount(paidAmount)}
              </p>
            </div>
            <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3">
              <p className="text-[10px] font-bold text-amber-200/70">المتبقي</p>
              <p className="mt-1 text-lg font-black text-amber-200" dir="ltr">
                {formatInvoiceAmount(remaining)}
              </p>
            </div>
          </div>

          <p className="mt-4 text-center text-[11px] font-bold leading-relaxed text-white/55">
            إجمالي تكلفة الرحلة: {formatInvoiceAmount(totalCost)}
            <span className="mx-2 text-white/25">|</span>
            المدفوع: {formatInvoiceAmount(paidAmount)}
            <span className="mx-2 text-white/25">|</span>
            المتبقي: {formatInvoiceAmount(remaining)}
          </p>
        </>
      )}
    </section>
  );
}
