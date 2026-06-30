'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  Clock,
  FileText,
  Inbox,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  Trash2,
  Users,
  X,
} from 'lucide-react';

import {
  convertLeadToQuotation,
  deleteCrmLead,
  quoteErrorMessage,
  whatsAppHref,
} from '@/lib/crm-lead-actions';
import {
  type CrmLeadRow,
  formatRelativeTimeArabic,
  formatTravelDateArabic,
  joinDestinations,
} from '@/lib/crm-leads';
import { translateLeadData, translateLeadList } from '@/lib/lead-data-localization';
import { supabase } from '@/lib/supabase';

type NewLeadsInboxProps = {
  leads: CrmLeadRow[];
  loading: boolean;
  warning?: string;
  onRefresh: () => void | Promise<void>;
};

const MODAL_SCROLL_CLASS =
  'overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="w-full border-b border-gray-100 py-3 text-right last:border-0">
      <p className="text-right text-[11px] font-black tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-right text-sm font-bold leading-relaxed text-gray-800">
        {value}
      </p>
    </div>
  );
}

function WhatsAppLink({ phone }: { phone: string }) {
  const href = whatsAppHref(phone);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex flex-row-reverse items-center gap-2 text-right font-bold text-emerald-700 transition hover:text-emerald-900"
      dir="ltr"
    >
      <MessageCircle className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
      <span>{phone}</span>
    </a>
  );
}

function LeadDetailModal({
  lead,
  onClose,
  onRefresh,
}: {
  lead: CrmLeadRow;
  onClose: () => void;
  onRefresh: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<'delete' | 'quote' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleDelete() {
    if (!supabase) {
      setActionError('Supabase غير مهيأ.');
      return;
    }
    const ok = window.confirm('هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع.');
    if (!ok) return;

    setBusy('delete');
    setActionError(null);
    try {
      await deleteCrmLead(supabase, lead.id);
      onClose();
      await onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'تعذر حذف الطلب.');
    } finally {
      setBusy(null);
    }
  }

  async function handleCreateQuote() {
    if (!supabase) {
      setActionError('Supabase غير مهيأ.');
      return;
    }

    setBusy('quote');
    setActionError(null);
    try {
      const quoteId = await convertLeadToQuotation(supabase, lead);
      onClose();
      await onRefresh();
      router.push(`/crm/quotations/new?edit=${encodeURIComponent(quoteId)}`);
    } catch (err) {
      console.error('Quote Creation Error:', err);
      setActionError(`تعذر إنشاء عرض السعر: ${quoteErrorMessage(err)}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lead-detail-title"
      dir="rtl"
      lang="ar"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-[95%] max-w-lg flex-col overflow-hidden rounded-t-2xl border border-[#D4AF37]/30 bg-white text-right shadow-2xl sm:max-h-[90vh] sm:w-full sm:rounded-2xl md:w-3/4 md:max-w-2xl lg:w-1/2 lg:max-w-3xl"
        dir="rtl"
        lang="ar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-gray-100 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-row items-start justify-between gap-3">
            <div className="min-w-0 flex-1 text-right">
              <p className="text-right text-[10px] font-black tracking-wide text-[#D4AF37] sm:text-[11px]">
                تفاصيل الطلب
              </p>
              <h3 id="lead-detail-title" className="mt-1 text-right text-lg font-black text-gray-900 sm:text-xl">
                {lead.full_name}
              </h3>
              <p className="mt-1 text-right text-[11px] font-semibold text-gray-500 sm:text-xs">
                {formatRelativeTimeArabic(lead.created_at)} · {translateLeadData(lead.form_type)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50"
              aria-label="إغلاق"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className={`min-h-0 flex-1 px-4 py-3 text-right sm:px-6 sm:py-4 ${MODAL_SCROLL_CLASS}`} dir="rtl">
          <div className="rounded-xl bg-[#FDFBF7] px-4 text-right">
            <DetailRow label="الوجهات" value={joinDestinations(lead.destinations)} />
            <DetailRow label="تاريخ السفر" value={formatTravelDateArabic(lead.travel_date)} />
            <DetailRow
              label="المدة والمسافرون"
              value={`${lead.travel_days} يوم · ${lead.travelers_count} مسافر`}
            />
            <div className="w-full border-b border-gray-100 py-3 text-right last:border-0">
              <p className="text-right text-[11px] font-black tracking-wide text-gray-400">الواتساب</p>
              <div className="mt-1 flex justify-start">
                <WhatsAppLink phone={lead.phone_wa} />
              </div>
            </div>
            {lead.email ? <DetailRow label="البريد" value={lead.email} /> : null}
            {lead.referral_code ? (
              <DetailRow label="كود الإحالة" value={lead.referral_code} />
            ) : null}
            {lead.budget ? (
              <DetailRow label="الميزانية" value={translateLeadData(lead.budget)} />
            ) : null}
            {lead.travel_style ? (
              <DetailRow label="مصدر التعارف" value={translateLeadData(lead.travel_style)} />
            ) : null}
            {lead.daily_pace ? (
              <DetailRow label="وتيرة اليوم" value={translateLeadData(lead.daily_pace)} />
            ) : null}
            {lead.walking_readiness ? (
              <DetailRow label="مدى المشي" value={translateLeadData(lead.walking_readiness)} />
            ) : null}
            {lead.day_start_time ? (
              <DetailRow label="بدء اليوم" value={translateLeadData(lead.day_start_time)} />
            ) : null}
            {lead.interests?.length ? (
              <DetailRow label="الاهتمامات" value={translateLeadList(lead.interests)} />
            ) : null}
            {lead.food_preferences?.length ? (
              <DetailRow label="الطعام" value={translateLeadList(lead.food_preferences)} />
            ) : null}
            {lead.accommodation_type?.length ? (
              <DetailRow label="الإقامة" value={translateLeadList(lead.accommodation_type)} />
            ) : null}
            <DetailRow label="الأفكار الختامية" value={lead.final_thoughts} />
          </div>

          {actionError ? (
            <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-right text-xs font-bold text-rose-800">
              {actionError}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 space-y-2 border-t border-gray-100 px-4 py-4 text-right sm:space-y-3 sm:px-6 sm:py-5" dir="rtl">
          <button
            type="button"
            onClick={() => void handleCreateQuote()}
            disabled={busy !== null}
            className="flex w-full flex-row-reverse items-center justify-center gap-2 rounded-xl bg-[#D4AF37] py-3 text-sm font-black text-[#1E2720] shadow-sm transition hover:bg-[#c4a030] disabled:opacity-60"
          >
            {busy === 'quote' ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <FileText className="h-4 w-4" aria-hidden />
            )}
            <span>إنشاء عرض سعر</span>
          </button>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              disabled={busy !== null}
              className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-center text-sm font-black text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
            >
              إغلاق
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={busy !== null}
              className="inline-flex flex-1 flex-row-reverse items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 py-2.5 text-sm font-black text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
            >
              {busy === 'delete' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="h-4 w-4" aria-hidden />
              )}
              <span>حذف الطلب</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function NewLeadsInbox({ leads, loading, warning, onRefresh }: NewLeadsInboxProps) {
  const [selected, setSelected] = useState<CrmLeadRow | null>(null);

  return (
    <div dir="rtl" lang="ar" className="text-right">
      <section className="mb-10" aria-label="الطلبات الجديدة">
        <h2 className="mb-4 text-lg font-black text-[#1E2720]">📥 صندوق الوارد — الطلبات الجديدة</h2>

        {warning ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-right text-xs font-bold text-amber-900">
            {warning}
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-[160px] flex-row items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-white/80">
            <Loader2 className="h-6 w-6 animate-spin text-[#D4AF37]" aria-hidden />
            <span className="text-sm font-bold text-gray-600">جاري تحميل الطلبات…</span>
          </div>
        ) : leads.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white/80 px-6 py-12 text-center">
            <Inbox className="mx-auto h-10 w-10 text-gray-300" aria-hidden />
            <p className="mt-4 text-sm font-bold text-gray-500">لا توجد طلبات جديدة حالياً</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {leads.map((lead) => (
              <article
                key={lead.id}
                className="group flex flex-col rounded-2xl border border-[#D4AF37]/25 bg-gradient-to-br from-white via-[#FEFDF9] to-[#FDFBF7] p-5 text-right shadow-sm ring-1 ring-[#D4AF37]/10 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex flex-row items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 text-right">
                    <p className="truncate text-base font-black text-gray-900">{lead.full_name}</p>
                    <p className="mt-1 flex flex-row items-center justify-start gap-1.5 text-xs font-semibold text-gray-500">
                      <Clock className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]" aria-hidden />
                      <span>{formatRelativeTimeArabic(lead.created_at)}</span>
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black text-emerald-800 ring-1 ring-emerald-200">
                    جديد
                  </span>
                </div>

                <div className="mt-4 space-y-2 text-right text-xs font-semibold text-gray-600">
                  <p className="flex flex-row items-start justify-start gap-2 leading-relaxed">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#D4AF37]" aria-hidden />
                    <span>{joinDestinations(lead.destinations)}</span>
                  </p>
                  <p className="flex flex-row items-center justify-start gap-2">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]" aria-hidden />
                    <span>{formatTravelDateArabic(lead.travel_date)}</span>
                  </p>
                  <p className="flex flex-row items-center justify-start gap-2">
                    <Users className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
                    <span>
                      {lead.travelers_count} مسافر · {lead.travel_days} يوم
                    </span>
                  </p>
                  <p className="flex flex-row items-center justify-start gap-2">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
                    <WhatsAppLink phone={lead.phone_wa} />
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelected(lead)}
                  className="mt-5 w-full rounded-xl border border-[#1E2720]/15 bg-[#1E2720] py-2.5 text-sm font-black text-[#D4AF37] shadow-sm transition group-hover:border-[#D4AF37]/40 hover:bg-[#2a352c]"
                >
                  عرض التفاصيل
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {selected ? (
        <LeadDetailModal lead={selected} onClose={() => setSelected(null)} onRefresh={onRefresh} />
      ) : null}
    </div>
  );
}
