'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Loader2, Receipt } from 'lucide-react';

import { listInvoicesForQuoteAction } from '@/app/actions/invoiceActions';
import { InvoicePaymentWhatsAppButton } from '@/app/crm/quotations/_components/InvoicePaymentWhatsAppButton';
import {
  buildInvoicePublicUrl,
  formatInvoiceAmount,
  formatInvoiceDate,
  INVOICE_STATUS_LABEL,
  INVOICE_TYPE_LABEL,
  type InvoiceRow,
} from '@/lib/crm-invoices';

type QuoteInvoiceHistoryTableProps = {
  quoteId: string;
  tripTitle?: string;
  clientPhone?: string | null;
  refreshKey?: number;
};

export function QuoteInvoiceHistoryTable({
  quoteId,
  tripTitle = '',
  clientPhone,
  refreshKey = 0,
}: QuoteInvoiceHistoryTableProps) {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!quoteId) {
      setInvoices([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const result = await listInvoicesForQuoteAction(quoteId);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      setInvoices([]);
      return;
    }
    setInvoices(result.invoices);
  }, [quoteId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function copyLink(invoice: InvoiceRow) {
    const url = buildInvoicePublicUrl(invoice.id);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(invoice.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      window.prompt('انسخ رابط الفاتورة:', url);
    }
  }

  if (!quoteId) return null;

  return (
    <section
      className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      aria-label="سجل الفواتير"
      dir="rtl"
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1C4532]/10 ring-1 ring-[#1C4532]/15">
            <Receipt className="h-4 w-4 text-[#1C4532]" aria-hidden />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
              Invoice History
            </p>
            <h2 className="text-sm font-black text-[#1C4532]">سجل الفواتير</h2>
          </div>
        </div>
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-[#C9A84C]" aria-hidden /> : null}
      </div>

      {error ? (
        <p className="px-5 py-4 text-xs font-bold text-amber-700">{error}</p>
      ) : invoices.length === 0 && !loading ? (
        <p className="px-5 py-6 text-center text-xs font-semibold text-slate-500">
          لا توجد فواتير مُصدَرة لهذا العرض بعد.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-right text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-black uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">التاريخ</th>
                <th className="px-4 py-3">المبلغ</th>
                <th className="px-4 py-3">النوع</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3">الرابط</th>
                <th className="px-4 py-3">الإرسال</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => {
                const url = buildInvoicePublicUrl(invoice.id);
                const isCopied = copiedId === invoice.id;
                const isPaid = invoice.status === 'paid';
                return (
                  <tr
                    key={invoice.id}
                    className="border-b border-slate-50 transition hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-3 font-semibold text-slate-700">
                      {formatInvoiceDate(invoice.created_at)}
                    </td>
                    <td className="px-4 py-3 font-black text-[#1C4532]" dir="ltr">
                      {formatInvoiceAmount(invoice.amount)}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-600">
                      {INVOICE_TYPE_LABEL[invoice.type]}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                          isPaid
                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                            : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                        }`}
                      >
                        {INVOICE_STATUS_LABEL[invoice.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600 transition hover:border-[#C9A84C]/50 hover:text-[#1C4532]"
                        >
                          <ExternalLink className="h-3 w-3" aria-hidden />
                          عرض
                        </a>
                        <button
                          type="button"
                          onClick={() => void copyLink(invoice)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600 transition hover:border-[#C9A84C]/50 hover:text-[#1C4532]"
                        >
                          {isCopied ? (
                            <Check className="h-3 w-3 text-emerald-600" aria-hidden />
                          ) : (
                            <Copy className="h-3 w-3" aria-hidden />
                          )}
                          {isCopied ? 'تم النسخ' : 'نسخ الرابط'}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {!isPaid ? (
                        <InvoicePaymentWhatsAppButton
                          invoice={invoice}
                          tripTitle={tripTitle || invoice.trip_title || 'رحلتك'}
                          phone={clientPhone ?? invoice.client_phone}
                        />
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
