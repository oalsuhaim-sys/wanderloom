'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Check,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  Map,
  Receipt,
  Wallet,
} from 'lucide-react';

import { getClientFinancialHubAction } from '@/app/actions/clientFinancialActions';
import { InvoicePaymentWhatsAppButton } from '@/app/crm/quotations/_components/InvoicePaymentWhatsAppButton';
import {
  buildInvoicePublicUrl,
  formatInvoiceAmount,
  INVOICE_STATUS_LABEL,
  INVOICE_TYPE_LABEL,
} from '@/lib/crm-invoices';
import type { ClientFinancialHubData } from '@/lib/client-financial-hub';
import { salesStageBadgeClass } from '@/lib/client-sales-stage';

const PANEL =
  'rounded-2xl border border-[#C9A84C]/30 bg-gradient-to-br from-[#1C4532] via-[#163528] to-[#0f241c] p-5 text-white shadow-lg';

type ClientFinancialHubProps = {
  clientId: string;
  refreshKey?: number;
};

export default function ClientFinancialHub({ clientId, refreshKey = 0 }: ClientFinancialHubProps) {
  const [data, setData] = useState<ClientFinancialHubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError('');
    const result = await getClientFinancialHubAction(clientId);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      setData(null);
      return;
    }
    setData(result.data);
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function copyLink(invoiceId: string) {
    const url = buildInvoicePublicUrl(invoiceId);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(invoiceId);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      window.prompt('انسخ الرابط:', url);
    }
  }

  if (loading) {
    return (
      <section className={`${PANEL} flex items-center justify-center gap-2 py-10`}>
        <Loader2 className="h-5 w-5 animate-spin text-[#C9A84C]" aria-hidden />
        <span className="text-sm font-bold text-white/60">جارٍ تحميل الملخص المالي…</span>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="rounded-2xl border border-amber-300/40 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900">
        {error || 'تعذر تحميل الملخص المالي.'}
      </section>
    );
  }

  return (
    <section className="space-y-4" aria-label="الملخص المالي الموحّد">
      <div className={PANEL}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#C9A84C]/75">
              Unified Client Ledger
            </p>
            <h2 className="mt-1 flex items-center gap-2 text-base font-black text-white">
              <Wallet className="h-5 w-5 text-[#C9A84C]" aria-hidden />
              الملخص المالي الموحّد
            </h2>
          </div>
          {data.salesStage ? (
            <span
              className={`rounded-full border px-3 py-1 text-[10px] font-black ${salesStageBadgeClass(data.salesStage)}`}
            >
              {data.salesStage}
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MiniStat label="المدفوع" value={data.totals.paid} tone="emerald" />
          <MiniStat label="المتبقي" value={data.totals.remaining} tone="amber" />
          <MiniStat label="فواتير معلّقة" value={data.totals.pendingInvoices} tone="gold" />
        </div>
      </div>

      {data.quotations.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-[#1C4532]">
            <FileText className="h-4 w-4 text-[#C9A84C]" aria-hidden />
            عروض الأسعار
          </h3>
          <div className="space-y-3">
            {data.quotations.map((q) => (
              <div
                key={q.id}
                className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-black text-[#1C4532]">{q.title}</p>
                    <p className="mt-0.5 text-[10px] font-bold text-slate-500">{q.statusLabel}</p>
                  </div>
                  <Link
                    href={q.editUrl}
                    className="text-[10px] font-black text-[#C9A84C] hover:underline"
                  >
                    تعديل العرض
                  </Link>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
                  <div>
                    <p className="text-slate-400">الإجمالي</p>
                    <p className="mt-0.5 text-[#1C4532]" dir="ltr">
                      {formatInvoiceAmount(q.totalBudget)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">مدفوع</p>
                    <p className="mt-0.5 text-emerald-700" dir="ltr">
                      {formatInvoiceAmount(q.paidAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">متبقي</p>
                    <p className="mt-0.5 text-amber-700" dir="ltr">
                      {formatInvoiceAmount(q.remainingAmount)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {data.invoices.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-[#1C4532]">
            <Receipt className="h-4 w-4 text-[#C9A84C]" aria-hidden />
            سجل الفواتير
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-right text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400">
                  <th className="px-2 py-2">الرحلة</th>
                  <th className="px-2 py-2">المبلغ</th>
                  <th className="px-2 py-2">النوع</th>
                  <th className="px-2 py-2">الحالة</th>
                  <th className="px-2 py-2">رابط</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-50">
                    <td className="px-2 py-2.5 font-bold text-slate-700">
                      {inv.trip_title || '—'}
                    </td>
                    <td className="px-2 py-2.5 font-black text-[#1C4532]" dir="ltr">
                      {formatInvoiceAmount(inv.amount)}
                    </td>
                    <td className="px-2 py-2.5 text-slate-600">
                      {INVOICE_TYPE_LABEL[inv.type]}
                    </td>
                    <td className="px-2 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                          inv.status === 'paid'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {INVOICE_STATUS_LABEL[inv.status]}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex gap-1">
                        <a
                          href={buildInvoicePublicUrl(inv.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 rounded border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600"
                        >
                          <ExternalLink className="h-3 w-3" aria-hidden />
                          عرض
                        </a>
                        <button
                          type="button"
                          onClick={() => void copyLink(inv.id)}
                          className="inline-flex items-center gap-0.5 rounded border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600"
                        >
                          {copiedId === inv.id ? (
                            <Check className="h-3 w-3 text-emerald-600" aria-hidden />
                          ) : (
                            <Copy className="h-3 w-3" aria-hidden />
                          )}
                          نسخ
                        </button>
                        {inv.status !== 'paid' ? (
                          <InvoicePaymentWhatsAppButton
                            invoice={inv}
                            tripTitle={inv.trip_title || 'رحلتك'}
                            phone={inv.client_phone}
                            className="inline-flex items-center gap-0.5 rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800"
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {data.itineraries.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-[#1C4532]">
            <Map className="h-4 w-4 text-[#C9A84C]" aria-hidden />
            المسارات المرتبطة
          </h3>
          <ul className="space-y-2">
            {data.itineraries.map((it) => (
              <li
                key={it.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-black text-[#1C4532]">{it.title}</p>
                  <p className="text-[10px] font-semibold text-slate-500">
                    {it.tripType} · {it.slug}
                  </p>
                </div>
                <Link
                  href={it.viewUrl}
                  target="_blank"
                  className="text-[10px] font-black text-[#C9A84C] hover:underline"
                >
                  فتح المسار
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'gold' | 'emerald' | 'amber';
}) {
  const tones = {
    gold: 'border-[#C9A84C]/25 bg-[#C9A84C]/10 text-[#C9A84C]',
    emerald: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300',
    amber: 'border-amber-400/25 bg-amber-500/10 text-amber-200',
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${tones[tone]}`}>
      <p className="text-[10px] font-bold opacity-75">{label}</p>
      <p className="mt-1 text-lg font-black" dir="ltr">
        {formatInvoiceAmount(value)}
      </p>
    </div>
  );
}
