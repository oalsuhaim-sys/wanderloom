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
    'rounded-xl border border-[#1c4532]/10 bg-[#f8faf8] px-4 py-3 text-sm leading-relaxed text-[#2d3d35]';

  const labelClass = 'mb-1 flex items-center gap-2 text-xs font-black text-[#1c4532]';
  const CityCard = ({ row }: { row: Destination }) => {
    const filled = [
      row.culture_info,
      row.guidelines_tips,
      row.weather_seasons,
      row.professional_impression,
    ].some((t) => t && String(t).trim());

    return (
      <article
        className="rounded-2xl border border-[#c9a84c]/25 bg-white p-5 shadow-[0_8px_30px_rgba(20,34,28,0.06)] ring-1 ring-[#1c4532]/5"
        dir="rtl"
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-[#0f1e16]">{row.city_name}</h3>
            <p className="mt-0.5 text-xs font-bold text-[#6b7280]">
              {filled ? 'محتوى مسجّل' : 'لا يوجد محتوى بعد لهذه المدينة'}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className={sectionClass}>
            <div className={labelClass}>
              <BookOpen className="h-4 w-4 text-[#c9a84c]" />
              الثقافة والجو العام
            </div>
            <p className="whitespace-pre-wrap font-bold">{row.culture_info?.trim() || '—'}</p>
          </div>
          <div className={sectionClass}>
            <div className={labelClass}>
              <CloudSun className="h-4 w-4 text-[#c9a84c]" />
              الطقس والمواسم
            </div>
            <p className="whitespace-pre-wrap font-bold">{row.weather_seasons?.trim() || '—'}</p>
          </div>
          <div className={sectionClass}>
            <div className={labelClass}>
              <Shield className="h-4 w-4 text-[#c9a84c]" />
              إرشادات عملية
            </div>
            <p className="whitespace-pre-wrap font-bold">{row.guidelines_tips?.trim() || '—'}</p>
          </div>
          <div className={`${sectionClass} border-[#c9a84c]/25 bg-[#fffef8]`}>
            <div className={labelClass}>
              <Sparkles className="h-4 w-4 text-[#c9a84c]" />
              انطباع خبير Wanderloom
            </div>
            <p className="whitespace-pre-wrap font-bold leading-relaxed">
              {row.professional_impression?.trim() || '—'}
            </p>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div
      className="min-h-screen bg-[#eef0ec] font-[family-name:var(--font-tajawal),system-ui,sans-serif] text-[#14221c] antialiased"
      dir="rtl"
    >
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/crm"
            className="inline-flex items-center gap-2 text-sm font-black text-[#1c4532]/70 transition hover:text-[#1c4532]"
          >
            <ArrowRight className="h-4 w-4" />
            لوحة التحكم
          </Link>
          <div className="flex items-center gap-2 text-xs font-black text-[#6b7280]">
            <Globe2 className="h-4 w-4 text-[#c9a84c]" />
            {grouped.length} دولة · من قاعدة البيانات
          </div>
        </div>

        <header className="mb-8 rounded-3xl border border-[#c9a84c]/30 bg-[#06120f] px-6 py-8 text-white shadow-xl sm:px-10">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#c9a84c]/20 text-[#d4b87a]">
              <Globe2 className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-black sm:text-3xl">دليل الوجهات الاحترافي</h1>
              <p className="mt-2 max-w-2xl text-sm font-bold leading-relaxed text-white/60">
                مرجع داخلي للفريق: ثقافة المدن، الطقس، أبرز المعالم، إرشادات التشغيل، و
                <strong className="text-[#d4b87a]">انطباع خبير Wanderloom</strong> — لغة بيعية فاخرة يعبّر بها الفريق مع
                العميل. افتح الدولة من القائمة المنسدلة أو ابحث عن المدينة مباشرة.
              </p>
            </div>
          </div>
        </header>

        <div className="mb-6 rounded-2xl border border-[#c9a84c]/25 bg-white p-4 shadow-md">
          <label className="flex items-center gap-3 rounded-xl border border-[#1c4532]/12 bg-[#f8faf8] px-4 py-3">
            <Search className="h-5 w-5 shrink-0 text-[#c9a84c]" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث باسم المدينة أو الدولة…"
              className="min-w-0 flex-1 border-0 bg-transparent text-sm font-bold text-[#14221c] outline-none placeholder:text-[#9ca3af]"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="shrink-0 rounded-lg px-2 py-1 text-xs font-black text-[#6b7280] hover:bg-[#e5e0d6]/50"
              >
                مسح
              </button>
            ) : null}
          </label>
        </div>

        {banner ? (
          <div
            className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-black ${
              banner.type === 'ok'
                ? 'border-emerald-300/50 bg-emerald-50 text-emerald-900'
                : 'border-red-300/50 bg-red-50 text-red-900'
            }`}
          >
            {banner.text}
          </div>
        ) : null}

        <div className="mb-8 rounded-2xl border-2 border-[#c9a84c]/40 bg-gradient-to-br from-[#fffef9] to-[#f5f0e6] px-5 py-4 shadow-[0_8px_28px_rgba(28,69,50,0.08)]">
          <h3 className="text-sm font-black text-[#1c4532]">نماذج مرجعية — صوت البيع الفاخر</h3>
          <p className="mt-1 text-xs font-bold leading-relaxed text-[#5c4a32]">{SALES_VOICE_INTRO}</p>
          <div className="mt-3 space-y-2">
            {SALES_VOICE_EXAMPLES.map((ex) => (
              <details
                key={ex.title}
                className="group rounded-xl border border-[#1c4532]/10 bg-white/90 px-3 py-2 text-right [&_summary]:cursor-pointer [&_summary]:list-none [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex items-center justify-between gap-2 text-xs font-black text-[#1c4532]">
                  <span>{ex.title}</span>
                  <span className="text-[#c9a84c] transition group-open:rotate-180">▼</span>
                </summary>
                <p className="mt-2 border-t border-[#e8e4dc] pt-2 text-xs font-bold leading-[1.85] text-[#2d3d35]">{ex.body}</p>
              </details>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-[#1c4532]" />
          </div>
        ) : grouped.length === 0 ? (
          <p className="py-16 text-center text-sm font-bold text-[#6b7280]">لا نتائج مطابقة لبحثك.</p>
        ) : (
          <div className="space-y-4">
            {grouped.map(({ country, cities }) => (
              <details
                key={country}
                className="group rounded-2xl border border-[#c9a84c]/30 bg-white shadow-[0_8px_28px_rgba(20,34,28,0.07)] ring-1 ring-[#1c4532]/5 open:shadow-lg"
                open={Boolean(search.trim())}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1c4532]/10 text-[#1c4532]">
                      <Globe2 className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="text-lg font-black text-[#0f1e16]">{country}</h2>
                      <p className="text-xs font-bold text-[#6b7280]">{cities.length} مدينة</p>
                    </div>
                  </div>
                  <ChevronDown className="h-5 w-5 shrink-0 text-[#c9a84c] transition group-open:-rotate-180" />
                </summary>
                <div className="border-t border-[#e8e4dc] px-4 pb-5 pt-2 sm:px-5">
                  <div className="grid gap-6 lg:grid-cols-2">
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
