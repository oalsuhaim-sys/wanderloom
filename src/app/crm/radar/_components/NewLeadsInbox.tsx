'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Copy,
  FileText,
  Loader2,
  MessageCircle,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import {
  revalidateCrmAfterRadarApprovalAction,
} from '@/app/actions/leadDnaWhatsAppActions';
import { ClientReferralBadge } from '@/components/crm/ClientReferralBadge';
import { approveGroupLeadFromInbox } from '@/app/actions/groupOnboardingActions';
import {
  handleAcceptRequest,
  handleRejectRequest,
} from '@/app/actions/leadRequestActions';
import DnaInviteTripTypePicker from '@/app/crm/_components/DnaInviteTripTypePicker';
import { showCrmSuccessToast } from '@/components/CrmLuxuryToaster';
import {
  deleteCrmLead,
  formatWhatsAppPhone,
  quoteErrorMessage,
  whatsAppHref,
  whatsAppHrefWithMessage,
} from '@/lib/crm-lead-actions';
import {
  buildClientDnaWelcomeUrlByClientId,
  type CrmLeadWithIntake,
  type DnaInviteTripType,
} from '@/lib/client-intake-pipeline';
import { supabase } from '@/lib/supabase';
import {
  formatRelativeTimeArabic,
  formatTravelDateArabic,
  isExplicitGroupTripLead,
  joinDestinations,
  resolveLeadBookingChannelLabel,
} from '@/lib/crm-leads';
import { translateLeadData, translateLeadList } from '@/lib/lead-data-localization';
import { instantDnaStage, instantDnaStageLabel, type InstantDnaStage } from '@/lib/instant-dna-status';

type NewLeadsInboxProps = {
  leads: CrmLeadWithIntake[];
  meetingLeads?: CrmLeadWithIntake[];
  interestLeads?: CrmLeadWithIntake[];
  panel?: 'inbox' | 'meetings' | 'interests';
  /** Demo meeting card when inbox, meetings, and interests are all empty. */
  showSample?: boolean;
  loading: boolean;
  warning?: string;
  onRefresh: () => void | Promise<void>;
  /** Optimistic remove from radar inbox after approval */
  onLeadApproved?: (leadId: string) => void;
  /** Inbox lead moved to the client-meetings column. */
  onMovedToMeeting?: (leadId: string) => void;
  /** Switch the radar tabs to the meetings column. `sample` counts the demo card. */
  onShowMeetings?: (options?: { sample?: boolean }) => void;
};

const MODAL_SCROLL_CLASS =
  'overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="w-full border-b border-slate-100 py-3 text-right last:border-0">
      <p className="text-right text-xs font-medium tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-right text-sm font-medium leading-relaxed text-slate-800">
        {value}
      </p>
    </div>
  );
}

function formatLeadDetailLine(label: string, value: string | null | undefined): string | null {
  const v = String(value ?? '').trim();
  if (!v || v === '—') return null;
  return `• ${label}: ${v}`;
}

/** نص واتساب مرتب بكل تفاصيل الطلب — يُفتح بدون رقم لاختيار الخبير من جهات الاتصال */
function buildLeadRequestWhatsAppMessage(lead: CrmLeadWithIntake): string {
  const durationTravelers = `${lead.travel_days || '—'} يوم · ${lead.travelers_count || '—'} مسافر`;
  const lines = [
    '📋 *تفاصيل طلب رحلة — Wanderloom*',
    '',
    formatLeadDetailLine('الاسم', lead.full_name),
    formatLeadDetailLine('الجوال', lead.phone_wa),
    formatLeadDetailLine('البريد', lead.email),
    formatLeadDetailLine('الوجهات', joinDestinations(lead.destinations)),
    formatLeadDetailLine('تاريخ السفر', formatTravelDateArabic(lead.travel_date)),
    formatLeadDetailLine('المدة والمسافرون', durationTravelers),
    formatLeadDetailLine('الميزانية', lead.budget ? translateLeadData(lead.budget) : null),
    formatLeadDetailLine(
      'أسلوب الرحلة',
      lead.travel_style === 'Group'
        ? 'جماعية'
        : lead.travel_style === 'Private'
          ? 'خاصة'
          : lead.travel_style
            ? translateLeadData(lead.travel_style)
            : null,
    ),
    formatLeadDetailLine(
      'مصدر التعارف',
      lead.lead_source ? translateLeadData(lead.lead_source) : null,
    ),
    formatLeadDetailLine(
      'وتيرة اليوم',
      lead.daily_pace ? translateLeadData(lead.daily_pace) : null,
    ),
    formatLeadDetailLine(
      'مدى المشي',
      lead.walking_readiness ? translateLeadData(lead.walking_readiness) : null,
    ),
    formatLeadDetailLine(
      'بدء اليوم',
      lead.day_start_time ? translateLeadData(lead.day_start_time) : null,
    ),
    formatLeadDetailLine(
      'الاهتمامات',
      lead.interests?.length ? translateLeadList(lead.interests) : null,
    ),
    formatLeadDetailLine(
      'الطعام',
      lead.food_preferences?.length ? translateLeadList(lead.food_preferences) : null,
    ),
    formatLeadDetailLine(
      'الإقامة',
      lead.accommodation_type?.length ? translateLeadList(lead.accommodation_type) : null,
    ),
    formatLeadDetailLine('كود الإحالة', lead.referral_code),
    formatLeadDetailLine(
      'نوع النموذج',
      lead.form_type ? translateLeadData(lead.form_type) : null,
    ),
    formatLeadDetailLine('الأفكار الختامية', lead.final_thoughts),
    '',
    '_يرجى مراجعة التفاصيل والتواصل عند الحاجة._',
  ].filter((line): line is string => line != null);

  return lines.join('\n');
}

function openWhatsAppShareText(message: string) {
  const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
  onLeadApproved,
}: {
  lead: CrmLeadWithIntake;
  onClose: () => void;
  onRefresh: () => void | Promise<void>;
  onLeadApproved?: (leadId: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<'delete' | 'quote' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'dna' | 'calendar' | null>(null);
  const [tripType, setTripType] = useState<DnaInviteTripType>('private');
  const [approved, setApproved] = useState(false);
  const [acceptedDnaUrl, setAcceptedDnaUrl] = useState<string | null>(null);
  const [acceptedClientId, setAcceptedClientId] = useState<number | null>(null);
  const intake = lead.intake;
  const dnaUrl =
    acceptedDnaUrl ||
    (intake?.clientId != null
      ? buildClientDnaWelcomeUrlByClientId(intake.clientId)
      : intake?.dnaUrl || '');

  function handleShareDetailsWhatsApp() {
    try {
      const message = buildLeadRequestWhatsAppMessage(lead);
      openWhatsAppShareText(message);
      toast.success('تم فتح واتساب — اختر الخبير من جهات الاتصال لإرسال التفاصيل');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر فتح واتساب.';
      setActionError(msg);
      toast.error(msg);
    }
  }

  async function copyText(value: string, kind: 'dna' | 'calendar') {
    if (!value?.trim()) {
      toast.error(kind === 'dna' ? 'تعذر العثور على رابط DNA للنسخ' : 'تعذر العثور على رابط التقويم للنسخ');
      return;
    }
    try {
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        const textArea = document.createElement('textarea');
        textArea.value = value;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(kind);
      if (kind === 'dna') {
        toast.success('تم نسخ رابط الـ DNA بنجاح! 📋');
      }
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setActionError('تعذر النسخ إلى الحافظة.');
      toast.error('تعذر النسخ إلى الحافظة.');
    }
  }

  async function handleRejectLead() {
    if (!lead?.id) {
      setActionError('بيانات الطلب مفقودة.');
      return;
    }
    const ok = window.confirm(
      'رفض هذا الطلب نهائياً؟ سيُزال من طابور الطلبات الواردة (هذا ليس إضافة لقاعدة العملاء النشطة).',
    );
    if (!ok) return;

    setBusy('delete');
    setActionError(null);
    try {
      const result = await handleRejectRequest(lead.id);
      if (!result.ok) throw new Error(result.error);
      toast.success(result.message || 'تم رفض الطلب وإزالته من الطابور.');
      onLeadApproved?.(lead.id);
      onClose();
      await onRefresh();
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'تعذر رفض الطلب.');
      toast.error(err instanceof Error ? err.message : 'تعذر رفض الطلب.');
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

    setBusy('quote');
    setActionError(null);

    try {
      if (isExplicitGroupTripLead(lead)) {
        const result = await approveGroupLeadFromInbox(lead.id);
        if (!result.ok) throw new Error(result.error);
        showCrmSuccessToast(result.message, { duration: 4000 });
        onLeadApproved?.(lead.id);
        onClose();
        await onRefresh();
        router.refresh();
        return;
      }

      const nameToSave = String(lead.full_name ?? '').trim();
      const phoneToSave = String(lead.phone_wa ?? '').trim();
      if (!nameToSave && !phoneToSave) {
        throw new Error('بيانات الطلب فارغة — لا يمكن الموافقة بدون اسم أو رقم.');
      }

      const result = await handleAcceptRequest(lead.id, {
        origin: typeof window !== 'undefined' ? window.location.origin : null,
      });
      if (!result.ok) {
        throw new Error(result.error || 'تعذر قبول الطلب.');
      }

      const surveyUrl =
        result.dnaUrl ||
        (result.dnaKey || result.clientId != null
          ? buildClientDnaWelcomeUrlByClientId(
              result.dnaKey || String(result.clientId ?? lead.id),
              window.location.origin,
              tripType,
            )
          : '');

      setAcceptedClientId(result.clientId);
      setAcceptedDnaUrl(surveyUrl || null);
      onLeadApproved?.(lead.id);
      setApproved(true);
      router.refresh();
      void revalidateCrmAfterRadarApprovalAction().catch((err) => {
        console.warn('[approve] revalidate skipped:', err);
      });

      showCrmSuccessToast(result.message || 'تمت الموافقة — رابط DNA جاهز للنسخ أو واتساب', {
        duration: 4000,
      });

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

  function openAcceptedDnaWhatsApp() {
    const resolvedClientId = acceptedClientId ?? intake?.clientId ?? lead.client_id;
    const url =
      acceptedDnaUrl ||
      dnaUrl ||
      (resolvedClientId != null
        ? buildClientDnaWelcomeUrlByClientId(resolvedClientId, window.location.origin, tripType)
        : '');
    const rawPhone = String(lead.phone_wa ?? '').trim();
    const cleanPhone = formatWhatsAppPhone(rawPhone);
    if (!cleanPhone || cleanPhone.length < 8) {
      toast.error('رقم جوال العميل غير متوفر!');
      return;
    }
    if (!url) {
      toast.error('رابط DNA غير جاهز بعد.');
      return;
    }
    try {
      const clientName = String(lead.full_name ?? 'عزيزنا العميل');
      const message = `مرحباً ${clientName}، يسعدنا البدء في تنظيم رحلتك! نرجو منك إكمال ملف DNA السفر الخاص بك عبر الرابط التالي:\n${url}`;
      const waUrl = whatsAppHrefWithMessage(cleanPhone, message);
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذر فتح واتساب.');
    }
  }

  return createPortal(
    <div
      className="crm-modal-overlay fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lead-detail-title"
      dir="rtl"
      lang="ar"
      onClick={onClose}
    >
      <div
        className="relative my-auto flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white text-right shadow-2xl sm:max-w-2xl md:max-w-2xl lg:max-w-3xl"
        dir="rtl"
        lang="ar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-row items-start justify-between gap-3">
            <div className="min-w-0 flex-1 text-right">
              <p className="text-right text-xs font-medium tracking-wide text-slate-500 sm:text-xs">
                تفاصيل الطلب
              </p>
              <h3 id="lead-detail-title" className="mt-1 text-right text-lg font-semibold text-slate-900 sm:text-xl">
                {lead.full_name}
              </h3>
              <p className="mt-1 text-right text-xs text-slate-500">
                {formatRelativeTimeArabic(lead.created_at)} · {translateLeadData(lead.form_type)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
              aria-label="إغلاق"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className={`min-h-0 flex-1 px-4 py-3 text-right sm:px-6 sm:py-4 ${MODAL_SCROLL_CLASS}`} dir="rtl">
          <div className="rounded-xl bg-slate-50/80 px-4 text-right">
            <DetailRow label="الوجهات" value={joinDestinations(lead.destinations)} />
            <DetailRow label="تاريخ السفر" value={formatTravelDateArabic(lead.travel_date)} />
            <DetailRow
              label="المدة والمسافرون"
              value={`${lead.travel_days} يوم · ${lead.travelers_count} مسافر`}
            />
            <div className="w-full border-b border-slate-100 py-3 text-right last:border-0">
              <p className="text-right text-xs font-medium tracking-wide text-slate-400">الواتساب</p>
              <div className="mt-1 flex justify-start">
                <WhatsAppLink phone={lead.phone_wa} />
              </div>
            </div>
            {lead.email ? <DetailRow label="البريد" value={lead.email} /> : null}
            {lead.referral_code ? (
              <div className="w-full border-b border-slate-100 py-3 text-right last:border-0">
                <p className="text-right text-xs font-medium tracking-wide text-slate-400">كود الإحالة</p>
                <div className="mt-2">
                  <ClientReferralBadge
                    clientName={String(lead.full_name ?? '').trim() || 'عميل'}
                    referralCodeUsed={lead.referral_code}
                  />
                </div>
              </div>
            ) : null}
            {lead.budget ? (
              <DetailRow label="الميزانية" value={translateLeadData(lead.budget)} />
            ) : null}
            {lead.travel_style ? (
              <DetailRow
                label="أسلوب الرحلة"
                value={
                  lead.travel_style === 'Group'
                    ? 'جماعية'
                    : lead.travel_style === 'Private'
                      ? 'خاصة'
                      : translateLeadData(lead.travel_style)
                }
              />
            ) : null}
            {lead.lead_source ? (
              <DetailRow label="مصدر التعارف" value={translateLeadData(lead.lead_source)} />
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
            <div className="mt-4 rounded-xl border border-slate-100 bg-white p-4 text-right shadow-sm">
              <p className="text-xs font-medium tracking-wide text-slate-500">أتمتة الاستقبال</p>
              <DnaInviteTripTypePicker
                value={tripType}
                onChange={setTripType}
                disabled={busy !== null}
                className="mt-3"
              />
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-500">رابط DNA</span>
                  <div className="flex flex-row-reverse items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void copyText(dnaUrl, 'dna')}
                      className="inline-flex flex-row-reverse items-center gap-1 rounded-full bg-white px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                    >
                      <Copy className="h-3 w-3 text-slate-400" aria-hidden />
                      {copied === 'dna' ? 'تم النسخ' : 'نسخ'}
                    </button>
                    <a
                      href={dnaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-emerald-700 underline"
                      dir="ltr"
                    >
                      فتح
                    </a>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-500">تقويم الاختيار</span>
                  <div className="flex flex-row-reverse items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void copyText(intake.bookingUrl, 'calendar')}
                      className="inline-flex flex-row-reverse items-center gap-1 rounded-full bg-white px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                    >
                      <Copy className="h-3 w-3 text-slate-400" aria-hidden />
                      {copied === 'calendar' ? 'تم النسخ' : 'نسخ'}
                    </button>
                    <a
                      href={intake.bookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-sky-700 underline"
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

        <div className="shrink-0 space-y-2 border-t border-slate-100 px-4 py-4 text-right sm:space-y-3 sm:px-6 sm:py-5" dir="rtl">
          {actionError ? (
            <p className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-right text-xs font-medium text-rose-800 ring-1 ring-rose-600/10">
              {actionError}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => handleShareDetailsWhatsApp()}
            disabled={busy !== null}
            className="flex w-full flex-row-reverse items-center justify-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 py-3 text-sm font-medium text-emerald-700 shadow-sm transition hover:bg-emerald-100 active:scale-[0.98] disabled:opacity-60"
          >
            <MessageCircle className="h-4 w-4 text-emerald-500" aria-hidden />
            <span>مشاركة التفاصيل عبر واتساب</span>
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
            className="flex w-full flex-row-reverse items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-medium text-white shadow-sm transition hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
          >
            {busy === 'quote' ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <FileText className="h-4 w-4" aria-hidden />
            )}
            <span>{isExplicitGroupTripLead(lead) ? 'موافقة وترحيل' : 'موافقة على الطلب'}</span>
          </button>
          ) : (
            <div className="space-y-3 rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 p-4 text-right shadow-sm">
              <p className="text-sm font-extrabold text-[#b8952d]">
                تمت الموافقة — ملف العميل جاهز في قاعدة العملاء
              </p>
              <p className="text-xs font-medium text-slate-600">رابط استبيان Travel DNA</p>
              <p
                className="break-all rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-[11px] font-semibold text-slate-700"
                dir="ltr"
              >
                {acceptedDnaUrl || dnaUrl || '—'}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void copyText(acceptedDnaUrl || dnaUrl, 'dna')}
                  disabled={!(acceptedDnaUrl || dnaUrl)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-[#1A2421] px-4 py-2.5 text-sm font-bold text-[#D4AF37] transition hover:opacity-90 disabled:opacity-50"
                >
                  <Copy className="h-4 w-4" aria-hidden />
                  {copied === 'dna' ? 'تم النسخ' : 'نسخ الرابط'}
                </button>
                <button
                  type="button"
                  onClick={() => openAcceptedDnaWhatsApp()}
                  disabled={!(acceptedDnaUrl || dnaUrl)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden />
                  إرسال واتساب
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              disabled={busy !== null}
              className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              إغلاق
            </button>
            <button
              type="button"
              onClick={() => void handleRejectLead()}
              disabled={busy !== null}
              className="inline-flex flex-1 flex-row-reverse items-center justify-center gap-1.5 rounded-xl border border-rose-100 bg-rose-50 py-2.5 text-sm font-medium text-rose-700 ring-1 ring-rose-600/20 transition hover:bg-rose-100 active:scale-[0.98] disabled:opacity-60"
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
    </div>,
    document.body,
  );
}

type InboxCardLead = {
  id: string;
  name: string;
  phone: string;
  created_at: string;
  dna_status: string;
  /** Zero-Wait onboarding — awaiting / complete (from clients.onboarding_completed) */
  dna_stage?: InstantDnaStage;
  dna_url?: string;
  opt_in: boolean;
  photography_consent: string;
  destinations: string[];
  country: string;
  passengers_count: number;
  booking_status: string;
  travel_date: string;
  meeting_date: string;
  interests: string[];
  referral_code: string;
  notes: string;
  email: string;
  isSample?: boolean;
  source?: CrmLeadWithIntake;
};

function splitStoredDestination(raw: string): { country: string; city: string } {
  const text = String(raw ?? '').trim();
  if (!text) return { country: '', city: '' };
  const dash = text.split(/\s*[—–]\s*/);
  if (dash.length >= 2 && dash[0]?.trim() && dash[1]?.trim()) {
    return { country: dash[0].trim(), city: dash.slice(1).join(' — ').trim() };
  }
  const colon = text.split(/\s*:\s*/);
  if (colon.length >= 2 && colon[0]?.trim() && colon[1]?.trim()) {
    return { country: colon[0].trim(), city: colon.slice(1).join(': ').trim() };
  }
  return { country: '', city: text };
}

function citiesAndCountryFromLead(lead: CrmLeadWithIntake): { cities: string[]; country: string } {
  const raw = Array.isArray(lead.destinations)
    ? lead.destinations.map((item) => String(item ?? '').trim()).filter(Boolean)
    : [];
  const cities: string[] = [];
  const countries: string[] = [];
  for (const item of raw) {
    const parts = splitStoredDestination(item);
    const label =
      parts.city && parts.country && !parts.city.includes('(')
        ? `${parts.city} (${parts.country})`
        : parts.city;
    if (label && !cities.includes(label)) cities.push(label);
    if (parts.country && !countries.includes(parts.country)) countries.push(parts.country);
  }
  return {
    cities: cities.length ? cities : ['غير محددة'],
    country: countries.join(' · '),
  };
}

function formatCalMeetingLabel(raw: string | null | undefined): string {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  try {
    return parsed.toLocaleString('ar-SA-u-ca-gregory-nu-latn', {
      timeZone: 'Asia/Riyadh',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return text;
  }
}

function yesterdayAt6pm(): Date {
  const slot = new Date();
  slot.setDate(slot.getDate() - 1);
  slot.setHours(18, 0, 0, 0);
  return slot;
}

/** Demo card stays off the active meetings list once yesterday 18:00 has passed. */
function sampleInboxLead(): InboxCardLead | null {
  const slot = yesterdayAt6pm();
  const ended = Date.now() > slot.getTime();
  if (ended) return null;
  return {
    id: 'lead-001',
    name: 'ناصر العجلان',
    phone: '966554492291',
    created_at: '2026/10/06',
    dna_status: 'DNA جاهز',
    opt_in: true,
    photography_consent: 'موافق (Opt-in)',
    destinations: ['سيؤول (كوريا الجنوبية)', 'بوسان (كوريا الجنوبية)', 'طوكيو', 'كيوتو', 'أوساكا'],
    country: '',
    passengers_count: 2,
    booking_status: 'تمت جدولة الاجتماع',
    travel_date: '25 أكتوبر 2026',
    meeting_date: 'أمس الساعة 06:00 مساءً (توقيت الرياض عبر Cal.com)',
    interests: ['فنادق بوتيك', 'طعام فاخر VVIP', 'سكينة وطبيعة'],
    referral_code: 'WNDR-VIP2026',
    notes: 'يفضّل الإقامة في فنادق البوتيك بالحي الهادئ، ميزانية مفتوحة.',
    email: 'nasser@example.com',
    isSample: true,
  };
}

function safeInboxDnaUrl(lead: CrmLeadWithIntake): string {
  try {
    if (lead.intake?.clientId != null) return buildClientDnaWelcomeUrlByClientId(lead.intake.clientId);
  } catch {
    /* fall through to the server-built link */
  }
  return String(lead.intake?.dnaUrl ?? '');
}

function toInboxCard(lead: CrmLeadWithIntake): InboxCardLead {
  const booking = resolveLeadBookingChannelLabel(lead as CrmLeadWithIntake & Record<string, unknown>);
  const created = lead.created_at
    ? new Date(lead.created_at).toLocaleDateString('en-CA')
    : '';
  const places = citiesAndCountryFromLead(lead);
  const optedIn = lead.media_consent !== false;
  const rawStatus = String(lead.status ?? '').trim().toLowerCase();
  const isMeeting =
    rawStatus === 'meeting' || rawStatus === 'meeting_scheduled' || rawStatus === 'scheduled';
  return {
    id: lead.id,
    name: lead.full_name?.trim() || 'عميل جديد',
    phone: String(lead.phone_wa ?? '').trim(),
    created_at: created,
    dna_status: instantDnaStageLabel(instantDnaStage(lead.intake)) || 'DNA جاهز',
    dna_stage: instantDnaStage(lead.intake),
    dna_url: safeInboxDnaUrl(lead),
    opt_in: optedIn,
    photography_consent: optedIn ? 'موافق (Opt-in)' : 'غير موافق (Opt-out)',
    destinations: places.cities,
    country: places.country,
    passengers_count: lead.travelers_count || 2,
    booking_status: isMeeting
      ? 'تمت جدولة الاجتماع'
      : booking.detail
        ? `${booking.label} · ${booking.detail}`
        : booking.label || 'بانتظار الجدولة',
    travel_date: lead.travel_date ? formatTravelDateArabic(lead.travel_date) : 'غير محدد',
    meeting_date: formatCalMeetingLabel(lead.meeting_date),
    interests: Array.isArray(lead.interests)
      ? lead.interests.map((item) => translateLeadData(String(item))).filter(Boolean)
      : [],
    referral_code: String(lead.referral_code ?? '').trim(),
    notes: String(lead.final_thoughts ?? '').trim(),
    email: String(lead.email ?? '').trim(),
    source: lead,
  };
}

export function NewLeadsInbox({
  leads,
  meetingLeads = [],
  interestLeads = [],
  panel = 'inbox',
  showSample = false,
  loading,
  warning,
  onRefresh,
  onLeadApproved,
  onMovedToMeeting,
  onShowMeetings,
}: NewLeadsInboxProps) {
  const [busyApproveId, setBusyApproveId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<InboxCardLead | null>(null);
  const [demoMeeting, setDemoMeeting] = useState<InboxCardLead | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  /** حذف الطلب نهائياً من جدول leads (لا يحذف ملف العميل في قاعدة العملاء). */
  async function handleDeleteLead(lead: InboxCardLead) {
    if (deletingId) return;
    if (lead.isSample) {
      setDemoMeeting(null);
      setSelectedLead(null);
      return;
    }
    const ok = window.confirm(
      `حذف طلب «${lead.name}» نهائياً؟\nسيُزال من الرادار ولوحة المسار ولا يمكن التراجع.\n(ملف العميل في قاعدة العملاء يبقى كما هو.)`,
    );
    if (!ok) return;
    if (!supabase) {
      toast.error('Supabase غير مهيأ.');
      return;
    }
    setDeletingId(lead.id);
    try {
      const { data, error } = await supabase.from('leads').delete().eq('id', lead.id).select('id');
      if (error) throw error;
      if (!data?.length) {
        throw new Error('لم يتم حذف الطلب — تحقق من صلاحيات الكتابة.');
      }
      setDeletedIds((prev) => [...prev, lead.id]);
      setSelectedLead(null);
      onLeadApproved?.(lead.id);
      toast.success('تم حذف الطلب نهائياً 🗑️');
      await onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذر حذف الطلب.');
    } finally {
      setDeletingId(null);
    }
  }

  async function persistMeetingStatus(leadId: string) {
    const preferred = await supabase.from('leads').update({ status: 'meeting_scheduled' }).eq('id', leadId);
    if (!preferred.error) return;
    const message = preferred.error.message ?? '';
    if (/check constraint|meeting_scheduled|invalid input value/i.test(message)) {
      const fallback = await supabase.from('leads').update({ status: 'meeting' }).eq('id', leadId);
      if (fallback.error) throw new Error(fallback.error.message);
      return;
    }
    throw new Error(message || 'تعذر تحديث حالة الطلب.');
  }

  async function handleApproveAndMoveToMeeting(lead: InboxCardLead) {
    if (movingId) return;
    setMovingId(lead.id);
    try {
      if (lead.isSample) {
        setDemoMeeting({
          ...lead,
          booking_status: 'تمت جدولة الاجتماع',
          dna_status: '📅 موعد مجدول',
        });
      } else {
        onMovedToMeeting?.(lead.id);
        onLeadApproved?.(lead.id);
      }
      setSelectedLead(null);
      onShowMeetings?.(lead.isSample ? { sample: true } : undefined);
      if (!lead.isSample) {
        await persistMeetingStatus(lead.id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطأ أثناء نقل الطلب.');
    } finally {
      setMovingId(null);
    }
  }

  async function handleQuickGroupApprove(leadId: string) {
    if (busyApproveId) return;
    setBusyApproveId(leadId);
    try {
      const result = await approveGroupLeadFromInbox(leadId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      onLeadApproved?.(leadId);
      await onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذر الموافقة على الطلب.');
    } finally {
      setBusyApproveId(null);
    }
  }

  return (
    <div dir="rtl" lang="ar" className="w-full text-right">
      <section className="mb-10 w-full" aria-label="الطلبات الجديدة">
        <h2 className="mb-5 pt-2 text-2xl font-bold text-[#1B242F]">
          {panel === 'meetings'
            ? 'جدول اجتماعات العملاء (منعكس تلقائياً من Cal.com)'
            : panel === 'interests'
              ? 'قائمة اهتمامات العملاء'
              : 'صندوق الوارد - الطلبات الجديدة'}
        </h2>

        {warning ? (
          <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-right text-xs font-medium text-amber-800 ring-1 ring-amber-600/10">
            {warning}
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#C59B4B] border-t-transparent" />
            <span className="text-xs font-bold text-slate-700">جاري تحميل رادار الطلبات...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {(() => {
              const meetingCards = [
                ...(demoMeeting ? [demoMeeting] : []),
                ...meetingLeads.map(toInboxCard),
              ];
              const sampleLead = showSample ? sampleInboxLead() : null;
              if (sampleLead && meetingCards.length === 0) meetingCards.push(sampleLead);
              const inboxCards = leads.map(toInboxCard);
              const interestCards = interestLeads.map(toInboxCard);
              const visible = (
                panel === 'meetings' ? meetingCards : panel === 'interests' ? interestCards : inboxCards
              ).filter((card) => !deletedIds.includes(card.id));
              if (visible.length === 0) {
                return (
                  <div className="col-span-full rounded-[28px] border border-slate-200 bg-white p-12 text-center text-xs font-bold text-slate-500">
                    {panel === 'meetings'
                      ? 'لا توجد اجتماعات مجدولة حالياً.'
                      : panel === 'interests'
                        ? 'لا توجد اهتمامات مسجلة حالياً.'
                        : 'لا توجد طلبات معلقة بـ صندوق الوارد.'}
                  </div>
                );
              }
              return visible.map((lead) => {
              const isGroupLead = Boolean(panel === 'inbox' && lead.source && isExplicitGroupTripLead(lead.source));
              const isBusyApprove = busyApproveId === lead.id;
              const wa = lead.phone.replace(/\D/g, '');

              return (
              <article
                key={lead.id}
                className="max-w-sm space-y-4 rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-sm transition-all hover:shadow-md"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`rounded-lg px-3 py-1 text-[11px] font-bold ${
                        panel !== 'meetings' && lead.dna_stage === 'complete'
                          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                          : 'bg-[#F2E8D7] text-[#8C6D2D]'
                      }`}
                    >
                      {panel === 'meetings'
                        ? '📅 موعد مجدول (Cal)'
                        : `${lead.dna_stage === 'complete' ? '✓ ' : lead.dna_stage === 'awaiting' ? '⏳ ' : ''}${lead.dna_status || 'DNA جاهز'}`}
                    </span>
                    <h3 className="text-xl font-bold text-[#111827]">{lead.name}</h3>
                  </div>

                  <div className="flex items-center justify-end gap-2 text-xs">
                    <span className="font-mono text-[11px] text-slate-400">{lead.created_at}</span>
                    {wa ? (
                      <a
                        href={whatsAppHref(wa)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 rounded-full border border-[#A7F3D0] bg-[#E8F8F0] px-3 py-1 text-xs font-bold text-[#10B981]"
                        dir="ltr"
                      >
                        <span className="text-sm">💬</span>
                        <span>{lead.phone}</span>
                      </a>
                    ) : (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-400">
                        بدون رقم
                      </span>
                    )}
                  </div>
                </div>

                {panel !== 'meetings' && lead.dna_url && lead.dna_stage === 'awaiting' ? (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-[#D4AF37]/30 bg-[#FFFBF0] px-3 py-2">
                    <button
                      type="button"
                      onClick={() => {
                        const url = lead.dna_url ?? '';
                        void navigator.clipboard
                          .writeText(url)
                          .then(() => toast.success('تم نسخ رابط الـ DNA 📋'))
                          .catch(() => toast.error('تعذر النسخ إلى الحافظة.'));
                      }}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                    >
                      <Copy className="h-3 w-3 text-slate-400" aria-hidden />
                      نسخ
                    </button>
                    <a
                      href={lead.dna_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      dir="ltr"
                      className="min-w-0 truncate text-left font-mono text-[11px] font-semibold text-[#8C6D2D] underline-offset-2 hover:underline"
                      title={lead.dna_url}
                    >
                      {lead.dna_url.replace(/^https?:\/\//, '')}
                    </a>
                    <span className="shrink-0 text-[11px] font-bold text-[#C59B4B]">🧬 رابط DNA</span>
                  </div>
                ) : null}

                <hr className="border-slate-100" />

                <div className="space-y-2.5 rounded-2xl border border-slate-200/60 bg-[#FDFBF7] p-4 text-right text-xs">
                  <div className="flex items-center justify-between gap-2 pb-1">
                    <span
                      className={`rounded-md px-2.5 py-0.5 text-[10px] font-bold ${
                        lead.opt_in ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {lead.photography_consent}
                    </span>
                    <span className="font-bold text-[#111827]">📷 التصوير:</span>
                  </div>
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex flex-1 flex-wrap justify-end gap-1">
                      {lead.destinations.map((city) => (
                        <span
                          key={city}
                          className="rounded-md bg-amber-100/80 px-2 py-0.5 text-[11px] font-bold text-[#8C6D2D]"
                        >
                          {city}
                        </span>
                      ))}
                    </div>
                    <span className="shrink-0 font-bold text-[#C59B4B]">📍 الرحلة:</span>
                  </div>

                  {lead.interests.length > 0 ? (
                    <div className="flex flex-wrap justify-end gap-1 pt-1">
                      {lead.interests.map((interest) => (
                        <span
                          key={interest}
                          className="rounded-md border border-amber-200/60 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-[#8C6D2D]"
                        >
                          ♡ {interest}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="space-y-1 pt-1 font-medium text-slate-600">
                    <p>👥 العدد: {lead.passengers_count || 2} مسافر</p>
                    <p>
                      📞 الحجز:{' '}
                      <span className="font-bold text-[#111827]">{lead.booking_status}</span>
                    </p>
                    {lead.meeting_date ? (
                      <p className="font-bold text-[#8C6D2D]">🗓️ الموعد: {lead.meeting_date}</p>
                    ) : (
                      <p>📅 السفر: {lead.travel_date}</p>
                    )}
                  </div>
                </div>

                {isGroupLead && lead.source ? (
                  <button
                    type="button"
                    disabled={isBusyApprove}
                    onClick={() => void handleQuickGroupApprove(lead.source!.id)}
                    className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {isBusyApprove ? 'جارٍ الترحيل...' : 'موافقة وترحيل'}
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => setSelectedLead(lead)}
                  className="w-full rounded-2xl bg-[#C59B4B] py-3.5 text-center text-xs font-bold text-slate-900 shadow-sm transition-all hover:bg-[#B2883A]"
                >
                  عرض التفاصيل
                </button>
              </article>
            );
              });
            })()}
          </div>
        )}
      </section>

      {selectedLead ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl space-y-6 overflow-y-auto rounded-3xl border border-[#EADBCC] bg-[#F8F5EE] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-xl font-bold text-[#111827]">
                  تفاصيل الطلب الكاملة · {selectedLead.name}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  تاريخ تقديم الطلب: {selectedLead.created_at}
                  {selectedLead.isSample ? ' · بطاقة تجريبية' : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLead(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
              <div className="space-y-1 rounded-2xl border border-[#EADBCC] bg-[#F2E8D7]/80 p-4 md:col-span-2">
                <span className="block font-bold text-[#8C6D2D]">📅 تاريخ ووقت الموعد المنعكس تلقائياً من Cal.com</span>
                <span className="text-sm font-bold text-slate-900">
                  {selectedLead.meeting_date || 'بانتظار وصول التحديث من Cal.com'}
                </span>
              </div>
              <div className="space-y-1.5 rounded-2xl border border-slate-200 bg-white p-4 md:col-span-2">
                <span className="block font-bold text-slate-400">♡ اهتمامات وتفضيلات العميل</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedLead.interests.length > 0 ? (
                    selectedLead.interests.map((interest) => (
                      <span
                        key={interest}
                        className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-[#8C6D2D]"
                      >
                        ♡ {interest}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500">سفر فاخر، إقامات ممتازة</span>
                  )}
                </div>
              </div>
              <div className="space-y-1.5 rounded-2xl border border-slate-200 bg-white p-4 md:col-span-2">
                <span className="block font-bold text-slate-400">المدن والجهات المستهدفة بالرحلة</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedLead.destinations.map((city) => (
                    <span
                      key={city}
                      className="rounded-lg border border-amber-200 bg-amber-100 px-3 py-1 text-xs font-bold text-[#8C6D2D]"
                    >
                      📍 {city}
                    </span>
                  ))}
                </div>
              </div>
              <div className="space-y-1 rounded-2xl border border-slate-200 bg-white p-4">
                <span className="block font-bold text-slate-400">الاسم الكامل</span>
                <span className="text-sm font-bold text-slate-900">{selectedLead.name}</span>
              </div>
              <div className="space-y-1 rounded-2xl border border-slate-200 bg-white p-4">
                <span className="block font-bold text-slate-400">رقم التواصل (واتساب)</span>
                <span className="block text-right text-sm font-bold text-emerald-600" dir="ltr">
                  {selectedLead.phone || 'بدون رقم'}
                </span>
              </div>
              <div className="space-y-1 rounded-2xl border border-slate-200 bg-white p-4">
                <span className="block font-bold text-slate-400">تاريخ السفر المقترح</span>
                <span className="text-sm font-bold text-slate-900">{selectedLead.travel_date}</span>
              </div>
              <div className="space-y-1 rounded-2xl border border-slate-200 bg-white p-4">
                <span className="block font-bold text-slate-400">عدد المسافرين</span>
                <span className="text-sm font-bold text-slate-900">{selectedLead.passengers_count} مسافر</span>
              </div>
              <div className="space-y-1 rounded-2xl border border-slate-200 bg-white p-4">
                <span className="block font-bold text-slate-400">كود الإحالة (Referral)</span>
                {selectedLead.referral_code ? (
                  <Link
                    href={`/influencers/${encodeURIComponent(selectedLead.referral_code)}`}
                    className="font-mono text-sm font-bold text-slate-900 hover:text-[#C59B4B]"
                  >
                    {selectedLead.referral_code}
                  </Link>
                ) : (
                  <span className="font-mono text-sm font-bold text-slate-900">بدون كود</span>
                )}
              </div>
              <div className="space-y-1 rounded-2xl border border-slate-200 bg-white p-4">
                <span className="block font-bold text-slate-400">حالة الموافقة والتصوير</span>
                <span className={`text-sm font-bold ${selectedLead.opt_in ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {selectedLead.opt_in ? 'موافق Opt-in' : 'غير موافق Opt-out'}
                </span>
              </div>
            </div>

            <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-xs">
              <span className="block font-bold text-slate-400">ملاحظات هندسة المسار والتفضيلات:</span>
              <p className="font-medium leading-relaxed text-slate-700">
                {selectedLead.notes || 'يفضّل الإقامة في فنادق البوتيك بالحي الهادئ، ميزانية مفتوحة.'}
              </p>
            </div>

            <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row">
              {panel === 'inbox' ? (
                <button
                  type="button"
                  disabled={movingId === selectedLead.id}
                  onClick={() => void handleApproveAndMoveToMeeting(selectedLead)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#C59B4B] py-3.5 text-center text-xs font-bold text-slate-900 shadow-md transition-all hover:bg-[#B2883A] disabled:opacity-60 sm:flex-1"
                >
                  <span>📅</span>
                  <span>
                    {movingId === selectedLead.id
                      ? 'جاري النقل...'
                      : 'تأكيد الموعد ونقل الطلب لخانات الاجتماعات'}
                  </span>
                </button>
              ) : null}
              <button
                type="button"
                disabled={deletingId === selectedLead.id}
                onClick={() => void handleDeleteLead(selectedLead)}
                className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-rose-200 bg-white px-5 py-3.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60 sm:w-auto"
              >
                {deletingId === selectedLead.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden />
                )}
                <span>{deletingId === selectedLead.id ? 'جاري الحذف...' : 'حذف الطلب'}</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedLead(null)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-5 py-3.5 text-xs font-bold text-slate-700 hover:bg-slate-100 sm:w-auto"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
