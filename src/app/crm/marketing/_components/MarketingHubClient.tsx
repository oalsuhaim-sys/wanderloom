'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import {
  CalendarDays,
  Clapperboard,
  Crown,
  Hash,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react';

import {
  createAiPromptLive,
  createCalendarItemLive,
  createHumanScriptLive,
  deleteAiPromptLive,
  deleteCalendarItemLive,
  deleteHumanScriptLive,
  updateAiPromptLive,
  updateBrandIdentityLive,
  updateCalendarItemLive,
  updateHumanScriptLive,
} from '@/lib/marketing-hub-supabase';
import { marketingSupabase } from '@/lib/marketing-supabase-client';
import MarketingContentFilterBar, {
  EDIT_CATEGORY_OPTIONS,
  EDIT_MEDIA_TYPE_OPTIONS,
  filterMarketingContentCards,
} from '@/app/crm/marketing/_components/MarketingContentFilterBar';
import {
  normalizeContentCategory,
  normalizeMediaType,
  type MarketingContentCategory,
  type MarketingMediaType,
} from '@/lib/marketing-content';
import {
  DEFAULT_BRAND_IDENTITY,
  mapAiRow,
  mapBrandRow,
  mapCalendarRow,
  mapHumanRow,
  type AiContentItem,
  type BrandIdentity,
  type BrandIdentityRow,
  type ContentCalendarItem,
  type HumanProductionGuide,
  type MarketingAiPromptRow,
  type MarketingCalendarRow,
  type MarketingHumanScriptRow,
} from '@/lib/marketing-hub-types';

type MarketingTab = 'ai' | 'human' | 'calendar' | 'brand';

type ModalKind = 'ai' | 'human' | 'calendar';
type ModalMode = 'add' | 'edit';

type ModalState =
  | { open: false }
  | {
      open: true;
      kind: ModalKind;
      mode: ModalMode;
      item?: AiContentItem | HumanProductionGuide | ContentCalendarItem;
    };

const TABS: { id: MarketingTab; label: string; icon: typeof Sparkles }[] = [
  { id: 'ai', label: 'مصنع الـ AI', icon: Sparkles },
  { id: 'human', label: 'دليل الإنتاج البشري', icon: Clapperboard },
  { id: 'calendar', label: 'تقويم النشر', icon: CalendarDays },
  { id: 'brand', label: 'هوية العلامة', icon: Crown },
];

const FIELD =
  'w-full rounded-lg border border-gray-300 bg-[#FDFBF7] p-3 text-sm font-bold text-[#111111] outline-none transition focus:border-[#cda04c] focus:ring-1 focus:ring-[#cda04c]';

const INJECT_CHECKBOX_CLASS =
  "h-5 w-5 shrink-0 cursor-pointer appearance-none rounded-sm border-2 border-[#111111] bg-white checked:border-[#1e3f20] checked:bg-[#1e3f20] relative outline-none after:content-[''] after:hidden checked:after:block after:absolute after:inset-0 after:m-auto after:h-[8px] after:w-[4px] after:rotate-45 after:border-b-2 after:border-r-2 after:border-white";

function aiStatusClass(status: string | null | undefined): string {
  const s = status ?? '';
  if (s.includes('تم الرفع')) return 'border-[#1e3f20]/30 bg-[#1e3f20]/10 text-[#1e3f20]';
  return 'border-[#cda04c]/45 bg-[#cda04c]/12 text-[#7a5f28]';
}

function guideStatusClass(status: string | null | undefined): string {
  const s = status ?? '';
  if (s.includes('مونتاج')) return 'border-[#cda04c]/50 bg-[#cda04c]/10 text-[#7a5f28]';
  if (s.includes('بانتظار')) return 'border-amber-300/60 bg-amber-50 text-amber-900';
  return 'border-[#1e3f20]/25 bg-[#1e3f20]/8 text-[#1e3f20]';
}

function copyText(text: string | null | undefined, successMsg: string) {
  navigator.clipboard
    .writeText(text ?? '')
    .then(() => toast.success(successMsg, { style: { background: '#1e3f20', color: '#fff' } }))
    .catch(() => toast.error('حدث خطأ أثناء النسخ'));
}

export default function MarketingHubClient() {
  const [activeTab, setActiveTab] = useState<MarketingTab>('ai');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [aiItems, setAiItems] = useState<AiContentItem[]>([]);
  const [humanGuides, setHumanGuides] = useState<HumanProductionGuide[]>([]);
  const [calendarItems, setCalendarItems] = useState<ContentCalendarItem[]>([]);
  const [brandIdentity, setBrandIdentity] = useState<BrandIdentity>({
    id: '',
    ...DEFAULT_BRAND_IDENTITY,
  });
  const [injectBrandById, setInjectBrandById] = useState<Record<string, boolean>>({});
  const [selectedMediaType, setSelectedMediaType] = useState<string>('الكل');
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [busy, setBusy] = useState(false);

  const loadFromSupabase = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      const [brandRes, aiRes, humanRes, calendarRes] = await Promise.all([
        marketingSupabase.from('brand_identity').select('*').eq('slug', 'default').maybeSingle(),
        marketingSupabase
          .from('marketing_ai_prompts')
          .select('*')
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
        marketingSupabase
          .from('marketing_human_scripts')
          .select('*')
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
        marketingSupabase
          .from('marketing_calendar')
          .select('*')
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
      ]);

      const errors = [brandRes.error, aiRes.error, humanRes.error, calendarRes.error].filter(Boolean);
      if (errors.length) {
        setLoadError(errors.map((e) => e?.message).join(' · '));
      }

      if (brandRes.data) {
        setBrandIdentity(mapBrandRow(brandRes.data as BrandIdentityRow));
      }
      if (aiRes.data) {
        setAiItems((aiRes.data as MarketingAiPromptRow[]).map(mapAiRow));
      }
      if (humanRes.data) {
        setHumanGuides((humanRes.data as MarketingHumanScriptRow[]).map(mapHumanRow));
      }
      if (calendarRes.data) {
        setCalendarItems((calendarRes.data as MarketingCalendarRow[]).map(mapCalendarRow));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoadError(error instanceof Error ? error.message : 'فشل جلب البيانات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFromSupabase();
  }, [loadFromSupabase]);

  const stats = useMemo(() => {
    const ready =
      aiItems.filter((c) => c.status === 'جاهز للتوليد').length +
      humanGuides.filter((g) => g.status === 'بانتظار التصوير').length;
    return {
      total: aiItems.length + humanGuides.length + calendarItems.length,
      ready,
    };
  }, [aiItems, humanGuides, calendarItems]);

  const filteredAiItems = useMemo(
    () => filterMarketingContentCards(aiItems, selectedMediaType, selectedCategory),
    [aiItems, selectedMediaType, selectedCategory],
  );

  const openAdd = useCallback(() => {
    if (activeTab === 'brand') return;
    setModal({ open: true, kind: activeTab, mode: 'add' });
  }, [activeTab]);

  const openEdit = useCallback((kind: ModalKind, item: AiContentItem | HumanProductionGuide | ContentCalendarItem) => {
    setModal({ open: true, kind, mode: 'edit', item });
  }, []);

  const handleDeleteAi = useCallback(async (id: string) => {
    if (!window.confirm('حذف هذه الحملة؟')) return;
    setBusy(true);
    const res = await deleteAiPromptLive(id);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setAiItems((prev) => prev.filter((x) => x.id !== id));
    toast.success('تم حذف الحملة');
  }, []);

  const handleDeleteHuman = useCallback(async (id: string) => {
    if (!window.confirm('حذف هذا الدليل؟')) return;
    setBusy(true);
    const res = await deleteHumanScriptLive(id);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setHumanGuides((prev) => prev.filter((x) => x.id !== id));
    toast.success('تم حذف الدليل');
  }, []);

  const handleDeleteCalendar = useCallback(async (id: string) => {
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
  }, []);

  const saveAi = useCallback(async (data: Omit<AiContentItem, 'id'>, id?: string) => {
    setBusy(true);
    if (id) {
      const res = await updateAiPromptLive(id, data);
      setBusy(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setAiItems((prev) => prev.map((x) => (x.id === id ? { ...data, id } : x)));
      toast.success('تم تحديث الحملة');
    } else {
      const res = await createAiPromptLive(data);
      setBusy(false);
      if (!res.ok || !res.data) {
        toast.error(res.error ?? 'فشل الإضافة');
        return;
      }
      setAiItems((prev) => [...prev, res.data!]);
      toast.success('تمت إضافة الحملة');
    }
    setModal({ open: false });
  }, []);

  const saveHuman = useCallback(async (data: Omit<HumanProductionGuide, 'id'>, id?: string) => {
    setBusy(true);
    if (id) {
      const res = await updateHumanScriptLive(id, data);
      setBusy(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setHumanGuides((prev) => prev.map((x) => (x.id === id ? { ...data, id } : x)));
      toast.success('تم تحديث الدليل');
    } else {
      const res = await createHumanScriptLive(data);
      setBusy(false);
      if (!res.ok || !res.data) {
        toast.error(res.error ?? 'فشل الإضافة');
        return;
      }
      setHumanGuides((prev) => [...prev, res.data!]);
      toast.success('تمت إضافة الدليل');
    }
    setModal({ open: false });
  }, []);

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

  const saveBrand = useCallback(async () => {
    setBusy(true);
    const res = await updateBrandIdentityLive(brandIdentity.id, {
      slogan: brandIdentity.slogan,
      scarfPromptRule: brandIdentity.scarfPromptRule,
      designRules: brandIdentity.designRules,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success('تم حفظ هوية العلامة', { style: { background: '#1e3f20', color: '#fff' } });
  }, [brandIdentity]);

  const copyPromptWithInject = useCallback(
    (item: AiContentItem) => {
      const inject = injectBrandById[item.id] ?? false;
      let text = (item.visualPrompt ?? '').trim();
      const rule = (brandIdentity.scarfPromptRule ?? '').trim();
      if (inject && rule) {
        const sep = text.endsWith(',') ? ' ' : ', ';
        text = `${text}${sep}${rule}`;
        copyText(text, 'تم حقن الهوية ونسخ البرومبت بنجاح! 🍃');
      } else {
        copyText(text, 'تم نسخ البرومبت الخام بنجاح');
      }
    },
    [brandIdentity.scarfPromptRule, injectBrandById],
  );

  const tabCount = (tab: MarketingTab) => {
    if (tab === 'ai') return aiItems.length;
    if (tab === 'human') return humanGuides.length;
    if (tab === 'calendar') return calendarItems.length;
    return 0;
  };

  return (
    <>
      <Toaster position="top-center" toastOptions={{ duration: 2500, style: { fontWeight: 700 } }} />

      <div className="min-h-full bg-[#FDFBF7] pb-24 font-[family-name:var(--font-tajawal),system-ui,sans-serif]" dir="rtl">
        <header className="mb-6 rounded-[1.5rem] border border-[#1e3f20]/10 bg-white p-4 shadow-[0_16px_48px_rgba(30,63,32,0.07)] sm:mb-8 sm:rounded-[2rem] sm:p-6 md:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 rounded-full border border-[#cda04c]/35 bg-[#cda04c]/10 px-3 py-1.5 text-[10px] font-black text-[#9a7b45] sm:px-4 sm:text-[11px]">
                <Megaphone className="h-3.5 w-3.5" aria-hidden />
                Marketing Hub · إدارة ديناميكية
              </p>
              <h1 className="mt-3 text-2xl font-black text-[#1e3f20] sm:mt-4 sm:text-3xl md:text-4xl">مركز التسويق</h1>
              <p className="mt-2 text-sm font-bold leading-relaxed text-gray-600 sm:mt-3">
                بيانات حية من Supabase · حقن الهوية البصرية · CRUD كامل
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/crm/marketing"
                className="inline-flex items-center gap-2 rounded-xl border border-[#cda04c]/35 bg-[#cda04c]/10 px-4 py-2.5 text-xs font-black text-[#7a5f28] shadow-sm transition hover:bg-[#cda04c]/20"
              >
                المحتوى والحملات
              </Link>
              <button
                type="button"
                onClick={() => void loadFromSupabase()}
                disabled={loading || busy}
                className="inline-flex items-center gap-2 rounded-xl border border-[#1e3f20]/20 bg-white px-4 py-2.5 text-xs font-black text-[#1e3f20] shadow-sm transition hover:bg-[#f4f0e6] disabled:opacity-50"
                title="تحديث من Supabase"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
                تحديث
              </button>
              <div className="rounded-2xl border border-[#1e3f20]/12 bg-[#f4f0e6]/60 px-5 py-4 text-center">
                <p className="text-2xl font-black text-[#cda04c]">{stats.total}</p>
                <p className="text-[11px] font-black text-[#1e3f20]">عنصر</p>
              </div>
              <div className="rounded-2xl border border-[#cda04c]/30 bg-[#cda04c]/10 px-5 py-4 text-center">
                <p className="text-2xl font-black text-[#1e3f20]">{stats.ready}</p>
                <p className="text-[11px] font-black text-[#7a5f28]">جاهز للتنفيذ</p>
              </div>
            </div>
          </div>
        </header>

        {loadError ? (
          <div className="mb-6 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
            {loadError}
            <span className="mt-1 block text-xs font-bold text-amber-800">
              تأكد من تنفيذ supabase/sql/marketing_hub.sql ثم استورد CSV عبر npm run seed:marketing
            </span>
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-2xl border border-gray-100 bg-white p-12 shadow-sm">
            <Loader2 className="h-10 w-10 animate-spin text-[#cda04c]" aria-hidden />
            <p className="text-sm font-black text-[#1e3f20]">جاري تحميل البيانات...</p>
            <p className="text-xs font-bold text-gray-500">Supabase · marketing_ai_prompts · human_scripts · calendar · brand_identity</p>
          </div>
        ) : (
          <>
        <nav className="mb-6 flex flex-col gap-2 rounded-2xl border border-[#1e3f20]/10 bg-white p-2 shadow-sm sm:mb-8 sm:flex-row sm:flex-wrap">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            const count = tabCount(tab.id);
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex w-full min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition sm:w-auto sm:flex-none sm:px-5 ${
                  active ? 'bg-[#1e3f20] text-white shadow-md' : 'text-[#1e3f20] hover:bg-[#f4f0e6]'
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? 'text-[#cda04c]' : 'text-[#cda04c]/70'}`} />
                {tab.label}
                {tab.id !== 'brand' ? (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${active ? 'bg-white/20' : 'bg-[#1e3f20]/8'}`}>
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {activeTab === 'ai' ? (
          <>
            <MarketingContentFilterBar
              selectedMediaType={selectedMediaType}
              selectedCategory={selectedCategory}
              onSelectMediaType={setSelectedMediaType}
              onSelectCategory={setSelectedCategory}
            />

            {filteredAiItems.length === 0 ? (
              <div className="rounded-[1.75rem] border border-dashed border-[#1e3f20]/15 bg-white px-6 py-12 text-center">
                <p className="text-sm font-black text-[#1e3f20]">لا توجد بطاقات تطابق هذا التصفية</p>
              </div>
            ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {filteredAiItems.map((item) => (
              <article
                key={item.id}
                className="flex flex-col gap-5 rounded-[1.75rem] border border-[#1e3f20]/10 bg-white p-6 shadow-[0_12px_40px_rgba(30,63,32,0.06)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="text-xl font-black text-[#1e3f20]">{item.campaign ?? ''}</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[#1e3f20]/20 bg-[#f4f0e6]/80 px-3 py-1 text-[10px] font-black text-[#1e3f20]">
                      {item.media_type}
                    </span>
                    <span className="rounded-full border border-[#cda04c]/40 bg-[#cda04c]/10 px-3 py-1 text-[10px] font-black text-[#7a5f28]">
                      {item.content_category}
                    </span>
                    <span className={`rounded-full border px-3 py-1 text-[10px] font-black ${aiStatusClass(item.status)}`}>
                      {item.status ?? ''}
                    </span>
                    <button type="button" onClick={() => openEdit('ai', item)} className="rounded-lg border border-gray-200 p-2 hover:bg-[#f4f0e6]" aria-label="تعديل">
                      <Pencil className="h-4 w-4 text-[#1e3f20]" />
                    </button>
                    <button type="button" onClick={() => handleDeleteAi(item.id)} className="rounded-lg border border-red-200 p-2 hover:bg-red-50" aria-label="حذف">
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </button>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-black text-[#1e3f20]">AI Prompt · Visual</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="m-0 flex cursor-pointer items-center gap-2 border-none bg-transparent p-0">
                        <input
                          type="checkbox"
                          checked={injectBrandById[item.id] ?? false}
                          onChange={(e) =>
                            setInjectBrandById((prev) => ({ ...prev, [item.id]: e.target.checked }))
                          }
                          className={INJECT_CHECKBOX_CLASS}
                        />
                        <span className="text-[11px] font-bold text-[#1e3f20]">تطبيق بصمة الهوية البصرية (حقن السكارف التلقائي)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => copyPromptWithInject(item)}
                        className="rounded bg-[#cda04c] px-3 py-1 text-xs font-bold text-white hover:bg-[#b3893d]"
                      >
                        نسخ البرومبت
                      </button>
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#111111]/20 bg-[#111111] p-4">
                    <p className="font-mono text-xs leading-relaxed text-gray-200" dir="ltr">
                      {item.visualPrompt ?? ''}
                    </p>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-black text-[#1e3f20]">Caption · عربي</p>
                    <button
                      type="button"
                      onClick={() =>
                        copyText(`${item.caption ?? ''}\n\n${item.hashtags ?? ''}`, 'تم نسخ النص التسويقي! 📋')
                      }
                      className="rounded border border-[#1e3f20] px-3 py-1 text-xs font-bold text-[#1e3f20] hover:bg-[#f4f0e6]"
                    >
                      نسخ الكابشن والهاشتاج
                    </button>
                  </div>
                  <div className="rounded-xl border border-[#cda04c]/25 bg-[#FFFBF0] p-4">
                    <p className="text-sm font-bold leading-[1.9] text-[#2d3a33]">{item.caption ?? ''}</p>
                    <p className="mt-3 flex items-center gap-2 border-t border-[#cda04c]/20 pt-3 text-xs font-bold text-[#1e3f20]">
                      <Hash className="h-3.5 w-3.5 text-[#cda04c]" aria-hidden />
                      {item.hashtags ?? ''}
                    </p>
                  </div>
                </div>

                <UploadZone cardId={item.id} />
              </article>
            ))}
          </div>
            )}
          </>
        ) : null}

        {activeTab === 'human' ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {humanGuides.map((item) => (
              <article key={item.id} className="flex flex-col gap-5 rounded-[1.75rem] border border-[#1e3f20]/10 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="rounded-full border border-[#cda04c]/35 bg-[#cda04c]/10 px-3 py-1 text-[10px] font-black text-[#9a7b45]">
                      {item.platform ?? ''}
                    </span>
                    <h3 className="mt-3 text-lg font-black text-[#1e3f20]">{item.title ?? ''}</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-[10px] font-black ${guideStatusClass(item.status)}`}>
                      {item.status ?? ''}
                    </span>
                    <button type="button" onClick={() => openEdit('human', item)} className="rounded-lg border border-gray-200 p-2 hover:bg-[#f4f0e6]">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => handleDeleteHuman(item.id)} className="rounded-lg border border-red-200 p-2 hover:bg-red-50">
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </button>
                  </div>
                </div>
                <div className="rounded-xl border border-[#cda04c]/30 bg-[#FFFBF0] p-4">
                  <p className="mb-2 flex items-center gap-2 text-xs font-black text-[#cda04c]">
                    <Video className="h-3.5 w-3.5" /> الخطاف
                  </p>
                  <p className="text-sm font-bold text-[#2d3a33]">{item.hook ?? ''}</p>
                </div>
                <ul className="space-y-2">
                  {item.shotList.map((shot, shotIndex) => (
                    <li key={`${item.id}-shot-${shotIndex}`} className="rounded-lg border border-[#1e3f20]/8 bg-[#FDFBF7] px-3 py-2 text-xs font-bold text-gray-700">
                      {shot ?? ''}
                    </li>
                  ))}
                </ul>
                <div className="rounded-xl border border-[#1e3f20]/12 bg-[#f4f0e6]/50 p-4">
                  <div className="mb-2 flex justify-between gap-2">
                    <p className="text-xs font-black text-[#1e3f20]">Voiceover</p>
                    <button type="button" onClick={() => copyText(item.voiceover, 'تم نسخ السكربت! 📋')} className="text-xs font-bold text-[#1e3f20] underline">
                      نسخ
                    </button>
                  </div>
                  <p className="text-sm font-bold text-[#2d3a33]">{item.voiceover ?? ''}</p>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {activeTab === 'calendar' ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-[#cda04c]/30 bg-gradient-to-l from-[#1e3f20]/5 to-[#cda04c]/10 px-6 py-4">
              <p className="text-xs font-black text-[#cda04c]">تقويم Instagram & TikTok</p>
              <h3 className="mt-1 text-lg font-black text-[#1e3f20]">خطة المحتوى</h3>
            </div>
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
                          <span className="rounded-full border border-[#1e3f20]/20 px-3 py-1 text-[10px] font-black">{slot.format ?? ''}</span>
                          <span className="rounded-full border border-[#cda04c]/40 bg-[#cda04c]/10 px-3 py-1 text-[10px] font-black">{slot.platform ?? ''}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => openEdit('calendar', slot)} className="rounded-lg border p-2 hover:bg-[#f4f0e6]">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => handleDeleteCalendar(slot.id)} className="rounded-lg border border-red-200 p-2 hover:bg-red-50">
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {activeTab === 'brand' ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <BrandCard title="الشعار اللفظي (Slogan)">
              <input
                value={brandIdentity.slogan ?? ''}
                onChange={(e) => setBrandIdentity((b) => ({ ...b, slogan: e.target.value }))}
                className={FIELD}
              />
            </BrandCard>
            <BrandCard title="قاعدة السكارف الحريري · Signature Scarf Prompt Rule">
              <textarea
                value={brandIdentity.scarfPromptRule ?? ''}
                onChange={(e) => setBrandIdentity((b) => ({ ...b, scarfPromptRule: e.target.value }))}
                rows={4}
                dir="ltr"
                className={`${FIELD} font-mono text-xs`}
              />
              <p className="mt-2 text-[11px] font-bold text-gray-500">يُحقَن تلقائياً عند تفعيل الشيك بوكس في مصنع الـ AI</p>
            </BrandCard>
            <BrandCard title="قواعد التصميم والخطوط" className="lg:col-span-2">
              <textarea
                value={brandIdentity.designRules ?? ''}
                onChange={(e) => setBrandIdentity((b) => ({ ...b, designRules: e.target.value }))}
                rows={4}
                className={FIELD}
              />
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <span className="rounded-full border border-[#cda04c]/20 bg-[#fffaf1] px-4 py-1.5 text-sm font-bold text-[#1e3f20]">#FDFBF7</span>
                <span className="rounded-full border border-[#cda04c]/20 bg-[#fffaf1] px-4 py-1.5 text-sm font-bold text-[#1e3f20]">#1e3f20</span>
                <span className="rounded-full border border-[#cda04c]/20 bg-[#fffaf1] px-4 py-1.5 text-sm font-bold text-[#1e3f20]">#cda04c</span>
                <span className="rounded-full border border-[#cda04c]/20 bg-[#fffaf1] px-4 py-1.5 text-sm font-bold text-[#1e3f20]">#111111</span>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={saveBrand}
                className="mt-4 rounded-lg bg-[#1e3f20] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#163018] disabled:opacity-60"
              >
                حفظ الهوية
              </button>
            </BrandCard>
          </div>
        ) : null}

        {activeTab !== 'brand' ? (
          <button
            type="button"
            onClick={openAdd}
            disabled={busy}
            className="fixed bottom-4 end-4 z-50 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#cda04c] px-5 py-3 text-sm font-black text-white shadow-lg hover:bg-[#b3893d] disabled:opacity-60 sm:bottom-8 sm:end-8 sm:px-6 sm:py-3.5"
          >
            <Plus className="h-5 w-5" />
            إضافة محتوى جديد
          </button>
        ) : null}
          </>
        )}
      </div>

      {modal.open ? (
        <MarketingModal
          modal={modal}
          onClose={() => setModal({ open: false })}
          onSaveAi={saveAi}
          onSaveHuman={saveHuman}
          onSaveCalendar={saveCalendar}
        />
      ) : null}
    </>
  );
}

function BrandCard({
  title,
  children,
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[1.75rem] border border-[#1e3f20]/10 bg-white p-6 shadow-sm ${className}`}>
      <h3 className="mb-4 text-lg font-black text-[#1e3f20]">{title}</h3>
      {children}
    </div>
  );
}

function UploadZone({ cardId }: { cardId: string }) {
  const [fileName, setFileName] = useState<string | null>(null);
  return (
    <label
      htmlFor={`upload-${cardId}`}
      className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-[#1e3f20]/25 bg-[#FDFBF7] px-4 py-8 text-center hover:border-[#cda04c]/50"
    >
      <Upload className="h-6 w-6 text-[#1e3f20]/50" aria-hidden />
      <span className="text-sm font-bold text-[#1e3f20]">ارفع الصورة/الفيديو المُولَّد هنا</span>
      {fileName ? <span className="text-xs font-black text-[#7a5f28]">{fileName}</span> : null}
      <input id={`upload-${cardId}`} type="file" accept="image/*,video/*" className="sr-only" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)} />
    </label>
  );
}

function MarketingModal({
  modal,
  onClose,
  onSaveAi,
  onSaveHuman,
  onSaveCalendar,
}: {
  modal: Extract<ModalState, { open: true }>;
  onClose: () => void;
  onSaveAi: (data: Omit<AiContentItem, 'id'>, id?: string) => void | Promise<void>;
  onSaveHuman: (data: Omit<HumanProductionGuide, 'id'>, id?: string) => void | Promise<void>;
  onSaveCalendar: (data: Omit<ContentCalendarItem, 'id'>, id?: string) => void | Promise<void>;
}) {
  const isEdit = modal.mode === 'edit';
  const item = modal.item;

  if (modal.kind === 'ai') {
    const ai = item as AiContentItem | undefined;
    return (
      <ModalShell title={isEdit ? 'تعديل المحتوى' : 'إضافة محتوى'} onClose={onClose}>
        <AiForm
          initial={ai}
          onSubmit={(data) => onSaveAi(data, isEdit ? ai?.id : undefined)}
          onCancel={onClose}
        />
      </ModalShell>
    );
  }
  if (modal.kind === 'human') {
    const h = item as HumanProductionGuide | undefined;
    return (
      <ModalShell title={isEdit ? 'تعديل دليل تصوير' : 'إضافة دليل تصوير'} onClose={onClose}>
        <HumanForm
          initial={h}
          onSubmit={(data) => onSaveHuman(data, isEdit ? h?.id : undefined)}
          onCancel={onClose}
        />
      </ModalShell>
    );
  }
  const c = item as ContentCalendarItem | undefined;
  return (
    <ModalShell title={isEdit ? 'تعديل موعد' : 'إضافة موعد'} onClose={onClose}>
      <CalendarForm
        initial={c}
        onSubmit={(data) => onSaveCalendar(data, isEdit ? c?.id : undefined)}
        onCancel={onClose}
      />
    </ModalShell>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      dir="rtl"
      lang="ar"
      onClick={onClose}
    >
      <div
        className="max-h-[92dvh] w-[95%] max-w-lg overflow-y-auto rounded-t-2xl border border-[#cda04c]/30 bg-[#FDFBF7] p-4 shadow-2xl sm:max-h-[90vh] sm:w-full sm:rounded-2xl sm:p-6 md:w-3/4 md:max-w-2xl lg:w-1/2 lg:max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-[#1e3f20]">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full border p-2 hover:bg-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AiForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: AiContentItem;
  onSubmit: (data: Omit<AiContentItem, 'id'>) => void;
  onCancel: () => void;
}) {
  const [mediaType, setMediaType] = useState<MarketingMediaType>(() =>
    normalizeMediaType(initial?.media_type),
  );
  const [category, setCategory] = useState<MarketingContentCategory>(() =>
    normalizeContentCategory(initial?.content_category),
  );
  const [campaign, setCampaign] = useState(initial?.campaign ?? '');
  const [visualPrompt, setVisualPrompt] = useState(initial?.visualPrompt ?? '');
  const [caption, setCaption] = useState(initial?.caption ?? '');
  const [hashtags, setHashtags] = useState(initial?.hashtags ?? '');
  const [status, setStatus] = useState(initial?.status ?? 'جاهز للتوليد');

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          mediaType,
          contentCategory: category,
          media_type: mediaType,
          content_category: category,
          campaign,
          visualPrompt,
          caption,
          hashtags,
          status,
        });
      }}
    >
      <label className="block text-xs font-black text-[#1e3f20]">نوع الوسائط</label>
      <select
        value={mediaType}
        onChange={(e) => setMediaType(e.target.value as MarketingMediaType)}
        className={FIELD}
      >
        {EDIT_MEDIA_TYPE_OPTIONS.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>

      <label className="block text-xs font-black text-[#1e3f20]">التصنيف</label>
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as MarketingContentCategory)}
        className={FIELD}
      >
        {EDIT_CATEGORY_OPTIONS.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>
      <label className="block text-xs font-black text-[#1e3f20]">اسم الحملة</label>
      <input value={campaign} onChange={(e) => setCampaign(e.target.value)} className={FIELD} required />
      <label className="block text-xs font-black text-[#1e3f20]">Visual Prompt</label>
      <textarea value={visualPrompt} onChange={(e) => setVisualPrompt(e.target.value)} className={FIELD} rows={3} dir="ltr" required />
      <label className="block text-xs font-black text-[#1e3f20]">Caption</label>
      <textarea value={caption} onChange={(e) => setCaption(e.target.value)} className={FIELD} rows={3} required />
      <label className="block text-xs font-black text-[#1e3f20]">Hashtags</label>
      <input value={hashtags} onChange={(e) => setHashtags(e.target.value)} className={FIELD} />
      <label className="block text-xs font-black text-[#1e3f20]">الحالة</label>
      <input value={status} onChange={(e) => setStatus(e.target.value)} className={FIELD} />
      <div className="flex gap-3 pt-2">
        <button type="submit" className="flex-1 rounded-lg bg-[#1e3f20] py-2.5 text-sm font-bold text-white">
          حفظ
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-bold">
          إلغاء
        </button>
      </div>
    </form>
  );
}

function HumanForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: HumanProductionGuide;
  onSubmit: (data: Omit<HumanProductionGuide, 'id'>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [hook, setHook] = useState(initial?.hook ?? '');
  const [shotListText, setShotListText] = useState(initial?.shotList.join('\n') ?? '');
  const [voiceover, setVoiceover] = useState(initial?.voiceover ?? '');
  const [carouselStructure, setCarouselStructure] = useState(initial?.carouselStructure ?? '');
  const [platform, setPlatform] = useState(initial?.platform ?? 'Instagram');
  const [status, setStatus] = useState(initial?.status ?? 'بانتظار التصوير');

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          title,
          hook,
          shotList: shotListText.split('\n').map((s) => (s ?? '').trim()).filter(Boolean),
          voiceover,
          platform,
          carouselStructure,
          status,
        });
      }}
    >
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="العنوان" className={FIELD} required />
      <textarea value={hook} onChange={(e) => setHook(e.target.value)} placeholder="الخطاف" className={FIELD} rows={2} required />
      <textarea value={shotListText} onChange={(e) => setShotListText(e.target.value)} placeholder="زوايا التصوير (سطر لكل زاوية)" className={FIELD} rows={4} required />
      <textarea value={voiceover} onChange={(e) => setVoiceover(e.target.value)} placeholder="Voiceover" className={FIELD} rows={3} required />
      <textarea value={carouselStructure} onChange={(e) => setCarouselStructure(e.target.value)} placeholder="Carousel structure (اختياري)" className={FIELD} rows={2} />
      <input value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="المنصة" className={FIELD} />
      <input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="الحالة" className={FIELD} />
      <div className="flex gap-3">
        <button type="submit" className="flex-1 rounded-lg bg-[#1e3f20] py-2.5 text-sm font-bold text-white">
          حفظ
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2.5 text-sm font-bold">
          إلغاء
        </button>
      </div>
    </form>
  );
}

function CalendarForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: ContentCalendarItem;
  onSubmit: (data: Omit<ContentCalendarItem, 'id'>) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(initial?.date ?? '');
  const [topic, setTopic] = useState(initial?.topic ?? '');
  const [format, setFormat] = useState(initial?.format ?? 'Reel');
  const [platform, setPlatform] = useState(initial?.platform ?? 'Instagram');

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ date, topic, format, platform });
      }}
    >
      <input value={date} onChange={(e) => setDate(e.target.value)} placeholder="الأسبوع / التاريخ" className={FIELD} required />
      <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="الموضوع" className={FIELD} required />
      <input value={format} onChange={(e) => setFormat(e.target.value)} placeholder="الصيغة" className={FIELD} />
      <input value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="المنصة" className={FIELD} />
      <div className="flex gap-3">
        <button type="submit" className="flex-1 rounded-lg bg-[#1e3f20] py-2.5 text-sm font-bold text-white">
          حفظ
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2.5 text-sm font-bold">
          إلغاء
        </button>
      </div>
    </form>
  );
}
