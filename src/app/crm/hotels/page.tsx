'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ExternalLink, Hotel, MessageCircle, Pencil, Phone, Plus, Save, Trash2, UserRound, X } from 'lucide-react';

import { supabase } from '@/lib/supabase';
import type { HotelCategory, HotelRow } from '@/types/hotel';

const CATEGORY_OPTIONS: {
  value: HotelCategory;
  label: string;
  hint: string;
}[] = [
  {
    value: 'ultra_luxury',
    label: 'فاخر جداً (Ultra-Luxury)',
    hint: 'مثل Aman و Four Seasons — خصوصية مطلقة، عميل لا يهتم بالسعر بقدر التميّز والخدمة الشخصية.',
  },
  {
    value: 'boutique_design',
    label: 'بوتيك مميز (Boutique / Design)',
    hint: 'فنادق أصغر، تصميم فني فريد (نمط Design Hotels) — تجربة مميزة بإيقاع أنيق.',
  },
  {
    value: 'apartments_luxe',
    label: 'شقق فاخرة (نمط «العيش كأهل البلد»)',
    hint: 'شقق/بيوت بتصميم عصري في مراكز المدن — للعميل الذي يفضل الاستقلالية والحياة المحلية.',
  },
  {
    value: 'smart_choice',
    label: 'اقتصادي ذكي (Smart Choice)',
    hint: 'فنادق 4 نجوم نظيفة، موقع استراتيجي — توفير ميزانية مع إقامة موثوقة.',
  },
];

const LEGACY_CATEGORY_LABELS: Record<string, string> = {
  boutique: 'بوتيك (تصنيف قديم — حدّث إلى «بوتيك مميز»)',
  four_star: '4 نجوم (قديم — حدّث إلى «اقتصادي ذكي»)',
  five_star: '5 نجوم (قديم — حدّث إلى «فاخر جداً»)',
  ryokan: 'ريوكان (قديم — حدّث إلى «بوتيك مميز» أو «فاخر جداً»)',
};

function categoryLabel(c: string): string {
  const opt = CATEGORY_OPTIONS.find((o) => o.value === c);
  if (opt) return opt.label;
  return LEGACY_CATEGORY_LABELS[c] ?? c;
}

/** خيارات القائمة عند التعديل: تُظهر قيمة قديمة حتى يختار الموظف تصنيفاً جديداً. */
function categoryOptionsForEdit(current: string): { value: string; label: string; hint: string }[] {
  if (CATEGORY_OPTIONS.some((o) => o.value === current)) return CATEGORY_OPTIONS;
  return [
    {
      value: current,
      label: `${categoryLabel(current)} — يحتاج تحديث`,
      hint: 'نفّذ ترحيل SQL أو اختر تصنيفاً من الهيكل الجديد ثم احفظ.',
    },
    ...CATEGORY_OPTIONS,
  ];
}

function normalizeUrl(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

function formatHotelWhatsApp(h: HotelRow): string {
  const url = normalizeUrl(h.booking_url) ?? '—';
  const why = h.notes?.trim() || '—';
  const loc = h.city?.trim() ? h.city.trim() : h.country;
  return `🏨 الفندق: ${h.name}
⭐ التصنيف: ${categoryLabel(h.category)}
📍 الموقع: ${loc}
💡 لماذا اخترناه لك؟ ${why}
🔗 رابط الفندق: ${url}`;
}

/** حقول النماذج — ثيم فاخر ثنائي (فاتح/داكن) */
const CRM_FORM_FIELD =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-gray-100 dark:focus:border-[#D4AF37]/40 dark:focus:ring-[#D4AF37]/15';
const CRM_FORM_FIELD_LTR = `${CRM_FORM_FIELD} text-left`;

const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border dark:border-[#D4AF37]/50 dark:bg-[#D4AF37]/20 dark:text-[#D4AF37] dark:hover:bg-[#D4AF37]/30';

const BTN_SECONDARY =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-gray-300';

const CARD =
  'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C]';

const CATEGORY_BADGE =
  'inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-[#D4AF37]/10 dark:text-[#D4AF37]';

export default function HotelsCRMPage() {
  const [countries, setCountries] = useState<string[]>([]);
  const [filterCountry, setFilterCountry] = useState('');
  const [filterCategory, setFilterCategory] = useState<'' | HotelCategory>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<HotelRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [newRow, setNewRow] = useState({
    name: '',
    country: '',
    city: '',
    category: 'smart_choice' as HotelCategory,
    booking_url: '',
    notes: '',
    manager_name: '',
    contact_number: '',
  });

  const loadCountries = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from('hotels').select('country');
      if (error) {
        console.error('[CRM hotels] loadCountries Supabase error:', error);
        throw error;
      }
      const list = (data ?? [])
        .map((r: { country?: string }) => r.country)
        .filter((c): c is string => Boolean(c?.trim()));
      setCountries([...new Set(list)].sort((a, b) => a.localeCompare(b, 'ar')));
    } catch (e) {
      console.error('[CRM hotels] loadCountries failed:', e);
    }
  }, []);

  const [allRows, setAllRows] = useState<HotelRow[]>([]);

  const loadHotels = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      setBanner({ type: 'err', text: 'قاعدة البيانات غير مهيأة. أضف مفاتيح Supabase في البيئة.' });
      console.warn(
        '[CRM hotels] supabase is null — أضف NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY في .env.local وأعد تشغيل dev',
      );
      return;
    }
    setLoading(true);
    setBanner(null);
    try {
      let q = supabase.from('hotels').select('*').order('name', { ascending: true });
      if (filterCountry) q = q.eq('country', filterCountry);
      if (filterCategory) q = q.eq('category', filterCategory);
      const { data, error } = await q;
      if (error) {
        console.error('[CRM hotels] Supabase select error:', error);
        throw error;
      }
      const list = (data ?? []) as HotelRow[];
      if (list.length === 0) {
        console.warn(
          '[CRM hotels] 0 rows — إن وُجدت بيانات في Table Editor فتحقق من RLS (SELECT لدور anon)، أو أزل تصفية الدولة/التصنيف، أو تأكد من اسم الجدول public.hotels.',
        );
      }
      setAllRows(list);
    } catch (e) {
      console.error('[CRM hotels] loadHotels failed:', e);
      const msg = e instanceof Error ? e.message : 'تعذر تحميل الفنادق.';
      setBanner({
        type: 'err',
        text: msg.includes('hotels') || msg.includes('relation')
          ? 'جدول الفنادق غير موجود بعد. نفّذ supabase/sql/hotels.sql في Supabase.'
          : msg.includes('hotels_category_check') || msg.includes('violates check constraint')
            ? 'تصنيف الفندق غير متوافق مع الهيكل الجديد. نفّذ supabase/sql/hotels_category_restructure.sql في Supabase.'
            : msg,
      });
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [filterCountry, filterCategory]);

  const rows = useMemo(() => {
    const qsearch = search.trim().toLowerCase();
    if (!qsearch) return allRows;
    return allRows.filter((h) => {
      const name = String(h.name ?? '').toLowerCase();
      const city = String(h.city ?? '').toLowerCase();
      const notes = String(h.notes ?? '').toLowerCase();
      return name.includes(qsearch) || city.includes(qsearch) || notes.includes(qsearch);
    });
  }, [allRows, search]);

  useEffect(() => {
    loadCountries();
  }, [loadCountries]);

  useEffect(() => {
    loadHotels();
  }, [loadHotels]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  async function copyHotelWhatsApp(h: HotelRow) {
    try {
      await navigator.clipboard.writeText(formatHotelWhatsApp(h));
      setToast('تم النسخ بنجاح!');
    } catch {
      setToast('تعذر النسخ — تأكد من HTTPS والأذونات.');
    }
  }

  const saveEdit = async () => {
    if (!supabase || !editing) return;
    setBanner(null);
    try {
      const { error } = await supabase
        .from('hotels')
        .update({
          name: editing.name.trim(),
          country: editing.country.trim(),
          city: editing.city.trim(),
          category: editing.category,
          booking_url: editing.booking_url?.trim() || null,
          notes: editing.notes?.trim() || null,
          manager_name: editing.manager_name?.trim() || null,
          contact_number: editing.contact_number?.trim() || null,
        })
        .eq('id', editing.id);
      if (error) throw error;
      setEditing(null);
      setBanner({ type: 'ok', text: 'تم حفظ التعديلات.' });
      await loadHotels();
      await loadCountries();
    } catch (e) {
      setBanner({
        type: 'err',
        text: e instanceof Error ? e.message : 'تعذر حفظ الفندق.',
      });
    }
  };

  const addHotel = async () => {
    if (!supabase) return;
    if (!newRow.name.trim() || !newRow.country.trim()) {
      setBanner({ type: 'err', text: 'اسم الفندق والدولة حقول مطلوبة.' });
      return;
    }
    setBanner(null);
    try {
      const { error } = await supabase.from('hotels').insert({
        name: newRow.name.trim(),
        country: newRow.country.trim(),
        city: newRow.city.trim(),
        category: newRow.category,
        booking_url: newRow.booking_url.trim() || null,
        notes: newRow.notes.trim() || null,
        manager_name: newRow.manager_name.trim() || null,
        contact_number: newRow.contact_number.trim() || null,
      });
      if (error) throw error;
      setAdding(false);
      setNewRow({
        name: '',
        country: '',
        city: '',
        category: 'smart_choice',
        booking_url: '',
        notes: '',
        manager_name: '',
        contact_number: '',
      });
      setBanner({ type: 'ok', text: 'تمت إضافة الفندق.' });
      await loadHotels();
      await loadCountries();
    } catch (e) {
      setBanner({
        type: 'err',
        text: e instanceof Error ? e.message : 'تعذر إضافة الفندق.',
      });
    }
  };

  const deleteHotel = async (id: string) => {
    if (!supabase || !window.confirm('حذف هذا الفندق من القائمة؟')) return;
    setBanner(null);
    try {
      const { error } = await supabase.from('hotels').delete().eq('id', id);
      if (error) throw error;
      setBanner({ type: 'ok', text: 'تم الحذف.' });
      await loadHotels();
      await loadCountries();
    } catch (e) {
      setBanner({
        type: 'err',
        text: e instanceof Error ? e.message : 'تعذر الحذف.',
      });
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-full bg-[#F9FAFB] font-sans dark:bg-[#1A2421]"
    >
      <div className="mx-auto max-w-7xl space-y-4">
        {toast ? (
          <div
            role="status"
            className="fixed bottom-6 left-1/2 z-[9999] -translate-x-1/2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg dark:border dark:border-[#D4AF37]/40 dark:bg-[#22302C] dark:text-[#D4AF37]"
          >
            {toast}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-slate-800 dark:text-gray-400 dark:hover:text-[#D4AF37]"
        >
          <ArrowRight className="h-3.5 w-3.5" aria-hidden /> رجوع
        </button>

        <header className="flex flex-col gap-4 rounded-2xl bg-slate-900 p-4 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6 dark:border dark:border-[#D4AF37]/30 dark:!bg-[#22302C] dark:text-[#D4AF37]">
          <div className="space-y-1.5">
            <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/50 dark:text-[#D4AF37]/80">
              <Hotel className="h-3.5 w-3.5" aria-hidden />
              Hotels Bank
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl dark:text-gray-100">
              قاعدة بيانات الفنادق
            </h1>
            <p className="text-sm text-white/70 dark:text-gray-300">
              {rows.length} فندق معروض
              {filterCountry ? ` · الدولة: ${filterCountry}` : ''}
              {filterCategory ? ` · التصنيف: ${categoryLabel(filterCategory)}` : ''}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Link
              href="/crm"
              className={`${BTN_SECONDARY} w-full border-white/20 !bg-white/10 !text-white hover:!bg-white/20 sm:w-auto dark:!border-[#D4AF37]/30 dark:!bg-[#1A2421] dark:!text-[#D4AF37]`}
            >
              لوحة التحكم
            </Link>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className={`${BTN_PRIMARY} w-full !bg-white !text-slate-900 hover:!bg-slate-50 sm:w-auto`}
            >
              <Plus className="h-4 w-4" aria-hidden /> إضافة فندق
            </button>
          </div>
        </header>

        {banner ? (
          <div
            role="alert"
            className={`rounded-xl border px-4 py-3 text-sm font-medium ${
              banner.type === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200'
            }`}
          >
            {banner.text}
          </div>
        ) : null}

        <div className={`${CARD} space-y-3 p-5`}>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-gray-100">
            دليل التصنيف للموظف — اختر الأنسب لملف العميل
          </h2>
          <ul className="space-y-2 text-xs leading-relaxed text-slate-600 dark:text-gray-300">
            {CATEGORY_OPTIONS.map((o) => (
              <li key={o.value}>
                <span className="font-semibold text-slate-800 dark:text-[#D4AF37]">{o.label}:</span>{' '}
                {o.hint}
              </li>
            ))}
          </ul>
        </div>

        <div className={`${CARD} grid grid-cols-1 gap-3 p-4 sm:grid-cols-3`}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو المدينة أو ملاحظات الموظفين…"
            className={CRM_FORM_FIELD}
          />
          <select
            value={filterCountry}
            onChange={(e) => setFilterCountry(e.target.value)}
            className={CRM_FORM_FIELD}
          >
            <option value="">كل الدول ({countries.length})</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory((e.target.value || '') as '' | HotelCategory)}
            className={CRM_FORM_FIELD}
          >
            <option value="">كل التصنيفات</option>
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} title={o.hint}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {adding ? (
          <div className={`${CARD} space-y-4 border-[#D4AF37]/30 p-5 dark:border-[#D4AF37]/40`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-[#D4AF37]">فندق جديد</h3>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-[#1A2421] dark:hover:text-[#D4AF37]"
                aria-label="إغلاق"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <input
                value={newRow.name}
                onChange={(e) => setNewRow({ ...newRow, name: e.target.value })}
                placeholder="اسم الفندق *"
                className={CRM_FORM_FIELD}
              />
              <input
                value={newRow.country}
                onChange={(e) => setNewRow({ ...newRow, country: e.target.value })}
                placeholder="الدولة *"
                className={CRM_FORM_FIELD}
              />
              <input
                value={newRow.city}
                onChange={(e) => setNewRow({ ...newRow, city: e.target.value })}
                placeholder="المدينة"
                className={CRM_FORM_FIELD}
              />
              <select
                value={newRow.category}
                onChange={(e) => setNewRow({ ...newRow, category: e.target.value as HotelCategory })}
                className={CRM_FORM_FIELD}
              >
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} title={o.hint}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                value={newRow.booking_url}
                onChange={(e) => setNewRow({ ...newRow, booking_url: e.target.value })}
                placeholder="رابط Booking / الموقع"
                dir="ltr"
                className={CRM_FORM_FIELD_LTR}
              />
              <input
                value={newRow.manager_name}
                onChange={(e) => setNewRow({ ...newRow, manager_name: e.target.value })}
                placeholder="اسم المسؤول"
                className={CRM_FORM_FIELD}
              />
              <input
                value={newRow.contact_number}
                onChange={(e) => setNewRow({ ...newRow, contact_number: e.target.value })}
                placeholder="رقم التواصل"
                dir="ltr"
                className={CRM_FORM_FIELD_LTR}
              />
            </div>
            <textarea
              value={newRow.notes}
              onChange={(e) => setNewRow({ ...newRow, notes: e.target.value })}
              placeholder="ملاحظاتك عن الفندق…"
              rows={3}
              className={`${CRM_FORM_FIELD} resize-y`}
            />
            <button type="button" onClick={addHotel} className={BTN_PRIMARY}>
              <Save className="h-4 w-4" aria-hidden /> حفظ الفندق
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className={`${CARD} px-6 py-14 text-center text-sm font-medium text-slate-500 dark:text-slate-400`}>
            جارٍ التحميل…
          </div>
        ) : rows.length === 0 ? (
          <div className={`${CARD} border-dashed px-6 py-14 text-center text-sm font-medium text-slate-500 dark:text-slate-400`}>
            لا توجد فنادق بعد أو لا نتائج للتصفية. أضف فندقاً أو غيّر الدولة.
          </div>
        ) : (
          <div className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C]">
              <table className="min-w-full text-right text-sm">
                <thead className="bg-slate-50 text-sm font-semibold text-slate-600 dark:bg-[#1A2421] dark:text-slate-300">
                  <tr className="border-b border-slate-200 dark:border-[#2D3F3A]">
                    <th className="whitespace-nowrap px-4 py-3">الفندق</th>
                    <th className="whitespace-nowrap px-4 py-3">الموقع</th>
                    <th className="whitespace-nowrap px-4 py-3">التصنيف</th>
                    <th className="whitespace-nowrap px-4 py-3">التواصل</th>
                    <th className="whitespace-nowrap px-4 py-3">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((h) => {
                    const bookingHref = normalizeUrl(h.booking_url);
                    const isEditing = editing?.id === h.id;
                    return (
                      <tr
                        key={h.id}
                        className="border-b border-slate-100 align-top dark:border-[#2D3F3A]"
                      >
                        {isEditing && editing ? (
                          <td colSpan={5} className="px-4 py-4">
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                <input
                                  value={editing.name}
                                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                                  className={CRM_FORM_FIELD}
                                />
                                <input
                                  value={editing.country}
                                  onChange={(e) => setEditing({ ...editing, country: e.target.value })}
                                  className={CRM_FORM_FIELD}
                                />
                                <input
                                  value={editing.city}
                                  onChange={(e) => setEditing({ ...editing, city: e.target.value })}
                                  className={CRM_FORM_FIELD}
                                />
                                <select
                                  value={editing.category}
                                  onChange={(e) =>
                                    setEditing({ ...editing, category: e.target.value as HotelCategory })
                                  }
                                  className={CRM_FORM_FIELD}
                                >
                                  {categoryOptionsForEdit(String(editing.category)).map((o) => (
                                    <option key={o.value} value={o.value} title={o.hint}>
                                      {o.label}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  value={editing.booking_url ?? ''}
                                  onChange={(e) => setEditing({ ...editing, booking_url: e.target.value })}
                                  placeholder="رابط"
                                  dir="ltr"
                                  className={CRM_FORM_FIELD_LTR}
                                />
                                <input
                                  value={editing.manager_name ?? ''}
                                  onChange={(e) => setEditing({ ...editing, manager_name: e.target.value })}
                                  placeholder="اسم المسؤول"
                                  className={CRM_FORM_FIELD}
                                />
                                <input
                                  value={editing.contact_number ?? ''}
                                  onChange={(e) => setEditing({ ...editing, contact_number: e.target.value })}
                                  placeholder="رقم التواصل"
                                  dir="ltr"
                                  className={CRM_FORM_FIELD_LTR}
                                />
                              </div>
                              <textarea
                                value={editing.notes ?? ''}
                                onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                                rows={2}
                                className={`${CRM_FORM_FIELD} resize-y`}
                              />
                              <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={saveEdit} className={BTN_PRIMARY}>
                                  <Save className="h-3.5 w-3.5" aria-hidden /> حفظ
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditing(null)}
                                  className={BTN_SECONDARY}
                                >
                                  إلغاء
                                </button>
                              </div>
                            </div>
                          </td>
                        ) : (
                          <>
                            <td className="px-4 py-3.5 text-slate-900 dark:text-gray-100">
                              <div className="font-semibold">{h.name}</div>
                              {h.notes ? (
                                <p className="mt-1 line-clamp-2 text-xs font-normal text-slate-500 dark:text-gray-400">
                                  {h.notes}
                                </p>
                              ) : null}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3.5 text-slate-900 dark:text-gray-100">
                              {h.city ? `${h.city} · ` : ''}
                              {h.country}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3.5">
                              <span className={CATEGORY_BADGE}>{categoryLabel(h.category)}</span>
                            </td>
                            <td className="px-4 py-3.5 text-slate-900 dark:text-gray-100">
                              <div className="space-y-1 text-xs">
                                {h.manager_name?.trim() ? (
                                  <p className="inline-flex items-center gap-1.5">
                                    <UserRound className="h-3.5 w-3.5 text-slate-400 dark:text-[#D4AF37]" aria-hidden />
                                    {h.manager_name.trim()}
                                  </p>
                                ) : null}
                                {h.contact_number?.trim() ? (
                                  <a
                                    href={`tel:${h.contact_number.trim().replace(/\s+/g, '')}`}
                                    className="inline-flex items-center gap-1.5 font-medium text-slate-700 hover:underline dark:text-gray-200"
                                    dir="ltr"
                                  >
                                    <Phone className="h-3.5 w-3.5 text-slate-400 dark:text-[#D4AF37]" aria-hidden />
                                    {h.contact_number.trim()}
                                  </a>
                                ) : null}
                                {!h.manager_name?.trim() && !h.contact_number?.trim() ? (
                                  <span className="text-slate-400">—</span>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => copyHotelWhatsApp(h)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                                >
                                  <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                                  واتساب
                                </button>
                                {bookingHref ? (
                                  <a
                                    href={bookingHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-gray-300"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                                    رابط
                                  </a>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => setEditing({ ...h })}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700 transition hover:bg-amber-100 dark:bg-[#D4AF37]/10 dark:text-[#D4AF37]"
                                  aria-label="تعديل"
                                >
                                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteHotel(h.id)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600 transition hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300"
                                  aria-label="حذف"
                                >
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
        )}
      </div>
    </div>
  );
}
