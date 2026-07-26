'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  Crown,
  Hourglass,
  Loader2,
  Medal,
  WalletCards,
} from 'lucide-react';

import { getClientAccessToken } from '@/lib/crm-session-token';

type WalletPartnerType = 'leader' | 'expert';
type TransactionStatus = 'pending' | 'cleared';

type WalletSummary = {
  partnerId: string;
  partnerType: WalletPartnerType;
  partnerName: string;
  tier: string;
  walletBalance: number;
  pendingCommission: number;
};

type WalletTransaction = {
  id: string;
  amount: number | string;
  status: TransactionStatus;
  description: string | null;
  created_at: string;
};

const moneyFormatter = new Intl.NumberFormat('ar-SA', {
  style: 'currency',
  currency: 'SAR',
  maximumFractionDigits: 2,
});

function formatMoney(value: number | string): string {
  const amount = Number(value);
  return moneyFormatter.format(Number.isFinite(amount) ? amount : 0);
}

function formatTransactionDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ar-SA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function tierPresentation(rawTier: string) {
  const tier = rawTier.trim().toLocaleLowerCase();
  if (tier === 'vip') {
    return {
      label: 'VIP',
      icon: Crown,
      className:
        'border-[#D4AF37]/40 bg-gradient-to-l from-[#10251B] to-[#07100D] text-[#E4C989]',
    };
  }
  if (tier === 'gold') {
    return {
      label: 'Gold',
      icon: Crown,
      className:
        'border-amber-300 bg-gradient-to-l from-amber-100 to-[#FFF9E8] text-amber-800',
    };
  }
  if (tier === 'silver') {
    return {
      label: 'Silver',
      icon: Medal,
      className:
        'border-slate-300 bg-gradient-to-l from-slate-100 to-white text-slate-700',
    };
  }
  return {
    label: 'Bronze',
    icon: Medal,
    className:
      'border-orange-200 bg-gradient-to-l from-orange-50 to-white text-orange-800',
  };
}

export function SmartWallet({
  partnerId,
  partnerType,
}: {
  partnerId: string;
  partnerType: WalletPartnerType;
}) {
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!partnerId.trim()) {
      setError('معرّف الشريك غير صالح.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const accessToken = await getClientAccessToken();
      const query = new URLSearchParams({
        partner_id: partnerId,
        partner_type: partnerType,
      });
      const response = await fetch(`/api/admin/wallet?${query.toString()}`, {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        wallet?: WalletSummary;
        transactions?: WalletTransaction[];
        error?: string;
      };

      if (!response.ok || !payload.ok || !payload.wallet) {
        throw new Error(payload.error || 'تعذر تحميل المحفظة.');
      }

      setWallet({
        ...payload.wallet,
        walletBalance: Number(payload.wallet.walletBalance) || 0,
        pendingCommission: Number(payload.wallet.pendingCommission) || 0,
      });
      setTransactions(
        Array.isArray(payload.transactions) ? payload.transactions : [],
      );
    } catch (err) {
      setWallet(null);
      setTransactions([]);
      setError(err instanceof Error ? err.message : 'تعذر تحميل المحفظة.');
    } finally {
      setLoading(false);
    }
  }, [partnerId, partnerType]);

  useEffect(() => {
    void load();
  }, [load]);

  const tier = useMemo(
    () => tierPresentation(wallet?.tier ?? 'Bronze'),
    [wallet?.tier],
  );
  const TierIcon = tier.icon;

  return (
    <section
      className="overflow-hidden rounded-2xl border border-[#C4A464]/25 bg-white shadow-sm"
      dir="rtl"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#C4A464]/15 bg-gradient-to-l from-[#10251B] to-[#08140F] px-5 py-4 text-white">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#C4A464]/30 bg-[#C4A464]/10 text-[#D8BD85]">
            <WalletCards className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-black">المحفظة الذكية</h2>
            <p className="mt-0.5 text-xs font-semibold text-white/50">
              العمولات والأرباح والحركات المالية
            </p>
          </div>
        </div>
        {!loading && wallet ? (
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black ${tier.className}`}
          >
            <TierIcon className="h-4 w-4" />
            {tier.label}
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="flex min-h-64 items-center justify-center gap-2 p-6 text-sm font-bold text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-[#C4A464]" />
          جاري تحميل المحفظة…
        </div>
      ) : error || !wallet ? (
        <div className="p-6">
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            {error || 'تعذر تحميل المحفظة.'}
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 rounded-xl border border-[#C4A464]/30 bg-[#C4A464]/10 px-4 py-2 text-xs font-black text-[#10251B] transition hover:bg-[#C4A464]/20"
          >
            إعادة المحاولة
          </button>
        </div>
      ) : (
        <div className="p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="relative overflow-hidden rounded-2xl bg-gradient-to-bl from-[#183C2C] to-[#0C2118] p-5 text-white shadow-lg">
              <div className="absolute -left-8 -top-8 h-28 w-28 rounded-full bg-[#C4A464]/10" />
              <p className="relative inline-flex items-center gap-2 text-xs font-bold text-white/60">
                <WalletCards className="h-4 w-4 text-[#D8BD85]" />
                الرصيد المتاح
              </p>
              <p
                className="relative mt-4 text-2xl font-black text-[#E4C989]"
                dir="ltr"
              >
                {formatMoney(wallet.walletBalance)}
              </p>
              <p className="relative mt-2 text-[10px] font-semibold text-white/40">
                عمولات مصفاة ومتاحة
              </p>
            </article>

            <article className="rounded-2xl border border-amber-200 bg-gradient-to-bl from-amber-50 to-[#FFFCF5] p-5">
              <p className="inline-flex items-center gap-2 text-xs font-bold text-amber-800">
                <Hourglass className="h-4 w-4" />
                العمولات المعلقة
              </p>
              <p
                className="mt-4 text-2xl font-black text-slate-900"
                dir="ltr"
              >
                {formatMoney(wallet.pendingCommission)}
              </p>
              <p className="mt-2 text-[10px] font-semibold text-amber-700/60">
                قيد الاعتماد أو إكمال الرحلة
              </p>
            </article>
          </div>

          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  آخر الحركات المالية
                </h3>
                <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
                  أحدث 50 حركة في المحفظة
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">
                {transactions.length}
              </span>
            </div>

            {transactions.length ? (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100">
                {transactions.map((transaction) => {
                  const cleared = transaction.status === 'cleared';
                  return (
                    <li
                      key={transaction.id}
                      className="flex flex-wrap items-center gap-3 bg-white px-4 py-3.5 transition hover:bg-slate-50"
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                          cleared
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {cleared ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <Clock3 className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-800">
                          {transaction.description || 'حركة محفظة'}
                        </p>
                        <p className="mt-1 text-[10px] font-semibold text-slate-400">
                          {formatTransactionDate(transaction.created_at)}
                        </p>
                      </div>
                      <div className="text-left">
                        <p
                          className={`text-sm font-black ${
                            cleared ? 'text-emerald-700' : 'text-slate-800'
                          }`}
                          dir="ltr"
                        >
                          {formatMoney(transaction.amount)}
                        </p>
                        <span
                          className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[9px] font-black ${
                            cleared
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {cleared ? 'مصفاة' : 'معلقة'}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <WalletCards className="mx-auto h-7 w-7 text-slate-300" />
                <p className="mt-2 text-xs font-bold text-slate-500">
                  لا توجد حركات مالية حتى الآن
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
