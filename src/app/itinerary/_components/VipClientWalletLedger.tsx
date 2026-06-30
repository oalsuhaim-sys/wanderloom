'use client';

import { useCallback, useEffect, useState } from 'react';
import { CreditCard, Loader2, Sparkles } from 'lucide-react';

import { supabaseClient } from '@/lib/supabaseClient';
import {
  fetchClientWalletLedger,
  formatWalletAmount,
  formatWalletSignedAmount,
  formatWalletTransactionDate,
  type WalletTransaction,
} from '@/lib/vip-wallet-ledger';
import VipSpendingTierBadge from '@/components/VipSpendingTierBadge';
import type { VipSpendingTier } from '@/lib/vip-spending-tier';

type Props = {
  clientId: string | number | null | undefined;
};

export default function VipClientWalletLedger({ clientId }: Props) {
  const [balance, setBalance] = useState<number | null>(null);
  const [vipTier, setVipTier] = useState<VipSpendingTier>('gold');
  const [totalSpent, setTotalSpent] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    const id = clientId != null ? String(clientId).trim() : '';
    if (!id || !supabaseClient) {
      setUnavailable(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setUnavailable(false);
    try {
      const ledger = await fetchClientWalletLedger(supabaseClient, id, { limit: 40 });
      setBalance(ledger.balance);
      setVipTier(ledger.vipTier);
      setTotalSpent(ledger.totalSpent);
      setTransactions(ledger.transactions);
      if (ledger.transactions.length === 0 && ledger.balance === 0) {
        setUnavailable(false);
      }
    } catch {
      setUnavailable(true);
      setBalance(null);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#D4AF37]/20 bg-[#0D0F0E] py-16 text-[#D4AF37]">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
        <p className="text-sm font-semibold text-white/60">جاري تحميل محفظة العهدة…</p>
      </div>
    );
  }

  if (unavailable || balance == null) {
    return null;
  }

  const hasActivity = balance !== 0 || transactions.length > 0;
  if (!hasActivity) {
    return null;
  }

  return (
    <section className="space-y-5" aria-labelledby="vip-wallet-ledger-title">
      <article className="relative overflow-hidden rounded-[1.35rem] border border-[#D4AF37]/40 bg-[#0D0F0E] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)] sm:p-7">
        <div
          className="pointer-events-none absolute -end-16 -top-16 h-48 w-48 rounded-full bg-[#D4AF37]/10 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -start-10 h-56 w-56 rounded-full bg-[#D4AF37]/5 blur-3xl"
          aria-hidden
        />

        <div className="relative">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.32em] text-[#D4AF37]/80">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Wanderloom VIP Ledger
              </p>
              <h2
                id="vip-wallet-ledger-title"
                className="mt-2 text-lg font-black text-white sm:text-xl"
              >
                محفظة العهدة المالية
              </h2>
            </div>
            <CreditCard className="h-8 w-8 shrink-0 text-[#D4AF37]/70" aria-hidden />
          </div>

          <div className="mb-2 flex items-center gap-3">
            <div
              className="h-9 w-11 rounded-md bg-gradient-to-br from-[#D4AF37] via-[#E8C860] to-[#B8941F] shadow-inner"
              aria-hidden
            />
            <div className="font-mono text-[10px] font-bold tracking-[0.35em] text-white/25">
              •••• •••• •••• VIP
            </div>
          </div>

          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/40">
            الرصيد المتبقي في العهدة
          </p>
          <p className="mt-2 font-mono text-4xl font-black tracking-tight text-[#D4AF37] sm:text-5xl" dir="ltr">
            {formatWalletAmount(balance)}
          </p>
          <p className="mt-3 max-w-sm text-xs leading-relaxed text-white/45">
            كل إيداع وخصم موثّق — شفافية كاملة في مصروفات رحلتك.
          </p>
          <div className="mt-4">
            <VipSpendingTierBadge tier={vipTier} totalSpent={totalSpent} subtle />
          </div>
        </div>
      </article>

      {transactions.length > 0 ? (
        <div>
          <h3 className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-[#1E2720]/45">
            سجل العمليات
          </h3>
          <ul className="space-y-2">
            {transactions.map((tx) => {
              const isDeposit = tx.amount > 0;
              return (
                <li
                  key={tx.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-[#1E2720]/8 bg-white px-4 py-3.5 shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-[#1E2720]">
                      {tx.description || (isDeposit ? 'إيداع عهدة' : 'خصم')}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-[#1E2720]/45">
                      {formatWalletTransactionDate(tx.createdAt)}
                    </p>
                  </div>
                  <p
                    className={`shrink-0 font-mono text-base font-black ${
                      isDeposit ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                    dir="ltr"
                  >
                    {formatWalletSignedAmount(tx.amount)}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
