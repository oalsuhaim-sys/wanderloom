'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ClipboardCopy,
  Copy,
  ExternalLink,
  FileDown,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  RefreshCcw,
  Route,
  Search,
  Trash2,
} from 'lucide-react';

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
  quotationStatusBadgeClass,
  quotationTotalPrice,
  type QuotationRow,
  type QuotationStatus,
} from '@/lib/crm-quotations';
import { revertApprovedQuotation } from '@/lib/quotation-to-itinerary';
import { buildItineraryBuilderPathFromQuotation } from '@/lib/itinerary-builder-prefill';
import WhatsAppTemplatePicker from '@/app/crm/_components/WhatsAppTemplatePicker';
import { GenerateInvoiceModal } from '@/app/crm/quotations/_components/GenerateInvoiceModal';
import { supabase } from '@/lib/supabase';
import { CRM_BTN_PRIMARY, CRM_INPUT } from '@/lib/crm-luxury-ui';

const STATUS_FILTER: { value: 'all' | QuotationStatus; label: string }[] = [
  { value: 'all', label: 'كل الحالات' },
  { value: 'draft', label: QUOTATION_STATUS_LABEL.draft },
  { value: 'pending_client', label: QUOTATION_STATUS_LABEL.pending_client },
  { value: 'approved', label: QUOTATION_STATUS_LABEL.approved },
];

const BTN_EDIT =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition-all hover:bg-slate-800 dark:border dark:border-[#D4AF37]/50 dark:bg-[#D4AF37]/20 dark:text-[#D4AF37]';

const ICON_PDF =
  'rounded-lg p-2 text-slate-400 transition-colors hover:text-red-500 dark:hover:text-red-400';

const ICON_MUTED =
  'rounded-lg p-2 text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-[#D4AF37]';

function formatQuoteDate(raw: string | null | undefined): string {
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    const sliced = String(raw).slice(0, 10);
    return sliced || '—';
  }
  return new Intl.DateTimeFormat('ar-SA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function quoteDisplayId(id: string): string {
  if (!id) return '—';
  if (/^\d+$/.test(id)) return `#QT-${id}`;
  return `#${id.slice(0, 8).toUpperCase()}`;
}

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
  const [invoiceQuotation, setInvoiceQuotation] = useState<QuotationRow | null>(null);
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

    const url = `${window.location.origin}/proposal/${quoteId}`;
    try {
      await navigator.clipboard.writeText(url);
      setToast('تم نسخ الرابط! يمكنك الآن إرساله للعميل.');
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

  const handleRevertApproval = async (
    quoteId: string,
    _clientId: string | null,
    row: QuotationRow,
  ) => {
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
    if (!window.confirm('هل أنت متأكد من إلغاء الاعتماد؟ سيتم إرجاع العرض لحالة الانتظار.')) {
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
        result.itinerariesCleaned > 0 ? ` · تم تنظيف ${result.itinerariesCleaned} مسار` : '';
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
        normalizeQuotationId(row.id),
      ]
        .join(' ')
        .toLowerCase();
      return blob.includes(query);
    });
  }, [rows, q, status]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-[#F9FAFB] dark:bg-[#1A2421]">
        <div className="text-center text-sm font-medium text-slate-500 dark:text-gray-400">
          <Loader2
            className="mx-auto mb-2 h-6 w-6 animate-spin text-slate-400 dark:text-[#D4AF37]"
            aria-hidden
          />
          جارٍ تحميل عروض الأسعار...
        </div>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className="min-h-full bg-[#F9FAFB] p-4 font-sans dark:bg-[#1A2421] sm:p-6 lg:p-8"
    >
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-[#D4AF37]/80">
              Finance · Sales
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-gray-100">
              عروض الأسعار
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
              عروض المبيعات قبل تحويلها لمسارات مؤكدة
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto dark:border-[#2D3F3A] dark:bg-[#22302C] dark:text-gray-300"
            >
              <RefreshCcw size={14} aria-hidden />
              تحديث
            </button>
            <Link href="/crm/quotations/new" className={`${CRM_BTN_PRIMARY} w-full sm:w-auto`}>
              <Plus size={16} aria-hidden />
              إنشاء عرض سعر جديد
            </Link>
          </div>
        </header>

        {error ? (
          <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        ) : null}

        {actionError ? (
          <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
            {actionError}
          </div>
        ) : null}

        {toast ? (
          <div
            role="status"
            className="fixed bottom-6 left-1/2 z-[200] w-[min(100%,22rem)] -translate-x-1/2 rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-3 text-center text-sm font-medium text-emerald-800 shadow-lg dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
          >
            {toast}
          </div>
        ) : null}

        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C] sm:p-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.2fr_0.8fr]">
            <label className="relative block">
              <Search
                size={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#D4AF37]"
                aria-hidden
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="بحث بالعنوان أو العميل أو الوجهة أو الرقم..."
                className={`${CRM_INPUT} pr-10`}
              />
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'all' | QuotationStatus)}
              className={CRM_INPUT}
            >
              {STATUS_FILTER.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-gray-400">
            النتائج: {filtered.length}
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C]">
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-right">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-sm text-slate-500 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-slate-400">
                  <th className="whitespace-nowrap px-4 py-3.5 font-semibold">الرقم</th>
                  <th className="whitespace-nowrap px-4 py-3.5 font-semibold">العميل</th>
                  <th className="whitespace-nowrap px-4 py-3.5 font-semibold">المبلغ</th>
                  <th className="whitespace-nowrap px-4 py-3.5 font-semibold">الحالة</th>
                  <th className="whitespace-nowrap px-4 py-3.5 font-semibold">التواريخ</th>
                  <th className="whitespace-nowrap px-4 py-3.5 font-semibold">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-14 text-center text-sm text-slate-400 dark:text-slate-500"
                    >
                      لا توجد عروض أسعار بعد.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => {
                    const quoteId = normalizeQuotationId(row.id);
                    const total = quotationTotalPrice(row);
                    const isApproved = isQuotationStatusApproved(row.status);
                    const cloning = Boolean(quoteId) && cloneBusyId === quoteId;
                    const deleting = Boolean(quoteId) && deleteBusyId === quoteId;
                    const reverting = Boolean(quoteId) && revertBusyId === quoteId;
                    const destinations = formatDestinationsLabel(row.destinations);

                    return (
                      <tr
                        key={quoteId || `quotation-${row.title}-${row.created_at}`}
                        className="border-b border-slate-100 transition-colors hover:bg-slate-50/60 dark:border-[#2D3F3A] dark:hover:bg-[#1A2421]/40"
                      >
                        <td className="px-4 py-4 align-middle">
                          <p className="font-mono text-sm font-bold text-slate-500 dark:text-[#D4AF37]">
                            {quoteDisplayId(quoteId)}
                          </p>
                          <p className="mt-1 max-w-[12rem] truncate text-xs text-slate-400 dark:text-slate-500">
                            {row.title || 'عرض سعر'}
                          </p>
                        </td>

                        <td className="px-4 py-4 align-middle">
                          <p className="text-sm font-semibold text-slate-800 dark:text-gray-200">
                            {quotationClientName(row)}
                          </p>
                          {destinations && destinations !== '—' ? (
                            <p className="mt-1 max-w-[14rem] truncate text-xs text-slate-500 dark:text-slate-400">
                              {destinations}
                            </p>
                          ) : null}
                        </td>

                        <td className="px-4 py-4 align-middle">
                          {total > 0 ? (
                            <p className="text-lg font-bold text-slate-900 dark:text-white" dir="ltr">
                              {total.toLocaleString('ar-SA')}{' '}
                              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                ر.س
                              </span>
                            </p>
                          ) : (
                            <span className="text-sm text-slate-400">—</span>
                          )}
                        </td>

                        <td className="px-4 py-4 align-middle">
                          <div className="flex flex-col items-start gap-2">
                            <span className={quotationStatusBadgeClass(row.status)}>
                              {QUOTATION_STATUS_LABEL[row.status]}
                            </span>
                            {row.status !== 'draft' && quoteId ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setInvoiceQuotation(row);
                                }}
                                title="إصدار فاتورة عربون أو مبلغ كامل"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-slate-300"
                              >
                                <Receipt size={11} aria-hidden />
                                الفواتير
                              </button>
                            ) : null}
                            {isApproved ? (
                              <button
                                type="button"
                                disabled={reverting}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  void handleRevertApproval(quoteId || row.id, row.client_id, row);
                                }}
                                title="إلغاء الاعتماد وإعادة العرض لبانتظار العميل"
                                className="inline-flex items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 transition hover:bg-amber-100 disabled:opacity-50 dark:border-amber-900/30 dark:bg-amber-900/20 dark:text-amber-400"
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

                        <td className="px-4 py-4 align-middle">
                          <div className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
                            <span>
                              إصدار:{' '}
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {formatQuoteDate(row.created_at)}
                              </span>
                            </span>
                            <span>
                              الرحلة:{' '}
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {formatQuoteDate(row.start_date)}
                                {row.end_date ? ` → ${formatQuoteDate(row.end_date)}` : ''}
                              </span>
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-4 align-middle">
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            {quoteId ? (
                              <Link
                                href={`/crm/quotations/edit/${quoteId}`}
                                title="تعديل العرض"
                                className={BTN_EDIT}
                              >
                                <Pencil size={14} aria-hidden />
                                تعديل
                              </Link>
                            ) : null}

                            {quoteId ? (
                              <Link
                                href={`/proposal/${quoteId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="فتح العرض / طباعة PDF"
                                className={ICON_PDF}
                              >
                                <FileDown size={16} aria-hidden />
                                <span className="sr-only">PDF</span>
                              </Link>
                            ) : null}

                            <div
                              className="[&_button]:!rounded-lg [&_button]:!p-2 [&_button]:!text-slate-400 [&_button]:hover:!bg-transparent [&_button]:hover:!text-emerald-500 dark:[&_button]:hover:!text-emerald-400"
                              title="إرسال واتساب"
                            >
                              <WhatsAppTemplatePicker
                                phone={quotationClientPhone(row)}
                                clientName={quotationClientName(row)}
                                tripTitle={row.title}
                                quoteId={quoteId || ''}
                                disabled={!quoteId}
                                onLaunched={() => setToast('تم فتح واتساب بالقالب المختار ✨')}
                                onError={(message) => setActionError(message)}
                              />
                            </div>

                            {quoteId ? (
                              <Link
                                href={`/proposal/${quoteId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="فتح صفحة العميل"
                                className={ICON_MUTED}
                              >
                                <ExternalLink size={16} aria-hidden />
                                <span className="sr-only">فتح</span>
                              </Link>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => void handleCopyClientLink(row)}
                              disabled={!quoteId}
                              title="نسخ رابط العميل"
                              className={`${ICON_MUTED} disabled:opacity-40`}
                            >
                              <ClipboardCopy size={16} aria-hidden />
                              <span className="sr-only">نسخ</span>
                            </button>

                            {quoteId ? (
                              <Link
                                href={buildItineraryBuilderPathFromQuotation(row)}
                                title="بناء مسار من العرض"
                                className={ICON_MUTED}
                              >
                                <Route size={16} aria-hidden />
                                <span className="sr-only">مسار</span>
                              </Link>
                            ) : null}

                            <button
                              type="button"
                              disabled={cloning || !quoteId}
                              onClick={() => void handleClone(row)}
                              title="استنساخ العرض"
                              className={`${ICON_MUTED} disabled:opacity-50`}
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
                              className="rounded-lg p-2 text-slate-400 transition-colors hover:text-rose-500 disabled:opacity-50 dark:hover:text-rose-400"
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
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C]">
            <FileText
              className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-[#D4AF37]/50"
              aria-hidden
            />
            <p className="text-sm font-semibold text-slate-900 dark:text-gray-100">
              ابدأ بأول عرض سعر
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">
              عروض الأسعار منفصلة عن المسارات المؤكدة — للمبيعات والاعتماد قبل التنفيذ.
            </p>
          </div>
        ) : null}

        {invoiceQuotation ? (
          <GenerateInvoiceModal
            quotation={invoiceQuotation}
            onClose={() => setInvoiceQuotation(null)}
            onCreated={() => {
              setToast('تم إصدار الفاتورة بنجاح ✨');
              setInvoiceQuotation(null);
              void refreshQuotations();
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
