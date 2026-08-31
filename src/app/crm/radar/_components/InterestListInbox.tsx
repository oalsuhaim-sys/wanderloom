'use client';

import { useMemo, useState } from 'react';
import {
  Clock,
  Copy,
  Heart,
  Loader2,
  MessageCircle,
  Phone,
  UserPlus,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

import {
  handleAddToClients,
} from '@/app/actions/leadRequestActions';
import { whatsAppHref } from '@/lib/crm-lead-actions';
import {
  formatRelativeTimeArabic,
  joinDestinations,
  type CrmLeadRow,
} from '@/lib/crm-leads';

type Props = {
  leads: CrmLeadRow[];
  loading: boolean;
  warning?: string;
  onLeadConverted?: (leadId: string) => void;
  onRefresh?: () => void | Promise<void>;
};

function copyPhones(leads: CrmLeadRow[]) {
  const lines = leads
    .map((lead) => {
      const name = String(lead.full_name ?? '').trim();
      const phone = String(lead.phone_wa ?? '').trim();
      if (!phone) return '';
      return name ? `${name}\t${phone}` : phone;
    })
    .filter(Boolean);
  return lines.join('\n');
}

export function InterestListInbox({
  leads,
  loading,
  warning,
  onLeadConverted,
  onRefresh,
}: Props) {
  const [copied, setCopied] = useState<'all' | string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const phoneCount = useMemo(
    () => leads.filter((lead) => String(lead.phone_wa ?? '').trim()).length,
    [leads],
  );

  async function copyText(value: string, kind: 'all' | string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      toast.success(kind === 'all' ? 'تم نسخ جميع الأرقام' : 'تم نسخ الرقم');
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error('تعذر النسخ إلى الحافظة');
    }
  }

  async function handleAddToClientsClick(lead: CrmLeadRow) {
    const id = String(lead.id ?? '').trim();
    if (!id) {
      toast.error('معرّف الطلب غير صالح');
      return;
    }
    if (convertingId) return;

    const name = String(lead.full_name ?? '').trim() || 'عميل';
    setConvertingId(id);

    try {
      console.log('[InterestList] handleAddToClients', id);
      const result = await handleAddToClients(id, {
        full_name: String(lead.full_name ?? '').trim() || null,
        phone_wa: String(lead.phone_wa ?? '').trim() || null,
        email: lead.email != null ? String(lead.email).trim() || null : null,
        destinations: Array.isArray(lead.destinations) ? lead.destinations : [],
      });

      if (!result.ok) {
        if (/موجود مسبقاً|already exists|23505|unique_phone_wa/i.test(result.error)) {
          toast.success(result.error, { duration: 5000, icon: '👤' });
          await onRefresh?.();
          return;
        }
        toast.error(result.error || 'فشل الإضافة إلى قاعدة العملاء');
        return;
      }

      toast.success(
        result.message ||
          (result.reusedExisting
            ? `العميل (${name}) موجود مسبقاً في قاعدة العملاء ✨`
            : 'تم إضافة / تحديث العميل في قاعدة العملاء بنجاح! ✨'),
        { duration: 4500 },
      );
      onLeadConverted?.(id);
      await onRefresh?.();

      if (typeof window !== 'undefined' && result.clientId) {
        window.setTimeout(() => {
          window.open(`/crm/clients/${result.clientId}`, '_blank', 'noopener,noreferrer');
        }, 350);
      }
    } catch (err) {
      console.error('[InterestListInbox] add-to-clients exception:', err);
      toast.error(err instanceof Error ? err.message : 'حدث خطأ أثناء إضافة العميل');
    } finally {
      setConvertingId(null);
    }
  }

  return (
    <div dir="rtl" lang="ar" className="w-full text-right">
      <Toaster position="top-center" toastOptions={{ className: 'text-sm font-medium' }} />
      <section className="mb-10 w-full" aria-label="قائمة الاهتمامات">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold text-slate-900">قائمة الاهتمامات</h2>
          {phoneCount > 0 ? (
            <button
              type="button"
              onClick={() => void copyText(copyPhones(leads), 'all')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-200"
            >
              <Copy className="h-3.5 w-3.5 text-[#b8952d]" aria-hidden />
              {copied === 'all' ? 'تم النسخ' : `نسخ ${phoneCount} رقم`}
            </button>
          ) : null}
        </div>

        {warning ? (
          <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-right text-xs font-medium text-amber-800 ring-1 ring-amber-600/10">
            {warning}
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-[160px] flex-row items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 shadow-sm">
            <Loader2 className="h-6 w-6 animate-spin text-[#b8952d]" aria-hidden />
            <span className="text-sm font-medium text-slate-500">جاري تحميل قائمة الاهتمامات…</span>
          </div>
        ) : leads.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-12 text-center">
            <Heart className="mx-auto h-10 w-10 text-slate-300" aria-hidden />
            <p className="mt-4 text-sm font-medium text-slate-500">لا توجد تسجيلات اهتمام حالياً</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="w-full overflow-x-auto">
              <table className="min-w-full text-right text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-4 py-3">الاسم</th>
                    <th className="px-4 py-3">الواتساب</th>
                    <th className="px-4 py-3">الوجهة</th>
                    <th className="px-4 py-3">التاريخ</th>
                    <th className="px-4 py-3">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads.map((lead) => {
                    const leadId = String(lead.id ?? '').trim();
                    const phone = String(lead.phone_wa ?? '').trim();
                    const waHref = phone ? whatsAppHref(phone) : '#';
                    const busy = convertingId === leadId;
                    return (
                      <tr
                        key={leadId || lead.id}
                        className="transition-colors hover:bg-slate-50/80"
                      >
                        <td className="px-4 py-3 font-extrabold text-slate-900">{lead.full_name}</td>
                        <td className="px-4 py-3 font-medium text-slate-600" dir="ltr">
                          {phone || '—'}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-600">
                          {joinDestinations(lead.destinations)}
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-slate-600">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                            {formatRelativeTimeArabic(lead.created_at)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={busy || !leadId}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                void handleAddToClientsClick(lead);
                              }}
                              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-[#b8952d] transition-all hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                              title="إضافة لقاعدة العملاء"
                            >
                              {busy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                              ) : (
                                <UserPlus className="h-3.5 w-3.5" aria-hidden />
                              )}
                              <span>إضافة لقاعدة العملاء</span>
                            </button>
                            {phone ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void copyText(phone, leadId)}
                                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-200"
                                >
                                  <Copy className="h-3.5 w-3.5" aria-hidden />
                                  {copied === leadId ? 'تم' : 'نسخ'}
                                </button>
                                <a
                                  href={waHref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition-all hover:bg-emerald-100"
                                >
                                  <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                                  واتساب
                                </a>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3 text-xs font-medium text-slate-500">
              <Phone className="mb-0.5 inline h-3.5 w-3.5 text-[#b8952d]" aria-hidden /> انقل المهتمين إلى قاعدة
              العملاء عند الجاهزية — ثم يختفون من هذه القائمة.
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
