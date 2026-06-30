'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ExternalLink, Loader2, MapPin, Plus, Sparkles } from 'lucide-react';

import { supabase } from '@/lib/supabase';
import {
  VIP_EXPERIENCE_CATEGORIES,
  experienceCategoryLabel,
  isKnownExperienceCategory,
  type ExperienceRow,
} from '@/types/experience';

const DEFAULT_CATEGORY = VIP_EXPERIENCE_CATEGORIES[0];

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
    alert(`فشل الحفظ: ${msg}`);
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

  const inputStyle = useMemo(
    () =>
      ({
        width: '100%',
        padding: 10,
        border: '1.5px solid #E5E0D6',
        borderRadius: 10,
        fontSize: 13,
        direction: 'rtl' as const,
        outline: 'none',
      }) as const,
    [],
  );

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#eef0ec] font-[family-name:var(--font-tajawal),system-ui,sans-serif]"
      style={{ maxWidth: 1100, margin: '0 auto' }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Link
          href="/crm"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            color: '#6B7280',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <ArrowRight size={14} /> لوحة التحكم
        </Link>
        <button
          type="button"
          onClick={openCreateModal}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            borderRadius: 999,
            border: 'none',
            background: 'linear-gradient(135deg,#1C4532,#163a30)',
            color: '#f0e4c4',
            fontSize: 12,
            fontWeight: 900,
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(28,69,50,0.25)',
          }}
        >
          <Plus size={16} strokeWidth={2.5} />
          إضافة تجربة
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: 'linear-gradient(135deg,#C9A84C,#8A6B2A)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Sparkles size={24} color="#1C4532" />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1C4532', margin: 0 }}>التجارب الاستثنائية</h1>
          <p style={{ fontSize: 11, color: '#6B7280', margin: '4px 0 0', fontWeight: 700 }}>
            اقتراحات مُنتقاة للعميل — حجز مباشر أو مشاركة عبر واتساب
          </p>
        </div>
      </div>

      {banner ? (
        <div
          style={{
            marginBottom: 14,
            padding: '12px 14px',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 700,
            background: banner.type === 'ok' ? '#D1FAE5' : '#FEE2E2',
            color: banner.type === 'ok' ? '#065F46' : '#991B1B',
            border: `1px solid ${banner.type === 'ok' ? '#6EE7B7' : '#FECACA'}`,
          }}
        >
          {banner.text}
        </div>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 10,
          marginBottom: 20,
          background: '#fff',
          padding: 14,
          borderRadius: 14,
          border: '1px solid #E8E4DC',
          boxShadow: '0 4px 20px rgba(28,69,50,0.06)',
        }}
      >
        <select value={filterCountry} onChange={(e) => setFilterCountry(e.target.value)} style={inputStyle}>
          <option value="">كل الدول</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={inputStyle}>
          <option value="">كل التصنيفات</option>
          {VIP_EXPERIENCE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Loader2 className="animate-spin text-[#1C4532]" size={40} />
        </div>
      ) : rows.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 40,
            color: '#6B7280',
            background: '#FAFAF8',
            borderRadius: 14,
            border: '1px dashed #E5E0D6',
            fontWeight: 700,
          }}
        >
          لا توجد تجارب أو لا نتائج للتصفية. نفّذ البذور في Supabase أو غيّر الفلاتر.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {rows.map((e) => (
            <article
              key={e.id}
              style={{
                background: '#fff',
                borderRadius: 18,
                border: '1px solid rgba(201,168,76,0.28)',
                padding: '18px 18px 16px',
                boxShadow: '0 8px 28px rgba(20,34,28,0.07)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <h2 style={{ fontSize: 16, fontWeight: 900, color: '#0f1e16', margin: 0, lineHeight: 1.4 }}>
                  {e.title}
                </h2>
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: '#FEF3C7',
                    color: '#92400E',
                  }}
                >
                  {experienceCategoryLabel(e.category)}
                </span>
              </div>
              {e.description?.trim() ? (
                <p className="mt-3 line-clamp-2 whitespace-pre-wrap text-sm text-[#1E2720]/70">
                  {e.description.trim()}
                </p>
              ) : null}
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#4B5563' }}
              >
                <MapPin size={14} className="text-[#C9A84C]" />
                {e.city ? `${e.country} · ${e.city}` : e.country}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => openEditModal(e)}
                  className="text-sm font-bold text-[#1C4532] transition hover:text-[#163a30]"
                >
                  تعديل
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(e.id)}
                  className="text-sm font-bold text-red-600 transition hover:text-red-800"
                >
                  حذف
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                {e.booking_url ? (
                  <a
                    href={e.booking_url.startsWith('http') ? e.booking_url : `https://${e.booking_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 12,
                      border: 'none',
                      background: 'linear-gradient(135deg,#2563EB,#1D4ED8)',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 800,
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <ExternalLink size={14} /> حجز التجربة للعميل
                  </a>
                ) : (
                  <div
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: '#F3F4F6',
                      color: '#9CA3AF',
                      fontSize: 12,
                      fontWeight: 800,
                      textAlign: 'center',
                    }}
                  >
                    رابط الحجز غير متوفر
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => openWhatsAppShare(e)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg,#25D366,#128C7E)',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  مشاركة واتساب
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {isModalOpen ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 20,
              padding: 24,
              width: '100%',
              maxWidth: 440,
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
              border: '1px solid #E8E4DC',
            }}
          >
            <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1C4532', margin: '0 0 16px' }}>
              {isEditing ? 'تعديل التجربة' : 'إضافة تجربة جديدة'}
            </h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                required
                placeholder="عنوان التجربة"
                value={formData.title}
                onChange={(ev) => setFormData({ ...formData, title: ev.target.value })}
                style={inputStyle}
              />
              <input
                required
                placeholder="الدولة"
                value={formData.country}
                onChange={(ev) => setFormData({ ...formData, country: ev.target.value })}
                style={inputStyle}
              />
              <input
                required
                placeholder="المدينة"
                value={formData.city}
                onChange={(ev) => setFormData({ ...formData, city: ev.target.value })}
                style={inputStyle}
              />
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#6B7280' }}>التصنيف (VIP)</span>
                <select
                  required
                  value={category}
                  onChange={(ev) => setCategory(ev.target.value)}
                  style={inputStyle}
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
                style={{ ...inputStyle, resize: 'vertical' as const }}
              />
              <input
                type="url"
                placeholder="رابط تفاصيل (اختياري)"
                value={formData.detail_url}
                onChange={(ev) => setFormData({ ...formData, detail_url: ev.target.value })}
                style={inputStyle}
              />
              <input
                type="url"
                placeholder="رابط الحجز للعميل (booking_url)"
                value={formData.booking_url}
                onChange={(ev) => setFormData({ ...formData, booking_url: ev.target.value })}
                style={{ ...inputStyle, border: '1.5px solid #BFDBFE', background: '#EFF6FF' }}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    flex: 1,
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg,#1C4532,#163a30)',
                    color: '#f0e4c4',
                    fontWeight: 900,
                    cursor: saving ? 'wait' : 'pointer',
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? 'جاري الحفظ…' : isEditing ? 'تحديث' : 'حفظ'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  style={{
                    flex: 1,
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: '1px solid #E5E0D6',
                    background: '#F9FAFB',
                    color: '#4B5563',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
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
