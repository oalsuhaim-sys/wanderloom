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
  /** Glass style for navy/olive banners */
  variant?: 'default' | 'glass';
};

const GLASS =
  'inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white shadow-none backdrop-blur-sm';

export default function VipSpendingTierBadge({
  tier,
  totalProfit,
  totalSpent,
  className = '',
  subtle = false,
  variant = 'default',
}: Props) {
  const profitBasis = totalProfit ?? totalSpent;
  const resolved = normalizeVipSpendingTier(tier ?? 'gold', profitBasis);
  const label = vipSpendingTierLabel(resolved).replace(/\s*[🟡⚫✨]\s*$/u, '');
  const subtleClass = subtle ? 'scale-90 opacity-95' : '';

  if (variant === 'glass') {
    return (
      <span className={`${GLASS} ${subtleClass} ${className}`} title={label}>
        {label}
      </span>
    );
  }

  if (resolved === 'signature') {
    return (
      <span
        className={`inline-flex items-center rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-3 py-1 text-xs font-semibold text-[#8a6f1a] dark:text-[#D4AF37] ${subtleClass} ${className}`}
      >
        {label}
      </span>
    );
  }

  if (resolved === 'black') {
    return (
      <span
        className={`inline-flex items-center rounded-full border border-slate-800/20 bg-slate-900 px-3 py-1 text-xs font-semibold text-[#D4AF37] ${subtleClass} ${className}`}
      >
        {label}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-1 text-xs font-semibold text-[#8a6f1a] dark:border-[#D4AF37]/30 dark:bg-[#D4AF37]/10 dark:text-[#D4AF37] ${subtleClass} ${className}`}
    >
      {label}
    </span>
  );
}
