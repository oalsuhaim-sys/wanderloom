'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  CloudSun,
  Globe2,
  Loader2,
  Search,
  Shield,
  Sparkles,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';

import {
  SALES_VOICE_EXAMPLES,
  SALES_VOICE_INTRO,
} from './sales-voice-examples';

type Destination = {
  id: string;
  country_name: string;
  city_name: string;
  culture_info: string | null;
  guidelines_tips: string | null;
  weather_seasons: string | null;
  professional_impression: string | null;
};

export default function DestinationsGuidePage() {
  const [rows, setRows] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [search, setSearch] = useState('');

  const loadAll = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      setBanner({ type: 'err', text: 'قاعدة البيانات غير مهيأة.' });
      console.warn(
        '[CRM destinations_guide] supabase is null — أضف NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY في .env.local وأعد تشغيل dev',
      );
      return;
    }
    setLoading(true);
    setBanner(null);
    try {
      const { data, error } = await supabase
        .from('destinations_guide')
        .select('id, country_name, city_name, culture_info, guidelines_tips, weather_seasons, professional_impression')
        .order('country_name', { ascending: true });

      if (error) {
        console.error(error);
        throw error;
      }

      const list = (data ?? []) as Destination[];
      if (list.length === 0) {
        console.warn(
          '[CRM destinations_guide] 0 rows — إن وُجدت بيانات في Table Editor فتحقق من سياسات RLS (SELECT لدور anon على public.destinations_guide).',
        );
      }
      setRows(list);
    } catch (e) {
      console.error('[CRM destinations_guide] loadAll failed:', e);
      const msg = e instanceof Error ? e.message : String(e);
      setBanner({
        type: 'err',
        text:
          msg.includes('destinations_guide') || msg.includes('relation')
            ? 'جدول destinations_guide غير موجود أو اسم الجدول غير صحيح.'
            : msg || 'تعذر تحميل الدليل.',
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const grouped = useMemo(() => {
    const q = search.trim();
    const filtered = !q
      ? rows
      : rows.filter((r) => r.country_name.includes(q) || r.city_name.includes(q));

    const map = new Map<string, Destination[]>();
    for (const r of filtered) {
      const key = r.country_name || '— بدون دولة —';
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return [...map.entries()].map(([country, cities]) => ({
      country,
      cities,
    }));
  }, [rows, search]);

  const sectionClass =
    'rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700';

  const labelClass = 'mb-1 flex items-center gap-2 text-xs font-bold text-slate-800';
  const CityCard = ({ row }: { row: Destination }) => {
    const filled = [
      row.culture_info,
      row.guidelines_tips,
      row.weather_seasons,
      row.professional_impression,
    ].some((t) => t && String(t).trim());

    return (
      <article
        className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm transition-all hover:border-[#D4AF37]/40"
        dir="rtl"
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">{row.city_name}</h3>
            <p className="mt-0.5 text-sm font-medium text-slate-500">
              {filled ? 'محتوى مسجّل' : 'لا يوجد محتوى بعد لهذه المدينة'}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className={sectionClass}>
            <div className={labelClass}>
              <BookOpen className="h-4 w-4 text-[#b8952d]" />
              الثقافة والجو العام
            </div>
            <p className="whitespace-pre-wrap font-bold text-slate-800">{row.culture_info?.trim() || '—'}</p>
          </div>
          <div className={sectionClass}>
            <div className={labelClass}>
              <CloudSun className="h-4 w-4 text-[#b8952d]" />
              الطقس والمواسم
            </div>
            <p className="whitespace-pre-wrap font-bold text-slate-800">{row.weather_seasons?.trim() || '—'}</p>
          </div>
          <div className={sectionClass}>
            <div className={labelClass}>
              <Shield className="h-4 w-4 text-[#b8952d]" />
              إرشادات عملية
            </div>
            <p className="whitespace-pre-wrap font-bold text-slate-800">{row.guidelines_tips?.trim() || '—'}</p>
          </div>
          <div className={`${sectionClass} border-[#D4AF37]/35 bg-[#D4AF37]/5`}>
            <div className={labelClass}>
              <Sparkles className="h-4 w-4 text-[#b8952d]" />
              انطباع خبير Wanderloom
            </div>
            <p className="whitespace-pre-wrap font-bold leading-relaxed text-slate-800">
              {row.professional_impression?.trim() || '—'}
            </p>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div
      className="min-h-screen bg-slate-50 p-6 font-[family-name:var(--font-tajawal),system-ui,sans-serif] text-slate-800 antialiased"
      dir="rtl"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/crm"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-[#b8952d]"
          >
            <ArrowRight className="h-4 w-4" />
            لوحة التحكم
          </Link>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <Globe2 className="h-4 w-4 text-[#b8952d]" />
            {grouped.length} دولة · من قاعدة البيانات
          </div>
        </div>

        <header className="mb-6 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm sm:px-10 sm:py-8">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 text-[#b8952d]">
              <Globe2 className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">دليل الوجهات الاحترافي</h1>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-500">
                مرجع داخلي للفريق: ثقافة المدن، الطقس، أبرز المعالم، إرشادات التشغيل، و
                <strong className="text-[#b8952d]"> انطباع خبير Wanderloom</strong> — لغة بيعية فاخرة يعبّر بها الفريق مع
                العميل. افتح الدولة من القائمة المنسدلة أو ابحث عن المدينة مباشرة.
              </p>
            </div>
          </div>
        </header>

        <div className="mb-6">
          <label className="flex min-h-[44px] items-center gap-3 rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 transition-all focus-within:border-[#D4AF37] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#D4AF37]/30">
            <Search className="h-5 w-5 shrink-0 text-[#b8952d]" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث باسم المدينة أو الدولة…"
              className="min-h-[44px] min-w-0 flex-1 border-0 bg-transparent text-sm font-bold text-slate-800 outline-none placeholder:text-slate-400"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="inline-flex min-h-[44px] shrink-0 items-center rounded-lg px-2 py-1 text-xs font-bold text-slate-500 transition hover:text-[#b8952d]"
              >
                مسح
              </button>
            ) : null}
          </label>
        </div>

        {banner ? (
          <div
            className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-bold ${
              banner.type === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-800'
            }`}
          >
            {banner.text}
          </div>
        ) : null}

        <div className="mb-8 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-extrabold text-[#b8952d]">نماذج مرجعية — صوت البيع الفاخر</h3>
          <p className="mt-1 text-sm font-medium leading-relaxed text-slate-500">{SALES_VOICE_INTRO}</p>
          <div className="mt-3 space-y-2">
            {SALES_VOICE_EXAMPLES.map((ex) => (
              <details
                key={ex.title}
                className="group rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-right transition-all hover:border-[#D4AF37]/35 [&_summary]:cursor-pointer [&_summary]:list-none [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex items-center justify-between gap-2 text-xs font-bold text-[#b8952d]">
                  <span>{ex.title}</span>
                  <span className="text-[#b8952d] transition group-open:rotate-180">▼</span>
                </summary>
                <p className="mt-2 border-t border-slate-200 pt-2 text-xs font-bold leading-[1.85] text-slate-700">
                  {ex.body}
                </p>
              </details>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-[#b8952d]" />
          </div>
        ) : grouped.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 py-16 text-center text-sm font-semibold text-slate-500">
            لا نتائج مطابقة لبحثك.
          </p>
        ) : (
          <div className="space-y-3">
            {grouped.map(({ country, cities }) => (
              <details
                key={country}
                className="group mb-3 rounded-xl border border-slate-200/80 bg-white p-0 shadow-sm transition-all hover:bg-slate-50 open:bg-white"
                open={Boolean(search.trim())}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 font-bold text-slate-900 [&::-webkit-details-marker]:hidden">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-[#b8952d]">
                      <Globe2 className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">{country}</h2>
                      <p className="text-sm font-medium text-slate-500">{cities.length} مدينة</p>
                    </div>
                  </div>
                  <ChevronDown className="h-5 w-5 shrink-0 text-[#b8952d] transition group-open:-rotate-180" />
                </summary>
                <div className="border-t border-slate-100 px-4 pb-5 pt-2 sm:px-5">
                  <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {cities.map((r) => (
                      <CityCard key={r.id} row={r} />
                    ))}
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
