'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ExternalLink, Loader2, MapPin, Sparkles } from 'lucide-react';

import { supabase } from '@/lib/supabase';
import type { ExperienceCategory, ExperienceRow } from '@/types/experience';

const CATEGORY_OPTIONS: { value: ExperienceCategory; label: string }[] = [
  { value: 'cooking', label: 'طهي' },
  { value: 'heritage', label: 'تراث' },
  { value: 'shopping', label: 'تسوق' },
  { value: 'relaxation', label: 'استرخاء' },
];

function categoryLabel(c: string): string {
  return CATEGORY_OPTIONS.find((o) => o.value === c)?.label ?? c;
}

function formatExperienceWhatsApp(e: ExperienceRow): string {
  const loc = e.city ? `${e.country} · ${e.city}` : e.country;
  const link = e.detail_url?.trim() ? e.detail_url.trim() : '—';
  return `✨ اقتراح مميز — Wanderloom

📌 ${e.title}
🌍 ${loc}
🏷️ التصنيف: ${categoryLabel(e.category)}

📝 ${e.description}

🔗 ${link}`;
}

export default function ExperiencesCRMPage() {
  const [rows, setRows] = useState<ExperienceRow[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [filterCountry, setFilterCountry] = useState('');
  const [filterCategory, setFilterCategory] = useState<'' | ExperienceCategory>('');
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data, error } = await supabase.from('experiences').select('country');
      if (error || !data) return;
      const u = [...new Set(data.map((x: { country?: string }) => x.country).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b), 'ar')
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
      let q = supabase.from('experiences').select('*').order('country', { ascending: true }).order('title', { ascending: true });
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
    load();
  }, [load]);

  async function copyWhatsApp(e: ExperienceRow) {
    const text = formatExperienceWhatsApp(e);
    try {
      await navigator.clipboard.writeText(text);
      setToast('تم النسخ بنجاح!');
    } catch {
      setToast('تعذر النسخ — تأكد من HTTPS والأذونات.');
    }
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
    []
  );

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#eef0ec] font-[family-name:var(--font-tajawal),system-ui,sans-serif]"
      style={{ maxWidth: 1100, margin: '0 auto' }}
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
            boxShadow: '0 12px 40px rgba(0,0,0,.2)',
            border: '1px solid rgba(201,168,76,.4)',
          }}
        >
          {toast}
        </div>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <Link href="/crm" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#6B7280', fontSize: 12, fontWeight: 700 }}>
          <ArrowRight size={14} /> لوحة التحكم
        </Link>
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
            اقتراحات مُنتقاة للعميل — انسخ النص وأرسله عبر واتساب
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
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory((e.target.value || '') as '' | ExperienceCategory)}
          style={inputStyle}
        >
          <option value="">كل التصنيفات</option>
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
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
                <h2 style={{ fontSize: 16, fontWeight: 900, color: '#0f1e16', margin: 0, lineHeight: 1.4 }}>{e.title}</h2>
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
                  {categoryLabel(e.category)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#4B5563' }}>
                <MapPin size={14} className="text-[#C9A84C]" />
                {e.city ? `${e.country} · ${e.city}` : e.country}
              </div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', lineHeight: 1.75, margin: 0, flex: 1 }}>{e.description}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => copyWhatsApp(e)}
                  style={{
                    flex: 1,
                    minWidth: 140,
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
                  نسخ للواتساب
                </button>
                {e.detail_url ? (
                  <a
                    href={e.detail_url.startsWith('http') ? e.detail_url : `https://${e.detail_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '10px 14px',
                      borderRadius: 12,
                      border: '1px solid #E5E0D6',
                      background: '#FAFAF8',
                      color: '#1C4532',
                      fontSize: 12,
                      fontWeight: 800,
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <ExternalLink size={14} /> رابط
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
