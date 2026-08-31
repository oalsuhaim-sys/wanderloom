'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CreditCard, Loader2, Minus, Plus, Wallet } from 'lucide-react';

import { supabase } from '@/lib/supabase';
import {
  addClientWalletTransaction,
  fetchClientWalletLedger,
  formatWalletAmount,
  formatWalletSignedAmount,
  formatWalletTransactionDate,
  type WalletTransaction,
} from '@/lib/vip-wallet-ledger';

type Props = {
  clientId: string;
  initialBalance?: number;
  onBalanceChange?: (balance: number) => void;
};

export default function ClientWalletLedgerCard({
  clientId,
  initialBalance = 0,
  onBalanceChange,
}: Props) {
  const [balance, setBalance] = useState(initialBalance);
  const [totalSpent, setTotalSpent] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [amountInput, setAmountInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');

  // Never put onBalanceChange in effect/callback deps — parent often passes an inline fn
  // which would re-trigger loadLedger forever (React error #185).
  const onBalanceChangeRef = useRef(onBalanceChange);
  onBalanceChangeRef.current = onBalanceChange;
  const lastNotifiedBalanceRef = useRef<number | null>(null);

  const notifyBalance = useCallback((next: number) => {
    if (lastNotifiedBalanceRef.current === next) return;
    lastNotifiedBalanceRef.current = next;
    onBalanceChangeRef.current?.(next);
  }, []);

  const loadLedger = useCallback(async () => {
    if (!supabase) {
      setError('قاعدة البيانات غير مهيأة.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const ledger = await fetchClientWalletLedger(supabase, clientId, { limit: 30 });
      setBalance(ledger.balance);
      setTotalSpent(ledger.totalSpent);
      setTransactions(ledger.transactions);
      notifyBalance(ledger.balance);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل محفظة العهدة.');
    } finally {
      setLoading(false);
    }
  }, [clientId, notifyBalance]);

  useEffect(() => {
    lastNotifiedBalanceRef.current = null;
    void loadLedger();
  }, [loadLedger]);

  const submitTransaction = async (sign: 1 | -1) => {
    if (!supabase) return;
    const raw = Number(amountInput.replace(/,/g, '').trim());
    if (!Number.isFinite(raw) || raw <= 0) {
      setNotice('أدخل مبلغاً موجباً.');
      return;
    }
    const amount = sign * raw;

    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const result = await addClientWalletTransaction(
        supabase,
        clientId,
        amount,
        descriptionInput,
      );
      setBalance(result.balance);
      setTotalSpent(result.totalSpent);
      notifyBalance(result.balance);
      setAmountInput('');
      setDescriptionInput('');
      setNotice(sign > 0 ? 'تم تسجيل الإيداع بنجاح.' : 'تم تسجيل الخصم بنجاح.');
      await loadLedger();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر حفظ العملية.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2D3F3A] dark:!bg-[#22302C]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="inline-flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-gray-100">
            <CreditCard className="h-5 w-5 text-slate-400 dark:text-[#D4AF37]" aria-hidden />
            محفظة العهدة المالية
          </h2>
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            إيداع مبلغ العهدة أو خصم مصروفات الرحلة — يظهر للعميل بشفافية.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-end dark:border-[#2D3F3A] dark:!bg-[#1A2421]">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">الرصيد الحالي</p>
          <p className="mt-0.5 font-mono text-xl font-semibold text-slate-900 dark:text-gray-100" dir="ltr">
            {formatWalletAmount(balance)}
          </p>
          <p className="mt-1 text-[10px] font-medium text-slate-500 dark:text-slate-400" dir="ltr">
            إجمالي المصروف: {formatWalletAmount(totalSpent)}
          </p>
        </div>
      </div>

      {notice ? (
        <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
          {error}
        </div>
      ) : null}

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">المبلغ (ر.س)</span>
          <input
            type="number"
            step="0.01"
            min={0}
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            placeholder="5000"
            dir="ltr"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200 dark:border-[#2D3F3A] dark:!bg-[#1A2421] dark:text-gray-100 dark:focus:border-[#D4AF37]/40 dark:focus:ring-[#D4AF37]/15"
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">الوصف / السبب</span>
          <input
            type="text"
            value={descriptionInput}
            onChange={(e) => setDescriptionInput(e.target.value)}
            placeholder="مثال: إيداع عهدة الرحلة · حجز فندق · تذاكر دخول"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200 dark:border-[#2D3F3A] dark:!bg-[#1A2421] dark:text-gray-100 dark:focus:border-[#D4AF37]/40 dark:focus:ring-[#D4AF37]/15"
          />
        </label>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void submitTransaction(1)}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60 sm:flex-none dark:border dark:border-[#D4AF37]/30 dark:!bg-[#D4AF37]/15 dark:text-[#D4AF37]"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          إيداع (+)
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void submitTransaction(-1)}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 sm:flex-none dark:border-[#2D3F3A] dark:!bg-[#1A2421] dark:text-gray-300 dark:hover:border-rose-500/40"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Minus className="h-4 w-4" />}
          خصم (−)
        </button>
      </div>

      <div>
        <h3 className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-gray-100">
          <Wallet className="h-4 w-4 text-slate-500 dark:text-[#D4AF37]" aria-hidden />
          آخر العمليات
        </h3>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-medium">جاري التحميل…</span>
          </div>
        ) : transactions.length === 0 ? (
          <div className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm font-medium text-slate-400 dark:!bg-[#1A2421]">
            لا توجد عمليات بعد — ابدأ بإيداع عهدة.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#2D3F3A]">
            <table className="w-full min-w-[420px] border-collapse text-start text-sm">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:!bg-[#1A2421] dark:text-[#D4AF37]">
                  <th className="px-3 py-2">التاريخ</th>
                  <th className="px-3 py-2">الوصف</th>
                  <th className="px-3 py-2 text-end">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, i) => (
                  <tr
                    key={tx.id}
                    className={i % 2 === 0 ? 'bg-white dark:!bg-[#22302C]' : 'bg-slate-50/80 dark:!bg-[#1A2421]/50'}
                  >
                    <td className="px-3 py-2.5 text-xs font-medium text-slate-600 whitespace-nowrap dark:text-slate-400">
                      {formatWalletTransactionDate(tx.createdAt)}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-gray-200">
                      {tx.description || '—'}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-end font-mono text-sm font-semibold ${
                        tx.amount >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-300'
                      }`}
                      dir="ltr"
                    >
                      {formatWalletSignedAmount(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
