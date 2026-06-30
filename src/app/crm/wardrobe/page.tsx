'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ExternalLink, Loader2, MapPin, Plus, ShoppingBag, Snowflake, Sparkles, Sun, X } from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { formatWardrobePrice, wardrobeItemCode } from '@/lib/format-wardrobe-price';
import type { TravelWardrobeRow } from '@/types/travel-wardrobe';

const SEASON_OPTIONS = ['شتاء', 'ربيع', 'صيف', 'خريف', 'طوال العام'] as const;

const DESTINATION_OPTIONS = [
  'أوروبا',
  'كوريا',
  'شواطئ',
  'ثلوج',
  'الخليج',
  'آسيا',
  'أمريكا الشمالية',
  'استوائي',
  'مدن',
  'سويسرا',
  'فرنسا',
  'إيطاليا',
  'اليابان',
  'المملكة المتحدة',
  'المالديف',
  'دبي',
  'نيويورك',
  'النرويج',
  'النمسا',
  'إسبانيا',
  'اليونان',
  'المغرب',
  'تركيا',
] as const;

const PLACEHOLDER_IMG =
  'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1200&auto=format&fit=crop';

function toggleInSet(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function mergeTags(row: TravelWardrobeRow, key: 'seasons' | 'destinations'): string[] {
  const primary = Array.isArray(row[key]) ? row[key]! : [];
  const extraKey = key === 'seasons' ? 'season_tags' : 'destination_tags';
  const extra = Array.isArray(row[extraKey]) ? (row[extraKey] as string[]) : [];
  return [...new Set([...primary, ...extra].map((s) => String(s).trim()).filter(Boolean))];
}

export default function WardrobeCollectionPage() {
  const [rows, setRows] = useState<TravelWardrobeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    image_url: '',
    purchase_url: '',
  });
  const [seasonPick, setSeasonPick] = useState<Set<string>>(new Set());
  const [destinationPick, setDestinationPick] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      setBanner({ type: 'err', text: 'قاعدة البيانات غير مهيأة.' });
      return;
    }
    setLoading(true);
    setBanner(null);
    try {
      const { data, error } = await supabase
        .from('travel_wardrobe')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRows((data ?? []) as TravelWardrobeRow[]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setRows([]);
      setBanner({
        type: 'err',
        text:
          msg.includes('travel_wardrobe') || msg.includes('relation')
            ? 'جدول travel_wardrobe غير موجود. نفّذ supabase/sql/travel_wardrobe.sql في Supabase.'
            : msg || 'تعذر تحميل المجموعة.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function resetModal() {
    setForm({ name: '', description: '', price: '', image_url: '', purchase_url: '' });
    setSeasonPick(new Set());
    setDestinationPick(new Set());
  }

  function openModal() {
    resetModal();
    setModalOpen(true);
  }

  async function handleSubmit() {
    if (!supabase) return;
    const name = form.name.trim();
    if (!name) {
      setBanner({ type: 'err', text: 'أدخل اسم القطعة.' });
      return;
    }
    const priceNum = Number(form.price);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      setBanner({ type: 'err', text: 'أدخل سعراً صحيحاً.' });
      return;
    }

    setSaving(true);
    setBanner(null);
    try {
      const description = form.description.trim();
      const imageTrim = form.image_url.trim();
      const purchaseTrim = form.purchase_url.trim();
      const seasons = Array.from(seasonPick);
      const destinations = Array.from(destinationPick);

      const payload: Record<string, unknown> = {
        name,
        description: description || '',
        price: priceNum,
        image_url: imageTrim || null,
        purchase_url: purchaseTrim || null,
        seasons,
        destinations,
        season_tags: [],
        destination_tags: [],
      };

      const { data: inserted, error } = await supabase.from('travel_wardrobe').insert(payload).select('*').maybeSingle();

      if (error) {
        const msg = error.message ?? '';
        const noTagCols =
          /season_tags|destination_tags/i.test(msg) && /does not exist|column|schema cache/i.test(msg);
        if (noTagCols) {
          delete payload.season_tags;
          delete payload.destination_tags;
          const retry = await supabase.from('travel_wardrobe').insert(payload).select('*').maybeSingle();
          if (retry.error) {
            console.error(retry.error);
            throw retry.error;
          }
          if (retry.data) setRows((prev) => [retry.data as TravelWardrobeRow, ...prev]);
        } else {
          console.error(error);
          throw error;
        }
      } else if (inserted) {
        setRows((prev) => [inserted as TravelWardrobeRow, ...prev]);
      }

      setModalOpen(false);
      resetModal();
      await load();
      setBanner({ type: 'ok', text: 'تم حفظ القطعة وتحديث المجموعة من Supabase.' });
    } catch (e) {
      console.error(e);
      setBanner({
        type: 'err',
        text: e instanceof Error ? e.message : 'تعذر الحفظ. راجع الصلاحيات أو بنية الجدول.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-gradient-to-b from-[#0c0f0d] via-[#121a16] to-[#0a0d0b] font-[family-name:var(--font-tajawal),system-ui,sans-serif] text-slate-100 antialiased"
    >
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(201,168,76,0.12),transparent)]" />

      <div className="relative mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <Link
          href="/crm"
          className="mb-8 inline-flex items-center gap-2 text-[13px] font-semibold tracking-wide text-amber-200/70 transition hover:text-amber-100"
        >
          <ArrowRight className="h-4 w-4" strokeWidth={2} />
          لوحة التحكم
        </Link>

        <header className="relative mb-12 overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-br from-emerald-950/80 via-[#0f1814] to-black/60 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-10">
          <div className="pointer-events-none absolute -left-20 top-0 h-56 w-56 rounded-full bg-amber-500/10 blur-3xl" />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-4 text-right">
              <p className="text-[11px] font-black uppercase tracking-[0.4em] text-amber-300/90">Wanderloom · Wardrobe</p>
              <h1 className="text-3xl font-black leading-tight text-white sm:text-[2.35rem]">
                أزياء السفر
                <span className="mt-2 block bg-gradient-to-l from-amber-200 to-amber-500 bg-clip-text text-xl font-bold text-transparent sm:text-2xl">
                  إدارة مجموعة الشركة
                </span>
              </h1>
              <p className="text-[15px] leading-relaxed text-slate-400">
                عرض قطع <span className="text-amber-200/90">travel_wardrobe</span> ببطاقات فاخرة، مع إضافة قطع جديدة ووسوم المواسم والوجهات للمطابقة مع رحلات العملاء.
              </p>
            </div>
            <button
              type="button"
              onClick={openModal}
              className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-2xl bg-gradient-to-l from-amber-400 via-amber-300 to-amber-500 px-8 py-4 text-sm font-black text-slate-900 shadow-[0_16px_48px_rgba(251,191,36,0.25)] transition hover:opacity-95 lg:self-auto"
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
              إضافة قطعة جديدة
            </button>
          </div>
        </header>

        {banner ? (
          <div
            role="status"
            className={`mb-10 rounded-2xl border px-5 py-4 text-sm font-bold leading-relaxed ${
              banner.type === 'ok'
                ? 'border-emerald-500/30 bg-emerald-950/40 text-emerald-100'
                : 'border-rose-500/35 bg-rose-950/40 text-rose-100'
            }`}
          >
            {banner.text}
          </div>
        ) : null}

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-28 text-slate-500">
            <Loader2 className="h-10 w-10 animate-spin text-amber-400/80" strokeWidth={1.5} />
            <span className="text-sm font-semibold tracking-wide">جارٍ تحميل المجموعة…</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] px-8 py-24 text-center backdrop-blur-sm">
            <ShoppingBag className="mx-auto mb-5 h-12 w-12 text-amber-400/40" strokeWidth={1.25} />
            <p className="text-base font-semibold text-slate-300">لا توجد قطع بعد.</p>
            <p className="mt-2 text-sm text-slate-500">ابدأ بإضافة قطعة جديدة من الزر أعلاه.</p>
          </div>
        ) : (
          <ul className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((item) => {
              const itemCode = wardrobeItemCode(String(item.id));
              const img = item.image_url?.trim() || PLACEHOLDER_IMG;
              const seasons = mergeTags(item, 'seasons');
              const destinations = mergeTags(item, 'destinations');
              const href = item.purchase_url?.trim()
                ? item.purchase_url.trim().startsWith('http')
                  ? item.purchase_url.trim()
                  : `https://${item.purchase_url.trim()}`
                : (item.purchase_link?.trim() ?? '');
              return (
                <li key={item.id} className="group">
                  <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-black/40 shadow-[0_20px_60px_rgba(0,0,0,0.35)] ring-1 ring-amber-500/10 transition duration-500 hover:border-amber-400/30 hover:shadow-[0_28px_70px_rgba(251,191,36,0.08)]">
                    <div className="relative aspect-[3/4] overflow-hidden bg-neutral-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img}
                        alt=""
                        className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.04]"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                      <div className="absolute right-4 top-4 flex flex-col items-end gap-2">
                        <span className="rounded-full border border-amber-400/40 bg-black/60 px-3 py-1 text-[11px] font-black tracking-wide text-amber-300 backdrop-blur-md">
                          كود القطعة: {itemCode}
                        </span>
                        <span className="rounded-full border border-white/15 bg-black/50 px-3 py-1 text-[11px] font-black text-amber-100 backdrop-blur-md">
                          {formatWardrobePrice(item.price)}
                        </span>
                      </div>
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute bottom-4 left-4 right-4 flex items-center justify-center gap-2 rounded-2xl border border-amber-400/40 bg-amber-500/15 py-2.5 text-xs font-black text-amber-50 backdrop-blur-md transition hover:bg-amber-500/25"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          المتجر
                        </a>
                      ) : null}
                    </div>
                    <div className="flex flex-1 flex-col gap-4 p-6 text-right">
                      <div>
                        <p className="mb-1 text-[11px] font-bold tracking-wide text-amber-400/90">
                          كود القطعة: {itemCode}
                        </p>
                        <h2 className="text-lg font-black leading-snug text-white">{item.name}</h2>
                        {item.description ? (
                          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-400">{item.description}</p>
                        ) : null}
                      </div>
                      <div className="mt-auto space-y-4 border-t border-white/[0.06] pt-4">
                        {seasons.length > 0 ? (
                          <div>
                            <p className="mb-2 flex items-center justify-end gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                              <Sun className="h-3 w-3 text-amber-400/80" />
                              المواسم
                            </p>
                            <div className="flex flex-wrap justify-end gap-2">
                              {seasons.map((s) => (
                                <span
                                  key={s}
                                  className="rounded-lg border border-cyan-500/25 bg-cyan-950/40 px-2.5 py-1 text-[11px] font-bold text-cyan-100/90"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {destinations.length > 0 ? (
                          <div>
                            <p className="mb-2 flex items-center justify-end gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                              <MapPin className="h-3 w-3 text-amber-400/80" />
                              الوجهات
                            </p>
                            <div className="flex flex-wrap justify-end gap-2">
                              {destinations.map((d) => (
                                <span
                                  key={d}
                                  className="rounded-lg border border-amber-500/30 bg-amber-950/35 px-2.5 py-1 text-[11px] font-bold text-amber-100/95"
                                >
                                  {d}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {!seasons.length && !destinations.length ? (
                          <p className="text-center text-[11px] font-semibold text-slate-600">لا وسوم موسم/وجهة بعد</p>
                        ) : null}
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" dir="rtl">
          <div
            className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-amber-500/20 bg-gradient-to-b from-[#141c18] to-[#0a0d0b] p-8 shadow-2xl shadow-black/50 ring-1 ring-white/5"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wardrobe-modal-title"
          >
            <button
              type="button"
              onClick={() => !saving && setModalOpen(false)}
              className="absolute left-4 top-4 rounded-full border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="إغلاق"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mb-8 flex items-center gap-3 border-b border-white/[0.08] pb-6 pr-2">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/10 text-amber-200">
                <Sparkles className="h-6 w-6" strokeWidth={1.5} />
              </span>
              <div className="text-right">
                <h2 id="wardrobe-modal-title" className="text-xl font-black text-white">
                  إضافة قطعة جديدة
                </h2>
                <p className="mt-1 text-sm text-slate-400">الحقول النصية + اختيار متعدد للمواسم والوجهات.</p>
              </div>
            </div>

            <div className="space-y-5">
              <label className="block text-right">
                <span className="mb-1.5 block text-xs font-black text-amber-200/80">اسم القطعة</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none ring-amber-400/20 placeholder:text-slate-600 focus:ring-2"
                  placeholder="مثال: معطف كشمير للشتاء السويسري"
                />
              </label>
              <label className="block text-right">
                <span className="mb-1.5 block text-xs font-black text-amber-200/80">الوصف</span>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none ring-amber-400/20 placeholder:text-slate-600 focus:ring-2"
                  placeholder="وصف القطعة والخامة…"
                />
              </label>
              <label className="block text-right">
                <span className="mb-1.5 block text-xs font-black text-amber-200/80">السعر (ر.س)</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none ring-amber-400/20 focus:ring-2 [color-scheme:dark]"
                  placeholder="0"
                />
              </label>
              <label className="block text-right">
                <span className="mb-1.5 block text-xs font-black text-amber-200/80">رابط الصورة</span>
                <input
                  value={form.image_url}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none ring-amber-400/20 placeholder:text-slate-600 focus:ring-2"
                  placeholder="https://…"
                />
              </label>
              <label className="block text-right">
                <span className="mb-1.5 block text-xs font-black text-amber-200/80">رابط الشراء (موقع المتجر)</span>
                <input
                  value={form.purchase_url}
                  onChange={(e) => setForm({ ...form, purchase_url: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none ring-amber-400/20 placeholder:text-slate-600 focus:ring-2"
                  placeholder="https://…"
                />
              </label>

              <div className="text-right">
                <span className="mb-2 flex items-center justify-end gap-2 text-xs font-black text-amber-200/80">
                  <Snowflake className="h-3.5 w-3.5 text-cyan-300/80" />
                  المواسم (اختيار متعدد)
                </span>
                <div className="flex flex-wrap justify-end gap-2">
                  {SEASON_OPTIONS.map((s) => {
                    const on = seasonPick.has(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSeasonPick(toggleInSet(seasonPick, s))}
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                          on
                            ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-50'
                            : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="text-right">
                <span className="mb-2 flex items-center justify-end gap-2 text-xs font-black text-amber-200/80">
                  <MapPin className="h-3.5 w-3.5 text-amber-400/80" />
                  الوجهات (اختيار متعدد)
                </span>
                <div className="max-h-44 overflow-y-auto rounded-xl border border-white/10 bg-black/25 p-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    {DESTINATION_OPTIONS.map((d) => {
                      const on = destinationPick.has(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDestinationPick(toggleInSet(destinationPick, d))}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
                            on
                              ? 'border-amber-400/50 bg-amber-500/20 text-amber-50'
                              : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                          }`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex gap-3 border-t border-white/[0.08] pt-6">
              <button
                type="button"
                disabled={saving}
                onClick={() => setModalOpen(false)}
                className="flex-1 rounded-xl border border-white/15 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/5 disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSubmit()}
                className="flex-1 rounded-xl bg-gradient-to-l from-amber-400 to-amber-500 py-3 text-sm font-black text-slate-900 shadow-lg shadow-amber-900/20 transition hover:opacity-95 disabled:opacity-50"
              >
                {saving ? 'جارٍ الحفظ…' : 'حفظ في Supabase'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
