'use client';

import { useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  Clock,
  Copy,
  Dna,
  FileText,
  Inbox,
  Kanban,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

import {
  revalidateCrmAfterRadarApprovalAction,
} from '@/app/actions/leadDnaWhatsAppActions';
import { ensureLeadClientAction } from '@/app/actions/submitCustomerLead';
import DnaInviteTripTypePicker from '@/app/crm/_components/DnaInviteTripTypePicker';
import {
  deleteCrmLead,
  quoteErrorMessage,
  whatsAppHref,
} from '@/lib/crm-lead-actions';
import {
  assertUsableLeadClientFields,
  buildClientDnaWelcomeUrlByClientId,
  buildDnaInviteWhatsAppPayload,
  isUsableClientName,
  isUsableClientPhone,
  markDnaLinkSent,
  type CrmLeadWithIntake,
  type DnaInviteTripType,
} from '@/lib/client-intake-pipeline';
import {
  formatRelativeTimeArabic,
  formatTravelDateArabic,
  joinDestinations,
} from '@/lib/crm-leads';
import { translateLeadData, translateLeadList } from '@/lib/lead-data-localization';
import { supabase } from '@/lib/supabase';

type NewLeadsInboxProps = {
  leads: CrmLeadWithIntake[];
  loading: boolean;
  warning?: string;
  onRefresh: () => void | Promise<void>;
  /** Optimistic remove from radar inbox after approval */
  onLeadApproved?: (leadId: string) => void;
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

function IntakeStatusBadge({ lead }: { lead: CrmLeadWithIntake }) {
  const intake = lead.intake;
  if (!intake) {
    return (
      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600 ring-1 ring-slate-200">
        قبل قبول العرض
      </span>
    );
  }
  if (intake.onboardingCompleted) {
    return (
      <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black text-emerald-800 ring-1 ring-emerald-200">
        DNA مكتمل
      </span>
    );
  }
  if (intake.dnaLinkSentAt) {
    return (
      <span className="shrink-0 rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-black text-sky-800 ring-1 ring-sky-200">
        رُسلت الدعوة
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-black text-violet-800 ring-1 ring-violet-200">
      DNA جاهز
    </span>
  );
}

function LeadDetailModal({
  lead,
  onClose,
  onRefresh,
  onLeadApproved,
}: {
  lead: CrmLeadWithIntake;
  onClose: () => void;
  onRefresh: () => void | Promise<void>;
  onLeadApproved?: (leadId: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<'delete' | 'quote' | 'whatsapp' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'dna' | 'calendar' | null>(null);
  const [tripType, setTripType] = useState<DnaInviteTripType>('private');
  const [approved, setApproved] = useState(false);
  const intake = lead.intake;
  const dnaUrl =
    intake?.clientId != null
      ? buildClientDnaWelcomeUrlByClientId(intake.clientId)
      : intake?.dnaUrl || '';

  async function copyText(value: string, kind: 'dna' | 'calendar') {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setActionError('تعذر النسخ إلى الحافظة.');
    }
  }

  /**
   * Manual DNA send — CHECK phone_wa first (unique_phone_wa), reuse id or insert stub.
   * Opens WhatsApp via a programmatic <a> click (more reliable than window.open after await).
   */
  async function handleSendWhatsApp(e?: MouseEvent) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!lead?.id) {
      setActionError('بيانات الطلب مفقودة.');
      return;
    }

    const nameToSave = String(lead.full_name ?? '').trim();
    const phoneToUse = String(lead.phone_wa ?? '').trim();

    if (!phoneToUse) {
      setActionError('رقم الجوال مفقود.');
      toast.error('رقم الجوال مفقود.');
      return;
    }

    try {
      assertUsableLeadClientFields({ name: nameToSave, phone: phoneToUse });
    } catch (validationErr) {
      const msg =
        validationErr instanceof Error
          ? validationErr.message
          : 'بيانات العميل ناقصة أو غير صالحة. تأكد من وجود رقم الجوال.';
      setActionError(msg);
      toast.error(msg);
      return;
    }

    setBusy('whatsapp');
    setActionError(null);
    try {
      // Always resolve via check-then-insert (reuse existing clients.id on duplicate phone)
      const ensured = await ensureLeadClientAction(lead.id, {
        name: nameToSave,
        phone: phoneToUse,
        email: lead.email ?? null,
      });
      if (!ensured.ok) {
        const raw = ensured.error || 'تعذر إنشاء ملف العميل تلقائياً من بيانات الطلب.';
        const msg = /23505|unique_phone_wa|duplicate key/i.test(raw)
          ? 'هذا الرقم مسجّل مسبقاً. أعد المحاولة — سيتم استخدام ملف العميل الحالي.'
          : raw;
        setActionError(msg);
        toast.error(msg);
        return;
      }
      const clientId = ensured.clientId;

      const { whatsAppUrl } = buildDnaInviteWhatsAppPayload(
        phoneToUse,
        clientId,
        tripType,
        window.location.origin,
      );

      // Hidden anchor click — avoids window.open popup blockers after async work
      const link = document.createElement('a');
      link.href = whatsAppUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(
        ensured.reusedExisting
          ? 'تم التعرف على عميل عائد — فُتح واتساب برابط DNA على ملفه الحالي.'
          : 'تم فتح واتساب برابط DNA — يمكنك الموافقة لاحقاً من الزر الذهبي.',
      );

      if (supabase) {
        void markDnaLinkSent(supabase, clientId).catch(() => undefined);
      }
      await onRefresh();
      if (approved) onClose();
    } catch (err) {
      console.error('Send DNA Error:', err);
      const raw = err instanceof Error ? err.message : '';
      const msg = /23505|unique_phone_wa|duplicate key/i.test(raw)
        ? 'حدث خطأ أثناء معالجة بيانات العميل — الرقم موجود مسبقاً.'
        : raw || 'حدث خطأ أثناء معالجة بيانات العميل.';
      setActionError(msg);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  async function handleRejectLead() {
    if (!supabase) {
      setActionError('Supabase غير مهيأ.');
      return;
    }
    const ok = window.confirm(
      'رفض هذا الطلب؟ سيُخفى من الرادار والكانبان (حالة: مرفوض).',
    );
    if (!ok) return;

    setBusy('delete');
    setActionError(null);
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: 'radar_rejected' })
        .eq('id', lead.id);
      if (error) throw error;
      toast.success('تم رفض الطلب وإخفاؤه من المسار');
      onClose();
      await onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'تعذر رفض الطلب.');
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (!supabase) {
      setActionError('Supabase غير مهيأ.');
      return;
    }
    const ok = window.confirm('هل أنت متأكد من حذف هذا الطلب نهائياً؟ لا يمكن التراجع.');
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

  async function handleApproveLead() {
    if (busy !== null) return;

    if (!lead?.id) {
      toast.error('خطأ: بيانات الطلب مفقودة');
      return;
    }

    if (!supabase) {
      toast.error('Supabase غير مهيأ.');
      return;
    }

    setBusy('quote');
    setActionError(null);

    try {
      const nameToSave = String(lead.full_name ?? '').trim();
      const phoneToSave = String(lead.phone_wa ?? '').trim();
      if (!isUsableClientName(nameToSave) || !isUsableClientPhone(phoneToSave)) {
        throw new Error(
          'بيانات العميل ناقصة أو غير صالحة. تأكد من وجود الاسم ورقم الجوال قبل الموافقة.',
        );
      }

      // 1) Database status first (SSOT) — must succeed
      const { error: dbError } = await supabase
        .from('leads')
        .update({ status: 'awaiting_dna' })
        .eq('id', lead.id);

      if (dbError) {
        throw new Error(dbError.message || 'فشل تحديث قاعدة البيانات');
      }

      // 1b) Smart recognition: reuse existing clients.id by phone_wa (returning customer)
      const ensured = await ensureLeadClientAction(lead.id, {
        name: nameToSave,
        phone: phoneToSave,
        email: lead.email ?? null,
      });
      if (!ensured.ok) {
        throw new Error(
          ensured.error || 'تعذر إنشاء ملف العميل في جدول clients — لن يظهر في قاعدة العملاء.',
        );
      }

      // 2) Instant UI: remove from radar list + bust cache — WhatsApp is manual-only below
      onLeadApproved?.(lead.id);
      setApproved(true);
      router.refresh();
      void revalidateCrmAfterRadarApprovalAction().catch((err) => {
        console.warn('[approve] revalidate skipped:', err);
      });

      toast.success(
        ensured.reusedExisting
          ? 'عميل عائد — رُبط الطلب بملفه الحالي. الرحلات الجديدة ستُضاف لنفس الملف. أرسل DNA من الزر أدناه.'
          : 'تمت الموافقة وأنشئ ملف العميل — أرسل رابط DNA يدوياً من الزر أدناه.',
        { duration: 5500 },
      );

      void onRefresh();
    } catch (error) {
      console.error('[approve] CRITICAL ERROR:', error);
      const message = quoteErrorMessage(error);
      setActionError(`تعذر إكمال الموافقة: ${message}`);
      toast.error('حدث خطأ أثناء قبول العميل، يرجى المحاولة مرة أخرى.');
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

          {intake ? (
            <div className="mt-4 rounded-xl border border-[#D4AF37]/25 bg-[#FEFDF9] p-4 text-right">
              <p className="text-[11px] font-black tracking-wide text-[#D4AF37]">أتمتة الاستقبال</p>
              <DnaInviteTripTypePicker
                value={tripType}
                onChange={setTripType}
                disabled={busy !== null}
                className="mt-3"
              />
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-gray-600">رابط DNA</span>
                  <div className="flex flex-row-reverse items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void copyText(dnaUrl, 'dna')}
                      className="inline-flex flex-row-reverse items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-[10px] font-black text-gray-700 hover:bg-white"
                    >
                      <Copy className="h-3 w-3" aria-hidden />
                      {copied === 'dna' ? 'تم النسخ' : 'نسخ'}
                    </button>
                    <a
                      href={dnaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-bold text-emerald-700 underline"
                      dir="ltr"
                    >
                      فتح
                    </a>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-gray-600">تقويم الاختيار</span>
                  <div className="flex flex-row-reverse items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void copyText(intake.bookingUrl, 'calendar')}
                      className="inline-flex flex-row-reverse items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-[10px] font-black text-gray-700 hover:bg-white"
                    >
                      <Copy className="h-3 w-3" aria-hidden />
                      {copied === 'calendar' ? 'تم النسخ' : 'نسخ'}
                    </button>
                    <a
                      href={intake.bookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-bold text-sky-700 underline"
                      dir="ltr"
                    >
                      فتح
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="shrink-0 space-y-2 border-t border-gray-100 px-4 py-4 text-right sm:space-y-3 sm:px-6 sm:py-5" dir="rtl">
          {actionError ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-right text-xs font-bold text-rose-800">
              {actionError}
            </p>
          ) : null}
          <button
            type="button"
            onClick={(e) => void handleSendWhatsApp(e)}
            disabled={busy !== null}
            className="flex w-full flex-row-reverse items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-3 text-sm font-black text-emerald-800 shadow-sm transition hover:bg-emerald-100 disabled:opacity-60"
          >
            {busy === 'whatsapp' ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <MessageCircle className="h-4 w-4" aria-hidden />
            )}
            <span>إرسال رابط DNA عبر واتساب (قبل الموافقة)</span>
          </button>

          {!approved ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void handleApproveLead();
            }}
            disabled={busy !== null}
            className="flex w-full flex-row-reverse items-center justify-center gap-2 rounded-xl bg-[#D4AF37] py-3 text-sm font-black text-[#1E2720] shadow-sm transition hover:bg-[#c4a030] disabled:opacity-60"
          >
            {busy === 'quote' ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <FileText className="h-4 w-4" aria-hidden />
            )}
            <span>موافقة على الطلب</span>
          </button>
          ) : (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-center text-xs font-bold text-emerald-900">
              تمت الموافقة — أرسل رابط DNA من الزر أعلاه، ثم أغلق النافذة.
            </p>
          )}

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
              onClick={() => void handleRejectLead()}
              disabled={busy !== null}
              className="inline-flex flex-1 flex-row-reverse items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 py-2.5 text-sm font-black text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
            >
              {busy === 'delete' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="h-4 w-4" aria-hidden />
              )}
              <span>رفض الطلب</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={busy !== null}
            className="w-full text-center text-[10px] font-bold text-gray-400 underline-offset-2 hover:text-rose-600 hover:underline disabled:opacity-60"
          >
            حذف نهائي من قاعدة البيانات
          </button>
        </div>
      </div>
    </div>
  );
}

export function NewLeadsInbox({
  leads,
  loading,
  warning,
  onRefresh,
  onLeadApproved,
}: NewLeadsInboxProps) {
  const [selected, setSelected] = useState<CrmLeadWithIntake | null>(null);

  return (
    <div dir="rtl" lang="ar" className="w-full text-right">
      <Toaster position="top-center" toastOptions={{ className: 'text-sm font-bold' }} />
      <section className="mb-10 w-full" aria-label="الطلبات الجديدة">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-black text-[#1E2720]">📥 صندوق الوارد — الطلبات الجديدة</h2>
          <Link
            href="/crm/pipeline"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4AF37]/35 bg-white px-3 py-1.5 text-[11px] font-black text-[#1E2720] transition hover:bg-[#FEF9EE]"
          >
            <Kanban className="h-3.5 w-3.5 text-amber-700" />
            لوحة الكانبان
          </Link>
        </div>

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
          <div className="flex w-full flex-col gap-4">
            {leads.map((lead) => (
              <article
                key={lead.id}
                className="group flex w-full flex-col rounded-2xl border border-[#D4AF37]/25 bg-gradient-to-br from-white via-[#FEFDF9] to-[#FDFBF7] p-5 text-right shadow-sm ring-1 ring-[#D4AF37]/10 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex flex-row items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 text-right">
                    <p className="break-words text-base font-black text-gray-900">{lead.full_name}</p>
                    <p className="mt-1 flex flex-row items-center justify-start gap-1.5 text-xs font-semibold text-gray-500">
                      <Clock className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]" aria-hidden />
                      <span>{formatRelativeTimeArabic(lead.created_at)}</span>
                    </p>
                  </div>
                  <IntakeStatusBadge lead={lead} />
                </div>

                {lead.intake ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex flex-row-reverse items-center gap-1 rounded-full bg-[#1E2720]/5 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                      <Dna className="h-3 w-3 text-violet-600" aria-hidden />
                      DNA
                    </span>
                    <span className="inline-flex flex-row-reverse items-center gap-1 rounded-full bg-[#1E2720]/5 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                      <CalendarDays className="h-3 w-3 text-sky-600" aria-hidden />
                      تقويم
                    </span>
                  </div>
                ) : null}

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
        <LeadDetailModal
          lead={selected}
          onClose={() => setSelected(null)}
          onRefresh={onRefresh}
          onLeadApproved={onLeadApproved}
        />
      ) : null}
    </div>
  );
}
