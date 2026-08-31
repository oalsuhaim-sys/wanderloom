'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  CalendarDays,
  FolderOpen,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';

import MarketingFilesLibrary from '@/app/crm/marketing/_components/MarketingFilesLibrary';
import {
  OperationsModal,
  type OperationsModalState,
} from '@/app/crm/marketing/_components/marketing-hub-forms';
import {
  createCalendarItemLive,
  deleteCalendarItemLive,
  updateCalendarItemLive,
} from '@/lib/marketing-hub-supabase';
import {
  mapCalendarRow,
  type ContentCalendarItem,
  type MarketingCalendarRow,
} from '@/lib/marketing-hub-types';
import { marketingSupabase } from '@/lib/marketing-supabase-client';
import { CRM_BTN_PRIMARY } from '@/lib/crm-luxury-ui';

function campaignStatus(slot: ContentCalendarItem): 'active' | 'paused' {
  const blob = `${slot.topic ?? ''} ${slot.format ?? ''} ${slot.platform ?? ''}`.toLowerCase();
  if (/pause|موقوف|مؤجل|draft|مسودة/.test(blob)) return 'paused';
  return 'active';
}

export default function MarketingOperationsClient() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [calendarItems, setCalendarItems] = useState<ContentCalendarItem[]>([]);
  const [modal, setModal] = useState<OperationsModalState>({ open: false });
  const [busy, setBusy] = useState(false);
  const [filesCount, setFilesCount] = useState(0);

  const loadCalendar = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await marketingSupabase
        .from('marketing_calendar')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) setLoadError(error.message);
      else if (data) setCalendarItems((data as MarketingCalendarRow[]).map(mapCalendarRow));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'فشل جلب التقويم');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

  const saveCalendar = useCallback(
    async (data: Omit<ContentCalendarItem, 'id'>, id?: string) => {
      setBusy(true);
      if (id) {
        const res = await updateCalendarItemLive(id, data);
        setBusy(false);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        setCalendarItems((prev) => prev.map((x) => (x.id === id ? { ...data, id } : x)));
        toast.success('تم تحديث الموعد');
      } else {
        const res = await createCalendarItemLive(data);
        setBusy(false);
        if (!res.ok || !res.data) {
          toast.error(res.error ?? 'فشل الإضافة');
          return;
        }
        setCalendarItems((prev) => [...prev, res.data!]);
        toast.success('تمت إضافة الموعد');
      }
      setModal({ open: false });
    },
    [],
  );

  const handleDeleteCalendar = async (id: string) => {
    if (!window.confirm('حذف هذا الموعد؟')) return;
    setBusy(true);
    const res = await deleteCalendarItemLive(id);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setCalendarItems((prev) => prev.filter((x) => x.id !== id));
    toast.success('تم حذف الموعد');
  };

  const kpis = useMemo(() => {
    const platforms = new Set(
      calendarItems.map((c) => String(c.platform ?? '').trim()).filter(Boolean),
    );
    const active = calendarItems.filter((c) => campaignStatus(c) === 'active').length;
    return [
      { label: 'مواعيد النشر', value: String(calendarItems.length), tone: 'slate' as const },
      { label: 'حملات نشطة', value: String(active), tone: 'emerald' as const },
      { label: 'المنصات', value: String(platforms.size), tone: 'amber' as const },
      { label: 'ملفات الأصول', value: String(filesCount), tone: 'slate' as const },
    ];
  }, [calendarItems, filesCount]);

  return (
    <>
      <div
        className="min-h-full bg-[#F9FAFB] pb-24 dark:bg-[#1A2421]"
        dir="rtl"
      >
        <header className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C] sm:mb-8 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-[#D4AF37]/80">
                <Megaphone className="h-3.5 w-3.5" aria-hidden />
                Marketing
              </p>
              <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                مركز التسويق
              </h1>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                مؤشرات الأداء · الحملات · مكتبة الأصول
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              <Link href="/crm/marketing/strategy" className={CRM_BTN_PRIMARY}>
                استوديو المحتوى والاستراتيجية
              </Link>
              <button
                type="button"
                onClick={() => void loadCalendar()}
                disabled={loading || busy}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-500 transition hover:bg-slate-50 disabled:opacity-50 dark:border-[#2D3F3A] dark:hover:bg-[#1A2421]"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} aria-hidden />
                تحديث
              </button>
            </div>
          </div>
        </header>

        {loadError ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
            {loadError}
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white p-12 shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C]">
            <Loader2 className="h-10 w-10 animate-spin text-[#D4AF37]" aria-hidden />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">جاري التحميل…</p>
          </div>
        ) : (
          <div className="space-y-10">
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="مؤشرات التسويق">
              {kpis.map((kpi) => {
                const valueClass =
                  kpi.tone === 'emerald'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : kpi.tone === 'amber'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-slate-900 dark:text-white';
                return (
                  <div
                    key={kpi.label}
                    className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm transition-all hover:shadow-md dark:border-[#2D3F3A] dark:bg-[#22302C]"
                  >
                    <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {kpi.label}
                    </p>
                    <p className={`text-3xl font-bold ${valueClass}`}>{kpi.value}</p>
                  </div>
                );
              })}
            </section>

            <section aria-label="الحملات ومواعيد النشر">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-slate-400 dark:text-[#D4AF37]/80" aria-hidden />
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">الحملات</h2>
                    <p className="mt-0.5 text-xs font-medium text-slate-500">
                      Instagram · TikTok · Reels
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModal({ open: true, kind: 'calendar', mode: 'add' })}
                  disabled={busy}
                  className={CRM_BTN_PRIMARY}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  إضافة موعد
                </button>
              </div>

              {calendarItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center dark:border-[#2D3F3A] dark:bg-[#22302C]">
                  <CalendarDays className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-[#D4AF37]/50" aria-hidden />
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    لا توجد مواعيد نشر بعد
                  </p>
                </div>
              ) : (
                <ul className="crm-stagger flex flex-col gap-3">
                  {calendarItems.map((slot) => {
                    const status = campaignStatus(slot);
                    return (
                      <li
                        key={slot.id}
                        className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg sm:flex-row sm:items-center sm:justify-between dark:border-[#2D3F3A] dark:bg-[#22302C]"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-400 dark:text-[#D4AF37]/80">
                            {slot.date ?? '—'}
                          </p>
                          <h4 className="mt-1 truncate text-base font-bold text-slate-900 dark:text-white">
                            {slot.topic || 'بدون عنوان'}
                          </h4>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {slot.format ? (
                              <span className="rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-700 dark:bg-[#1A2421] dark:text-slate-300">
                                {slot.format}
                              </span>
                            ) : null}
                            {slot.platform ? (
                              <span className="rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-700 dark:bg-[#1A2421] dark:text-slate-300">
                                {slot.platform}
                              </span>
                            ) : null}
                            <span
                              className={
                                status === 'active'
                                  ? 'rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                                  : 'rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                              }
                            >
                              {status === 'active' ? 'نشطة' : 'متوقفة'}
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setModal({ open: true, kind: 'calendar', mode: 'edit', item: slot })
                            }
                            className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50 dark:border-[#2D3F3A] dark:text-slate-300 dark:hover:bg-[#1A2421]"
                            aria-label="تعديل"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteCalendar(slot.id)}
                            className="rounded-xl border border-rose-200 p-2 text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/40 dark:hover:bg-rose-950/20"
                            aria-label="حذف"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section aria-label="الملفات">
              <div className="mb-5 flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-slate-400 dark:text-[#D4AF37]/80" aria-hidden />
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">مكتبة الأصول</h2>
              </div>
              <MarketingFilesLibrary onFilesCountChange={setFilesCount} />
            </section>
          </div>
        )}
      </div>

      {modal.open ? (
        <OperationsModal
          modal={modal}
          onClose={() => setModal({ open: false })}
          onSaveHuman={async () => {}}
          onSaveCalendar={saveCalendar}
        />
      ) : null}
    </>
  );
}
