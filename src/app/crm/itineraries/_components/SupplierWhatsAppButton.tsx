'use client';

import { MessageCircle } from 'lucide-react';

import { openSupplierWhatsApp } from '@/lib/supplier-whatsapp-brief';
import { WL_BTN_WHATSAPP } from '@/lib/itinerary-builder-ui';

type Props = {
  message: string;
  label?: string;
  className?: string;
  compact?: boolean;
  /** supplier = emerald WhatsApp · driver = gold/olive transit badge */
  variant?: 'supplier' | 'driver';
};

const DRIVER_CLASS =
  'inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition-all hover:bg-emerald-100';

export default function SupplierWhatsAppButton({
  message,
  label = 'إبلاغ المورد (WhatsApp) 💬',
  className = '',
  compact = false,
  variant = 'supplier',
}: Props) {
  if (variant === 'driver') {
    return (
      <button
        type="button"
        onClick={() => openSupplierWhatsApp(message)}
        className={`${DRIVER_CLASS} ${compact ? 'text-[11px]' : ''} ${className}`}
      >
        <MessageCircle className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden />
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => openSupplierWhatsApp(message)}
      className={`${WL_BTN_WHATSAPP} ${
        compact ? '!px-2.5 !py-1.5 text-[11px]' : 'text-xs'
      } ${className}`}
    >
      <MessageCircle className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden />
      {label}
    </button>
  );
}
