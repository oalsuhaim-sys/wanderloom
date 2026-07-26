'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import {
  ArrowRight,
  Clapperboard,
  Crown,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Video,
} from 'lucide-react';

import MarketingProductionStudio from '@/app/crm/marketing/_components/MarketingProductionStudio';
import {
  guideStatusClass,
  MARKETING_FIELD,
  OperationsModal,
  type OperationsModalState,
} from '@/app/crm/marketing/_components/marketing-hub-forms';
import {
  createHumanScriptLive,
  deleteHumanScriptLive,
  updateBrandIdentityLive,
  updateHumanScriptLive,
} from '@/lib/marketing-hub-supabase';
import {
  DEFAULT_BRAND_IDENTITY,
  mapBrandRow,
  mapHumanRow,
  type BrandIdentity,
  type BrandIdentityRow,
  type HumanProductionGuide,
  type MarketingHumanScriptRow,
} from '@/lib/marketing-hub-types';
import { marketingSupabase } from '@/lib/marketing-supabase-client';

const BACK_BTN =
  'mb-6 inline-flex items-center gap-1 rounded-full border border-[#cda04c]/35 bg-[#111111]/60 px-2.5 py-1 text-[10px] font-bold text-[#cda04c]/90 backdrop-blur-sm transition hover:border-[#cda04c]/55 hover:text-[#cda04c]';

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

export default function MarketingStrategyClient() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [humanGuides, setHumanGuides] = useState<HumanProductionGuide[]>([]);
  const [brandIdentity, setBrandIdentity] = useState<BrandIdentity>({ id: '', ...DEFAULT_BRAND_IDENTITY });
  const [modal, setModal] = useState<OperationsModalState>({ open: false });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [humanRes, brandRes] = await Promise.all([
        marketingSupabase
          .from('marketing_human_scripts')
          .select('*')
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
        marketingSupabase.from('brand_identity').select('*').eq('slug', 'default').maybeSingle(),
      ]);

      if (humanRes.data) {
        setHumanGuides((humanRes.data as MarketingHumanScriptRow[]).map(mapHumanRow));
      }
      if (brandRes.data) {
        setBrandIdentity(mapBrandRow(brandRes.data as BrandIdentityRow));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'فشل تحميل الاستراتيجية');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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

  const handleDeleteHuman = async (id: string) => {
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
  };

  const saveBrand = async () => {
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
  };

  return (
    <>
      <Toaster position="top-center" toastOptions={{ duration: 2500, style: { fontWeight: 700 } }} />

      <div
        className="min-h-full pb-24 font-[family-name:var(--font-tajawal),system-ui,sans-serif]"
        dir="rtl"
        style={{
          background:
            'radial-gradient(ellipse 90% 50% at 50% -10%, rgba(205,160,76,0.12), transparent), #0a0c0b',
        }}
      >
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
          <Link href="/crm/marketing" className={BACK_BTN}>
            <ArrowRight className="h-3 w-3" aria-hidden />
            <span>← العودة للعمليات</span>
          </Link>

          <header className="mb-10 rounded-[1.75rem] border border-[#cda04c]/25 bg-[#111111]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-8">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#cda04c]/35 bg-[#cda04c]/10 px-3 py-1 text-[10px] font-black text-[#cda04c]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Content & Strategy Studio
            </p>
            <h1 className="mt-4 text-2xl font-black text-white sm:text-3xl">استوديو المحتوى والاستراتيجية</h1>
            <p className="mt-2 text-sm font-bold text-[#A8A49C]">
              مصنع الـ AI · دليل الإنتاج البشري · هوية العلامة
            </p>
          </header>

          {loading ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#cda04c]" aria-hidden />
              <p className="text-sm font-bold text-[#A8A49C]">جاري تحميل لوحة الاستراتيجية…</p>
            </div>
          ) : (
            <div className="space-y-14">
              <section aria-label="مصنع الـ AI">
                <div className="mb-5 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-[#cda04c]" aria-hidden />
                  <h2 className="text-xl font-black text-white">مصنع الـ AI</h2>
                </div>
                <div className="rounded-[1.75rem] border border-white/8 bg-[#FDFBF7] p-4 shadow-2xl sm:p-6 md:p-8">
                  <MarketingProductionStudio />
                </div>
              </section>

              <section aria-label="دليل الإنتاج البشري">
                <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Clapperboard className="h-5 w-5 text-[#cda04c]" aria-hidden />
                    <h2 className="text-xl font-black text-white">دليل الإنتاج البشري</h2>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setModal({ open: true, kind: 'human', mode: 'add' })}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#cda04c]/45 px-3 py-1.5 text-[11px] font-bold text-[#cda04c] transition hover:bg-[#cda04c]/10 disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    إضافة دليل
                  </button>
                </div>

                {humanGuides.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-6 py-10 text-center">
                    <p className="text-sm font-black text-[#E8E4DC]">لا توجد أدلة تصوير بعد</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {humanGuides.map((item) => (
                      <article
                        key={item.id}
                        className="flex flex-col gap-5 rounded-[1.75rem] border border-[#1e3f20]/10 bg-white p-6 shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <span className="rounded-full border border-[#cda04c]/35 bg-[#cda04c]/10 px-3 py-1 text-[10px] font-black text-[#9a7b45]">
                              {item.platform ?? ''}
                            </span>
                            <h3 className="mt-3 text-lg font-black text-[#1e3f20]">{item.title ?? ''}</h3>
                          </div>
                          <div className="flex gap-2">
                            <span className={`rounded-full border px-3 py-1 text-[10px] font-black ${guideStatusClass(item.status)}`}>
                              {item.status ?? ''}
                            </span>
                            <button
                              type="button"
                              onClick={() => setModal({ open: true, kind: 'human', mode: 'edit', item })}
                              className="rounded-lg border border-gray-200 p-2 hover:bg-[#f4f0e6]"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteHuman(item.id)}
                              className="rounded-lg border border-red-200 p-2 hover:bg-red-50"
                            >
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
                          {item.shotList.map((shot, i) => (
                            <li
                              key={`${item.id}-${i}`}
                              className="rounded-lg border border-[#1e3f20]/8 bg-[#FDFBF7] px-3 py-2 text-xs font-bold text-gray-700"
                            >
                              {shot}
                            </li>
                          ))}
                        </ul>
                        <div className="rounded-xl border border-[#1e3f20]/12 bg-[#f4f0e6]/50 p-4">
                          <p className="text-xs font-black text-[#1e3f20]">Voiceover</p>
                          <p className="mt-1 text-sm font-bold text-[#2d3a33]">{item.voiceover ?? ''}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section aria-label="هوية العلامة">
                <div className="mb-5 flex items-center gap-2">
                  <Crown className="h-5 w-5 text-[#cda04c]" aria-hidden />
                  <h2 className="text-xl font-black text-white">هوية العلامة</h2>
                </div>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <BrandCard title="الشعار اللفظي (Slogan)">
                    <input
                      value={brandIdentity.slogan ?? ''}
                      onChange={(e) => setBrandIdentity((b) => ({ ...b, slogan: e.target.value }))}
                      className={MARKETING_FIELD}
                    />
                  </BrandCard>
                  <BrandCard title="قاعدة السكارف الحريري">
                    <textarea
                      value={brandIdentity.scarfPromptRule ?? ''}
                      onChange={(e) => setBrandIdentity((b) => ({ ...b, scarfPromptRule: e.target.value }))}
                      rows={4}
                      dir="ltr"
                      className={`${MARKETING_FIELD} font-mono text-xs`}
                    />
                  </BrandCard>
                  <BrandCard title="قواعد التصميم والخطوط" className="lg:col-span-2">
                    <textarea
                      value={brandIdentity.designRules ?? ''}
                      onChange={(e) => setBrandIdentity((b) => ({ ...b, designRules: e.target.value }))}
                      rows={4}
                      className={MARKETING_FIELD}
                    />
                    <div className="mt-4 flex flex-wrap justify-center gap-3">
                      {['#FDFBF7', '#1e3f20', '#cda04c', '#111111'].map((hex) => (
                        <span
                          key={hex}
                          className="rounded-full border border-[#cda04c]/20 bg-[#fffaf1] px-4 py-1.5 text-sm font-bold text-[#1e3f20]"
                        >
                          {hex}
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void saveBrand()}
                      className="mt-4 rounded-lg bg-[#1e3f20] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#163018] disabled:opacity-60"
                    >
                      حفظ الهوية
                    </button>
                  </BrandCard>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>

      {modal.open ? (
        <OperationsModal
          modal={modal}
          onClose={() => setModal({ open: false })}
          onSaveHuman={saveHuman}
          onSaveCalendar={async () => {}}
        />
      ) : null}
    </>
  );
}
