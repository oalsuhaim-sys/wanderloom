'use client';

import { MessageCircle } from 'lucide-react';

import {
  buildInvoicePublicUrl,
  buildInvoiceWhatsAppUrl,
  type InvoiceRow,
  type InvoiceType,
} from '@/lib/crm-invoices';

type InvoicePaymentWhatsAppButtonProps = {
  invoice: Pick<InvoiceRow, 'id' | 'amount' | 'type'>;
  tripTitle: string;
  phone?: string | null;
  className?: string;
  label?: string;
};

export function InvoicePaymentWhatsAppButton({
  invoice,
  tripTitle,
  phone,
  className = '',
  label = 'إرسال رابط السداد عبر الواتساب',
}: InvoicePaymentWhatsAppButtonProps) {
  const url = buildInvoiceWhatsAppUrl({
    phone,
    tripTitle,
    invoiceUrl: buildInvoicePublicUrl(invoice.id),
    amount: invoice.amount,
    type: invoice.type as InvoiceType,
  });

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ||
        'inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-bold text-emerald-800 transition hover:bg-emerald-100'
      }
    >
      <MessageCircle className="h-3 w-3" aria-hidden />
      {label}
    </a>
  );
}
