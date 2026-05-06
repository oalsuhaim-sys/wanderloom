'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  CloudSun,
  Globe2,
  ListChecks,
  Loader2,
  Pencil,
  Save,
  Search,
  Shield,
  Sparkles,
  X,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import {
  CRM_DESTINATIONS_GUIDE,
  type CrmGuideCityDef,
  type CrmGuideCountryDef,
} from '@/lib/crm-destinations-guide-data';
import type { DestinationsGuideRow } from '@/types/destinations-guide';

import {
  SALES_VOICE_EXAMPLES,
  SALES_VOICE_INTRO,
  SALES_VOICE_PLACEHOLDER,
} from './sales-voice-examples';

type Draft = {
  culture: string;
  guidelines: string;
  weather_seasons: string;
  professional_impression: string;
  highlights: string;
};

const emptyDraft = (): Draft => ({
  culture: '',
  guidelines: '',
  weather_seasons: '',
  professional_impression: '',
  highlights: '',
});

function rowToDraft(row: DestinationsGuideRow | undefined): Draft {
  if (!row) return emptyDraft();
  return {
    culture: row.culture ?? '',
    guidelines: row.guidelines ?? '',
    weather_seasons: row.weather_seasons ?? '',
    professional_impression: row.professional_impression ?? '',
    highlights: row.highlights ?? '',
  };
}

function compositeKey(countryId: string, cityId: string) {
  return `${countryId}:${cityId}`;
}

export default function DestinationsGuidePage() {
  const [byKey, setByKey] = useState<Record<string, DestinationsGuideRow>>({});
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [search, setSearch] = useState('');
  const [editingCityId, setEditingCityId] = useState<string | null>(null);
  const [editingCountryId, setEditingCountryId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      setBanner({ type: 'err', text: 'قاعدة البيانات غير مهيأة.' });
      return;
    }
    setLoading(true);
    setBanner(null);
    try {
      const { data, error } = await supabase.from('destinations_guide').select('*');
      if (error) throw error;
      const map: Record<string, DestinationsGuideRow> = {};
      for (const r of (data ?? []) as DestinationsGuideRow[]) {
        map[compositeKey(r.country_id, r.city_id)] = r;
      }
      setByKey(map);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setBanner({
        type: 'err',
        text:
          msg.includes('destinations_guide') || msg.includes('relation')
            ? 'جدول destinations_guide غير موجود. نفّذ supabase/sql/destinations_guide.sql في Supabase.'
            : msg || 'تعذر تحميل الدليل.',
      });
      setByKey({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const filteredCountries = useMemo((): CrmGuideCountryDef[] => {
    const q = search.trim();
    if (!q) return [...CRM_DESTINATIONS_GUIDE];
    return CRM_DESTINATIONS_GUIDE.flatMap((c) => {
      const countryMatch = c.labelAr.includes(q);
      const cities = countryMatch ? [...c.cities] : c.cities.filter((ci) => ci.labelAr.includes(q));
      if (cities.length === 0) return [];
      return [{ ...c, cities }];
    });
  }, [search]);

  const startEdit = (countryId: string, city: CrmGuideCityDef) => {
    setEditingCountryId(countryId);
    setEditingCityId(city.id);
    setDraft(rowToDraft(byKey[compositeKey(countryId, city.id)]));
  };

  const cancelEdit = () => {
    setEditingCityId(null);
    setEditingCountryId(null);
    setDraft(emptyDraft());
  };

  const saveCity = async (countryId: string, cityId: string) => {
    if (!supabase) return;
    setSaving(true);
    setBanner(null);
    try {
      const payload = {
        country_id: countryId,
        city_id: cityId,
        culture: draft.culture.trim(),
        guidelines: draft.guidelines.trim(),
        weather_seasons: draft.weather_seasons.trim(),
        professional_impression: draft.professional_impression.trim(),
        highlights: draft.highlights.trim(),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('destinations_guide').upsert(payload, {
        onConflict: 'country_id,city_id',
      });
      if (error) throw error;
      setBanner({ type: 'ok', text: 'تم حفظ المعلومات بنجاح.' });
      cancelEdit();
      await loadAll();
    } catch (e) {
      setBanner({
        type: 'err',
        text: e instanceof Error ? e.message : 'تعذر الحفظ.',
      });
    } finally {
      setSaving(false);
    }
  };

  const countryCount = CRM_DESTINATIONS_GUIDE.length;

  const sectionClass =
    'rounded-xl border border-[#1c4532]/10 bg-[#f8faf8] px-4 py-3 text-sm leading-relaxed text-[#2d3d35]';

  const labelClass = 'mb-1 flex items-center gap-2 text-xs font-black text-[#1c4532]';

  const CityCard = ({ country, city }: { country: CrmGuideCountryDef; city: CrmGuideCityDef }) => {
    const row = byKey[compositeKey(country.id, city.id)];
    const filled = [
      row?.culture,
      row?.guidelines,
      row?.weather_seasons,
      row?.professional_impression,
      row?.highlights,
    ].some((t) => t && String(t).trim());
    const isEditing = editingCountryId === country.id && editingCityId === city.id;

    return (
      <article
        className="rounded-2xl border border-[#c9a84c]/25 bg-white p-5 shadow-[0_8px_30px_rgba(20,34,28,0.06)] ring-1 ring-[#1c4532]/5"
        dir="rtl"
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-[#0f1e16]">{city.labelAr}</h3>
            <p className="mt-0.5 text-xs font-bold text-[#6b7280]">
              {filled ? 'محتوى مسجّل' : 'بانتظار إدخال المدير أو تشغيل سكربت البذور'}
            </p>
          </div>
          {!isEditing ? (
            <button
              type="button"
              onClick={() => startEdit(country.id, city)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1c4532] px-3 py-2 text-xs font-black text-[#f0e4c4] transition hover:bg-[#163a30]"
            >
              <Pencil className="h-3.5 w-3.5" />
              تعديل
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => saveCity(country.id, city.id)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-l from-[#7a5f28] to-[#d4b87a] px-3 py-2 text-xs font-black text-[#0a1814] disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                حفظ
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-xl border border-[#e5e0d6] bg-white px-3 py-2 text-xs font-black text-[#4b5563]"
              >
                <X className="inline h-3.5 w-3.5" /> إلغاء
              </button>
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-3">
            {(
              [
                ['culture', 'الثقافة والجو العام', draft.culture],
                ['weather_seasons', 'الطقس والمواسم', draft.weather_seasons],
                ['highlights', 'أبرز المعالم والأنشطة', draft.highlights],
                ['guidelines', 'إرشادات عملية للموظف', draft.guidelines],
              ] as const
            ).map(([key, arLabel, val]) => (
              <label key={key} className="block">
                <span className="mb-1 block text-xs font-black text-[#1c4532]">{arLabel}</span>
                <textarea
                  className="min-h-[88px] w-full rounded-xl border border-[#e5e0d6] bg-[#fafaf8] px-3 py-2 text-sm font-bold text-[#14221c] outline-none ring-[#c9a84c] focus:ring-2"
                  value={val}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                />
              </label>
            ))}
            <label className="block rounded-2xl border border-[#c9a84c]/35 bg-[#fffef6] p-4 ring-1 ring-[#1c4532]/5">
              <span className="mb-1 block text-xs font-black text-[#1c4532]">
                انطباع خبير Wanderloom — لغة بيعية ذهبية
              </span>
              <p className="mb-2 text-[11px] font-bold leading-relaxed text-[#5c4a32]">{SALES_VOICE_INTRO}</p>
              <textarea
                className="min-h-[160px] w-full rounded-xl border border-[#e5e0d6] bg-white px-3 py-2 text-sm font-bold leading-relaxed text-[#14221c] outline-none ring-[#c9a84c] focus:ring-2"
                placeholder={SALES_VOICE_PLACEHOLDER}
                value={draft.professional_impression}
                onChange={(e) => setDraft({ ...draft, professional_impression: e.target.value })}
              />
            </label>
          </div>
        ) : (
          <div className="space-y-3">
            <div className={sectionClass}>
              <div className={labelClass}>
                <BookOpen className="h-4 w-4 text-[#c9a84c]" />
                الثقافة والجو العام
              </div>
              <p className="whitespace-pre-wrap font-bold">
                {row?.culture?.trim() || '— لم يُضف بعد —'}
              </p>
            </div>
            <div className={sectionClass}>
              <div className={labelClass}>
                <CloudSun className="h-4 w-4 text-[#c9a84c]" />
                الطقس والمواسم
              </div>
              <p className="whitespace-pre-wrap font-bold">
                {row?.weather_seasons?.trim() || '— لم يُضف بعد —'}
              </p>
            </div>
            <div className={sectionClass}>
              <div className={labelClass}>
                <ListChecks className="h-4 w-4 text-[#c9a84c]" />
                أبرز المعالم والأنشطة
              </div>
              <p className="whitespace-pre-wrap font-bold">
                {row?.highlights?.trim() || '— لم يُضف بعد —'}
              </p>
            </div>
            <div className={sectionClass}>
              <div className={labelClass}>
                <Shield className="h-4 w-4 text-[#c9a84c]" />
                إرشادات عملية
              </div>
              <p className="whitespace-pre-wrap font-bold">
                {row?.guidelines?.trim() || '— لم يُضف بعد —'}
              </p>
            </div>
            <div className={`${sectionClass} border-[#c9a84c]/25 bg-[#fffef8]`}>
              <div className={labelClass}>
                <Sparkles className="h-4 w-4 text-[#c9a84c]" />
                انطباع خبير Wanderloom
              </div>
              <p className="whitespace-pre-wrap font-bold leading-relaxed">
                {row?.professional_impression?.trim() ||
                  '— لم يُضف بعد — املأ بصوت فاخر يجمع المشهد، الانطباع، ونصيحة للموظف. —'}
              </p>
            </div>
          </div>
        )}
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
            {countryCount} دولة · دليل حصرٍ للموظفين
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
        ) : filteredCountries.length === 0 ? (
          <p className="py-16 text-center text-sm font-bold text-[#6b7280]">لا نتائج مطابقة لبحثك.</p>
        ) : (
          <div className="space-y-4">
            {filteredCountries.map((country) => (
              <details
                key={country.id}
                className="group rounded-2xl border border-[#c9a84c]/30 bg-white shadow-[0_8px_28px_rgba(20,34,28,0.07)] ring-1 ring-[#1c4532]/5 open:shadow-lg"
                open={Boolean(search.trim())}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1c4532]/10 text-[#1c4532]">
                      <Globe2 className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="text-lg font-black text-[#0f1e16]">{country.labelAr}</h2>
                      <p className="text-xs font-bold text-[#6b7280]">{country.cities.length} مدينة</p>
                    </div>
                  </div>
                  <ChevronDown className="h-5 w-5 shrink-0 text-[#c9a84c] transition group-open:-rotate-180" />
                </summary>
                <div className="border-t border-[#e8e4dc] px-4 pb-5 pt-2 sm:px-5">
                  <div className="grid gap-6 lg:grid-cols-2">
                    {country.cities.map((city) => (
                      <CityCard key={city.id} country={country} city={city} />
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
