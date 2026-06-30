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

import { supabase } from '@/lib/supabase';
import {
  approveQuotation,
  calculateProfitFromMargin,
  formatDestinationsLabel,
  formatQuotationDateRange,
  isQuotationStatusApproved,
  mapQuotationRow,
  QUOTATION_STATUS_LABEL,
  quotationTotalPrice,
  type QuotationRow,
} from '@/lib/crm-quotations';
import { createItineraryFromApprovedQuotation } from '@/lib/quotation-to-itinerary';
import VipPwaInstallButton from '@/app/itinerary/_components/VipPwaInstallButton';

function formatSar(value: number): string {
  return `${value.toLocaleString('ar-SA')} ر.س`;
}

export default function PublicQuotationPage() {
  const params = useParams();
  const rawQuoteId = params?.id ?? (params as { quoteId?: string | string[] })?.quoteId;
  const quoteId = Array.isArray(rawQuoteId) ? rawQuoteId[0] : rawQuoteId;

  const [quotation, setQuotation] = useState<QuotationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
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

      const { data: quotationData, error: supabaseError } = await supabase
        .from('quotations')
        .select('*, clients(*)')
        .eq('id', quoteId)
        .single();

      if (cancelled) return;

      setFetchDebug({
        quoteId,
        supabaseError,
        rawData: quotationData,
      });

      if (supabaseError || !quotationData) {
        setQuotation(null);
        setLoading(false);
        return;
      }

      const row = mapQuotationRow(quotationData as Record<string, unknown>);
      setQuotation(row);
      setApproved(isQuotationStatusApproved(row.status));
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
      await approveQuotation(quoteId);

      const itineraryResult = await createItineraryFromApprovedQuotation(quotation);
      if (!itineraryResult) {
        console.error(
          'Failed to auto-create itinerary after quotation approval for quote:',
          quoteId,
        );
      } else {
        console.log('Auto-created itinerary from approved quotation:', itineraryResult);
      }

      setApproved(true);
      setQuotation((prev) => (prev ? { ...prev, status: 'approved' } : prev));
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
  const activities = quotation.activities_proposals.filter(
    (a) => a.name || a.description || a.price > 0,
  );
  const transports = quotation.transport_proposals.filter(
    (t) => t.description || t.mode || t.price > 0,
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
            تم استلام موافقتك، سيقوم مصمم رحلتك بالبدء في إجراءات الحجز المؤكد.
          </p>
          <p className="mt-6 text-sm text-white/40">{quotation.title}</p>
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

      {activities.length > 0 ? (
        <section className="mb-8">
          <SectionTitle icon={<Ticket className="h-4 w-4" />} title="الفعاليات" />
          <div className="space-y-3">
            {activities.map((activity) => (
              <article
                key={activity.id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm"
              >
                <p className="text-lg font-black text-[#FAFAFA]">{activity.name || '—'}</p>
                {activity.description ? (
                  <p className="mt-2 text-sm font-semibold text-white/50">{activity.description}</p>
                ) : null}
                {activity.price > 0 ? (
                  <p className="mt-2 text-sm font-black text-[#D4AF37]" dir="ltr">
                    {formatSar(activity.price)}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {transports.length > 0 ? (
        <section className="mb-8">
          <SectionTitle icon={<Bus className="h-4 w-4" />} title="المواصلات" />
          <div className="space-y-3">
            {transports.map((transport) => (
              <article
                key={transport.id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm"
              >
                <p className="text-lg font-black text-[#FAFAFA]">{transport.description || '—'}</p>
                {transport.mode ? (
                  <p className="mt-2 text-sm font-semibold text-white/50">{transport.mode}</p>
                ) : null}
                {transport.price > 0 ? (
                  <p className="mt-2 text-sm font-black text-[#D4AF37]" dir="ltr">
                    {formatSar(transport.price)}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
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
