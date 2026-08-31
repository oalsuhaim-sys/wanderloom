'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ExternalLink, Loader2, MapPin, Plus, Sparkles, X } from 'lucide-react';

import { toast } from '@/lib/crm-toast';
import { supabase } from '@/lib/supabase';
import {
  VIP_EXPERIENCE_CATEGORIES,
  experienceCategoryLabel,
  isKnownExperienceCategory,
  type ExperienceRow,
} from '@/types/experience';

const DEFAULT_CATEGORY = VIP_EXPERIENCE_CATEGORIES[0];

const CARD =
  'bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm transition-all hover:border-[#D4AF37]/40';
const INNER =
  'bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm';
const INPUT =
  'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/25';
const TAG =
  'bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1 rounded-lg text-xs font-bold';
const BTN_PRIMARY =
  'bg-[#D4AF37] hover:bg-[#b8952d] text-black font-extrabold py-2.5 px-4 rounded-xl text-sm transition-all shadow-sm w-full inline-flex items-center justify-center gap-2';
const BTN_WA =
  'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold py-2.5 px-4 rounded-xl text-sm transition-all w-full inline-flex items-center justify-center gap-2';

function formatExperienceWhatsApp(e: ExperienceRow): string {
  const loc = e.city ? `${e.country} · ${e.city}` : e.country;
  const detail = e.detail_url?.trim() ? e.detail_url.trim() : '—';
  const booking = e.booking_url?.trim() ? e.booking_url.trim() : '';
  return `✨ اقتراح مميز — Wanderloom

📌 ${e.title}
🌍 ${loc}
🏷️ التصنيف: ${experienceCategoryLabel(e.category)}

📝 ${e.description}

🔗 ${detail}${booking ? `\n\n📅 حجز: ${booking}` : ''}`;
}

type ExperienceForm = {
  title: string;
  country: string;
  city: string;
  description: string;
  detail_url: string;
  booking_url: string;
};

function formatSupabaseError(error: unknown): string {
  if (!error || typeof error !== 'object') return 'حدث خطأ أثناء الحفظ';
  const e = error as { message?: string; details?: string; hint?: string; code?: string };
  const msg = [e.message, e.details, e.hint].filter(Boolean).join(' — ');
  if (/experiences_category_check|category_check|check constraint/i.test(msg)) {
    return `${msg} — نفّذ supabase/sql/experiences_vip_categories.sql في Supabase لتحديث التصنيفات.`;
  }
  if (e.code) return `${msg} (${e.code})`.trim() || 'حدث خطأ أثناء الحفظ';
  return msg || 'حدث خطأ أثناء الحفظ';
}

/** حمولة نظيفة — بدون id أو created_at (يولّدهما Supabase تلقائياً) */
function buildPayload(formData: ExperienceForm, categoryValue: string): Record<string, unknown> {
  return {
    title: formData.title.trim(),
    country: formData.country.trim(),
    city: formData.city.trim(),
    category: categoryValue,
    description: formData.description.trim(),
    detail_url: formData.detail_url.trim() || null,
    booking_url: formData.booking_url.trim() || null,
  };
}

function isMissingColumnError(message: string, column: string): boolean {
  return new RegExp(column, 'i').test(message) && /column|schema cache|does not exist/i.test(message);
}

export default function ExperiencesCRMPage() {
  const [rows, setRows] = useState<ExperienceRow[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [filterCountry, setFilterCountry] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [category, setCategory] = useState<string>(DEFAULT_CATEGORY);
  const [formData, setFormData] = useState<ExperienceForm>({
    title: '',
    country: '',
    city: '',
    description: '',
    detail_url: '',
    booking_url: '',
  });

  const categorySelectOptions = useMemo(() => {
    const options = [...VIP_EXPERIENCE_CATEGORIES];
    const trimmed = category.trim();
    if (trimmed && !isKnownExperienceCategory(trimmed) && !options.includes(trimmed as (typeof options)[number])) {
      return [trimmed, ...options];
    }
    return options;
  }, [category]);

  useEffect(() => {
    if (!supabase) return;
    void (async () => {
      const { data, error } = await supabase.from('experiences').select('country');
      if (error || !data) return;
      const u = [...new Set(data.map((x: { country?: string }) => x.country).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b), 'ar'),
      );
      setCountries(u as string[]);
    })();
  }, []);

  const load = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      setBanner({ type: 'err', text: 'قاعدة البيانات غير مهيأة.' });
      return;
    }
    setLoading(true);
    setBanner(null);
    try {
      let q = supabase
        .from('experiences')
        .select('*')
        .order('country', { ascending: true })
        .order('title', { ascending: true });
      if (filterCountry) q = q.eq('country', filterCountry);
      if (filterCategory) q = q.eq('category', filterCategory);
      const { data, error } = await q;
      if (error) throw error;
      setRows((data ?? []) as ExperienceRow[]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setBanner({
        type: 'err',
        text:
          msg.includes('experiences') || msg.includes('relation')
            ? 'جدول experiences غير موجود. نفّذ supabase/sql/experiences.sql ثم experiences_seed.sql.'
            : msg || 'تعذر التحميل.',
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filterCountry, filterCategory]);

  useEffect(() => {
    void load();
  }, [load]);

  function openWhatsAppShare(e: ExperienceRow) {
    const text = formatExperienceWhatsApp(e);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  }

  function resetForm() {
    setCategory(DEFAULT_CATEGORY);
    setFormData({
      title: '',
      country: '',
      city: '',
      description: '',
      detail_url: '',
      booking_url: '',
    });
    setIsEditing(false);
    setEditId(null);
  }

  function closeModal() {
    setIsModalOpen(false);
    resetForm();
  }

  function openCreateModal() {
    resetForm();
    setIsModalOpen(true);
  }

  function openEditModal(e: ExperienceRow) {
    setIsEditing(true);
    setEditId(e.id);
    const cat = e.category?.trim() || DEFAULT_CATEGORY;
    setCategory(cat || DEFAULT_CATEGORY);
    setFormData({
      title: e.title ?? '',
      country: e.country ?? '',
      city: e.city ?? '',
      description: e.description ?? '',
      detail_url: e.detail_url ?? '',
      booking_url: e.booking_url ?? '',
    });
    setIsModalOpen(true);
  }

  async function handleDelete(id: string) {
    if (!supabase) {
      setBanner({ type: 'err', text: 'قاعدة البيانات غير مهيأة.' });
      return;
    }
    if (!confirm('هل أنت متأكد من حذف هذه التجربة؟')) return;

    const { error } = await supabase.from('experiences').delete().eq('id', id);
    if (error) {
      console.error(error);
      setBanner({ type: 'err', text: error.message || 'تعذر حذف التجربة.' });
      return;
    }
    setBanner({ type: 'ok', text: 'تم حذف التجربة.' });
    void load();
  }

  function reportSaveError(error: unknown) {
    console.error('Supabase Save Error:', error);
    const msg = formatSupabaseError(error);
    toast.error(`فشل الحفظ: ${msg}`);
    setBanner({ type: 'err', text: `فشل الحفظ: ${msg}` });
  }

  async function persistExperience(payload: Record<string, unknown>) {
    if (!supabase) return { error: { message: 'قاعدة البيانات غير مهيأة.' } };

    const cleanPayload = { ...payload };
    delete cleanPayload.id;
    delete cleanPayload.created_at;

    if (isEditing && editId) {
      let result = await supabase.from('experiences').update(cleanPayload).eq('id', editId);
      if (result.error && isMissingColumnError(result.error.message ?? '', 'booking_url')) {
        const { booking_url: _b, ...withoutBooking } = cleanPayload;
        result = await supabase.from('experiences').update(withoutBooking).eq('id', editId);
      }
      return result;
    }

    let result = await supabase.from('experiences').insert([cleanPayload]);
    if (result.error && isMissingColumnError(result.error.message ?? '', 'booking_url')) {
      const { booking_url: _b, ...withoutBooking } = cleanPayload;
      result = await supabase.from('experiences').insert([withoutBooking]);
    }
    return result;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!supabase) {
      setBanner({ type: 'err', text: 'قاعدة البيانات غير مهيأة.' });
      return;
    }

    const categoryValue = category.trim();
    if (!categoryValue) {
      setBanner({ type: 'err', text: 'يرجى اختيار التصنيف.' });
      return;
    }
    if (!formData.title.trim() || !formData.country.trim() || !formData.description.trim()) {
      setBanner({ type: 'err', text: 'العنوان والدولة والوصف مطلوبة.' });
      return;
    }

    const payload = buildPayload(formData, categoryValue);
    setSaving(true);
    setBanner(null);

    const { error } = await persistExperience(payload);

    if (error) {
      reportSaveError(error);
      setSaving(false);
      return;
    }

    setBanner({
      type: 'ok',
      text: isEditing ? 'تم تحديث التجربة بنجاح.' : 'تمت إضافة التجربة بنجاح.',
    });
    closeModal();
    void load();
    setSaving(false);
  }

  return (
    <div dir="rtl" className="mx-auto min-h-screen max-w-[1100px] bg-slate-50 p-6 pb-14 font-sans text-slate-800">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/crm"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 transition hover:text-[#b8952d]"
        >
          <ArrowRight size={14} /> لوحة التحكم
        </Link>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-xl bg-[#D4AF37] px-5 py-2.5 text-sm font-extrabold text-black shadow-sm transition hover:bg-[#b8952d]"
        >
          <Plus size={16} strokeWidth={2.5} />
          إضافة تجربة
        </button>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 text-[#b8952d]">
          <Sparkles size={24} />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 sm:text-2xl">التجارب الاستثنائية</h1>
          <p className="mt-1 text-xs font-medium text-slate-500">
            اقتراحات مُنتقاة للعميل — حجز مباشر أو مشاركة عبر واتساب
          </p>
        </div>
      </div>

      {banner ? (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm font-bold ${
            banner.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {banner.text}
        </div>
      ) : null}

      <div className={`${INNER} mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2`}>
        <select value={filterCountry} onChange={(e) => setFilterCountry(e.target.value)} className={INPUT}>
          <option value="">كل الدول</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className={INPUT}>
          <option value="">كل التصنيفات</option>
          {VIP_EXPERIENCE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-[#b8952d]" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-10 text-center text-sm font-semibold text-slate-500">
          لا توجد تجارب أو لا نتائج للتصفية. نفّذ البذور في Supabase أو غيّر الفلاتر.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((e) => (
            <article key={e.id} className={`${CARD} flex flex-col gap-3`}>
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-extrabold text-slate-900 leading-snug">{e.title}</h2>
                <span className={`${TAG} shrink-0`}>{experienceCategoryLabel(e.category)}</span>
              </div>

              {e.description?.trim() ? (
                <p className="line-clamp-2 whitespace-pre-wrap text-sm text-slate-600">{e.description.trim()}</p>
              ) : null}

              <div className="flex items-center gap-1 text-xs font-bold text-slate-500">
                <MapPin size={14} className="text-[#b8952d]" />
                {e.city ? `${e.country} · ${e.city}` : e.country}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => openEditModal(e)}
                  className="cursor-pointer text-xs font-bold text-slate-500 transition hover:text-[#b8952d]"
                >
                  تعديل
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(e.id)}
                  className="cursor-pointer text-xs font-bold text-slate-500 transition hover:text-rose-600"
                >
                  حذف
                </button>
              </div>

              <div className="mt-1 flex flex-col gap-2">
                {e.booking_url ? (
                  <a
                    href={e.booking_url.startsWith('http') ? e.booking_url : `https://${e.booking_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={BTN_PRIMARY}
                  >
                    <ExternalLink size={14} /> حجز التجربة للعميل
                  </a>
                ) : (
                  <div className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-center text-sm font-bold text-slate-500">
                    رابط الحجز غير متوفر
                  </div>
                )}

                <button type="button" onClick={() => openWhatsAppShare(e)} className={BTN_WA}>
                  مشاركة واتساب
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {isModalOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-6">
          <div
            className="relative my-auto w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8"
            role="dialog"
            aria-modal="true"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <h2 className="text-xl font-extrabold text-slate-900">
                {isEditing ? 'تعديل التجربة' : 'إضافة تجربة جديدة'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-xl border border-slate-200 bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 disabled:opacity-50"
                aria-label="إغلاق"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                required
                placeholder="عنوان التجربة"
                value={formData.title}
                onChange={(ev) => setFormData({ ...formData, title: ev.target.value })}
                className={INPUT}
              />
              <input
                required
                placeholder="الدولة"
                value={formData.country}
                onChange={(ev) => setFormData({ ...formData, country: ev.target.value })}
                className={INPUT}
              />
              <input
                required
                placeholder="المدينة"
                value={formData.city}
                onChange={(ev) => setFormData({ ...formData, city: ev.target.value })}
                className={INPUT}
              />
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-600">التصنيف (VIP)</span>
                <select
                  required
                  value={category}
                  onChange={(ev) => setCategory(ev.target.value)}
                  className={INPUT}
                >
                  {categorySelectOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <textarea
                required
                placeholder="الوصف"
                rows={4}
                value={formData.description}
                onChange={(ev) => setFormData({ ...formData, description: ev.target.value })}
                className={`${INPUT} resize-y`}
              />
              <input
                type="url"
                placeholder="رابط تفاصيل (اختياري)"
                value={formData.detail_url}
                onChange={(ev) => setFormData({ ...formData, detail_url: ev.target.value })}
                className={INPUT}
              />
              <input
                type="url"
                placeholder="رابط الحجز للعميل (booking_url)"
                value={formData.booking_url}
                onChange={(ev) => setFormData({ ...formData, booking_url: ev.target.value })}
                className={INPUT}
              />
              <div className="mt-2 flex gap-3">
                <button type="submit" disabled={saving} className={`${BTN_PRIMARY} disabled:opacity-60`}>
                  {saving ? 'جاري الحفظ…' : isEditing ? 'تحديث' : 'حفظ'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
