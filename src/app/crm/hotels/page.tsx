'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ExternalLink, Hotel, MessageCircle, Pencil, Plus, Save, Trash2, X } from 'lucide-react';

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
  });

  const loadCountries = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from('hotels').select('country');
      if (error) throw error;
      const list = (data ?? [])
        .map((r: { country?: string }) => r.country)
        .filter((c): c is string => Boolean(c?.trim()));
      setCountries([...new Set(list)].sort((a, b) => a.localeCompare(b, 'ar')));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const [allRows, setAllRows] = useState<HotelRow[]>([]);

  const loadHotels = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      setBanner({ type: 'err', text: 'قاعدة البيانات غير مهيأة. أضف مفاتيح Supabase في البيئة.' });
      return;
    }
    setLoading(true);
    setBanner(null);
    try {
      let q = supabase.from('hotels').select('*').order('name', { ascending: true });
      if (filterCountry) q = q.eq('country', filterCountry);
      if (filterCategory) q = q.eq('category', filterCategory);
      const { data, error } = await q;
      if (error) throw error;
      setAllRows((data ?? []) as HotelRow[]);
    } catch (e) {
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
    return allRows.filter(
      (h) =>
        h.name.toLowerCase().includes(qsearch) ||
        h.city.toLowerCase().includes(qsearch) ||
        (h.notes && h.notes.toLowerCase().includes(qsearch))
    );
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
    []
  );

  const btn = (bg: string, color: string) => ({
    padding: '8px 14px',
    background: bg,
    color,
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 700 as const,
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    gap: 6,
  });

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#eef0ec] font-[family-name:var(--font-tajawal),system-ui,sans-serif]"
      style={{ padding: '20px 16px', maxWidth: 1200, margin: '0 auto' }}
    >
      {toast ? (
        <div
          role="status"
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            padding: '12px 22px',
            borderRadius: 14,
            background: 'linear-gradient(135deg,#1C4532,#163a30)',
            color: '#f0e4c4',
            fontSize: 13,
            fontWeight: 800,
            boxShadow: '0 8px 32px rgba(28,69,50,0.35)',
            border: '1px solid rgba(201,168,76,0.35)',
          }}
        >
          {toast}
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => window.history.back()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'none',
          border: 'none',
          color: '#6B7280',
          cursor: 'pointer',
          fontSize: 12,
          marginBottom: 16,
        }}
      >
        <ArrowRight size={14} /> رجوع
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1C4532', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Hotel size={26} color="#C9A84C" strokeWidth={2} />
            قاعدة بيانات الفنادق
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
            {rows.length} فندق معروض
            {filterCountry ? ` · الدولة: ${filterCountry}` : ''}
            {filterCategory ? ` · التصنيف: ${categoryLabel(filterCategory)}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link
            href="/crm"
            style={{
              textDecoration: 'none',
              ...btn('#F3F0EB', '#1C4532'),
            }}
          >
            لوحة التحكم
          </Link>
          <button type="button" onClick={() => setAdding(true)} style={{ ...btn('#C9A84C', '#1C4532'), padding: '10px 18px', fontSize: 12 }}>
            <Plus size={16} /> إضافة فندق
          </button>
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
          marginBottom: 16,
          padding: '14px 16px',
          borderRadius: 14,
          background: 'linear-gradient(135deg, #fffef9 0%, #f0f4f1 100%)',
          border: '1px solid rgba(201,168,76,0.35)',
          boxShadow: '0 4px 20px rgba(28,69,50,0.06)',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, color: '#1C4532', marginBottom: 10 }}>
          دليل التصنيف للموظف — اختر الأنسب لملف العميل
        </div>
        <ul style={{ margin: 0, paddingRight: 18, fontSize: 11, fontWeight: 700, color: '#3d4a42', lineHeight: 1.75 }}>
          {CATEGORY_OPTIONS.map((o) => (
            <li key={o.value} style={{ marginBottom: 6 }}>
              <span style={{ color: '#1C4532' }}>{o.label}:</span> {o.hint}
            </li>
          ))}
        </ul>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 10,
          marginBottom: 16,
          background: '#fff',
          padding: 14,
          borderRadius: 14,
          border: '1px solid #E8E4DC',
          boxShadow: '0 4px 20px rgba(28,69,50,0.06)',
        }}
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو المدينة أو ملاحظات الموظفين…"
          style={inputStyle}
        />
        <select
          value={filterCountry}
          onChange={(e) => setFilterCountry(e.target.value)}
          style={inputStyle}
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
          style={inputStyle}
        >
          <option value="">كل التصنيفات</option>
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} title={o.hint}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {adding && (
        <div
          style={{
            background: '#FFFBEB',
            border: '1px solid #FDE68A',
            borderRadius: 14,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div style={{ fontWeight: 800, color: '#92400E', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            فندق جديد
            <button type="button" onClick={() => setAdding(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400E' }}>
              <X size={18} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            <input
              value={newRow.name}
              onChange={(e) => setNewRow({ ...newRow, name: e.target.value })}
              placeholder="اسم الفندق *"
              style={inputStyle}
            />
            <input
              value={newRow.country}
              onChange={(e) => setNewRow({ ...newRow, country: e.target.value })}
              placeholder="الدولة *"
              style={inputStyle}
            />
            <input
              value={newRow.city}
              onChange={(e) => setNewRow({ ...newRow, city: e.target.value })}
              placeholder="المدينة"
              style={inputStyle}
            />
            <select
              value={newRow.category}
              onChange={(e) => setNewRow({ ...newRow, category: e.target.value as HotelCategory })}
              style={inputStyle}
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
              style={{ ...inputStyle, direction: 'ltr' }}
            />
          </div>
          <textarea
            value={newRow.notes}
            onChange={(e) => setNewRow({ ...newRow, notes: e.target.value })}
            placeholder="ملاحظاتك عن الفندق…"
            rows={3}
            style={{ ...inputStyle, marginTop: 10, resize: 'vertical' as const }}
          />
          <button type="button" onClick={addHotel} style={{ ...btn('#1C4532', '#fff'), marginTop: 12 }}>
            <Save size={16} /> حفظ الفندق
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9CA3AF' }}>جارٍ التحميل…</div>
      ) : rows.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 40,
            color: '#6B7280',
            background: '#FAFAF8',
            borderRadius: 14,
            border: '1px dashed #E5E0D6',
          }}
        >
          لا توجد فنادق بعد أو لا نتائج للتصفية. أضف فندقاً أو غيّر الدولة.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((h) => (
            <div
              key={h.id}
              style={{
                background: '#fff',
                borderRadius: 14,
                border: '1px solid #F3F0EB',
                padding: '14px 16px',
                boxShadow: '0 1px 6px rgba(0,0,0,.04)',
              }}
            >
              {editing?.id === h.id ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                    <input
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      style={inputStyle}
                    />
                    <input
                      value={editing.country}
                      onChange={(e) => setEditing({ ...editing, country: e.target.value })}
                      style={inputStyle}
                    />
                    <input
                      value={editing.city}
                      onChange={(e) => setEditing({ ...editing, city: e.target.value })}
                      style={inputStyle}
                    />
                    <select
                      value={editing.category}
                      onChange={(e) => setEditing({ ...editing, category: e.target.value as HotelCategory })}
                      style={inputStyle}
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
                      style={{ ...inputStyle, direction: 'ltr' }}
                    />
                  </div>
                  <textarea
                    value={editing.notes ?? ''}
                    onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                    rows={2}
                    style={{ ...inputStyle, marginTop: 8 }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button type="button" onClick={saveEdit} style={btn('#1C4532', '#fff')}>
                      <Save size={14} /> حفظ
                    </button>
                    <button type="button" onClick={() => setEditing(null)} style={btn('#F3F0EB', '#374151')}>
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#1C4532' }}>{h.name}</div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                      {h.city ? `${h.city} · ` : ''}
                      {h.country}
                      <span
                        style={{
                          marginRight: 8,
                          padding: '2px 8px',
                          borderRadius: 8,
                          background: '#FEF3C7',
                          color: '#92400E',
                          fontWeight: 700,
                          fontSize: 11,
                        }}
                      >
                        {categoryLabel(h.category)}
                      </span>
                    </div>
                    {h.notes ? (
                      <div style={{ fontSize: 12, color: '#4B5563', marginTop: 8, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {h.notes}
                      </div>
                    ) : null}
                    {h.booking_url ? (
                      <a
                        href={normalizeUrl(h.booking_url) ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          marginTop: 10,
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#1C4532',
                        }}
                      >
                        <ExternalLink size={14} /> فتح الرابط
                      </a>
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => copyHotelWhatsApp(h)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 12px',
                        borderRadius: 10,
                        border: '1px solid rgba(37,211,102,0.45)',
                        background: 'linear-gradient(135deg, #e8f8ec 0%, #d4f0dc 100%)',
                        color: '#166534',
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <MessageCircle size={16} color="#25D366" />
                      نسخ للواتساب
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing({ ...h })}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        border: 'none',
                        background: '#FEF3C7',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      aria-label="تعديل"
                    >
                      <Pencil size={16} color="#D97706" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteHotel(h.id)}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        border: 'none',
                        background: '#FEE2E2',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      aria-label="حذف"
                    >
                      <Trash2 size={16} color="#DC2626" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
