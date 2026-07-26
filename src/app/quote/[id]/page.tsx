'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Building2,
  Bus,
  CalendarDays,
  CheckCircle2,
  Loader2,
  MapPin,
  Plane,
  Sparkles,
  Ticket,
} from 'lucide-react';

import { approveQuotationAction } from '@/app/actions/quotationActions';
import { supabase } from '@/lib/supabase';
import {
  buildInvoicePublicUrl,
  formatInvoiceAmount,
  INVOICE_RECEIVABLE_DB_STATUSES,
  INVOICE_TYPE_LABEL,
  isInvoiceReceivableStatus,
  type InvoiceType,
} from '@/lib/crm-invoices';
import {
  calculateProfitFromMargin,
  extractClientQuoteActivities,
  extractClientQuoteTransportation,
  formatDestinationsLabel,
  formatQuotationDateRange,
  isQuotationStatusApproved,
  mapQuotationRow,
  PUBLIC_QUOTATION_SELECT,
  QUOTATION_STATUS_LABEL,
  quotationTotalPrice,
  type ClientQuoteActivity,
  type ClientQuoteTransport,
  type QuotationRow,
} from '@/lib/crm-quotations';
import { createItineraryFromApprovedQuotation } from '@/lib/quotation-to-itinerary';
import VipPwaInstallButton from '@/app/itinerary/_components/VipPwaInstallButton';

function formatSar(value: number): string {
  return `${value.toLocaleString('ar-SA')} ر.س`;
}

type PublicPendingInvoice = {
  id: string;
  amount: number;
  type: InvoiceType;
  url: string;
};

export default function PublicQuotationPage() {
  const params = useParams();
  const rawQuoteId = params?.id ?? (params as { quoteId?: string | string[] })?.quoteId;
  const quoteId = Array.isArray(rawQuoteId) ? rawQuoteId[0] : rawQuoteId;

  const [quotation, setQuotation] = useState<QuotationRow | null>(null);
  const [clientActivities, setClientActivities] = useState<ClientQuoteActivity[]>([]);
  const [clientTransportation, setClientTransportation] = useState<ClientQuoteTransport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [pendingInvoices, setPendingInvoices] = useState<PublicPendingInvoice[]>([]);
  const [fetchDebug, setFetchDebug] = useState<{
    quoteId: string | undefined;
    supabaseError: unknown;
    rawData: unknown;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError('');
      setFetchDebug(null);

      if (!quoteId) {
        if (!cancelled) {
          setFetchDebug({
            quoteId: undefined,
            supabaseError: null,
            rawData: null,
          });
          setQuotation(null);
          setLoading(false);
        }
        return;
      }

      if (!supabase) {
        if (!cancelled) {
          setFetchDebug({
            quoteId,
            supabaseError: { message: 'Supabase client is not configured.' },
            rawData: null,
          });
          setQuotation(null);
          setLoading(false);
        }
        return;
      }

      let quotationData: Record<string, unknown> | null = null;
      let supabaseError: { message?: string } | null = null;

      const primary = await supabase
        .from('quotations')
        .select(PUBLIC_QUOTATION_SELECT)
        .eq('id', quoteId)
        .single();

      if (!primary.error && primary.data) {
        quotationData = primary.data as Record<string, unknown>;
      } else {
        supabaseError = primary.error;
        const fallback = await supabase
          .from('quotations')
          .select('*, clients(*)')
          .eq('id', quoteId)
          .single();
        if (!fallback.error && fallback.data) {
          quotationData = fallback.data as Record<string, unknown>;
          supabaseError = null;
        } else if (fallback.error) {
          supabaseError = fallback.error;
        }
      }

      if (cancelled) return;

      setFetchDebug({
        quoteId,
        supabaseError,
        rawData: quotationData,
      });

      if (supabaseError || !quotationData) {
        setQuotation(null);
        setClientActivities([]);
        setClientTransportation([]);
        setLoading(false);
        return;
      }

      const record = quotationData as Record<string, unknown>;
      const row = mapQuotationRow(record);
      setQuotation(row);
      setClientActivities(extractClientQuoteActivities(record));
      setClientTransportation(extractClientQuoteTransportation(record));
      setApproved(
        isQuotationStatusApproved(row.status) ||
          row.status === 'awaiting_payment' ||
          row.status === 'deposit_paid' ||
          row.status === 'fully_paid',
      );

      const invoiceRes = await supabase
        .from('invoices')
        .select('id, amount, type, status')
        .eq('quote_id', quoteId)
        .in('status', [...INVOICE_RECEIVABLE_DB_STATUSES]);

      if (!cancelled) {
        const receivable = (invoiceRes.data ?? [])
          .filter((item) => isInvoiceReceivableStatus((item as { status?: unknown }).status))
          .map((item) => {
            const o = item as { id?: unknown; amount?: unknown; type?: unknown };
            const id = String(o.id ?? '').trim();
            const type = String(o.type ?? '').trim() === 'full' ? 'full' : 'deposit';
            return {
              id,
              amount: Number(o.amount) || 0,
              type: type as InvoiceType,
              url: buildInvoicePublicUrl(id),
            };
          })
          .filter((item) => item.id && item.amount > 0);
        setPendingInvoices(receivable);
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [quoteId]);

  const handleApprove = useCallback(async () => {
    if (!quoteId || !quotation || isQuotationStatusApproved(quotation.status) || approving) return;
    if (!supabase) {
      setError('Supabase غير مهيأ.');
      return;
    }

    setApproving(true);
    setError('');
    try {
      const result = await approveQuotationAction(quoteId);
      if (!result.ok) throw new Error(result.error);

      const approvedRow = result.row;

      setApproved(true);
      setQuotation((prev) =>
        prev
          ? { ...prev, ...approvedRow, status: 'approved' }
          : { ...approvedRow, status: 'approved' },
      );

      try {
        const itineraryResult = await createItineraryFromApprovedQuotation({
          ...quotation,
          ...approvedRow,
          status: 'approved',
        });
        if (!itineraryResult) {
          console.error(
            'Failed to auto-create itinerary after quotation approval for quote:',
            quoteId,
          );
        }
      } catch (itineraryErr) {
        console.error('Itinerary auto-create after approval:', itineraryErr);
      }
    } catch (e) {
      console.error('Approval Update Error:', e);
      setError(e instanceof Error ? e.message : 'تعذر اعتماد العرض. حاول مرة أخرى.');
    } finally {
      setApproving(false);
    }
  }, [quoteId, quotation, approving]);

  if (loading) {
    return (
      <PageShell>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-[#D4AF37]">
          <Loader2 className="h-10 w-10 animate-spin" aria-hidden />
          <p className="text-sm font-bold text-white/60">جاري تحميل عرضكم الخاص…</p>
        </div>
      </PageShell>
    );
  }

  if (!loading && !quotation) {
    const debugQuoteId = fetchDebug?.quoteId ?? quoteId;
    const debugError = fetchDebug?.supabaseError ?? null;
    const debugData = fetchDebug?.rawData ?? null;

    return (
      <div
        className="min-h-screen p-10 text-left"
        dir="ltr"
        style={{ backgroundColor: '#1a1a1a', color: '#ff6b6b' }}
      >
        <h2 className="mb-4 text-2xl font-bold">🔍 System X-Ray (Debug Mode)</h2>
        <p className="mb-2">
          <strong className="text-white">Extracted URL ID:</strong>{' '}
          {debugQuoteId || 'UNDEFINED'}
        </p>
        <p className="mb-2">
          <strong className="text-white">Supabase Error:</strong>{' '}
          {debugError ? JSON.stringify(debugError, null, 2) : 'No explicit error (Data is null)'}
        </p>
        <p className="mb-2">
          <strong className="text-white">Data Returned:</strong> {JSON.stringify(debugData)}
        </p>
      </div>
    );
  }

  if (!quotation) return null;

  const grandTotal = quotationTotalPrice(quotation);
  const marginProfit = calculateProfitFromMargin(
    quotation.total_estimated_cost,
    quotation.profit_margin,
  );
  const usesNewPricing = quotation.service_fee > 0 || quotation.grand_total > 0;
  const legacyServiceFee = !usesNewPricing ? quotation.expected_profit : 0;
  const flights = quotation.flight_proposals.filter(
    (f) => f.departureCity || f.arrivalCity || f.airline || f.flight_class || f.price > 0,
  );
  const hotels = quotation.hotel_proposals.filter(
    (h) => h.hotel_name || h.city || h.room_type || h.price > 0,
  );

  if (approved) {
    return (
      <PageShell>
        <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 shadow-[0_0_40px_rgba(212,175,55,0.25)]">
            <CheckCircle2 className="h-10 w-10 text-[#D4AF37]" aria-hidden />
          </div>
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-4 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#D4AF37]">
            <Sparkles className="h-3 w-3" aria-hidden />
            {QUOTATION_STATUS_LABEL.approved}
          </span>
          <h1 className="text-2xl font-black text-[#FAFAFA] sm:text-3xl">شكراً لثقتكم</h1>
          <p className="mt-4 text-base font-semibold leading-relaxed text-white/70">
            {pendingInvoices.length > 0
              ? 'تم استلام موافقتكم. يُرجى إتمام السداد عبر الفاتورة أدناه لتأكيد الحجز.'
              : 'تم استلام موافقتك، سيقوم مصمم رحلتك بالبدء في إجراءات الحجز المؤكد.'}
          </p>
          <p className="mt-6 text-sm text-white/40">{quotation.title}</p>

          {pendingInvoices.length > 0 ? (
            <section className="mt-10 w-full max-w-md text-right">
              <div className="mb-4 text-center">
                <h2 className="text-lg font-black text-amber-200">🧾 فواتير بانتظار السداد</h2>
              </div>
              <div className="space-y-3">
                {pendingInvoices.map((invoice) => (
                  <article
                    key={invoice.id}
                    className="rounded-2xl border border-amber-400/35 bg-gradient-to-b from-amber-950/40 to-[#111412] p-5 text-right shadow-[0_0_40px_rgba(245,158,11,0.1)]"
                  >
                    <p className="text-sm font-black text-amber-100">
                      {INVOICE_TYPE_LABEL[invoice.type]}
                    </p>
                    <p className="mt-2 text-2xl font-black text-[#D4AF37]" dir="ltr">
                      {formatInvoiceAmount(invoice.amount)}
                    </p>
                    <a
                      href={invoice.url}
                      className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[#D4AF37] px-4 py-3.5 text-sm font-black text-[#0D0F0E] transition hover:brightness-110"
                    >
                      اضغط للسداد
                    </a>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <header className="mb-10 text-center">
        <div className="mb-5 flex justify-center">
          <VipPwaInstallButton label="تثبيت تطبيق Wanderloom" />
        </div>
        <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#D4AF37]/90">
          Wanderloom Private Travel
        </p>
        <h1 className="mt-4 text-3xl font-black leading-tight text-[#D4AF37] sm:text-4xl">
          مقترح رحلة حصري
        </h1>
        <p className="mt-4 text-2xl font-black text-[#FAFAFA] sm:text-3xl">
          {quotation.title || 'رحلتكم القادمة'}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-sm font-semibold text-white/55">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-[#D4AF37]" aria-hidden />
            {formatQuotationDateRange(quotation.start_date, quotation.end_date)}
          </span>
          {quotation.destinations.length > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-[#D4AF37]" aria-hidden />
              {formatDestinationsLabel(quotation.destinations)}
            </span>
          ) : null}
        </div>
      </header>

      {flights.length > 0 ? (
        <section className="mb-8">
          <SectionTitle icon={<Plane className="h-4 w-4" />} title="مقترحات الطيران" />
          <div className="space-y-3">
            {flights.map((flight) => (
              <article
                key={flight.id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-lg font-black text-[#FAFAFA]" dir="ltr">
                    {flight.departureCity || '—'}
                    <span className="mx-2 text-[#D4AF37]">→</span>
                    {flight.arrivalCity || '—'}
                  </p>
                  {flight.flight_class ? (
                    <span className="rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-0.5 text-xs font-bold text-[#D4AF37]">
                      {flight.flight_class}
                    </span>
                  ) : null}
                </div>
                {flight.airline ? (
                  <p className="mt-2 text-sm font-semibold text-white/50">{flight.airline}</p>
                ) : null}
                {flight.price > 0 ? (
                  <p className="mt-2 text-sm font-black text-[#D4AF37]" dir="ltr">
                    {formatSar(flight.price)}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {hotels.length > 0 ? (
        <section className="mb-8">
          <SectionTitle icon={<Building2 className="h-4 w-4" />} title="مقترحات الإقامة" />
          <div className="space-y-3">
            {hotels.map((hotel) => (
              <article
                key={hotel.id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm"
              >
                <p className="text-lg font-black text-[#FAFAFA]">{hotel.hotel_name || '—'}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-white/50">
                  {hotel.city ? <span>{hotel.city}</span> : null}
                  {hotel.room_type ? (
                    <span className="text-[#D4AF37]">· {hotel.room_type}</span>
                  ) : null}
                </div>
                {hotel.price > 0 ? (
                  <p className="mt-2 text-sm font-black text-[#D4AF37]" dir="ltr">
                    {formatSar(hotel.price)}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {clientActivities.length > 0 ? (
        <div className="mb-8">
          <h3 className="mb-4 flex items-center gap-2 text-xl font-bold text-[#D4AF37]">
            <Ticket className="h-6 w-6" aria-hidden />
            الفعاليات المقترحة
          </h3>
          <div className="rounded-xl border border-[#1e2420] bg-[#111412] p-4">
            {clientActivities.map((activity, idx) => (
              <div
                key={`activity-${idx}-${activity.title}`}
                className="border-b border-[#1e2420] py-3 last:border-0"
              >
                <h4 className="text-lg font-bold text-white">{activity.title}</h4>
                {activity.location ? (
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-gray-400">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]" aria-hidden />
                    {activity.location}
                  </p>
                ) : null}
                {activity.description ? (
                  <p className="mt-1 text-sm text-gray-400">{activity.description}</p>
                ) : null}
                {activity.price > 0 ? (
                  <p className="mt-2 text-sm font-black text-[#D4AF37]" dir="ltr">
                    {formatSar(activity.price)}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {clientTransportation.length > 0 ? (
        <div className="mb-8">
          <h3 className="mb-4 flex items-center gap-2 text-xl font-bold text-[#D4AF37]">
            <Bus className="h-6 w-6" aria-hidden />
            تفاصيل المواصلات
          </h3>
          <div className="rounded-xl border border-[#1e2420] bg-[#111412] p-4">
            {clientTransportation.map((trans, idx) => (
              <div
                key={`transport-${idx}-${trans.title}`}
                className="border-b border-[#1e2420] py-3 last:border-0"
              >
                <h4 className="text-lg font-bold text-white">{trans.type || trans.title}</h4>
                {trans.description ? (
                  <p className="mt-1 text-sm text-gray-400">{trans.description}</p>
                ) : null}
                {trans.price > 0 ? (
                  <p className="mt-2 text-sm font-black text-[#D4AF37]" dir="ltr">
                    {formatSar(trans.price)}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-[#D4AF37]/50 bg-gradient-to-br from-[#0D0F0E] via-[#1A2520] to-[#0D0F0E] p-6 shadow-[0_16px_48px_rgba(0,0,0,0.35)] ring-1 ring-[#D4AF37]/25">
        <div className="mb-5 text-center">
          <h2 className="text-xl font-black text-[#FAFAFA] sm:text-2xl">المقترح المالي</h2>
          <p className="mt-1 text-xs font-semibold text-white/45">
            تقدير شامل — يُؤكَّد رسمياً بعد اعتمادكم
          </p>
        </div>

        <div className="space-y-2.5">
          <SummaryRow
            label="التكلفة التقديرية للرحلة"
            value={formatSar(quotation.total_estimated_cost)}
          />
          {usesNewPricing && marginProfit > 0 ? (
            <SummaryRow label="هامش الخدمة" value={formatSar(marginProfit)} />
          ) : null}
          {quotation.service_fee > 0 ? (
            <SummaryRow label="رسوم خدمة Wanderloom" value={formatSar(quotation.service_fee)} />
          ) : legacyServiceFee > 0 ? (
            <SummaryRow label="رسوم خدمة وإدارة" value={formatSar(legacyServiceFee)} />
          ) : null}
          <div className="mt-5 rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-4 py-6 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#D4AF37]/80">
              الإجمالي المطلوب
            </p>
            <p className="mt-2 text-4xl font-black text-[#D4AF37] sm:text-5xl" dir="ltr">
              {formatSar(grandTotal)}
            </p>
          </div>
        </div>

        {error ? (
          <p className="mt-4 text-center text-sm font-bold text-red-300">{error}</p>
        ) : null}

        <button
          type="button"
          onClick={() => void handleApprove()}
          disabled={approving}
          className="mt-6 w-full rounded-2xl bg-gradient-to-l from-[#D4AF37] via-[#C9A227] to-[#B8941F] px-6 py-5 text-lg font-black text-[#0D0F0E] shadow-[0_0_32px_rgba(212,175,55,0.45)] ring-2 ring-[#D4AF37]/60 transition hover:brightness-110 hover:shadow-[0_0_48px_rgba(212,175,55,0.55)] active:scale-[0.99] disabled:opacity-60"
        >
          {approving ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              جاري الاعتماد…
            </span>
          ) : (
            'اعتماد العرض والمضي قدماً ✨'
          )}
        </button>
      </section>

      <p className="mt-10 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25">
        Wanderloom · Confidential Quotation
      </p>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen bg-[#0D0F0E] px-4 py-10 text-white sm:px-6"
      dir="rtl"
      lang="ar"
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-[#D4AF37]/5 blur-3xl" />
        <div className="absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-[#1A2520]/80 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-2xl">{children}</div>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h2 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-[#D4AF37]">
      {icon}
      {title}
    </h2>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <span className="text-sm font-bold text-white/75">{label}</span>
      <span className="text-sm font-black text-[#D4AF37]" dir="ltr">
        {value}
      </span>
    </div>
  );
}
