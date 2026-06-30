'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';
import { CalendarDays, Clapperboard, Loader2, Megaphone, Video } from 'lucide-react';

import MarketingFilesLibrary from '@/app/crm/marketing/_components/MarketingFilesLibrary';
import MarketingProductionStudio from '@/app/crm/marketing/_components/MarketingProductionStudio';
import { marketingSupabase } from '@/lib/marketing-supabase-client';
import { mapCalendarRow, type ContentCalendarItem, type MarketingCalendarRow } from '@/lib/marketing-hub-types';

const LUXURY_CARD =
  'flex h-full flex-col gap-5 rounded-[1.75rem] border border-[#1e3f20]/10 bg-white p-6 shadow-[0_12px_40px_rgba(30,63,32,0.06)]';

function isTikTokPlatform(platform: string | null | undefined): boolean {
  return String(platform ?? '')
    .trim()
    .toLowerCase()
    .includes('tiktok');
}

export default function ContentCampaignsClient() {
  const [loading, setLoading] = useState(true);
  const [tiktokPlan, setTiktokPlan] = useState<ContentCalendarItem[]>([]);

  const loadTikTokPlan = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await marketingSupabase
        .from('marketing_calendar')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) {
        toast.error(error.message || 'تعذّر تحميل خطة تيك توك');
        setTiktokPlan([]);
        return;
      }

      const items = ((data ?? []) as MarketingCalendarRow[])
        .map(mapCalendarRow)
        .filter((item) => isTikTokPlatform(item.platform));

      setTiktokPlan(items);
    } catch (e) {
      console.error('[ContentCampaigns] load failed', e);
      toast.error('فشل جلب خطة المحتوى');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTikTokPlan();
  }, [loadTikTokPlan]);

  return (
    <>
      <Toaster position="top-center" toastOptions={{ duration: 2500, style: { fontWeight: 700 } }} />

      <div
        className="min-h-full bg-[#FDFBF7] pb-24 font-[family-name:var(--font-tajawal),system-ui,sans-serif]"
        dir="rtl"
      >
        <header className="mb-6 rounded-[1.5rem] border border-[#1e3f20]/10 bg-white p-4 shadow-[0_16px_48px_rgba(30,63,32,0.07)] sm:mb-8 sm:rounded-[2rem] sm:p-6 md:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 rounded-full border border-[#cda04c]/35 bg-[#cda04c]/10 px-3 py-1.5 text-[10px] font-black text-[#9a7b45] sm:px-4 sm:text-[11px]">
                <Megaphone className="h-3.5 w-3.5" aria-hidden />
                Content & Campaigns
              </p>
              <h1 className="mt-3 text-2xl font-black text-[#1e3f20] sm:mt-4 sm:text-3xl md:text-4xl">
                المحتوى والحملات
              </h1>
              <p className="mt-2 text-sm font-bold leading-relaxed text-gray-600 sm:mt-3">
                خطة تيك توك · استوديو الإنتاج · مكتبة ملفات التسويق
              </p>
            </div>
            <Link
              href="/crm/marketing/hub"
              className="inline-flex items-center gap-2 self-start rounded-xl border border-[#1e3f20]/20 bg-white px-4 py-2.5 text-xs font-black text-[#1e3f20] shadow-sm transition hover:bg-[#f4f0e6]"
            >
              <Clapperboard className="h-4 w-4 text-[#cda04c]" aria-hidden />
              مركز التسويق الكامل
            </Link>
          </div>
        </header>

        <section className="mb-8 space-y-4">
          <div>
            <p className="text-xs font-black text-[#cda04c]">Production Workflow</p>
            <h2 className="mt-1 text-lg font-black text-[#1e3f20]">استوديو الإنتاج — AI × بشري</h2>
          </div>
          <MarketingProductionStudio />
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <article className={LUXURY_CARD}>
            <div>
              <p className="flex items-center gap-2 text-xs font-black text-[#cda04c]">
                <Video className="h-4 w-4" aria-hidden />
                TikTok · Reels
              </p>
              <h2 className="mt-1 text-xl font-black text-[#1e3f20]">خطة محتوى تيك توك</h2>
              <p className="mt-1 text-xs font-bold text-gray-500">من جدول marketing_calendar · منصة TikTok</p>
            </div>

            {loading ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[#cda04c]" aria-hidden />
                <p className="text-sm font-bold text-gray-500">جاري تحميل الخطة…</p>
              </div>
            ) : tiktokPlan.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-[#1e3f20]/12 bg-[#FDFBF7] px-6 py-10 text-center">
                <CalendarDays className="mb-3 h-10 w-10 text-[#cda04c]/60" aria-hidden />
                <p className="text-sm font-black text-[#1e3f20]">لا توجد عناصر تيك توك بعد</p>
                <p className="mt-2 text-xs font-bold text-gray-500">
                  أضف مواعيد من{' '}
                  <Link href="/crm/marketing/hub" className="text-[#cda04c] underline">
                    مركز التسويق
                  </Link>{' '}
                  مع منصة TikTok
                </p>
              </div>
            ) : (
              <ol className="max-h-[420px] space-y-3 overflow-y-auto border-r-2 border-[#cda04c]/30 pr-4">
                {tiktokPlan.map((slot, index) => (
                  <li
                    key={slot.id}
                    className="relative rounded-xl border border-[#1e3f20]/8 bg-[#FDFBF7] px-4 py-3"
                  >
                    <span className="absolute -right-[calc(0.75rem+1px)] top-3 flex h-5 w-5 items-center justify-center rounded-full border border-[#cda04c] bg-white text-[9px] font-black text-[#1e3f20]">
                      {index + 1}
                    </span>
                    <p className="text-[10px] font-black text-[#cda04c]">{slot.date || '—'}</p>
                    <h3 className="mt-1 text-sm font-black text-[#1e3f20]">{slot.topic || '—'}</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full border border-[#1e3f20]/15 px-2.5 py-0.5 text-[10px] font-black">
                        {slot.format || 'Reel'}
                      </span>
                      <span className="rounded-full border border-[#cda04c]/40 bg-[#cda04c]/10 px-2.5 py-0.5 text-[10px] font-black">
                        {slot.platform || 'TikTok'}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </article>

          <MarketingFilesLibrary />
        </div>
      </div>
    </>
  );
}
