'use client';

import {
  normalizeVipSpendingTier,
  vipSpendingTierLabel,
  type VipSpendingTier,
} from '@/lib/vip-spending-tier';

type Props = {
  tier?: VipSpendingTier | string | null;
  /** إجمالي الأرباح (ر.س) — يُستخدم لحساب الشريحة */
  totalProfit?: unknown;
  /** @deprecated استخدم totalProfit */
  totalSpent?: unknown;
  className?: string;
  /** أصغر للهيدر في واجهة العميل */
  subtle?: boolean;
};

export default function VipSpendingTierBadge({
  tier,
  totalProfit,
  totalSpent,
  className = '',
  subtle = false,
}: Props) {
  const profitBasis = totalProfit ?? totalSpent;
  const resolved = normalizeVipSpendingTier(tier ?? 'gold', profitBasis);
  const label = vipSpendingTierLabel(resolved);
  const subtleClass = subtle ? 'scale-90 opacity-95' : '';

  if (resolved === 'signature') {
    return (
      <span
        className={`inline-flex items-center bg-gradient-to-r from-[#D4AF37] via-white to-[#D4AF37] text-black px-3 py-1 rounded-full text-xs font-extrabold shadow-lg ${subtleClass} ${className}`}
      >
        {label}
      </span>
    );
  }

  if (resolved === 'black') {
    return (
      <span
        className={`inline-flex items-center bg-[#1A2520] text-[#D4AF37] border border-[#D4AF37] px-3 py-1 rounded-full text-xs font-bold shadow-md ${subtleClass} ${className}`}
      >
        {label}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center bg-yellow-100 text-yellow-800 border border-yellow-300 px-3 py-1 rounded-full text-xs font-bold shadow-sm ${subtleClass} ${className}`}
    >
      {label}
    </span>
  );
}
