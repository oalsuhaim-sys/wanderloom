'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Loader2, MessageSquareWarning, Send } from 'lucide-react';

import {
  getQuotationForEditAction,
  resolveAndApproveQuotationAction,
  sendUpdatedQuotationAction,
} from '@/app/actions/quotationActions';
import { ClientFeedbackAlert } from '@/app/crm/quotations/_components/ClientFeedbackPanel';
import {
  formatDestinationsLabel,
  QUOTATION_STATUS_LABEL,
  quotationClientName,
  type QuotationRow,
} from '@/lib/crm-quotations';
import { hasClientFeedback } from '@/lib/interactive-quotation';

function feedbackFor(
  obj: Record<string, string> | undefined,
  key: string,
): string | null {
  const v = String(obj?.[key] ?? '').trim();
  return v || null;
}

function ClientNote({ text }: { text: string }) {
  return (
    <div className="mt-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
      <span className="inline-flex items-center gap-1">
        <MessageSquareWarning className="h-3.5 w-3.5" aria-hidden />
        ملاحظة العميل:
      </span>
      <p className="mt-1 leading-relaxed">{text}</p>
    </div>
  );
}

export default function AdminQuotationReviewPage() {
  const params = useParams();
  const rawId = params?.id;
  const quoteId = Array.isArray(rawId) ? rawId[0] : String(rawId ?? '').trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [row, setRow] = useState<QuotationRow | null>(null);
  const [busyAction, setBusyAction] = useState<'approve' | 'send' | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!quoteId) {
      setError('معرّف العرض غير صالح.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const result = await getQuotationForEditAction(quoteId);
    if (!result.ok) {
      setError(result.error);
      setRow(null);
      setLoading(false);
      return;
    }
    setRow(result.row);
    setLoading(false);
  }, [quoteId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const reviewNeeded = row?.status === 'needs_revision' || row?.status === 'client_responded';

  const notes = useMemo(() => {
    if (!row) return { general: null as string | null, days: {}, hotels: {}, transport: {} };
    const general = String(row.client_feedback.general ?? '').trim() || null;
    return {
      general,
      days: row.client_feedback.days ?? {},
      hotels: row.client_feedback.hotels ?? {},
      transport: row.client_feedback.transport ?? {},
    };
  }, [row]);

  if (loading) {
    return (
      <div dir="rtl" className="flex min-h-[60vh] items-center justify-center gap-2 text-slate-600">
        <Loader2 className="h-6 w-6 animate-spin text-[#C5A059]" aria-hidden />
        جارٍ تحميل مراجعة عرض السعر...
      </div>
    );
  }

  if (error || !row) {
    return (
      <div dir="rtl" className="mx-auto max-w-3xl p-6">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
          {error || 'تعذر تحميل العرض.'}
        </div>
        <div className="mt-4">
          <Link href="/crm/radar" className="text-sm font-black text-[#1A3B2A] underline">
            العودة إلى الرادار
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="mx-auto max-w-5xl p-4 sm:p-6">
      {toast ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-900">
          {toast}
        </div>
      ) : null}

      <header className="mb-6 rounded-3xl border border-[#C5A059]/40 bg-gradient-to-l from-[#FFFBF0] to-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#8A6B2A]">
              Review Mode
            </p>
            <h1 className="mt-1 text-2xl font-black text-[#1A3B2A]">{row.title || 'عرض سعر'}</h1>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              {quotationClientName(row)} · {formatDestinationsLabel(row.destinations)}
            </p>
          </div>
          <span className="rounded-full bg-[#1A3B2A] px-3 py-1 text-xs font-black text-[#D4AF37]">
            {QUOTATION_STATUS_LABEL[row.status]}
          </span>
        </div>
        {!reviewNeeded ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-700">
            لا توجد طلبات مراجعة نشطة على هذا العرض حالياً.
          </div>
        ) : null}
      </header>

      {hasClientFeedback(row.client_feedback) ? (
        <ClientFeedbackAlert feedback={row.client_feedback} className="mb-6" />
      ) : notes.general ? (
        <section className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <p className="flex items-center gap-2 text-sm font-black text-amber-900">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            ملاحظة عامة من العميل
          </p>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-amber-950">{notes.general}</p>
        </section>
      ) : null}

      <section className="mb-6 rounded-2xl border border-[#EFE5D6] bg-white p-5">
        <h2 className="text-lg font-black text-[#1A3B2A]">اليوم بيوم</h2>
        <div className="mt-3 space-y-3">
          {row.itinerary_days.length === 0 ? (
            <p className="text-sm font-semibold text-slate-500">لا يوجد أيام محفوظة.</p>
          ) : (
            row.itinerary_days.map((day) => {
              const dayNote = feedbackFor(notes.days, day.id);
              return (
                <article key={day.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-black text-[#8A6B2A]">
                    اليوم {day.dayNumber} {day.date ? `· ${day.date}` : ''} {day.city ? `· ${day.city}` : ''}
                  </p>
                  <p className="mt-1 text-sm font-black text-[#1A3B2A]">{day.title || `اليوم ${day.dayNumber}`}</p>
                  {day.description ? <p className="mt-1 text-xs font-semibold text-slate-600">{day.description}</p> : null}
                  {dayNote ? <ClientNote text={dayNote} /> : null}
                </article>
              );
            })
          )}
        </div>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[#EFE5D6] bg-white p-5">
          <h2 className="text-lg font-black text-[#1A3B2A]">خيارات الفنادق</h2>
          <div className="mt-3 space-y-3">
            {row.hotel_options.length === 0 ? (
              <p className="text-sm font-semibold text-slate-500">لا توجد خيارات فنادق محفوظة.</p>
            ) : (
              row.hotel_options.map((hotel) => {
                const note = feedbackFor(notes.hotels, hotel.id);
                return (
                  <article
                    key={hotel.id}
                    className={`rounded-xl border p-3 ${
                      hotel.is_selected_by_client
                        ? 'border-emerald-300 bg-emerald-50'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <p className="text-sm font-black text-[#1A3B2A]">{hotel.name || 'فندق'}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-600">{hotel.city}</p>
                    {hotel.description ? <p className="mt-1 text-xs font-semibold text-slate-600">{hotel.description}</p> : null}
                    {hotel.price > 0 ? (
                      <p className="mt-1 text-xs font-black text-amber-800" dir="ltr">
                        {hotel.price.toLocaleString('ar-SA')} ر.س
                      </p>
                    ) : null}
                    {hotel.is_selected_by_client ? (
                      <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-800">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                        ✅ Client Selected This Option
                      </p>
                    ) : null}
                    {note ? <ClientNote text={note} /> : null}
                  </article>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[#EFE5D6] bg-white p-5">
          <h2 className="text-lg font-black text-[#1A3B2A]">خيارات المواصلات</h2>
          <div className="mt-3 space-y-3">
            {row.transport_options.length === 0 ? (
              <p className="text-sm font-semibold text-slate-500">لا توجد خيارات مواصلات محفوظة.</p>
            ) : (
              row.transport_options.map((transport) => {
                const note = feedbackFor(notes.transport, transport.id);
                return (
                  <article
                    key={transport.id}
                    className={`rounded-xl border p-3 ${
                      transport.is_selected_by_client
                        ? 'border-emerald-300 bg-emerald-50'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <p className="text-sm font-black text-[#1A3B2A]">{transport.name || 'مواصلات'}</p>
                    {transport.description ? (
                      <p className="mt-1 text-xs font-semibold text-slate-600">{transport.description}</p>
                    ) : null}
                    {transport.price > 0 ? (
                      <p className="mt-1 text-xs font-black text-amber-800" dir="ltr">
                        {transport.price.toLocaleString('ar-SA')} ر.س
                      </p>
                    ) : null}
                    {transport.is_selected_by_client ? (
                      <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-800">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                        ✅ Client Selected This Option
                      </p>
                    ) : null}
                    {note ? <ClientNote text={note} /> : null}
                  </article>
                );
              })
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#EFE5D6] bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busyAction != null}
            onClick={async () => {
              setBusyAction('approve');
              const result = await resolveAndApproveQuotationAction(row.id);
              setBusyAction(null);
              if (!result.ok) {
                setToast(result.error);
                return;
              }
              setRow(result.row);
              setToast('تم حل المراجعة واعتماد العرض بنجاح ✨');
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"
          >
            {busyAction === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
            Mark as Resolved & Approve
          </button>
          <button
            type="button"
            disabled={busyAction != null}
            onClick={async () => {
              setBusyAction('send');
              const result = await sendUpdatedQuotationAction(row.id);
              setBusyAction(null);
              if (!result.ok) {
                setToast(result.error);
                return;
              }
              setRow(result.row);
              setToast('تم إرسال النسخة المحدثة للعميل — الحالة عادت لانتظار العميل.');
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1A3B2A] px-4 py-2.5 text-sm font-black text-[#D4AF37] disabled:opacity-60"
          >
            {busyAction === 'send' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
            Send Updated Quotation
          </button>
          <Link
            href={`/crm/quotations/edit/${encodeURIComponent(row.id)}`}
            className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-700"
          >
            تعديل العرض
          </Link>
        </div>
      </section>
    </div>
  );
}
