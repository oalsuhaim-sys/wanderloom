'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ClipboardCopy, Copy, ExternalLink, FileText, Loader2, Pencil, Plus, RefreshCcw, Search, Trash2 } from 'lucide-react';

import {
  cloneQuotation,
  deleteQuotation,
  fetchQuotationsList,
  formatDestinationsLabel,
  isQuotationStatusApproved,
  normalizeQuotationId,
  QUOTATION_STATUS_LABEL,
  quotationClientName,
  quotationClientPhone,
  quotationTotalPrice,
  type QuotationRow,
  type QuotationStatus,
} from '@/lib/crm-quotations';
import { revertApprovedQuotation } from '@/lib/quotation-to-itinerary';
import WhatsAppTemplatePicker from '@/app/crm/_components/WhatsAppTemplatePicker';
import { supabase } from '@/lib/supabase';

const STATUS_FILTER: { value: 'all' | QuotationStatus; label: string }[] = [
  { value: 'all', label: 'كل الحالات' },
  { value: 'draft', label: QUOTATION_STATUS_LABEL.draft },
  { value: 'pending_client', label: QUOTATION_STATUS_LABEL.pending_client },
  { value: 'approved', label: QUOTATION_STATUS_LABEL.approved },
];

export default function CRMQuotationsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [rows, setRows] = useState<QuotationRow[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | QuotationStatus>('all');
  const [cloneBusyId, setCloneBusyId] = useState<string | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const [revertBusyId, setRevertBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refreshQuotations = useCallback(async () => {
    try {
      const data = await fetchQuotationsList();
      setRows(data);
      setError('');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'تعذر تحديث القائمة.');
    }
  }, []);

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const data = await fetchQuotationsList();
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل عروض الأسعار.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const handleClone = async (row: QuotationRow) => {
    const quoteId = normalizeQuotationId(row.id);
    if (!quoteId) {
      setActionError('معرّف العرض غير صالح — لا يمكن الاستنساخ.');
      return;
    }

    setCloneBusyId(quoteId);
    setActionError('');
    try {
      const newId = await cloneQuotation(quoteId);
      setToast(`تم استنساخ العرض #${newId} كمسودة ✨`);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'تعذر استنساخ العرض.');
    } finally {
      setCloneBusyId(null);
    }
  };

  const handleCopyClientLink = async (row: QuotationRow) => {
    const quoteId = normalizeQuotationId(row.id);
    if (!quoteId) {
      setActionError('معرّف العرض غير صالح — لا يمكن نسخ الرابط.');
      return;
    }

    const url = `${window.location.origin}/quote/${quoteId}`;
    try {
      await navigator.clipboard.writeText(url);
      setToast('تم نسخ رابط العميل ✨');
    } catch {
      setToast(url);
    }
  };

  const handleDeleteQuotation = async (row: QuotationRow) => {
    const quoteId = normalizeQuotationId(row.id);
    if (!quoteId) {
      setActionError('معرّف العرض غير صالح — لا يمكن الحذف.');
      return;
    }
    if (!supabase) {
      setActionError('Supabase غير مهيأ.');
      return;
    }
    if (
      !window.confirm('هل أنت متأكد من حذف عرض السعر هذا نهائياً؟ لا يمكن التراجع عن هذا الإجراء.')
    ) {
      return;
    }

    setDeleteBusyId(quoteId);
    setActionError('');
    try {
      await deleteQuotation(quoteId);
      setRows((prev) => prev.filter((item) => normalizeQuotationId(item.id) !== quoteId));
      setToast('تم حذف العرض بنجاح 🗑️');
    } catch (e) {
      console.error('Delete error:', e);
      setActionError(e instanceof Error ? e.message : 'حدث خطأ أثناء الحذف.');
    } finally {
      setDeleteBusyId(null);
    }
  };

  const handleRevertApproval = async (quoteId: string, _clientId: string | null, row: QuotationRow) => {
    void _clientId;
    const resolvedQuoteId = normalizeQuotationId(quoteId) || normalizeQuotationId(row.id);
    if (!resolvedQuoteId) {
      setActionError('معرّف العرض غير صالح — لا يمكن إلغاء الاعتماد.');
      return;
    }
    if (!supabase) {
      setActionError('Supabase غير مهيأ.');
      return;
    }
    if (
      !window.confirm('هل أنت متأكد من إلغاء الاعتماد؟ سيتم إرجاع العرض لحالة الانتظار.')
    ) {
      return;
    }

    setRevertBusyId(resolvedQuoteId);
    setActionError('');

    try {
      const result = await revertApprovedQuotation({ ...row, id: resolvedQuoteId });

      setRows((prev) =>
        prev.map((item) =>
          normalizeQuotationId(item.id) === resolvedQuoteId
            ? { ...item, status: 'pending_client' }
            : item,
        ),
      );

      const cleanupNote =
        result.itinerariesCleaned > 0
          ? ` · تم تنظيف ${result.itinerariesCleaned} مسار`
          : '';
      setToast(`تم إلغاء الاعتماد بنجاح!${cleanupNote} 📉✨`);

      if (result.itineraryWarnings.length) {
        console.warn('Itinerary cleanup warnings:', result.itineraryWarnings);
      }

      await refreshQuotations();
    } catch (e) {
      console.error('handleRevertApproval error:', e);
      setActionError(e instanceof Error ? e.message : 'فشل إلغاء الاعتماد.');
    } finally {
      setRevertBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((row) => {
      if (status !== 'all' && row.status !== status) return false;
      if (!query) return true;
      const blob = [
        row.title,
        quotationClientName(row),
        formatDestinationsLabel(row.destinations),
      ]
        .join(' ')
        .toLowerCase();
      return blob.includes(query);
    });
  }, [rows, q, status]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-center font-black text-slate-500">
          <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" aria-hidden />
          جارٍ تحميل عروض الأسعار...
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#1C4532]">عروض الأسعار 📄</h1>
          <p className="mt-1 text-xs font-bold text-slate-500">
            عروض المبيعات قبل تحويلها لمسارات مؤكدة
          </p>
        </div>
        <Link
          href="/crm/quotations/new"
          className="inline-flex items-center gap-2 rounded-xl border border-[#C9A84C]/55 bg-gradient-to-l from-[#8A6B2A] to-[#C9A84C] px-4 py-2.5 text-xs font-black text-[#1C4532]"
        >
          <Plus size={16} aria-hidden />
          إنشاء عرض سعر جديد
        </Link>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-800">
          {error}
        </div>
      ) : null}

      {actionError ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900">
          {actionError}
        </div>
      ) : null}

      {toast ? (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[200] w-[min(100%,22rem)] -translate-x-1/2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-center text-sm font-black text-emerald-900 shadow-lg"
        >
          {toast}
        </div>
      ) : null}

      <div className="mb-4 rounded-2xl border border-[#F3F0EB] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.2fr_0.8fr]">
          <label className="flex items-center gap-2">
            <Search size={16} className="shrink-0 text-[#C9A84C]" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث بالعنوان أو العميل أو الوجهة..."
              className="w-full rounded-xl border border-gray-300 bg-white p-3 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
            />
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'all' | QuotationStatus)}
            className="rounded-xl border border-gray-300 bg-white p-3 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
          >
            {STATUS_FILTER.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <p className="mt-2 text-xs font-bold text-slate-500">النتائج: {filtered.length}</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#F3F0EB] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-sm">
            <thead>
              <tr className="bg-[#1C4532] text-[10px] font-black uppercase tracking-wider text-[#C9A84C]">
                <th className="px-4 py-3 text-start">العميل</th>
                <th className="px-4 py-3 text-start">العنوان</th>
                <th className="px-4 py-3 text-start">الوجهات</th>
                <th className="px-4 py-3 text-start">الحالة</th>
                <th className="px-4 py-3 text-start">الإجمالي</th>
                <th className="px-4 py-3 text-center">التواصل</th>
                <th className="px-4 py-3 text-center">رابط العميل</th>
                <th className="px-4 py-3 text-center">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-xs font-bold text-slate-400">
                    لا توجد عروض أسعار بعد.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const quoteId = normalizeQuotationId(row.id);
                  const total = quotationTotalPrice(row);
                  const isApproved = isQuotationStatusApproved(row.status);
                  const isDraft = row.status === 'draft';
                  const cloning = Boolean(quoteId) && cloneBusyId === quoteId;
                  const deleting = Boolean(quoteId) && deleteBusyId === quoteId;
                  const reverting = Boolean(quoteId) && revertBusyId === quoteId;
                  return (
                    <tr
                      key={quoteId || `quotation-${row.title}-${row.created_at}`}
                      className="border-t border-slate-100 transition hover:bg-[#FFFBF0]/60"
                    >
                      <td className="px-4 py-3 font-bold text-slate-800">
                        {quotationClientName(row)}
                      </td>
                      <td className="px-4 py-3 font-black text-[#1C4532]">{row.title || '—'}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-600">
                        {formatDestinationsLabel(row.destinations)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-2">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${
                              isApproved
                                ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                                : isDraft
                                  ? 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
                                  : 'bg-amber-50 text-amber-900 ring-1 ring-amber-200'
                            }`}
                          >
                            {QUOTATION_STATUS_LABEL[row.status]}
                          </span>
                          {isApproved ? (
                            <button
                              type="button"
                              disabled={reverting}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                void handleRevertApproval(
                                  quoteId || row.id,
                                  row.client_id,
                                  row,
                                );
                              }}
                              title="إلغاء الاعتماد وإعادة العرض لبانتظار العميل"
                              className="mt-1 flex items-center gap-1 rounded border border-orange-200 bg-orange-50 px-2 py-1 text-[10px] font-black text-orange-600 transition hover:bg-orange-100 disabled:opacity-50"
                            >
                              {reverting ? (
                                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                              ) : (
                                <RefreshCcw size={10} aria-hidden />
                              )}
                              إلغاء الاعتماد
                            </button>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-black text-[#1C4532]" dir="ltr">
                        {total > 0 ? `${total.toLocaleString('ar-SA')} ر.س` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <WhatsAppTemplatePicker
                            phone={quotationClientPhone(row)}
                            clientName={quotationClientName(row)}
                            tripTitle={row.title}
                            totalEstimatedCost={row.total_estimated_cost}
                            quoteId={quoteId || ''}
                            disabled={!quoteId}
                            onLaunched={() => setToast('تم فتح واتساب بالقالب المختار ✨')}
                            onError={(message) => setActionError(message)}
                          />
                          {quotationClientPhone(row) ? (
                            <span className="text-[10px] font-bold text-slate-500" dir="ltr">
                              {quotationClientPhone(row)}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-700">
                              لا يوجد رقم — يُفتح واتساب للصق الرقم
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex items-center gap-1">
                          {quoteId ? (
                            <Link
                              href={`/quote/${quoteId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="فتح صفحة العميل"
                              className="inline-flex items-center justify-center rounded-lg border border-[#C9A84C]/45 bg-[#FEFDF9] p-2 text-[#1C4532] transition hover:bg-amber-50"
                            >
                              <ExternalLink size={16} aria-hidden />
                              <span className="sr-only">فتح صفحة العميل</span>
                            </Link>
                          ) : (
                            <span
                              className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 p-2 text-[10px] font-bold text-red-700"
                              title="معرّف العرض غير صالح"
                            >
                              —
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => void handleCopyClientLink(row)}
                            disabled={!quoteId}
                            title="نسخ رابط العميل"
                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <ClipboardCopy size={16} aria-hidden />
                            <span className="sr-only">نسخ الرابط</span>
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex items-center justify-center gap-1.5">
                          {quoteId ? (
                            <Link
                              href={`/crm/quotations/edit/${quoteId}`}
                              title="تعديل العرض"
                              className="inline-flex items-center justify-center rounded-lg border border-blue-200 bg-blue-50 p-2 text-blue-600 transition hover:bg-blue-100"
                            >
                              <Pencil size={16} aria-hidden />
                              <span className="sr-only">تعديل</span>
                            </Link>
                          ) : null}
                          <button
                            type="button"
                            disabled={cloning || !quoteId}
                            onClick={() => void handleClone(row)}
                            title="استنساخ العرض"
                            className="inline-flex items-center justify-center rounded-lg border border-[#C9A84C]/45 bg-[#FEFDF9] p-2 text-[#1C4532] transition hover:bg-amber-50 disabled:opacity-50"
                          >
                            {cloning ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            ) : (
                              <Copy size={16} aria-hidden />
                            )}
                            <span className="sr-only">استنساخ</span>
                          </button>
                          <button
                            type="button"
                            disabled={deleting || !quoteId}
                            onClick={() => void handleDeleteQuotation(row)}
                            title="حذف العرض"
                            className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                          >
                            {deleting ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            ) : (
                              <Trash2 size={16} aria-hidden />
                            )}
                            <span className="sr-only">حذف</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {rows.length === 0 && !error ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#C9A84C]/40 bg-[#FEFDF9] p-8 text-center">
          <FileText className="mx-auto mb-3 h-10 w-10 text-[#C9A84C]" aria-hidden />
          <p className="text-sm font-black text-[#1C4532]">ابدأ بأول عرض سعر VIP</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            عروض الأسعار منفصلة عن المسارات المؤكدة — للمبيعات والاعتماد قبل التنفيذ.
          </p>
        </div>
      ) : null}
    </div>
  );
}
