'use client';

import { useMemo, useState } from 'react';
import {
  Clock,
  Copy,
  Heart,
  Loader2,
  MessageCircle,
  Trash2,
  UserPlus,
} from 'lucide-react';
import toast from 'react-hot-toast';

import {
  deleteInterestLead,
  handleAddToClients,
} from '@/app/actions/leadRequestActions';
import { showCrmSuccessToast } from '@/components/CrmLuxuryToaster';
import { revalidateClientDirectory } from '@/app/crm/clients/useClientDirectory';
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  /** Local hide so row disappears instantly even before parent/refetch settles */
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());

  const visibleLeads = useMemo(
    () => leads.filter((lead) => !hiddenIds.has(String(lead.id ?? '').trim())),
    [leads, hiddenIds],
  );

  const phoneCount = useMemo(
    () => visibleLeads.filter((lead) => String(lead.phone_wa ?? '').trim()).length,
    [visibleLeads],
  );

  function removeLeadFromList(id: string) {
    const targetId = String(id ?? '').trim();
    if (!targetId) return;
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(targetId);
      return next;
    });
    onLeadConverted?.(targetId);
  }

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

  async function handleDeleteClick(lead: CrmLeadRow) {
    const id = String(lead.id ?? '').trim();
    if (!id) {
      toast.error('معرّف الطلب غير صالح');
      return;
    }
    if (convertingId || deletingId) return;

    const name = String(lead.full_name ?? '').trim() || 'هذا التسجيل';
    const ok = window.confirm(`حذف تسجيل اهتمام «${name}» نهائياً؟ لا يمكن التراجع.`);
    if (!ok) return;

    setDeletingId(id);
    try {
      const result = await deleteInterestLead(id);
      if (!result.ok) {
        toast.error(result.error || 'تعذر حذف التسجيل');
        return;
      }
      removeLeadFromList(id);
      toast.success(result.message || 'تم الحذف');
      void onRefresh?.();
    } catch (err) {
      console.error('[InterestListInbox] delete exception:', err);
      toast.error(err instanceof Error ? err.message : 'تعذر حذف التسجيل');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleAddToClientsClick(lead: CrmLeadRow) {
    const id = String(lead.id ?? '').trim();
    if (!id) {
      toast.error('معرّف الطلب غير صالح');
      return;
    }
    if (convertingId || deletingId) return;

    setConvertingId(id);
    try {
      const result = await handleAddToClients(id, {
        full_name: String(lead.full_name ?? '').trim() || null,
        phone_wa: String(lead.phone_wa ?? '').trim() || null,
        email: lead.email != null ? String(lead.email).trim() || null : null,
        destinations: Array.isArray(lead.destinations) ? lead.destinations : [],
      });

      if (!result.ok) {
        if (/موجود مسبقاً|already exists|23505|unique_phone_wa/i.test(result.error)) {
          // Client already exists — still clear this interest row from the list/DB
          const cleared = await deleteInterestLead(id);
          if (!cleared.ok) {
            console.warn('[InterestListInbox] clear interest after existing client:', cleared.error);
          }
          removeLeadFromList(id);
          showCrmSuccessToast('تمت إضافة العميل بنجاح ونقله من قائمة الاهتمامات', {
            duration: 4000,
            icon: '👤',
          });
          void onRefresh?.();
          return;
        }
        toast.error(result.error || 'فشل الإضافة إلى قاعدة العملاء');
        return;
      }

      // Immediate UI removal + parent state update
      removeLeadFromList(id);
      showCrmSuccessToast(
        result.message || 'تمت إضافة العميل بنجاح ونقله من قائمة الاهتمامات',
        { duration: 4000 },
      );
      void onRefresh?.();
      void revalidateClientDirectory();
    } catch (err) {
      console.error('[InterestListInbox] add-to-clients exception:', err);
      toast.error(err instanceof Error ? err.message : 'حدث خطأ أثناء إضافة العميل');
    } finally {
      setConvertingId(null);
    }
  }

  return (
    <div dir="rtl" lang="ar" className="w-full text-right">
      <section className="mb-10 w-full" aria-label="قائمة الاهتمامات">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold text-slate-900">قائمة الاهتمامات</h2>
          {phoneCount > 0 ? (
            <button
              type="button"
              onClick={() => void copyText(copyPhones(visibleLeads), 'all')}
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
        ) : visibleLeads.length === 0 ? (
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
                  {visibleLeads.map((lead) => {
                    const leadId = String(lead.id ?? '').trim();
                    const phone = String(lead.phone_wa ?? '').trim();
                    const waHref = phone ? whatsAppHref(phone) : '#';
                    const busyConvert = convertingId === leadId;
                    const busyDelete = deletingId === leadId;
                    const rowBusy = busyConvert || busyDelete;
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
                              disabled={rowBusy || !leadId}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                void handleAddToClientsClick(lead);
                              }}
                              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-[#b8952d] transition-all hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                              title="إضافة لقاعدة العملاء"
                            >
                              {busyConvert ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                              ) : (
                                <UserPlus className="h-3.5 w-3.5" aria-hidden />
                              )}
                              <span>إضافة لقاعدة العملاء</span>
                            </button>
                            <button
                              type="button"
                              disabled={rowBusy || !leadId}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                void handleDeleteClick(lead);
                              }}
                              className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-600 transition-all hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                              title="حذف"
                              aria-label={`حذف ${String(lead.full_name ?? '').trim() || 'تسجيل الاهتمام'}`}
                            >
                              {busyDelete ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                              )}
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
          </div>
        )}
      </section>
    </div>
  );
}
