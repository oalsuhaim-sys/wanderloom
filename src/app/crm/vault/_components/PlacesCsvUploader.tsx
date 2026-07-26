'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  MapPin,
  Upload,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import {
  parseCsvText,
  pickField,
  rowsToObjects,
} from '@/lib/csv-parse';
import { PLACES_BANK_CATEGORIES } from '@/lib/places-bank';
import { supabase } from '@/lib/supabase';
import { TRIP_DESTINATIONS } from '@/lib/trip-destination-data';

const CHUNK_SIZE = 100;

const FALLBACK_DESCRIPTION = 'تفاصيل المعلم قيد التحديث...';
const FALLBACK_IMAGE = '/images/placeholders/default-landmark.jpg';

/** Sparse CSV: Place Name + Google Maps Link (+ optional extras) */
const NAME_ALIASES = [
  'name',
  'place_name',
  'placename',
  'place name',
  'landmark',
  'landmark_name',
  'title',
  'place',
  'اسم',
  'الاسم',
  'اسم_المعلم',
  'اسم المعلم',
];

const LINK_ALIASES = [
  'link',
  'url',
  'maps_url',
  'map_url',
  'google_maps_link',
  'google_maps_url',
  'google maps link',
  'google maps',
  'maps',
  'الرابط',
  'رابط',
  'رابط_الخريطة',
  'رابط الخريطة',
];

const COUNTRY_ALIASES = ['country', 'دولة', 'الدولة', 'country_name'];
const CITY_ALIASES = ['city', 'مدينة', 'المدينة', 'city_name', 'destination'];
const CATEGORY_ALIASES = ['category', 'تصنيف', 'التصنيف', 'type', 'cat'];
const TAG_ALIASES = [
  'sub_tag',
  'description',
  'وصف',
  'الوصف',
  'tag',
  'notes',
  'note',
];
const LAT_ALIASES = ['lat', 'latitude', 'خط_العرض'];
const LNG_ALIASES = ['lng', 'lon', 'longitude', 'long', 'خط_الطول'];

const COUNTRY_EN: Record<string, string> = {
  japan: 'Japan',
  korea: 'South Korea',
  china: 'China',
  canada: 'Canada',
  south_africa: 'South Africa',
  germany: 'Germany',
  spain: 'Spain',
  italy: 'Italy',
  france: 'France',
  uk: 'United Kingdom',
  usa: 'United States',
  portugal: 'Portugal',
  belgium: 'Belgium',
  netherlands: 'Netherlands',
  czech: 'Czech Republic',
  poland: 'Poland',
  austria: 'Austria',
  sweden: 'Sweden',
  russia: 'Russia',
  hungary: 'Hungary',
  switzerland: 'Switzerland',
};

const CITY_EN: Record<string, string> = {
  tokyo: 'Tokyo',
  kyoto: 'Kyoto',
  osaka: 'Osaka',
  okinawa: 'Okinawa',
  hokkaido: 'Hokkaido',
  seoul: 'Seoul',
  busan: 'Busan',
  jeju: 'Jeju',
  beijing: 'Beijing',
  shanghai: 'Shanghai',
  guangzhou: 'Guangzhou',
};

export type DestinationOption = {
  id: string;
  label: string;
  country: string;
  city: string;
};

export type PlaceCsvInsertRow = {
  name: string;
  country: string;
  city: string;
  category: string;
  sub_tag: string;
  maps_url: string | null;
  image_url: string;
  lat: number | null;
  lng: number | null;
};

type Props = {
  onImported?: () => void;
};

function mapCategory(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s) return 'l';
  if (PLACES_BANK_CATEGORIES[s]) return s;

  const labels: Record<string, string> = {
    معلم: 'l',
    landmark: 'l',
    landmarks: 'l',
    lounge: 'l',
    مطعم: 'r',
    restaurant: 'r',
    مقهى: 'c',
    كافيه: 'c',
    cafe: 'c',
    coffee: 'c',
    تسوق: 's',
    shopping: 's',
    'وجهة رئيسية': 'd',
    destination: 'd',
    تجربة: 'd',
    experience: 'd',
    فندق: 'h',
    hotel: 'h',
    'ترفيه عائلي': 'f',
    family: 'f',
    entertainment: 'f',
    طعام: 'f',
    food: 'f',
    طبيعة: 'o',
    أخرى: 'o',
    other: 'o',
    park: 'o',
  };
  return labels[s] ?? (s.length === 1 ? s : 'l');
}

function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Pull lat/lng from common Google Maps URL shapes */
export function extractLatLngFromMapsUrl(url: string): {
  lat: number | null;
  lng: number | null;
} {
  const s = url.trim();
  if (!s) return { lat: null, lng: null };

  const at = /@(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/.exec(s);
  if (at) {
    return { lat: Number(at[1]), lng: Number(at[2]) };
  }

  const bang = /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/.exec(s);
  if (bang) {
    return { lat: Number(bang[1]), lng: Number(bang[2]) };
  }

  const q = /[?&](?:q|query)=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/i.exec(s);
  if (q) {
    return { lat: Number(q[1]), lng: Number(q[2]) };
  }

  return { lat: null, lng: null };
}

function buildTripDestinationOptions(): DestinationOption[] {
  const out: DestinationOption[] = [];
  for (const country of TRIP_DESTINATIONS) {
    const countryEn = COUNTRY_EN[country.id] ?? country.labelAr;
    for (const city of country.cities) {
      const cityEn = CITY_EN[city.id] ?? city.labelAr;
      out.push({
        id: `trip:${country.id}:${city.id}`,
        label: `${city.labelAr} · ${country.labelAr}`,
        country: countryEn,
        city: cityEn,
      });
    }
  }
  return out;
}

export function mapCsvRowsToPlaces(
  objects: Record<string, string>[],
  destination: Pick<DestinationOption, 'country' | 'city'>,
): { rows: PlaceCsvInsertRow[]; errors: string[] } {
  const rows: PlaceCsvInsertRow[] = [];
  const errors: string[] = [];

  objects.forEach((obj, index) => {
    const name = pickField(obj, NAME_ALIASES);
    const mapsUrl = pickField(obj, LINK_ALIASES);
    const line = index + 2;

    if (!name) {
      errors.push(`صف ${line}: اسم المعلم ناقص (Place Name).`);
      return;
    }

    const csvCountry = pickField(obj, COUNTRY_ALIASES);
    const csvCity = pickField(obj, CITY_ALIASES);
    const country = csvCountry || destination.country;
    const city = csvCity || destination.city;

    const fromUrl = extractLatLngFromMapsUrl(mapsUrl);
    const lat =
      parseOptionalNumber(pickField(obj, LAT_ALIASES)) ?? fromUrl.lat;
    const lng =
      parseOptionalNumber(pickField(obj, LNG_ALIASES)) ?? fromUrl.lng;

    const description =
      pickField(obj, TAG_ALIASES).trim() || FALLBACK_DESCRIPTION;

    rows.push({
      name,
      country,
      city,
      category: mapCategory(pickField(obj, CATEGORY_ALIASES)),
      sub_tag: description,
      maps_url: mapsUrl || null,
      image_url: FALLBACK_IMAGE,
      lat,
      lng,
    });
  });

  return { rows, errors };
}

function buildInsertPayload(
  row: PlaceCsvInsertRow,
  mode: 'full' | 'maps' | 'core',
): Record<string, unknown> {
  const core: Record<string, unknown> = {
    name: row.name,
    country: row.country,
    city: row.city,
    category: row.category || 'l',
    sub_tag: row.sub_tag || FALLBACK_DESCRIPTION,
  };

  if (mode === 'core') {
    // Preserve maps link inside sub_tag when no maps column exists
    if (row.maps_url) {
      core.sub_tag = `${core.sub_tag}\n${row.maps_url}`.trim();
    }
    return core;
  }

  if (row.lat != null) core.lat = row.lat;
  if (row.lng != null) core.lng = row.lng;

  if (mode === 'maps' || mode === 'full') {
    if (row.maps_url) {
      core.maps_url = row.maps_url;
      core.google_maps_url = row.maps_url;
      core.map_url = row.maps_url;
    }
  }

  if (mode === 'full') {
    core.image_url = row.image_url || FALLBACK_IMAGE;
  }

  return core;
}

function isMissingColumnError(message: string): boolean {
  return /column|schema cache|does not exist|could not find/i.test(message);
}

const SAMPLE_CSV = `Place Name,Google Maps Link
Seongsan Ilchulbong,https://maps.app.goo.gl/example1
Hallasan National Park,https://www.google.com/maps/place/Hallasan/@33.3617,126.5292
Dongmun Market,https://maps.google.com/?q=Dongmun+Market+Jeju
`;

export default function PlacesCsvUploader({ onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [destinations, setDestinations] = useState<DestinationOption[]>(() =>
    buildTripDestinationOptions(),
  );
  const [destLoading, setDestLoading] = useState(false);
  const [selectedDestinationId, setSelectedDestinationId] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<PlaceCsvInsertRow[]>([]);
  const [allRows, setAllRows] = useState<PlaceCsvInsertRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const selectedDestination = useMemo(
    () => destinations.find((d) => d.id === selectedDestinationId) ?? null,
    [destinations, selectedDestinationId],
  );

  const loadDestinations = useCallback(async () => {
    if (!supabase) {
      setDestinations(buildTripDestinationOptions());
      return;
    }

    setDestLoading(true);
    try {
      const tripOpts = buildTripDestinationOptions();
      const byKey = new Map<string, DestinationOption>();

      for (const opt of tripOpts) {
        byKey.set(`${opt.country}||${opt.city}`.toLowerCase(), opt);
      }

      const guide = await supabase
        .from('destinations_guide')
        .select('id, country_name, city_name')
        .order('country_name', { ascending: true })
        .limit(500);

      if (!guide.error && guide.data?.length) {
        for (const row of guide.data) {
          const country = String(row.country_name ?? '').trim();
          const city = String(row.city_name ?? '').trim();
          if (!country || !city) continue;
          const key = `${country}||${city}`.toLowerCase();
          if (byKey.has(key)) continue;
          byKey.set(key, {
            id: `guide:${String(row.id)}`,
            label: `${city} · ${country}`,
            country,
            city,
          });
        }
      }

      // Distinct city/country already in places bank
      const places = await supabase
        .from('places')
        .select('country, city')
        .order('country')
        .limit(2000);

      if (!places.error && places.data?.length) {
        for (const row of places.data) {
          const country = String(row.country ?? '').trim();
          const city = String(row.city ?? '').trim();
          if (!country || !city) continue;
          const key = `${country}||${city}`.toLowerCase();
          if (byKey.has(key)) continue;
          byKey.set(key, {
            id: `place:${country}:${city}`,
            label: `${city} · ${country}`,
            country,
            city,
          });
        }
      }

      const merged = [...byKey.values()].sort((a, b) =>
        a.label.localeCompare(b.label, 'ar'),
      );
      setDestinations(merged.length ? merged : tripOpts);
    } catch (err) {
      console.warn('[PlacesCsvUploader] destinations load:', err);
      setDestinations(buildTripDestinationOptions());
    } finally {
      setDestLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void loadDestinations();
  }, [open, loadDestinations]);

  function resetFileState() {
    setFileName(null);
    setPreview([]);
    setAllRows([]);
    setParseErrors([]);
    if (inputRef.current) inputRef.current.value = '';
  }

  function close() {
    if (importing) return;
    setOpen(false);
    setSelectedDestinationId('');
    resetFileState();
  }

  function downloadTemplate() {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'places-sparse-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function reparseWithDestination(
    objects: Record<string, string>[],
    dest: DestinationOption,
  ) {
    const { rows: mapped, errors } = mapCsvRowsToPlaces(objects, dest);
    setAllRows(mapped);
    setPreview(mapped.slice(0, 3));
    setParseErrors(errors.slice(0, 8));
    return mapped.length;
  }

  const pendingObjectsRef = useRef<Record<string, string>[] | null>(null);

  function handleDestinationChange(id: string) {
    setSelectedDestinationId(id);
    const dest = destinations.find((d) => d.id === id);
    if (dest && pendingObjectsRef.current?.length) {
      const n = reparseWithDestination(pendingObjectsRef.current, dest);
      if (n > 0) {
        toast.success(`تم ربط ${n} صفاً بـ ${dest.city}`);
      }
    }
  }

  function handleFile(file: File | null) {
    if (!file) return;
    if (!selectedDestination) {
      toast.error('اختر الوجهة / المدينة أولاً قبل رفع الملف.');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('الرجاء اختيار ملف CSV فقط.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '');
        const { headers, rows } = parseCsvText(text);
        if (!headers.length) {
          toast.error('الملف فارغ أو غير صالح.');
          resetFileState();
          return;
        }

        const objects = rowsToObjects(headers, rows);
        pendingObjectsRef.current = objects;
        const n = reparseWithDestination(objects, selectedDestination);
        setFileName(file.name);

        if (!n) {
          toast.error('لم يُعثر على صفوف باسم معلم صالح.');
        } else {
          toast.success(
            `تم تحليل ${n} معلماً → ${selectedDestination.city}، ${selectedDestination.country}`,
          );
        }
      } catch (err) {
        console.error('[PlacesCsvUploader] parse:', err);
        toast.error('تعذر قراءة ملف CSV.');
        resetFileState();
      }
    };
    reader.onerror = () => {
      toast.error('فشل قراءة الملف.');
      resetFileState();
    };
    reader.readAsText(file, 'UTF-8');
  }

  async function insertChunk(
    chunk: PlaceCsvInsertRow[],
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!supabase) return { ok: false, error: 'Supabase غير مهيأ.' };

    const modes: Array<'full' | 'maps' | 'core'> = ['full', 'maps', 'core'];
    let lastError = 'تعذر الإدراج.';

    for (const mode of modes) {
      const payload = chunk.map((row) => buildInsertPayload(row, mode));
      const { error } = await supabase.from('places').insert(payload);
      if (!error) return { ok: true };
      lastError = error.message || lastError;
      if (!isMissingColumnError(lastError)) {
        return { ok: false, error: lastError };
      }
      // Missing optional columns — retry with leaner payload
    }

    return { ok: false, error: lastError };
  }

  async function handleBulkInsert() {
    if (!supabase) {
      toast.error('Supabase غير مهيأ.');
      return;
    }
    if (!selectedDestination) {
      toast.error('اختر الوجهة قبل التأكيد.');
      return;
    }
    if (!allRows.length) {
      toast.error('لا توجد بيانات للاستيراد.');
      return;
    }

    setImporting(true);
    let inserted = 0;
    try {
      // Ensure destination stamped on every row (in case dropdown changed)
      const stamped = allRows.map((row) => ({
        ...row,
        country: row.country || selectedDestination.country,
        city: row.city || selectedDestination.city,
      }));

      for (let i = 0; i < stamped.length; i += CHUNK_SIZE) {
        const chunk = stamped.slice(i, i + CHUNK_SIZE);
        const result = await insertChunk(chunk);
        if (!result.ok) throw new Error(result.error);
        inserted += chunk.length;
      }

      toast.success(
        `تمت إضافة ${inserted} معلماً إلى ${selectedDestination.city} بنجاح!`,
      );
      onImported?.();
      close();
    } catch (err) {
      console.error('[PlacesCsvUploader] insert:', err);
      const msg =
        err instanceof Error ? err.message : 'حدث خطأ أثناء رفع البيانات.';
      toast.error(
        inserted > 0
          ? `أُدرج ${inserted} صفاً ثم توقف: ${msg}`
          : msg || 'حدث خطأ أثناء رفع البيانات.',
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-[#C9A84C]/50 bg-[#1C4532] px-4 py-2.5 text-xs font-black text-[#F6E7B8] shadow-sm transition hover:bg-[#163828]"
      >
        <Upload className="h-4 w-4" aria-hidden />
        استيراد CSV
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[320] flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal
          aria-labelledby="csv-upload-title"
          onClick={close}
        >
          <div
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#E8E4DC] bg-white p-5 shadow-2xl"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2
                  id="csv-upload-title"
                  className="text-lg font-black text-[#1C4532]"
                >
                  استيراد معالم ذكي (CSV)
                </h2>
                <p className="mt-1 text-[11px] font-bold text-slate-500">
                  يكفي عمودان: Place Name + Google Maps Link — الوجهة تُختار من
                  القائمة أدناه.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={importing}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                aria-label="إغلاق"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4">
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-black text-[#1C4532]">
                <MapPin className="h-3.5 w-3.5 text-[#C9A84C]" />
                الوجهة / المدينة <span className="text-rose-600">*</span>
              </label>
              <select
                value={selectedDestinationId}
                disabled={importing || destLoading}
                onChange={(e) => handleDestinationChange(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-900 outline-none focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C]/40 disabled:opacity-50"
              >
                <option value="">
                  {destLoading
                    ? 'جاري تحميل الوجهات…'
                    : 'اختر الوجهة (مثال: جزيرة جيجو)'}
                </option>
                {destinations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
              {selectedDestination ? (
                <p className="mt-1.5 text-[10px] font-bold text-emerald-700">
                  سيُعيَّن لكل الصفوف: {selectedDestination.city} ·{' '}
                  {selectedDestination.country}
                </p>
              ) : (
                <p className="mt-1.5 text-[10px] font-bold text-amber-700">
                  يجب اختيار الوجهة قبل رفع الملف.
                </p>
              )}
            </div>

            <div className="mb-4 rounded-xl border border-dashed border-[#C9A84C]/45 bg-[#FFFBF0] p-4 text-[11px] font-bold leading-relaxed text-[#5C4A1F]">
              <p className="mb-2 font-black text-[#1C4532]">
                صيغة CSV المدعومة (نادرة الحقول):
              </p>
              <p className="font-mono text-[10px] text-slate-700">
                Place Name, Google Maps Link
              </p>
              <p className="mt-2 text-slate-600">
                القيم الافتراضية عند النقص: تصنيف معلم (l) · وصف «
                {FALLBACK_DESCRIPTION}» · صورة placeholder · إحداثيات من الرابط
                إن وُجدت.
              </p>
              <button
                type="button"
                onClick={downloadTemplate}
                className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-black text-[#8B6914] underline-offset-2 hover:underline"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                تحميل قالب CSV بسيط
              </button>
            </div>

            <label
              className={`mb-4 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 transition ${
                selectedDestination
                  ? 'cursor-pointer border-slate-200 bg-slate-50 hover:border-[#C9A84C]/60 hover:bg-[#FFFBF0]/50'
                  : 'cursor-not-allowed border-slate-100 bg-slate-50/60 opacity-60'
              }`}
            >
              <Upload className="h-8 w-8 text-[#C9A84C]" />
              <span className="text-sm font-black text-[#1C4532]">
                اختر ملف CSV
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                {fileName ?? 'accept=".csv" — UTF-8'}
              </span>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                disabled={importing || !selectedDestination}
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </label>

            {parseErrors.length > 0 ? (
              <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-800">
                <p className="mb-1 font-black">تحذيرات التحليل:</p>
                <ul className="list-disc space-y-0.5 pr-4">
                  {parseErrors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {preview.length > 0 ? (
              <div className="mb-4 overflow-hidden rounded-xl border border-slate-200">
                <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
                  <p className="text-xs font-black text-slate-800">
                    معاينة أول {preview.length} صفوف
                  </p>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                    {allRows.length} جاهز · {selectedDestination?.city}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[32rem] text-right text-[11px]">
                    <thead className="bg-[#1C4532] text-[#F6E7B8]">
                      <tr>
                        <th className="px-2 py-2 font-black">الاسم</th>
                        <th className="px-2 py-2 font-black">المدينة</th>
                        <th className="px-2 py-2 font-black">الرابط</th>
                        <th className="px-2 py-2 font-black">وصف</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr
                          key={`${row.name}-${i}`}
                          className="border-t border-slate-100"
                        >
                          <td className="px-2 py-2 font-bold text-slate-900">
                            {row.name}
                          </td>
                          <td className="px-2 py-2 text-slate-600">
                            {row.city}
                          </td>
                          <td className="max-w-[10rem] truncate px-2 py-2 font-mono text-[10px] text-blue-700">
                            {row.maps_url || '—'}
                          </td>
                          <td className="max-w-[8rem] truncate px-2 py-2 text-slate-500">
                            {row.sub_tag}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={
                  importing ||
                  allRows.length === 0 ||
                  !selectedDestinationId
                }
                onClick={() => void handleBulkInsert()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#1C4532] px-4 py-3 text-sm font-black text-white transition hover:bg-[#163828] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جاري الاستيراد…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    تأكيد وإدراج {allRows.length || ''} معلم
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={importing}
                onClick={close}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
