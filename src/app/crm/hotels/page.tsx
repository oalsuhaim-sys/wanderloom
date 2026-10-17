'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ExternalLink, Hotel, Mail, MapPin, MessageCircle, Pencil, Plus, Save, Trash2, UserRound, X } from 'lucide-react';

import { usePlacesBankDestinations } from '@/hooks/usePlacesBankDestinations';
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

const OPTIONAL_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function invalidOptionalEmail(value: string): boolean {
  const email = value.trim();
  return Boolean(email) && !OPTIONAL_EMAIL_RE.test(email);
}

function dbErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const message = String((err as { message?: unknown }).message ?? '').trim();
    if (message) return message;
  }
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return 'خطأ في الاتصال بقاعدة البيانات';
}

function normalizeUrl(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

/** رقم واتساب: whatsapp → contact_number */
function hotelWhatsAppDigits(h: HotelRow): string {
  const raw = String(h.whatsapp ?? h.contact_number ?? '').trim();
  return raw.replace(/[^0-9]/g, '');
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
  'inline-flex bg-amber-50 text-amber-700 border border-amber-200/60 px-2.5 py-0.5 rounded-full text-xs font-medium dark:bg-[#D4AF37]/10 dark:text-[#D4AF37] dark:border-[#D4AF37]/30';

const FILTER_BAR =
  'rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C]';

const ROW =
  'border-b border-slate-100 transition-colors hover:bg-slate-50/50 dark:border-[#2D3F3A] dark:hover:bg-[#1A2421]/40';

const BTN_WA =
  'p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 text-xs flex items-center gap-1 font-medium transition dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50';
const BTN_LINK =
  'p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs flex items-center gap-1 font-medium transition dark:bg-[#1A2421] dark:text-slate-300 dark:hover:bg-[#2D3F3A]';
const BTN_ICON =
  'p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition dark:hover:bg-[#1A2421] dark:hover:text-[#D4AF37]';

export default function HotelsCRMPage() {
  const { countries, citiesByCountry } = usePlacesBankDestinations();
  const [filterCountry, setFilterCountry] = useState('');
  const [filterCategory, setFilterCategory] = useState<'' | HotelCategory>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<HotelRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [newRow, setNewRow] = useState({
    name: '',
    country: '',
    city: '',
    category: 'smart_choice' as HotelCategory,
    booking_url: '',
    notes: '',
    manager_name: '',
    contact_number: '',
    email: '',
    whatsapp: '',
  });

  const newCityOptions = useMemo(() => {
    const country = newRow.country.trim();
    if (!country) return [];
    const list = citiesByCountry[country] ?? [];
    const cur = newRow.city.trim();
    if (cur && !list.includes(cur)) return [...list, cur];
    return list;
  }, [newRow.country, newRow.city, citiesByCountry]);

  const editCityOptions = useMemo(() => {
    if (!editing) return [];
    const country = String(editing.country ?? '').trim();
    if (!country) return [];
    const list = citiesByCountry[country] ?? [];
    const cur = String(editing.city ?? '').trim();
    if (cur && !list.includes(cur)) return [...list, cur];
    return list;
  }, [editing, citiesByCountry]);

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
      const email = String(h.email ?? '').toLowerCase();
      return (
        name.includes(qsearch) ||
        city.includes(qsearch) ||
        notes.includes(qsearch) ||
        email.includes(qsearch)
      );
    });
  }, [allRows, search]);

  useEffect(() => {
    void loadHotels();
  }, [loadHotels]);

  const saveEdit = async () => {
    if (!supabase || !editing) return;
    if (invalidOptionalEmail(editing.email ?? '')) {
      setBanner({ type: 'err', text: 'يرجى إدخال بريد إلكتروني صحيح بدون مسافات.' });
      return;
    }
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
          email: editing.email?.trim() || null,
          whatsapp: editing.whatsapp?.trim() || null,
        })
        .eq('id', editing.id);
      if (error) throw error;
      setEditing(null);
      setBanner({ type: 'ok', text: 'تم حفظ التعديلات.' });
      await loadHotels();
    } catch (e) {
      setBanner({
        type: 'err',
        text: e instanceof Error ? e.message : 'تعذر حفظ الفندق.',
      });
    }
  };

  const addHotel = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!supabase) return;
    if (!newRow.name.trim() || !newRow.country.trim() || !newRow.city.trim()) {
      setBanner({ type: 'err', text: 'يرجى تعبئة اسم الفندق والدولة والمدينة على الأقل.' });
      return;
    }
    if (invalidOptionalEmail(newRow.email)) {
      setBanner({ type: 'err', text: 'يرجى إدخال بريد إلكتروني صحيح بدون مسافات.' });
      return;
    }
    setBanner(null);
    setSaving(true);
    try {
      const payload = {
        name: newRow.name.trim(),
        country: newRow.country.trim(),
        city: newRow.city.trim(),
        category: newRow.category,
        booking_url: newRow.booking_url.trim() || null,
        notes: newRow.notes.trim() || null,
        manager_name: newRow.manager_name.trim() || null,
        contact_number: newRow.contact_number.trim() || null,
        email: newRow.email.trim() || null,
        whatsapp: newRow.whatsapp.trim() || null,
      };
      const { error } = await supabase.from('hotels').insert(payload);
      if (error) {
        console.error('Supabase Error:', error);
        throw error;
      }
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
        email: '',
        whatsapp: '',
      });
      setBanner({ type: 'ok', text: 'تمت إضافة الفندق بنجاح إلى القائمة!' });
      await loadHotels();
    } catch (err) {
      console.error('تفاصيل خطأ إضافة الفندق:', err);
      setBanner({
        type: 'err',
        text: `تعذر إضافة الفندق: ${dbErrorMessage(err)}`,
      });
    } finally {
      setSaving(false);
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
      className="min-h-screen bg-[#F8F5EE] p-6 font-sans"
    >
      <div className="mx-auto max-w-7xl space-y-4">
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
            className={`rounded-2xl border p-4 text-xs font-bold shadow-sm ${
              banner.type === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {banner.type === 'ok' ? '✅ ' : '⚠️ '}
            {banner.text}
          </div>
        ) : null}

        <div className="space-y-2 rounded-3xl border border-slate-200 bg-white p-6 text-xs text-slate-700 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900">
            دليل التصنيف للموظف – اختر الأنسب لملف العميل
          </h3>
          {CATEGORY_OPTIONS.map((o) => (
            <p key={o.value}>
              <strong>{o.label}:</strong> {o.hint}
            </p>
          ))}
        </div>

        <div className={`${FILTER_BAR} grid grid-cols-1 gap-2.5 sm:grid-cols-3`}>
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
          <form
            onSubmit={(e) => void addHotel(e)}
            className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 text-right shadow-sm"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">فندق جديد</h2>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-[#1A2421] dark:hover:text-[#D4AF37]"
                aria-label="إغلاق"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-3">
              <input
                value={newRow.name}
                onChange={(e) => setNewRow({ ...newRow, name: e.target.value })}
                placeholder="اسم الفندق *"
                className="rounded-2xl border border-slate-200 bg-[#F8F5EE]/50 p-3 font-bold outline-none focus:border-[#C59B4B]"
              />
              <select
                value={newRow.country}
                onChange={(e) => setNewRow({ ...newRow, country: e.target.value, city: '' })}
                className="rounded-2xl border border-slate-200 bg-[#F8F5EE]/50 p-3 font-bold outline-none focus:border-[#C59B4B]"
                required
              >
                <option value="">الدولة * (بنك الأماكن)</option>
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={newRow.city}
                onChange={(e) => setNewRow({ ...newRow, city: e.target.value })}
                className="rounded-2xl border border-slate-200 bg-[#F8F5EE]/50 p-3 font-bold outline-none focus:border-[#C59B4B] disabled:opacity-60"
                disabled={!newRow.country}
                required
              >
                <option value="">{newRow.country ? 'المدينة' : 'اختر الدولة أولاً'}</option>
                {newCityOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={newRow.category}
                onChange={(e) => setNewRow({ ...newRow, category: e.target.value as HotelCategory })}
                className="rounded-2xl border border-slate-200 bg-[#F8F5EE]/50 p-3 font-bold outline-none focus:border-[#C59B4B]"
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
                placeholder="رابط خرائط جوجل (Google Maps URL)"
                dir="ltr"
                className="rounded-2xl border border-slate-200 bg-[#F8F5EE]/50 p-3 outline-none focus:border-[#C59B4B] md:col-span-2"
              />
              <input
                value={newRow.manager_name}
                onChange={(e) => setNewRow({ ...newRow, manager_name: e.target.value })}
                placeholder="اسم المسؤول"
                className="rounded-2xl border border-slate-200 bg-[#F8F5EE]/50 p-3 outline-none focus:border-[#C59B4B]"
              />
              <input
                type="text"
                inputMode="email"
                autoComplete="email"
                value={newRow.email}
                onChange={(e) => setNewRow({ ...newRow, email: e.target.value.trim() })}
                placeholder="(Email) البريد الإلكتروني"
                dir="ltr"
                className="rounded-2xl border border-slate-200 bg-[#F8F5EE]/50 p-3 text-right font-mono outline-none focus:border-[#C59B4B]"
              />
              <input
                type="tel"
                value={newRow.contact_number}
                onChange={(e) => setNewRow({ ...newRow, contact_number: e.target.value })}
                placeholder="رقم التواصل / واتساب"
                dir="ltr"
                className="rounded-2xl border border-slate-200 bg-[#F8F5EE]/50 p-3 outline-none focus:border-[#C59B4B]"
              />
              <textarea
                value={newRow.notes}
                onChange={(e) => setNewRow({ ...newRow, notes: e.target.value })}
                placeholder="ملاحظاتك عن الفندق..."
                rows={2}
                className="resize-y rounded-2xl border border-slate-200 bg-[#F8F5EE]/50 p-3 outline-none focus:border-[#C59B4B] md:col-span-3"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-[#1B242F] px-8 py-3.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? 'جاري الحفظ...' : 'حفظ الفندق'}
            </button>
          </form>
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
          <div className="w-full overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C]">
              <table className="min-w-full text-right text-sm">
                <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-[#1A2421] dark:text-slate-400">
                  <tr className="border-b border-slate-200 dark:border-[#2D3F3A]">
                    <th className="whitespace-nowrap px-4 py-2.5">اسم الفندق</th>
                    <th className="whitespace-nowrap px-4 py-2.5">الموقع</th>
                    <th className="whitespace-nowrap px-4 py-2.5">التصنيف</th>
                    <th className="whitespace-nowrap px-4 py-2.5">التواصل</th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-left">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((h) => {
                    const bookingHref = normalizeUrl(h.booking_url);
                    const isEditing = editing?.id === h.id;
                    const locationLabel = [h.city?.trim(), h.country?.trim()].filter(Boolean).join(' · ');
                    return (
                      <tr key={h.id} className={ROW}>
                        {isEditing && editing ? (
                          <td colSpan={5} className="px-4 py-3">
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                <input
                                  value={editing.name}
                                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                                  className={CRM_FORM_FIELD}
                                />
                                <select
                                  value={editing.country}
                                  onChange={(e) =>
                                    setEditing({ ...editing, country: e.target.value, city: '' })
                                  }
                                  className={CRM_FORM_FIELD}
                                >
                                  <option value="">الدولة</option>
                                  {countries.map((c) => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                  {editing.country && !countries.includes(editing.country) ? (
                                    <option value={editing.country}>{editing.country}</option>
                                  ) : null}
                                </select>
                                <select
                                  value={editing.city ?? ''}
                                  onChange={(e) => setEditing({ ...editing, city: e.target.value })}
                                  className={CRM_FORM_FIELD}
                                >
                                  <option value="">المدينة</option>
                                  {editCityOptions.map((c) => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                </select>
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
                                  type="text"
                                  inputMode="email"
                                  autoComplete="email"
                                  value={editing.email ?? ''}
                                  onChange={(e) =>
                                    setEditing({ ...editing, email: e.target.value.trim() })
                                  }
                                  placeholder="(Email) البريد الإلكتروني"
                                  dir="ltr"
                                  className={`${CRM_FORM_FIELD_LTR} text-right font-mono`}
                                />
                                <input
                                  value={editing.contact_number ?? ''}
                                  onChange={(e) => setEditing({ ...editing, contact_number: e.target.value })}
                                  placeholder="رقم التواصل / واتساب"
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
                            <td className="max-w-[280px] px-4 py-2.5">
                              <div className="font-bold text-sm text-slate-800 dark:text-gray-100">
                                {h.name}
                              </div>
                              {h.notes?.trim() ? (
                                <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-400">
                                  {h.notes.trim()}
                                </p>
                              ) : null}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5">
                              {locationLabel ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                                  <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                                  {locationLabel}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5">
                              <span className={CATEGORY_BADGE}>{categoryLabel(h.category)}</span>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="space-y-0.5">
                                {h.manager_name?.trim() ? (
                                  <p className="inline-flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300">
                                    <UserRound className="h-3 w-3 text-slate-400" aria-hidden />
                                    {h.manager_name.trim()}
                                  </p>
                                ) : null}
                                {h.email?.trim() ? (
                                  <a
                                    href={`mailto:${h.email.trim()}`}
                                    className="flex items-center gap-1 font-mono text-xs text-slate-700 transition-colors hover:text-amber-600 dark:text-slate-300 dark:hover:text-[#D4AF37]"
                                    dir="ltr"
                                  >
                                    <Mail className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
                                    {h.email.trim()}
                                  </a>
                                ) : (
                                  <span className="text-xs text-slate-400">غير محدد</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center justify-end gap-1.5">
                                {hotelWhatsAppDigits(h) ? (
                                  <a
                                    href={`https://wa.me/${hotelWhatsAppDigits(h)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={BTN_WA}
                                    title="فتح واتساب"
                                  >
                                    <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                                    <span className="hidden lg:inline">واتساب</span>
                                  </a>
                                ) : null}
                                {bookingHref ? (
                                  <a
                                    href={bookingHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={BTN_LINK}
                                    title="فتح الرابط"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                                    <span className="hidden lg:inline">رابط</span>
                                  </a>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => setEditing({ ...h })}
                                  className={BTN_ICON}
                                  aria-label="تعديل"
                                >
                                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteHotel(h.id)}
                                  className={`${BTN_ICON} hover:text-rose-600`}
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
