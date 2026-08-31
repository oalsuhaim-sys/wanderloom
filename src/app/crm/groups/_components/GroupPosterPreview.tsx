'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  ImagePlus,
  Loader2,
  Upload,
  UserRound,
} from 'lucide-react';
import { toPng } from 'html-to-image';

import { getCountryAdvisorData, type SeasonKey } from '@/lib/destination-advisor-data';
import {
  fetchGroupTripLeaderOptions,
  type GroupTripLeaderOption,
} from '@/lib/group-trip-leaders';
import {
  POSTER_SEASON_OPTIONS,
  resolvePosterSeason,
  SEASON_THEMES,
} from '@/lib/group-poster-season-themes';
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
  /** Explicit season — overrides date inference when set */
  season?: SeasonKey;
  /** yyyy-mm-dd — used to infer season when `season` is omitted */
  tripStartDate?: string;
};

type PosterLeader = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

/** 4K Kyoto street — default poster canvas background */
const HIGH_RES_JAPAN_COVER =
  'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=90&w=2000&auto=format&fit=crop';

function toHighResUnsplash(url: string): string {
  if (!url.includes('images.unsplash.com')) return url;
  let next = url.includes('w=') ? url.replace(/w=\d+/, 'w=2000') : `${url}${url.includes('?') ? '&' : '?'}w=2000`;
  next = next.includes('q=') ? next.replace(/q=\d+/, 'q=90') : `${next}&q=90`;
  return next;
}

/** صور سينمائية احتياطية حسب الوجهة — للجزء العلوي من البوستر */
const CINEMATIC_FALLBACKS: Array<{ keys: string[]; url: string }> = [
  {
    keys: ['japan', 'tokyo', 'kyoto', 'osaka', 'اليابان', 'طوكيو', 'كيوتو', 'اوساكا', 'أوساكا'],
    url: HIGH_RES_JAPAN_COVER,
  },
  {
    keys: ['korea', 'seoul', 'كوريا', 'سيول'],
    url: 'https://images.unsplash.com/photo-1517154429939-022a2f2b3b0e?q=90&w=2000&auto=format&fit=crop',
  },
  {
    keys: ['france', 'paris', 'فرنسا', 'باريس'],
    url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=90&w=2000&auto=format&fit=crop',
  },
  {
    keys: ['italy', 'rome', 'milan', 'venice', 'إيطاليا', 'ايطاليا', 'روما', 'ميلان', 'فينيسيا'],
    url: 'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?q=90&w=2000&auto=format&fit=crop',
  },
  {
    keys: ['spain', 'barcelona', 'madrid', 'إسبانيا', 'اسبانيا', 'برشلونة', 'مدريد'],
    url: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?q=90&w=2000&auto=format&fit=crop',
  },
  {
    keys: ['swiss', 'switzerland', 'سويسرا', 'زيورخ', 'جنيف'],
    url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=90&w=2000&auto=format&fit=crop',
  },
  {
    keys: ['maldives', 'المالديف', 'مالدي'],
    url: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?q=90&w=2000&auto=format&fit=crop',
  },
  {
    keys: ['turkey', 'istanbul', 'تركيا', 'اسطنبول', 'إسطنبول'],
    url: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?q=90&w=2000&auto=format&fit=crop',
  },
];

/** High-res cinematic fallback — used when destination lookup or remote load fails */
const DEFAULT_COVER = HIGH_RES_JAPAN_COVER;
const DEFAULT_CINEMATIC = DEFAULT_COVER;

const PANEL_LABEL = 'mb-1.5 block text-sm font-extrabold text-slate-800';
const PANEL_INPUT =
  'w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm font-bold text-slate-900 outline-none transition focus:bg-white focus:ring-2 focus:ring-[#D4AF37]';
const PANEL_SELECT = `${PANEL_INPUT} appearance-none pe-9 [color-scheme:light]`;
const SELECT_CHEVRON_STYLE = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'left 0.75rem center',
  backgroundSize: '1rem',
} as const;

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

function resolveCinematicUrl(titleAr: string, titleEn: string | undefined, season: SeasonKey): string {
  const hay = `${titleAr} ${titleEn ?? ''}`.toLowerCase();

  for (const row of ADVISOR_MATCH) {
    if (!row.keys.some((k) => hay.includes(k.toLowerCase()))) continue;
    const seasonImage = getCountryAdvisorData(row.id).seasons[season]?.images?.[0];
    if (seasonImage) {
      return toHighResUnsplash(seasonImage);
    }
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
  season: seasonProp,
  tripStartDate = '',
}: GroupPosterPreviewProps) {
  const posterRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [isImageReady, setIsImageReady] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inferredSeason = useMemo(
    () => resolvePosterSeason(seasonProp, tripStartDate),
    [seasonProp, tripStartDate],
  );
  const [selectedSeason, setSelectedSeason] = useState<SeasonKey>(inferredSeason);

  useEffect(() => {
    setSelectedSeason(inferredSeason);
  }, [inferredSeason]);

  const currentTheme = SEASON_THEMES[selectedSeason];

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
  const groupBadgeLabel = badgeAr?.trim() || 'رحلة مجموعة';

  const selectedLeader = useMemo(
    () => leaders.find((l) => l.id === selectedLeaderId) ?? null,
    [leaders, selectedLeaderId],
  );

  const coverImage = useMemo(
    () => resolveCinematicUrl(titleAr, titleEn, selectedSeason) || DEFAULT_COVER,
    [titleAr, titleEn, selectedSeason],
  );
  const [displayCoverUrl, setDisplayCoverUrl] = useState(coverImage);

  useEffect(() => {
    setIsImageReady(false);
    setDisplayCoverUrl(coverImage || DEFAULT_COVER);
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
        backgroundColor: '#0a0a0a',
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
    <section className="space-y-4 border-t border-slate-200 pt-5" dir="rtl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#b8952d]">
            Marketing Poster
          </p>
          <h3 className="mt-1 text-sm font-black text-[#D4AF37]">مولّد البوستر التسويقي</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            غلاف سينمائي تلقائي حسب الوجهة — مع شعار الشريك ومشرف الرحلة.
          </p>
        </div>
      </div>

      <div
        className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white lg:flex-row lg:items-stretch"
        dir="ltr"
      >
        {/* Form controls — physical left, light panel */}
        <div
          className="box-border w-full max-h-[85vh] shrink-0 overflow-x-hidden overflow-y-auto border-b border-slate-200 bg-white p-6 pt-8 md:w-1/2 lg:border-b-0 lg:border-l"
          dir="rtl"
        >
          <div className="flex min-w-0 flex-col gap-4">
          <label className="block min-w-0">
            <span className={`${PANEL_LABEL} flex items-center gap-1.5`}>
              {currentTheme.emoji} موسم الرحلة
            </span>
            <select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value as SeasonKey)}
              className={PANEL_SELECT}
              style={SELECT_CHEVRON_STYLE}
            >
              {POSTER_SEASON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[10px] font-semibold text-slate-500">
              يُحدَّث تلقائياً من تاريخ البداية — يمكنك تغييره للمعاينة.
            </p>
          </label>

          <label className="block min-w-0">
            <span className={`${PANEL_LABEL} flex items-center gap-1.5`}>
              <UserRound className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
              مشرف الرحلة
            </span>
            <select
              value={selectedLeaderId}
              onChange={(e) => setSelectedLeaderId(e.target.value)}
              disabled={leadersLoading}
              className={`${PANEL_SELECT} disabled:cursor-not-allowed disabled:opacity-60`}
              style={SELECT_CHEVRON_STYLE}
            >
              <option value="">— بدون مشرف على البوستر —</option>
              {leaders.map((leader) => (
                <option key={leader.id} value={leader.id}>
                  {leader.name}
                </option>
              ))}
            </select>
            {leadersLoading ? (
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                <Loader2 className="h-3 w-3 animate-spin text-[#D4AF37]" aria-hidden />
                جاري تحميل المشرفين…
              </p>
            ) : leadersError ? (
              <p className="mt-1.5 text-[11px] font-bold text-amber-700">{leadersError}</p>
            ) : null}
          </label>

          <div className="min-w-0">
            <span className={`${PANEL_LABEL} flex items-center gap-1.5`}>
              <ImagePlus className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
              رفع شعار الشريك (اختياري)
            </span>
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
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
                    className="h-12 w-12 shrink-0 rounded-full bg-white object-contain p-1 shadow-sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-slate-800">
                      {partnerLogoName ?? 'شعار الشريك'}
                    </p>
                    <button
                      type="button"
                      onClick={clearPartnerLogo}
                      className="mt-1 text-[11px] font-bold text-rose-600 hover:text-rose-700"
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
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
                >
                  {logoUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-[#D4AF37]" aria-hidden />
                      جاري الرفع…
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 text-[#D4AF37]" aria-hidden />
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
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-base font-black shadow-md transition-all ${
              !isImageReady || downloading
                ? 'cursor-not-allowed bg-slate-200 text-slate-500'
                : 'bg-[#D4AF37] text-black hover:bg-[#b8952d]'
            }`}
          >
            {!isImageReady ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                <span>جاري تجهيز الصورة…</span>
              </>
            ) : downloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                <span>جاري التوليد…</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" aria-hidden />
                <span>تحميل البوستر التسويقي</span>
              </>
            )}
          </button>
          <p className="text-center text-[11px] font-semibold text-slate-500">
            PNG عالي الدقة · مناسب لواتساب وقصص إنستغرام
          </p>
          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800">
              {error}
            </p>
          ) : null}
          </div>
        </div>

        {/* Poster preview — physical right */}
        <div className="flex w-full shrink-0 items-center justify-center bg-slate-50 p-6 lg:w-1/2">
        <div
          id="marketing-poster-canvas"
          ref={posterRef}
          dir="rtl"
          className={`relative mx-auto flex aspect-[9/16] min-h-[600px] w-[400px] shrink-0 flex-col justify-between overflow-hidden rounded-2xl p-6 font-sans shadow-2xl ring-1 ${currentTheme.borderGlow}`}
          style={{ fontFamily: 'var(--font-tajawal), system-ui, sans-serif' }}
        >
          {/* Full-bleed background */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={`${displayCoverUrl}-${selectedSeason}`}
            src={displayCoverUrl || DEFAULT_COVER}
            crossOrigin="anonymous"
            alt="Destination Cover"
            className="absolute inset-0 z-0 h-full w-full object-cover object-center contrast-[1.05] brightness-[1.02]"
            decoding="async"
            onLoad={() => {
              setIsImageReady(true);
            }}
            onError={(e) => {
              const img = e.currentTarget;
              if (img.src !== DEFAULT_COVER && !img.src.includes('photo-1493976040374-85c8e12f0c0e')) {
                setDisplayCoverUrl(DEFAULT_COVER);
                img.src = DEFAULT_COVER;
              } else {
                setIsImageReady(true);
              }
            }}
          />

          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-1/2 bg-gradient-to-b from-black/70 via-black/30 to-transparent"
            aria-hidden
          />

          {/* Top hero — floats on full photo */}
          <div className="relative z-10 pt-2 text-center">
            <div
              dir="ltr"
              className="mb-6 flex w-full items-center justify-between"
            >
              <span
                className={`rounded-full border bg-black/40 px-3 py-1 text-xs font-bold backdrop-blur-md ${currentTheme.headerPill}`}
              >
                {currentTheme.name} {currentTheme.emoji}
              </span>

              <div className="flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-3 py-1 backdrop-blur-md">
                {partnerLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={partnerLogo}
                    alt="Partner"
                    className="h-5 w-5 rounded-full object-cover"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src="/wanderloom.png"
                    alt="Wanderloom"
                    className="h-5 w-5 rounded-full bg-white/90 object-contain p-0.5"
                  />
                )}
                <span className="text-xs font-black text-white">{groupBadgeLabel}</span>
              </div>
            </div>

            <p className="mb-1 text-xs font-black uppercase tracking-widest text-[#D4AF37] drop-shadow">
              GROUP JOURNEY
            </p>
            <h1 className="mb-2 text-2xl font-black leading-tight text-white drop-shadow-lg">
              {displayTitle}
            </h1>
            {dateRange ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-3.5 py-1 text-xs font-bold text-white backdrop-blur-md">
                <span aria-hidden>📅</span>
                <span>{dateRange}</span>
              </div>
            ) : null}
            {selectedLeader ? (
              <p className="mt-2 text-[11px] font-bold text-white/90 drop-shadow">
                بقيادة: {selectedLeader.name}
              </p>
            ) : null}
          </div>

          {/* Clean luxury dark glass — crisp typography, no text shadows */}
          <div className="relative z-10 mt-auto overflow-hidden rounded-2xl border border-white/25 bg-black/20 p-6 shadow-2xl backdrop-blur-[2px] transition-all">
            <div
              className="pointer-events-none absolute -right-3 -top-4 z-20 select-none"
              aria-hidden
            >
              <span className="inline-block rotate-12 text-4xl opacity-80">{currentTheme.emoji}</span>
            </div>

            <div
              className="pointer-events-none absolute -bottom-5 -left-4 z-20 select-none opacity-70"
              aria-hidden
            >
              <span className="inline-block -rotate-45 text-6xl">{currentTheme.emoji}</span>
            </div>

            <span
              className={`pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 select-none text-9xl opacity-[0.07] ${currentTheme.accentText}`}
              aria-hidden
            >
              {currentTheme.emoji}
            </span>

            <div className="relative z-10">
              <div className="mb-3.5 border-b border-white/15 pb-3.5 text-center">
                <span className="text-2xl font-black tracking-tight text-[#D4AF37]">
                  {priceLabel}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 pb-3">
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-amber-300">
                    يشمل
                  </p>
                  <ul className="space-y-2 text-xs font-semibold leading-relaxed text-white">
                    {includes.length === 0 ? (
                      <li className="text-slate-400">—</li>
                    ) : (
                      includes.map((item) => (
                        <li key={`inc-${item}`} className="flex items-center gap-2">
                          <span className="font-bold text-emerald-400" aria-hidden>
                            ✓
                          </span>
                          <span>{item}</span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    لا يشمل
                  </p>
                  <ul className="space-y-2">
                    {excludes.length === 0 ? (
                      <li className="text-xs font-semibold text-slate-400">—</li>
                    ) : (
                      excludes.map((item) => (
                        <li
                          key={`exc-${item}`}
                          className="flex items-center gap-2 text-xs font-semibold text-rose-400"
                        >
                          <span className="font-bold" aria-hidden>
                            ✕
                          </span>
                          <span>{item}</span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>

              <div className="border-t border-white/15 pt-2 text-center">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-300">
                  WANDERLOOM · PRIVATE JOURNEYS
                </p>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </section>
  );
}
