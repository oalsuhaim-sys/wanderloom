'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Download,
  ImagePlus,
  Loader2,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import { toPng } from 'html-to-image';

import { getCountryAdvisorData } from '@/lib/destination-advisor-data';
import {
  fetchGroupTripLeaderOptions,
  type GroupTripLeaderOption,
} from '@/lib/group-trip-leaders';
import { uploadMarketingFile } from '@/lib/marketing-files';
import { supabase } from '@/lib/supabase';
import type { TripCountryId } from '@/lib/trip-destination-data';

export type GroupPosterPreviewProps = {
  titleAr: string;
  titleEn?: string;
  badgeAr?: string;
  datesAr?: string;
  price: string;
  includesAr: string;
  excludesAr: string;
  /** Prefill poster supervisor from the trip form leader */
  defaultLeaderId?: string;
};

type PosterLeader = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

/** صور سينمائية احتياطية حسب الوجهة — للجزء العلوي من البوستر */
const CINEMATIC_FALLBACKS: Array<{ keys: string[]; url: string }> = [
  {
    keys: ['japan', 'tokyo', 'kyoto', 'osaka', 'اليابان', 'طوكيو', 'كيوتو', 'اوساكا', 'أوساكا'],
    url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop',
  },
  {
    keys: ['korea', 'seoul', 'كوريا', 'سيول'],
    url: 'https://images.unsplash.com/photo-1517154429939-022a2f2b3b0e?q=80&w=1200&auto=format&fit=crop',
  },
  {
    keys: ['france', 'paris', 'فرنسا', 'باريس'],
    url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=1200&auto=format&fit=crop',
  },
  {
    keys: ['italy', 'rome', 'milan', 'venice', 'إيطاليا', 'ايطاليا', 'روما', 'ميلان', 'فينيسيا'],
    url: 'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?q=80&w=1200&auto=format&fit=crop',
  },
  {
    keys: ['spain', 'barcelona', 'madrid', 'إسبانيا', 'اسبانيا', 'برشلونة', 'مدريد'],
    url: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?q=80&w=1200&auto=format&fit=crop',
  },
  {
    keys: ['swiss', 'switzerland', 'سويسرا', 'زيورخ', 'جنيف'],
    url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=1200&auto=format&fit=crop',
  },
  {
    keys: ['maldives', 'المالديف', 'مالدي'],
    url: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?q=80&w=1200&auto=format&fit=crop',
  },
  {
    keys: ['turkey', 'istanbul', 'تركيا', 'اسطنبول', 'إسطنبول'],
    url: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?q=80&w=1200&auto=format&fit=crop',
  },
];

const DEFAULT_CINEMATIC =
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=1200&auto=format&fit=crop';

const ADVISOR_MATCH: Array<{ id: TripCountryId; keys: string[] }> = [
  { id: 'japan', keys: ['japan', 'tokyo', 'kyoto', 'اليابان', 'طوكيو', 'كيوتو'] },
  { id: 'korea', keys: ['korea', 'seoul', 'كوريا', 'سيول'] },
  { id: 'france', keys: ['france', 'paris', 'فرنسا', 'باريس'] },
  { id: 'china', keys: ['china', 'beijing', 'shanghai', 'الصين', 'بكين', 'شنغهاي'] },
];

function parseArList(value: string): string[] {
  return value
    ? value
        .split(/،|,/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
}

function formatPosterPrice(raw: string): string {
  const cleaned = raw.trim();
  if (!cleaned) return 'السعر قريباً';
  const digits = cleaned.replace(/[^\d.]/g, '');
  const n = Number(digits);
  if (Number.isFinite(n) && n > 0) {
    return `السعر ${n.toLocaleString('en-US')} ر.س`;
  }
  return cleaned.includes('ر') || /sar/i.test(cleaned) ? cleaned : `السعر ${cleaned}`;
}

function slugifyTripName(title: string): string {
  const base = title.trim().replace(/\s+/g, '-').replace(/[^\w\u0600-\u06FF-]+/g, '');
  return base.slice(0, 48) || 'Group-Trip';
}

function resolveCinematicUrl(titleAr: string, titleEn?: string): string {
  const hay = `${titleAr} ${titleEn ?? ''}`.toLowerCase();

  for (const row of ADVISOR_MATCH) {
    if (!row.keys.some((k) => hay.includes(k.toLowerCase()))) continue;
    const autumn = getCountryAdvisorData(row.id).seasons.autumn?.images?.[0];
    if (autumn) return autumn.includes('w=') ? autumn.replace(/w=\d+/, 'w=1200') : autumn;
  }

  for (const row of CINEMATIC_FALLBACKS) {
    if (row.keys.some((k) => hay.includes(k.toLowerCase()))) return row.url;
  }

  return DEFAULT_CINEMATIC;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('تعذر قراءة الملف'));
    reader.readAsDataURL(file);
  });
}

function pickAvatarUrl(raw: Record<string, unknown>): string | null {
  for (const key of ['avatar_url', 'photo_url', 'image_url', 'profile_image']) {
    const value = raw[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

/**
 * Live marketing poster — DOM → PNG via html-to-image (toPng).
 */
export default function GroupPosterPreview({
  titleAr,
  titleEn,
  badgeAr,
  datesAr,
  price,
  includesAr,
  excludesAr,
  defaultLeaderId = '',
}: GroupPosterPreviewProps) {
  const posterRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [isImageReady, setIsImageReady] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [leaders, setLeaders] = useState<PosterLeader[]>([]);
  const [leadersLoading, setLeadersLoading] = useState(true);
  const [leadersError, setLeadersError] = useState<string | null>(null);
  const [selectedLeaderId, setSelectedLeaderId] = useState(defaultLeaderId);

  const [partnerLogo, setPartnerLogo] = useState<string | null>(null);
  const [partnerLogoName, setPartnerLogoName] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  const includes = useMemo(() => parseArList(includesAr).slice(0, 6), [includesAr]);
  const excludes = useMemo(() => parseArList(excludesAr).slice(0, 4), [excludesAr]);
  const displayTitle = titleAr.trim() || titleEn?.trim() || 'رحلة قروب Wanderloom';
  const priceLabel = formatPosterPrice(price);
  const dateRange = datesAr?.trim() || '';

  const selectedLeader = useMemo(
    () => leaders.find((l) => l.id === selectedLeaderId) ?? null,
    [leaders, selectedLeaderId],
  );

  const coverImage = useMemo(
    () => resolveCinematicUrl(titleAr, titleEn),
    [titleAr, titleEn],
  );

  useEffect(() => {
    setIsImageReady(false);
    setError(null);
  }, [coverImage]);

  useEffect(() => {
    if (defaultLeaderId) setSelectedLeaderId(defaultLeaderId);
  }, [defaultLeaderId]);

  useEffect(() => {
    let cancelled = false;

    async function loadLeaders() {
      setLeadersLoading(true);
      setLeadersError(null);

      if (!supabase) {
        if (!cancelled) {
          setLeaders([]);
          setLeadersError('Supabase غير مهيأ.');
          setLeadersLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from('leaders')
        .select('id, name')
        .eq('status', 'active')
        .order('name', { ascending: true });

      if (!cancelled && !error && data?.length) {
        const rows = (data as Record<string, unknown>[])
          .map((row) => {
            const id = row.id != null ? String(row.id) : '';
            const name = String(row.name ?? '').trim();
            if (!id || !name) return null;
            return { id, name, avatarUrl: pickAvatarUrl(row) } satisfies PosterLeader;
          })
          .filter((row): row is PosterLeader => row != null);
        setLeaders(rows);
        setLeadersLoading(false);
        return;
      }

      const { options, error: fetchErr } = await fetchGroupTripLeaderOptions(supabase);
      if (cancelled) return;

      if (fetchErr) {
        setLeaders([]);
        setLeadersError(fetchErr);
      } else {
        setLeaders(
          options.map(
            (o: GroupTripLeaderOption): PosterLeader => ({
              id: o.id,
              name: o.name,
              avatarUrl: null,
            }),
          ),
        );
      }
      setLeadersLoading(false);
    }

    void loadLeaders();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePartnerLogoChange = useCallback(async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('يرجى اختيار ملف صورة (PNG / JPG / WebP).');
      return;
    }

    setLogoUploading(true);
    setError(null);
    try {
      // Data URL keeps html-to-image CORS-safe for the PNG export.
      const dataUrl = await readFileAsDataUrl(file);
      if (!dataUrl) throw new Error('تعذر قراءة الشعار');
      setPartnerLogo(dataUrl);
      setPartnerLogoName(file.name);

      // Best-effort cloud backup (preview already uses the data URL).
      const uploaded = await uploadMarketingFile(file);
      if (!uploaded.ok) {
        console.warn('[GroupPosterPreview] partner logo upload skipped:', uploaded.error);
      }
    } catch (err) {
      console.error('[GroupPosterPreview] partner logo', err);
      setError(err instanceof Error ? err.message : 'تعذر رفع شعار الشريك.');
    } finally {
      setLogoUploading(false);
    }
  }, []);

  const clearPartnerLogo = useCallback(() => {
    setPartnerLogo(null);
    setPartnerLogoName(null);
    if (logoInputRef.current) logoInputRef.current.value = '';
  }, []);

  const handleDownload = useCallback(async () => {
    if (!posterRef.current) return;
    if (!isImageReady) {
      setError('انتظر اكتمال تحميل الصورة ثم أعد المحاولة.');
      return;
    }

    setDownloading(true);
    setError(null);
    try {
      const dataUrl = await toPng(posterRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#F9F9F6',
        includeQueryParams: true,
      });

      const link = document.createElement('a');
      link.download = `Wanderloom-Trip-${slugifyTripName(displayTitle)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('[GroupPosterPreview] toPng failed', err);
      setError('حدث خطأ أثناء تحميل البوستر.');
    } finally {
      setDownloading(false);
    }
  }, [displayTitle, isImageReady]);

  return (
    <section className="space-y-4 border-t border-gray-800 pt-5" dir="rtl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#C5A059]">
            Marketing Poster
          </p>
          <h3 className="mt-1 text-sm font-black text-[#d4af37]">مولّد البوستر التسويقي</h3>
          <p className="mt-1 text-xs font-semibold text-gray-500">
            غلاف سينمائي تلقائي حسب الوجهة — مع شعار الشريك ومشرف الرحلة.
          </p>
        </div>
      </div>

      <div
        className="flex flex-col items-stretch gap-5 lg:flex-row lg:items-start lg:justify-center"
        dir="ltr"
      >
        {/* Form controls — physical left */}
        <div className="flex w-full max-w-sm shrink-0 flex-col gap-4 lg:pt-2" dir="rtl">
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black text-[#C5A059]">
              <UserRound className="h-3.5 w-3.5" aria-hidden />
              مشرف الرحلة
            </span>
            <select
              value={selectedLeaderId}
              onChange={(e) => setSelectedLeaderId(e.target.value)}
              disabled={leadersLoading}
              className="w-full appearance-none rounded-xl border border-white/10 bg-[#12261B] px-3 py-2.5 pe-9 text-sm font-bold text-white outline-none transition focus:border-[#C5A059]/50 disabled:opacity-60"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23C5A059' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'left 0.75rem center',
                backgroundSize: '1rem',
              }}
            >
              <option value="">— بدون مشرف على البوستر —</option>
              {leaders.map((leader) => (
                <option key={leader.id} value={leader.id}>
                  {leader.name}
                </option>
              ))}
            </select>
            {leadersLoading ? (
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-bold text-gray-500">
                <Loader2 className="h-3 w-3 animate-spin text-[#C5A059]" aria-hidden />
                جاري تحميل المشرفين…
              </p>
            ) : leadersError ? (
              <p className="mt-1.5 text-[11px] font-bold text-amber-400/90">{leadersError}</p>
            ) : null}
          </label>

          <div>
            <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black text-[#C5A059]">
              <ImagePlus className="h-3.5 w-3.5" aria-hidden />
              رفع شعار الشريك (اختياري)
            </span>
            <div className="rounded-xl border border-dashed border-white/15 bg-[#12261B] p-3">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  void handlePartnerLogoChange(file);
                }}
              />
              {partnerLogo ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={partnerLogo}
                    alt="شعار الشريك"
                    className="h-12 w-12 rounded-full bg-white object-contain p-1 shadow-sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white">
                      {partnerLogoName ?? 'شعار الشريك'}
                    </p>
                    <button
                      type="button"
                      onClick={clearPartnerLogo}
                      className="mt-1 text-[11px] font-bold text-rose-400 hover:text-rose-300"
                    >
                      إزالة الشعار
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white/5 px-3 py-3 text-xs font-bold text-gray-300 transition hover:bg-white/10 hover:text-white disabled:opacity-60"
                >
                  {logoUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-[#C5A059]" aria-hidden />
                      جاري الرفع…
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 text-[#C5A059]" aria-hidden />
                      اختر صورة الشعار
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={!isImageReady || downloading}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-black shadow-md transition ${
              !isImageReady || downloading
                ? 'cursor-not-allowed bg-gray-600 text-gray-300'
                : 'bg-[#1A3B2A] text-white hover:bg-[#12261B]'
            }`}
          >
            {!isImageReady ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-[#C5A059]" aria-hidden />
                <span>جاري تجهيز الصورة…</span>
              </>
            ) : downloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-[#C5A059]" aria-hidden />
                <span>جاري التوليد…</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4 text-[#C5A059]" aria-hidden />
                <span>تحميل البوستر التسويقي</span>
              </>
            )}
          </button>
          <p className="text-center text-[11px] font-semibold text-gray-500">
            PNG عالي الدقة · مناسب لواتساب وقصص إنستغرام
          </p>
          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800">
              {error}
            </p>
          ) : null}
        </div>

        {/* Poster preview — physical right */}
        <div
          id="poster-node"
          ref={posterRef}
          dir="rtl"
          className="relative mx-auto flex h-[500px] w-[400px] shrink-0 flex-col overflow-hidden rounded-2xl bg-[#F9F9F6] text-[#1A3B2A] shadow-2xl ring-1 ring-[#C5A059]/25"
          style={{ fontFamily: 'var(--font-tajawal), system-ui, sans-serif' }}
        >
          <div className="relative flex h-1/2 w-full flex-col justify-end overflow-hidden p-6 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={coverImage}
              src={coverImage}
              crossOrigin="anonymous"
              alt="Destination Background"
              className="absolute inset-0 z-0 h-full w-full object-cover"
              decoding="async"
              onLoad={() => {
                setIsImageReady(true);
                setError(null);
              }}
              onError={() => {
                setIsImageReady(true);
                setError('تعذر تحميل صورة الغلاف.');
              }}
            />

            <div
              className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-[#1A3B2A] via-[#1A3B2A]/55 to-black/25"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-[#F9F9F6] to-transparent"
              aria-hidden
            />

            {/* Partner logo — physical top-left, opposite Wanderloom */}
            {partnerLogo ? (
              <div className="absolute left-4 top-4 z-20 h-12 w-12 rounded-full bg-white p-1 shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={partnerLogo}
                  alt="Partner"
                  className="h-full w-full rounded-full object-contain"
                />
              </div>
            ) : null}

            <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
              {badgeAr?.trim() ? (
                <span className="rounded-full bg-[#C5A059]/95 px-3 py-1 text-[10px] font-black text-[#1A3B2A] shadow-sm">
                  {badgeAr.trim()}
                </span>
              ) : null}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/wanderloom.png"
                alt="Wanderloom"
                className="h-9 w-9 rounded-full bg-white/90 object-contain p-0.5 shadow-md"
              />
            </div>

            <div className="relative z-20 pb-2">
              <span className="mb-2 block text-sm font-bold uppercase tracking-[0.28em] text-[#C5A059] drop-shadow">
                Group Journey
              </span>
              <h1 className="text-3xl font-extrabold leading-tight text-white drop-shadow-lg md:text-[2.05rem]">
                {displayTitle}
              </h1>
              {dateRange ? (
                <p className="mt-3 text-base font-medium text-white/90 drop-shadow">{dateRange}</p>
              ) : null}
              {selectedLeader ? (
                <div className="mx-auto mt-3 flex w-fit items-center gap-2 rounded-full bg-black/30 px-3 py-1 text-white backdrop-blur-sm">
                  {selectedLeader.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedLeader.avatarUrl}
                      alt=""
                      className="h-5 w-5 rounded-full object-cover"
                    />
                  ) : null}
                  <span className="text-sm font-bold">بقيادة: {selectedLeader.name}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="relative z-20 flex h-1/2 flex-col bg-[#F9F9F6] px-5 pb-4 pt-3">
            <p className="text-center text-xl font-black text-[#C5A059]">{priceLabel}</p>

            <div className="mt-3 grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-hidden">
              <div className="min-h-0 overflow-hidden">
                <p className="mb-1.5 text-[11px] font-black text-[#1A3B2A]">يشمل</p>
                <ul className="space-y-1">
                  {includes.length === 0 ? (
                    <li className="text-[10px] font-semibold text-gray-400">—</li>
                  ) : (
                    includes.map((item) => (
                      <li
                        key={`inc-${item}`}
                        className="flex items-start gap-1.5 text-[10px] font-bold leading-snug text-[#1A3B2A]"
                      >
                        <Check
                          className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600"
                          strokeWidth={3}
                          aria-hidden
                        />
                        <span className="line-clamp-2">{item}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div className="min-h-0 overflow-hidden">
                <p className="mb-1.5 text-[11px] font-black text-gray-500">لا يشمل</p>
                <ul className="space-y-1">
                  {excludes.length === 0 ? (
                    <li className="text-[10px] font-semibold text-gray-400">—</li>
                  ) : (
                    excludes.map((item) => (
                      <li
                        key={`exc-${item}`}
                        className="flex items-start gap-1.5 text-[10px] font-semibold leading-snug text-gray-500"
                      >
                        <X
                          className="mt-0.5 h-3 w-3 shrink-0 text-rose-500/80"
                          strokeWidth={3}
                          aria-hidden
                        />
                        <span className="line-clamp-2">{item}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>

            <p className="mt-2 text-center text-[9px] font-bold tracking-[0.18em] text-[#1A3B2A]/45">
              WANDERLOOM · PRIVATE JOURNEYS
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
