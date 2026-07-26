'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { CalendarDays, FolderOpen, Loader2, Megaphone, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';

import MarketingFilesLibrary from '@/app/crm/marketing/_components/MarketingFilesLibrary';
import { OperationsModal, type OperationsModalState } from '@/app/crm/marketing/_components/marketing-hub-forms';
import {
  createCalendarItemLive,
  deleteCalendarItemLive,
  updateCalendarItemLive,
} from '@/lib/marketing-hub-supabase';
import { mapCalendarRow, type ContentCalendarItem, type MarketingCalendarRow } from '@/lib/marketing-hub-types';
import { marketingSupabase } from '@/lib/marketing-supabase-client';

const STUDIO_BTN =
  'inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#cda04c]/55 bg-white px-3 py-1.5 text-[10px] font-bold tracking-wide text-[#9a7b45] shadow-[0_1px_8px_rgba(205,160,76,0.12)] transition hover:border-[#cda04c] hover:bg-[#cda04c]/[0.06] hover:text-[#7a5f28] sm:text-[11px]';

export default function MarketingOperationsClient() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [calendarItems, setCalendarItems] = useState<ContentCalendarItem[]>([]);
  const [modal, setModal] = useState<OperationsModalState>({ open: false });
  const [busy, setBusy] = useState(false);

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

  const saveCalendar = useCallback(async (data: Omit<ContentCalendarItem, 'id'>, id?: string) => {
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
  }, []);

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

  return (
    <>
      <Toaster position="top-center" toastOptions={{ duration: 2500, style: { fontWeight: 700 } }} />

      <div className="min-h-full bg-[#FDFBF7] pb-24 font-[family-name:var(--font-tajawal),system-ui,sans-serif]" dir="rtl">
        <header className="mb-6 rounded-[1.5rem] border border-[#1e3f20]/10 bg-white p-4 shadow-[0_16px_48px_rgba(30,63,32,0.07)] sm:mb-8 sm:rounded-[2rem] sm:p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="inline-flex items-center gap-2 rounded-full border border-[#1e3f20]/15 bg-[#f4f0e6]/50 px-3 py-1 text-[10px] font-black text-[#1e3f20] sm:text-[11px]">
                <Megaphone className="h-3.5 w-3.5 text-[#cda04c]" aria-hidden />
                العمليات اليومية
              </p>
              <h1 className="mt-3 text-2xl font-black text-[#1e3f20] sm:text-3xl">مركز التسويق</h1>
              <p className="mt-1.5 text-sm font-bold text-gray-500">الملفات · مواعيد النشر</p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              <Link href="/crm/marketing/strategy" className={STUDIO_BTN}>
                <span>🎬 استوديو المحتوى والاستراتيجية</span>
              </Link>
              <button
                type="button"
                onClick={() => void loadCalendar()}
                disabled={loading || busy}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#1e3f20]/12 px-2.5 py-1 text-[10px] font-bold text-gray-500 transition hover:bg-[#f4f0e6] disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} aria-hidden />
                تحديث
              </button>
            </div>
          </div>
        </header>

        {loadError ? (
          <div className="mb-6 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
            {loadError}
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 rounded-2xl border border-gray-100 bg-white p-12 shadow-sm">
            <Loader2 className="h-10 w-10 animate-spin text-[#cda04c]" aria-hidden />
            <p className="text-sm font-black text-[#1e3f20]">جاري التحميل…</p>
          </div>
        ) : (
          <div className="space-y-12">
            <section aria-label="الملفات">
              <div className="mb-5 flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-[#cda04c]" aria-hidden />
                <h2 className="text-xl font-black text-[#1e3f20]">الملفات</h2>
              </div>
              <MarketingFilesLibrary />
            </section>

            <section aria-label="مواعيد النشر">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-[#cda04c]" aria-hidden />
                  <div>
                    <h2 className="text-xl font-black text-[#1e3f20]">مواعيد النشر</h2>
                    <p className="mt-0.5 text-xs font-bold text-gray-500">Instagram · TikTok · Reels</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModal({ open: true, kind: 'calendar', mode: 'add' })}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#1e3f20]/20 bg-[#1e3f20] px-3.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#163018] disabled:opacity-60"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  إضافة موعد
                </button>
              </div>

              {calendarItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#1e3f20]/15 bg-white px-6 py-12 text-center">
                  <CalendarDays className="mx-auto mb-3 h-10 w-10 text-[#cda04c]/60" aria-hidden />
                  <p className="text-sm font-black text-[#1e3f20]">لا توجد مواعيد نشر بعد</p>
                </div>
              ) : (
                <ol className="relative space-y-0 border-r-2 border-[#cda04c]/35 pr-6">
                  {calendarItems.map((slot, index) => (
                    <li key={slot.id} className="relative pb-8 last:pb-0">
                      <span className="absolute -right-[calc(0.75rem+1px)] top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#cda04c] bg-[#FDFBF7] text-[10px] font-black">
                        {index + 1}
                      </span>
                      <div className="rounded-2xl border border-[#1e3f20]/10 bg-white p-5 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-black text-[#cda04c]">{slot.date ?? ''}</p>
                            <h4 className="mt-2 text-base font-black text-[#1e3f20]">{slot.topic ?? ''}</h4>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="rounded-full border border-[#1e3f20]/20 px-3 py-1 text-[10px] font-black">
                                {slot.format ?? ''}
                              </span>
                              <span className="rounded-full border border-[#cda04c]/40 bg-[#cda04c]/10 px-3 py-1 text-[10px] font-black">
                                {slot.platform ?? ''}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setModal({ open: true, kind: 'calendar', mode: 'edit', item: slot })}
                              className="rounded-lg border p-2 hover:bg-[#f4f0e6]"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteCalendar(slot.id)}
                              className="rounded-lg border border-red-200 p-2 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
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
