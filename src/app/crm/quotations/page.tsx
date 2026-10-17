'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ClipboardCopy,
  Copy,
  ExternalLink,
  FileDown,
  FileText,
  Loader2,
  MessageCircle,
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
import { launchWhatsAppTemplate } from '@/lib/whatsapp-templates';
import { updatePipelineStatus } from '@/lib/lead-pipeline-automation';
import { GenerateInvoiceModal } from '@/app/crm/quotations/_components/GenerateInvoiceModal';
import { supabase } from '@/lib/supabase';

const STATUS_FILTER: { value: 'all' | QuotationStatus; label: string }[] = [
  { value: 'all', label: 'كل الحالات' },
  { value: 'draft', label: QUOTATION_STATUS_LABEL.draft },
  { value: 'pending_client', label: QUOTATION_STATUS_LABEL.pending_client },
  { value: 'approved', label: QUOTATION_STATUS_LABEL.approved },
];

const FILTER_CONTROL =
  'min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200/80 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-gray-100 dark:focus:border-[#D4AF37]/40 dark:focus:ring-[#D4AF37]/15';

function formatQuoteDate(raw: string | null | undefined): string {
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    const sliced = String(raw).slice(0, 10);
    return sliced || '—';
  }
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

/** Compact travel window: `03 ➔ 13 ديسمبر 2026` (same month) or with both months. */
function formatTravelDateRange(
  startRaw: string | null | undefined,
  endRaw: string | null | undefined,
): string {
  const start = startRaw ? new Date(startRaw) : null;
  const end = endRaw ? new Date(endRaw) : null;
  if (!start || Number.isNaN(start.getTime())) return '—';
  if (!end || Number.isNaN(end.getTime())) return formatQuoteDate(startRaw);

  const locale = 'ar-SA-u-ca-gregory-nu-latn';
  const dayFmt = new Intl.DateTimeFormat(locale, { day: 'numeric' });
  const monthFmt = new Intl.DateTimeFormat(locale, { month: 'long' });
  const yearFmt = new Intl.DateTimeFormat(locale, { year: 'numeric' });

  const d1 = dayFmt.format(start);
  const d2 = dayFmt.format(end);
  const m1 = monthFmt.format(start);
  const m2 = monthFmt.format(end);
  const y2 = yearFmt.format(end);

  const y1 = yearFmt.format(start);
  if (start.getFullYear() === end.getFullYear()) {
    return `${d1} ${m1} ${y1} ← ${d2} ${m2}`;
  }
  return `${d1} ${m1} ${y1} ← ${d2} ${m2} ${y2}`;
}

function quoteDisplayId(id: string): string {
  if (!id) return '—';
  if (/^\d+$/.test(id)) return `#QT-${id}`;
  return `#${id.slice(0, 8).toUpperCase()}`;
}

type MenuItem = {
  id: string;
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
  disabled?: boolean;
  external?: boolean;
};

function RowActionsMenu({
  items,
  busy,
}: {
  items: MenuItem[];
  busy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-600 transition hover:bg-slate-200 disabled:opacity-50"
        title="المزيد"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <span aria-hidden>•••</span>
        )}
        <span className="sr-only">المزيد من الإجراءات</span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute left-0 z-30 mt-2 w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 text-right shadow-xl"
        >
          {items.map((item) => {
            const className = [
              'flex w-full items-center gap-2.5 px-3 py-2.5 text-right text-sm font-medium transition',
              item.danger
                ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30'
                : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#1A2421]',
              item.disabled ? 'pointer-events-none opacity-40' : '',
            ].join(' ');

            if (item.href) {
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  role="menuitem"
                  target={item.external ? '_blank' : undefined}
                  rel={item.external ? 'noopener noreferrer' : undefined}
                  className={className}
                  onClick={() => setOpen(false)}
                >
                  <span className="text-slate-400">{item.icon}</span>
                  {item.label}
                </Link>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={className}
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
              >
                <span className={item.danger ? 'text-rose-500' : 'text-slate-400'}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
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
  const [quoteToDelete, setQuoteToDelete] = useState<QuotationRow | null>(null);
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

    setDeleteBusyId(quoteId);
    setActionError('');
    try {
      await deleteQuotation(quoteId);
      setRows((prev) => prev.filter((item) => normalizeQuotationId(item.id) !== quoteId));
      setQuoteToDelete(null);
      setToast('تم حذف العرض بنجاح');
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
      <div className="flex min-h-[70vh] items-center justify-center bg-[#F8F5EE]">
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
    <div dir="rtl" className="min-h-screen bg-[#F8F5EE] p-6 font-sans">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/crm/quotations/new"
            className="inline-flex items-center justify-center rounded-2xl bg-[#C59B4B] px-6 py-3 text-xs font-bold text-slate-900 shadow-sm transition-all hover:bg-[#B2883A]"
          >
            + إنشاء عرض سعر جديد
          </Link>
          <div className="text-right">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              FINANCE · SALES
            </span>
            <h1 className="text-2xl font-bold text-[#111827]">عروض الأسعار</h1>
            <p className="text-xs text-slate-500">عروض المبيعات قبل تحويلها لمسارات مؤكدة</p>
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

        {/* Filter toolbar */}
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C] sm:p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.4fr_0.8fr]">
            <label className="relative block">
              <Search
                size={16}
                className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#D4AF37]"
                aria-hidden
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="بحث بالعنوان أو العميل أو الوجهة أو الرقم..."
                className={`${FILTER_CONTROL} pr-10`}
              />
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'all' | QuotationStatus)}
              className={FILTER_CONTROL}
            >
              {STATUS_FILTER.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-3 text-xs font-medium text-slate-500 dark:text-gray-400">
            النتائج: {filtered.length}
          </p>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-right text-xs">
              <thead className="border-b border-slate-200 bg-[#F8F5EE]/60 font-bold text-slate-500">
                <tr>
                  <th className="p-4">الرقم</th>
                  <th className="p-4">العميل</th>
                  <th className="p-4">المبلغ</th>
                  <th className="p-4">الحالة</th>
                  <th className="p-4">التواريخ</th>
                  <th className="p-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-10 text-center text-sm text-slate-400 dark:text-slate-500"
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
                    const menuBusy = cloning || deleting || reverting;
                    const clientLabel = quotationClientName(row);

                    const menuItems: MenuItem[] = [];
                    if (quoteId) {
                      menuItems.push({
                        id: 'pdf',
                        label: 'تحميل / طباعة PDF',
                        icon: <FileDown size={15} aria-hidden />,
                        href: `/proposal/${quoteId}`,
                        external: true,
                      });
                      menuItems.push({
                        id: 'open',
                        label: 'فتح صفحة العميل',
                        icon: <ExternalLink size={15} aria-hidden />,
                        href: `/proposal/${quoteId}`,
                        external: true,
                      });
                      menuItems.push({
                        id: 'copy',
                        label: 'نسخ رابط العميل',
                        icon: <ClipboardCopy size={15} aria-hidden />,
                        onClick: () => void handleCopyClientLink(row),
                      });
                      menuItems.push({
                        id: 'wa-follow',
                        label: 'واتساب · متابعة',
                        icon: <MessageCircle size={15} aria-hidden />,
                        onClick: () => {
                          launchWhatsAppTemplate({
                            templateId: 'follow_up',
                            phone: quotationClientPhone(row),
                            clientName: clientLabel,
                            tripTitle: row.title,
                            quoteId,
                          });
                          setToast('تم فتح واتساب ✨');
                        },
                      });
                      menuItems.push({
                        id: 'route',
                        label: 'بناء مسار من العرض',
                        icon: <Route size={15} aria-hidden />,
                        href: buildItineraryBuilderPathFromQuotation(row),
                      });
                      menuItems.push({
                        id: 'clone',
                        label: cloning ? 'جاري الاستنساخ…' : 'استنساخ العرض',
                        icon: cloning ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : (
                          <Copy size={15} aria-hidden />
                        ),
                        onClick: () => void handleClone(row),
                        disabled: cloning,
                      });
                      if (row.status !== 'draft') {
                        menuItems.push({
                          id: 'invoice',
                          label: 'الفواتير',
                          icon: <Receipt size={15} aria-hidden />,
                          onClick: () => setInvoiceQuotation(row),
                        });
                      }
                      if (isApproved) {
                        menuItems.push({
                          id: 'revert',
                          label: reverting ? 'جاري الإلغاء…' : 'إلغاء الاعتماد',
                          icon: reverting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                          ) : (
                            <RefreshCcw size={15} aria-hidden />
                          ),
                          onClick: () =>
                            void handleRevertApproval(quoteId || row.id, row.client_id, row),
                          disabled: reverting,
                        });
                      }
                      menuItems.push({
                        id: 'delete',
                        label: deleting ? 'جاري الحذف…' : 'حذف عرض السعر',
                        icon: deleting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : (
                          <Trash2 size={15} aria-hidden />
                        ),
                        onClick: () => setQuoteToDelete(row),
                        danger: true,
                        disabled: deleting,
                      });
                    }

                    return (
                      <tr
                        key={quoteId || `quotation-${row.title}-${row.created_at}`}
                        className="border-b border-slate-100 font-medium text-slate-800 transition-colors hover:bg-slate-50/80"
                      >
                        <td className="whitespace-nowrap p-4 align-middle">
                          <span className="font-mono font-bold text-slate-400">
                            {quoteDisplayId(quoteId)}
                          </span>
                        </td>

                        <td className="p-4 align-middle">
                          <span className="block font-bold text-slate-900">
                            {clientLabel || 'عميل غير مسجل'}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {destinations && destinations !== '—' ? destinations : '—'}
                          </span>
                        </td>

                        <td className="whitespace-nowrap p-4 align-middle">
                          {total > 0 ? (
                            <span className="font-mono font-bold text-slate-900" dir="ltr">
                              {total.toLocaleString('en-US')} ر.س
                            </span>
                          ) : (
                            <span className="font-mono font-bold text-slate-400">—</span>
                          )}
                        </td>

                        <td className="whitespace-nowrap p-4 align-middle">
                          <span className={quotationStatusBadgeClass(row.status)}>
                            {QUOTATION_STATUS_LABEL[row.status] || 'بانتظار العميل'}
                          </span>
                        </td>

                        <td className="whitespace-nowrap p-4 align-middle">
                          <span className="font-mono text-[11px] text-slate-500">
                            {formatTravelDateRange(row.start_date, row.end_date)}
                          </span>
                        </td>

                        <td className="relative whitespace-nowrap p-4 text-center align-middle">
                          <div className="flex items-center justify-center gap-2">
                            {quoteId ? (
                              <Link
                                href={`/crm/quotations/edit/${quoteId}`}
                                title="تعديل العرض"
                                className="rounded-xl bg-[#111827] px-4 py-1.5 text-xs font-bold text-white transition hover:bg-slate-800"
                              >
                                تعديل
                              </Link>
                            ) : null}

                            <button
                              type="button"
                              disabled={!quoteId || !quotationClientPhone(row)}
                              title={
                                quotationClientPhone(row) ? 'إرسال واتساب' : 'لا يوجد رقم واتساب'
                              }
                              onClick={() => {
                                if (!quoteId) {
                                  setActionError('معرّف العرض غير صالح.');
                                  return;
                                }
                                const phone = quotationClientPhone(row);
                                if (!phone) {
                                  setActionError('لا يوجد رقم واتساب لهذا العميل.');
                                  return;
                                }
                                launchWhatsAppTemplate({
                                  templateId: 'send_quote',
                                  phone,
                                  clientName: clientLabel,
                                  tripTitle: row.title,
                                  quoteId,
                                });
                                if (supabase && row.client_id != null) {
                                  void updatePipelineStatus(
                                    supabase,
                                    { clientId: row.client_id, leadId: row.lead_id, force: true },
                                    'awaiting_payment',
                                  ).catch(() => undefined);
                                }
                                setToast('تم فتح واتساب بالعرض');
                              }}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-xs text-emerald-600 transition hover:bg-emerald-100 disabled:opacity-40"
                            >
                              <span aria-hidden>💬</span>
                              <span className="sr-only">واتساب</span>
                            </button>

                            {menuItems.length ? (
                              <RowActionsMenu items={menuItems} busy={menuBusy} />
                            ) : null}
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

        {quoteToDelete ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm space-y-4 rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-2xl">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-red-200 bg-red-50 text-xl text-red-600">
                🗑️
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">تأكيد حذف عرض السعر</h3>
                <p className="text-xs text-slate-500">
                  هل أنت متأكد من حذف عرض السعر الخاص بـ{' '}
                  <strong className="text-slate-900">
                    {quotationClientName(quoteToDelete) || 'العميل'}
                  </strong>
                  ؟ لا يمكن التراجع عن هذا الإجراء.
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => void handleDeleteQuotation(quoteToDelete)}
                  disabled={deleteBusyId !== null}
                  className="flex-1 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white transition-all hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteBusyId !== null ? 'جاري الحذف...' : 'نعم، حذف'}
                </button>
                <button
                  type="button"
                  onClick={() => setQuoteToDelete(null)}
                  disabled={deleteBusyId !== null}
                  className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-200 disabled:opacity-50"
                >
                  إلغاء
                </button>
              </div>
            </div>
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
