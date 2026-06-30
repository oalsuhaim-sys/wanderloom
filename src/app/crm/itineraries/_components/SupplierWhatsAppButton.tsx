'use client';

import { MessageCircle } from 'lucide-react';

import { openSupplierWhatsApp } from '@/lib/supplier-whatsapp-brief';

type Props = {
  message: string;
  label?: string;
  className?: string;
  compact?: boolean;
};

export default function SupplierWhatsAppButton({
  message,
  label = 'إبلاغ المورد (WhatsApp) 💬',
  className = '',
  compact = false,
}: Props) {
  return (
    <button
      type="button"
      onClick={() => openSupplierWhatsApp(message)}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-green-200 bg-green-50 font-bold text-green-800 transition hover:bg-green-100 ${
        compact ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'
      } ${className}`}
    >
      <MessageCircle className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden />
      {label}
    </button>
  );
}
