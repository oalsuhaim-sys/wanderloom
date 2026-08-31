'use client';

import { useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Copy,
  FileText,
  Inbox,
  Kanban,
  Loader2,
  MessageCircle,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

import {
  revalidateCrmAfterRadarApprovalAction,
} from '@/app/actions/leadDnaWhatsAppActions';
import { approveGroupLeadFromInbox } from '@/app/actions/groupOnboardingActions';
import {
  handleAcceptRequest,
  handleAddToClients,
  handleRejectRequest,
} from '@/app/actions/leadRequestActions';
import { ensureLeadClientAction } from '@/app/actions/submitCustomerLead';
import DnaInviteTripTypePicker from '@/app/crm/_components/DnaInviteTripTypePicker';
import {
  deleteCrmLead,
  formatWhatsAppPhone,
  quoteErrorMessage,
  whatsAppHref,
  whatsAppHrefWithMessage,
} from '@/lib/crm-lead-actions';
import {
  assertUsableLeadClientFields,
  buildClientDnaWelcomeUrlByClientId,
  buildDnaInviteWhatsAppPayload,
  markDnaLinkSent,
  type CrmLeadWithIntake,
  type DnaInviteTripType,
} from '@/lib/client-intake-pipeline';
import {
  formatRelativeTimeArabic,
  formatTravelDateArabic,
  isExplicitGroupTripLead,
  joinDestinations,
  parseBookedTripLabelFromLead,
} from '@/lib/crm-leads';
import { translateLeadData, translateLeadList } from '@/lib/lead-data-localization';
import {
  InboxBookingChannelCell,
  InboxLuxuryTripBadge,
  InboxMediaConsentInline,
  inboxCompactPrimaryBtnClass,
  inboxCompactWhatsAppClass,
  inboxLuxuryCardClass,
  inboxLuxuryDetailsClass,
  inboxLuxuryMetaGridClass,
  inboxLuxuryPrimaryButtonStyle,
} from './inbox-luxury-ui';
import { BRAND_GOLD } from '@/lib/brand-gold';

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

function IntakeStatusBadge({ lead }: { lead: CrmLeadWithIntake }) {
  const intake = lead.intake;
  if (!intake) {
    return (
      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
        قبل قبول العرض
      </span>
    );
  }
  if (intake.onboardingCompleted) {
    return (
      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
        DNA مكتمل
      </span>
    );
  }
  if (intake.dnaLinkSentAt) {
    return (
      <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-800">
        رُسلت الدعوة
      </span>
    );
  }
  return (
    <span
      className="rounded-md border px-2 py-0.5 text-[10px] font-bold"
      style={{
        backgroundColor: BRAND_GOLD.MUTED_BG,
        borderColor: BRAND_GOLD.LIGHT_BORDER,
        color: BRAND_GOLD.TEXT,
      }}
    >
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
  const [busy, setBusy] = useState<'delete' | 'quote' | 'whatsapp' | 'addClient' | null>(null);
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

  async function handleAddToClientsClick() {
    if (!lead?.id) {
      setActionError('بيانات الطلب مفقودة.');
      return;
    }
    if (busy !== null) return;

    setBusy('addClient');
    setActionError(null);
    try {
      console.log('[NewLeadsInbox] handleAddToClients', lead.id);
      const result = await handleAddToClients(lead.id, {
        full_name: String(lead.full_name ?? '').trim() || null,
        phone_wa: String(lead.phone_wa ?? '').trim() || null,
        email: lead.email != null ? String(lead.email).trim() || null : null,
        destinations: Array.isArray(lead.destinations) ? lead.destinations : [],
      });
      if (!result.ok) throw new Error(result.error);

      toast.success(
        result.message ||
          (result.reusedExisting
            ? 'العميل موجود مسبقاً في قاعدة العملاء ✨'
            : 'تم إضافة / تحديث العميل في قاعدة العملاء بنجاح! ✨'),
      );
      onLeadApproved?.(lead.id);
      onClose();
      await onRefresh();
      router.refresh();
      if (result.clientId) {
        window.setTimeout(() => {
          window.open(`/crm/clients/${result.clientId}`, '_blank', 'noopener,noreferrer');
        }, 350);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء إضافة العميل';
      if (/موجود مسبقاً|already exists|23505|unique_phone_wa/i.test(msg)) {
        toast.success(msg, { icon: '👤' });
        onLeadApproved?.(lead.id);
        onClose();
        await onRefresh();
        return;
      }
      setActionError(msg);
      toast.error(msg);
    } finally {
      setBusy(null);
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
        toast.success(result.message);
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
        buildClientDnaWelcomeUrlByClientId(
          result.dnaKey || String(result.clientId ?? lead.id),
          window.location.origin,
          tripType,
        );

      setAcceptedClientId(result.clientId);
      setAcceptedDnaUrl(surveyUrl);
      onLeadApproved?.(lead.id);
      setApproved(true);
      router.refresh();
      void revalidateCrmAfterRadarApprovalAction().catch((err) => {
        console.warn('[approve] revalidate skipped:', err);
      });

      toast.success(result.message || 'تمت الموافقة — رابط DNA جاهز للنسخ أو واتساب', {
        duration: 5500,
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
              <DetailRow label="كود الإحالة" value={lead.referral_code} />
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

          <button
            type="button"
            onClick={(e) => void handleSendWhatsApp(e)}
            disabled={busy !== null}
            className="flex w-full flex-row-reverse items-center justify-center gap-2 rounded-xl border border-emerald-100 bg-white py-3 text-sm font-medium text-emerald-700 shadow-sm ring-1 ring-emerald-600/10 transition hover:bg-emerald-50 active:scale-[0.98] disabled:opacity-60"
          >
            {busy === 'whatsapp' ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <MessageCircle className="h-4 w-4 text-emerald-500" aria-hidden />
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

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void handleAddToClientsClick();
            }}
            disabled={busy !== null}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-800 bg-[#1A2421] py-3 text-sm font-bold text-[#D4AF37] shadow-sm transition hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
            title="إضافة لقاعدة العملاء فقط — بدون رفض"
          >
            {busy === 'addClient' ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <UserPlus className="h-4 w-4" aria-hidden />
            )}
            <span>إضافة لقاعدة العملاء</span>
          </button>

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

export function NewLeadsInbox({
  leads,
  loading,
  warning,
  onRefresh,
  onLeadApproved,
}: NewLeadsInboxProps) {
  const [selected, setSelected] = useState<CrmLeadWithIntake | null>(null);
  const [busyApproveId, setBusyApproveId] = useState<string | null>(null);

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
      <Toaster position="top-center" toastOptions={{ className: 'text-sm font-bold' }} />
      <section className="mb-10 w-full" aria-label="الطلبات الجديدة">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold text-slate-900">صندوق الوارد — الطلبات الجديدة</h2>
          <Link
            href="/crm/pipeline"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-200"
          >
            <Kanban className="h-3.5 w-3.5 text-[#b8952d]" />
            لوحة الكانبان
          </Link>
        </div>

        {warning ? (
          <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-right text-xs font-medium text-amber-800 ring-1 ring-amber-600/10">
            {warning}
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-[160px] flex-row items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 shadow-sm">
            <Loader2 className="h-6 w-6 animate-spin text-[#b8952d]" aria-hidden />
            <span className="text-sm font-medium text-slate-500">جاري تحميل الطلبات…</span>
          </div>
        ) : leads.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-12 text-center">
            <Inbox className="mx-auto h-10 w-10 text-slate-300" aria-hidden />
            <p className="mt-4 text-sm font-medium text-slate-500">لا توجد طلبات جديدة حالياً</p>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-2">
            {leads.map((lead) => {
              const isGroupLead = isExplicitGroupTripLead(lead);
              const tripLabel = parseBookedTripLabelFromLead(lead) || joinDestinations(lead.destinations);
              const isBusyApprove = busyApproveId === lead.id;
              const timeAgo = formatRelativeTimeArabic(lead.created_at) || 'الآن';
              const wa = String(lead.phone_wa ?? '').trim();
              const travelersLabel = `${lead.travelers_count || 1} مسافر${
                lead.travel_days ? ` (${lead.travel_days} يوم)` : ''
              }`;

              return (
              <article
                key={lead.id}
                className={`${inboxLuxuryCardClass} group hover:border-[rgba(205,160,76,0.45)]`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h3 className="text-sm font-extrabold text-slate-900 sm:text-base">{lead.full_name}</h3>
                    {isGroupLead ? <InboxLuxuryTripBadge isGroup /> : null}
                    <IntakeStatusBadge lead={lead} />
                    {lead.intake ? (
                      <span className="rounded-md bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-800">
                        DNA
                      </span>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-400">{timeAgo}</span>
                    {wa ? (
                      <a
                        href={whatsAppHref(wa)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={inboxCompactWhatsAppClass}
                        dir="ltr"
                      >
                        💬 {wa}
                      </a>
                    ) : null}
                  </div>
                </div>

                <div className={inboxLuxuryDetailsClass}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5 font-extrabold text-slate-900">
                      <span className="shrink-0" style={{ color: BRAND_GOLD.TEXT }}>
                        📍 الرحلة:
                      </span>
                      <span className="truncate">{tripLabel || '—'}</span>
                    </div>
                    <InboxMediaConsentInline mediaConsent={lead.media_consent} />
                  </div>

                  <div className={inboxLuxuryMetaGridClass}>
                    <div>
                      👥 العدد: <span className="font-bold text-slate-800">{travelersLabel}</span>
                    </div>
                    <InboxBookingChannelCell lead={lead as CrmLeadWithIntake & Record<string, unknown>} />
                    {!isGroupLead && lead.travel_date ? (
                      <div>
                        📅 السفر:{' '}
                        <span className="font-bold text-slate-800">
                          {formatTravelDateArabic(lead.travel_date)}
                        </span>
                      </div>
                    ) : null}
                    {lead.referral_code ? (
                      <div className="flex items-center gap-1 font-bold text-slate-700">
                        <span>🎁 إحالة:</span>
                        <span
                          className="rounded px-2 py-0.5 text-[10px] font-extrabold"
                          style={{
                            backgroundColor: '#F7F0E1',
                            color: '#8C6D23',
                          }}
                        >
                          {lead.referral_code}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {isGroupLead ? (
                    <button
                      type="button"
                      disabled={isBusyApprove}
                      onClick={() => void handleQuickGroupApprove(lead.id)}
                      style={inboxLuxuryPrimaryButtonStyle(isBusyApprove)}
                      className={`${inboxCompactPrimaryBtnClass} flex flex-row-reverse flex-1 items-center justify-center gap-1.5 sm:flex-none`}
                    >
                      {isBusyApprove ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                      <span>موافقة وترحيل</span>
                      <span aria-hidden>➔</span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setSelected(lead)}
                    className={`cursor-pointer rounded-xl border py-2 text-xs font-extrabold transition-all ${
                      isGroupLead
                        ? 'border-slate-200 bg-white px-4 text-slate-700 hover:bg-slate-50'
                        : `${inboxCompactPrimaryBtnClass} flex-1 border-transparent`
                    }`}
                    style={!isGroupLead ? inboxLuxuryPrimaryButtonStyle() : undefined}
                  >
                    عرض التفاصيل
                  </button>
                </div>
              </article>
            );
            })}
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
