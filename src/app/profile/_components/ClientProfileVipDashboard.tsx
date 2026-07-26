'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  Copy,
  Crown,
  Gift,
  History,
  Images,
  Loader2,
  MapPin,
  Plane,
  Replace,
  Ticket,
  Trash2,
  Wallet,
} from 'lucide-react';

import UpcomingItineraryBridge from '@/app/itinerary/_components/UpcomingItineraryBridge';
import VipClientWalletLedger from '@/app/itinerary/_components/VipClientWalletLedger';
import type { ClientItineraryBridge } from '@/lib/client-active-itinerary';
import { groupClientMemoriesByJourney } from '@/lib/client-memories';
import type { ClientMemory, ClientProfileSummary } from '@/lib/client-profile-dashboard';
import {
  isDayOrCityLabelOnly,
  isPlaceholderLocationName,
  resolveMemoryGoogleMapsUrl,
} from '@/lib/memory-maps-url';
import { formatShortArabicDate, formatTripDateRange, googleMapsSearchUrl } from '@/lib/public-itinerary';
import { formatWalletAmount } from '@/lib/vip-wallet-ledger';

type ClientProfileVipDashboardProps = {
  client: ClientProfileSummary;
  clientTrips: ClientItineraryBridge[];
  pastTrips: ClientItineraryBridge[];
  activeTrip: ClientItineraryBridge | null;
  memories: ClientMemory[];
  activeItinerarySlug?: string;
  profileCode?: string;
  onMemoriesChange?: (memories: ClientMemory[]) => void;
};

function formatPassportExpiry(raw: string | null | undefined): string {
  if (!raw?.trim()) return 'لا يوجد';
  if (/^\d{4}-\d{2}-\d{2}/.test(raw.trim())) {
    return formatShortArabicDate(raw);
  }
  return raw.trim();
}

function tierDisplayLabel(tier: string | null | undefined): string {
  const s = String(tier ?? '').trim().toLowerCase();
  if (!s) return 'Wanderloom VIP';
  if (s.includes('black') || s.includes('أسود')) return 'Wanderloom Black';
  if (s.includes('platinum') || s.includes('بلاتين')) return 'Wanderloom Platinum';
  if (s.includes('gold') || s.includes('ذهب')) return 'Wanderloom Gold';
  if (s.includes('silver') || s.includes('فض')) return 'Wanderloom Silver';
  return `Wanderloom ${tier}`;
}

function isUpcomingTrip(
  trip: ClientItineraryBridge,
  activeId: string | null,
): boolean {
  if (activeId && trip.id === activeId) return true;
  const end = (trip.endDate ?? trip.startDate ?? '').trim();
  if (!end) return false;
  const today = new Date().toISOString().slice(0, 10);
  return end.slice(0, 10) >= today;
}

function WanderloomBlackCard({
  name,
  tier,
  upcomingDestination,
}: {
  name: string;
  tier: string | null;
  upcomingDestination: string | null;
}) {
  return (
    <div
      className="relative flex h-56 flex-col justify-between overflow-hidden rounded-2xl border border-[#C5A059]/30 bg-gradient-to-br from-gray-900 to-black p-6 text-white shadow-2xl"
      aria-label="بطاقة Wanderloom VIP"
    >
      <div
        className="pointer-events-none absolute -bottom-16 -right-10 h-40 w-40 rounded-full bg-[#C5A059]/15 blur-3xl"
        aria-hidden
      />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C5A059]/15 ring-1 ring-[#C5A059]/35">
          <Crown className="h-5 w-5 text-[#C5A059]" aria-hidden />
        </span>
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#C5A059]">
          {tierDisplayLabel(tier)}
        </p>
      </div>

      <div className="relative z-10">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
          Private Member
        </p>
        <h1 className="mt-1 text-2xl font-black leading-snug sm:text-3xl">{name}</h1>
      </div>

      <div className="relative z-10 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold text-white/45">
            {upcomingDestination ? 'الوجهة القادمة' : 'العضوية'}
          </p>
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-black text-[#C5A059]">
            {upcomingDestination ? (
              <>
                <Plane className="h-3.5 w-3.5" aria-hidden />
                {upcomingDestination}
              </>
            ) : (
              'عضو VIP'
            )}
          </p>
        </div>
        <span className="text-[10px] font-black tracking-[0.25em] text-white/30">
          WANDERLOOM
        </span>
      </div>
    </div>
  );
}

function ReferralWealthCard({
  referralCode,
  walletBalance,
  totalSpent,
  remainingBalance,
  tripsCount,
}: {
  referralCode: string | null;
  walletBalance: number;
  totalSpent: number;
  remainingBalance: number;
  tripsCount: number;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-100 bg-white/70 p-6 shadow-sm backdrop-blur-md">
      <div className="mb-5 flex items-center gap-2">
        <Gift className="h-4 w-4 text-[#C5A059]" aria-hidden />
        <h2 className="text-sm font-black text-[#1A3B2A]">كود الإحالة والمكافآت</h2>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-dashed border-[#1A3B2A]/30 bg-[#F9F9F6] px-4 py-2">
        {referralCode ? (
          <code
            className="min-w-0 flex-1 truncate font-mono text-sm font-bold tracking-wider text-[#1A3B2A]"
            dir="ltr"
          >
            {referralCode}
          </code>
        ) : (
          <p className="flex-1 text-sm font-bold text-[#1A3B2A]/50">لا يوجد كود إحالة</p>
        )}
        <button
          type="button"
          onClick={() => void handleCopy()}
          disabled={!referralCode}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#1A3B2A]/15 bg-white text-[#1A3B2A] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#C5A059]/50 hover:text-[#C5A059] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={copied ? 'تم النسخ' : 'نسخ كود الإحالة'}
        >
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
        </button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 border-t border-gray-100 pt-6 md:grid-cols-4 md:divide-x md:divide-x-reverse md:divide-gray-100">
        <div className="flex flex-col items-center justify-center space-y-2 text-center md:px-2">
          <span className="text-sm font-medium text-gray-500">رصيد المكافآت</span>
          <span
            className="text-xl font-bold text-[#C5A059] md:text-2xl"
            style={{ textShadow: '0 0 20px rgba(197, 160, 89, 0.25)' }}
            dir="ltr"
          >
            {formatWalletAmount(walletBalance)}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center space-y-2 text-center md:px-2">
          <span className="text-sm font-medium text-gray-500">إجمالي المدفوعات</span>
          <span className="text-xl font-bold text-[#1A3B2A] md:text-2xl" dir="ltr">
            {formatWalletAmount(totalSpent)}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center space-y-2 text-center md:px-2">
          <span className="text-sm font-medium text-gray-500">المبلغ المتبقي</span>
          <span
            className={`text-xl font-bold md:text-2xl ${
              remainingBalance > 0 ? 'text-rose-800/80' : 'text-[#1A3B2A]'
            }`}
            dir="ltr"
          >
            {formatWalletAmount(remainingBalance)}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center space-y-2 text-center md:px-2">
          <span className="text-sm font-medium text-gray-500">عدد الرحلات</span>
          <span className="text-xl font-bold text-[#1A3B2A] md:text-2xl">{tripsCount}</span>
        </div>
      </div>
    </section>
  );
}

function TripArchiveList({
  trips,
  activeTripId,
}: {
  trips: ClientItineraryBridge[];
  activeTripId: string | null;
}) {
  if (trips.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-[#C5A059]/25 bg-white/60 px-5 py-6 text-sm font-semibold text-gray-500">
        لا توجد رحلات مسجّلة بعد.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white/70 shadow-sm backdrop-blur-md">
      {trips.map((trip) => {
        const upcoming = isUpcomingTrip(trip, activeTripId);
        const dateRange = formatTripDateRange(
          trip.startDate,
          trip.endDate ?? trip.startDate,
        );
        const showDates = Boolean(dateRange && dateRange !== 'التواريخ قريباً');

        return (
          <div
            key={trip.id}
            className="group flex items-center justify-between gap-4 border-b border-gray-100 p-4 transition-all duration-300 last:border-0 hover:-translate-y-0.5 hover:bg-[#F9F9F6]"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <GoogleMapsPinLink
                href={googleMapsSearchUrl(trip.destination || trip.title)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1A3B2A]/5 text-[#C5A059] ring-1 ring-[#1A3B2A]/10 hover:bg-[#1A3B2A]/10"
                iconClassName="h-4 w-4"
              />
              <Link href={trip.viewUrl} className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-[#1A3B2A]">{trip.destination}</p>
                {trip.title && trip.title !== trip.destination ? (
                  <p className="mt-0.5 truncate text-xs font-semibold text-gray-500">{trip.title}</p>
                ) : null}
                {showDates ? (
                  <p className="mt-0.5 text-[11px] font-bold text-gray-400" dir="ltr">
                    {dateRange}
                  </p>
                ) : null}
              </Link>
            </div>
            <Link
              href={trip.viewUrl}
              className="flex shrink-0 items-center gap-2"
              aria-label={`فتح مسار ${trip.destination}`}
            >
              <span
                className={`rounded-full px-3 py-1 text-sm font-bold ${
                  upcoming
                    ? 'bg-[#C5A059]/15 text-[#8A6B2A]'
                    : 'bg-[#1A3B2A]/10 text-[#1A3B2A]'
                }`}
              >
                {upcoming ? 'قادمة' : 'مكتملة'}
              </span>
              <ChevronLeft
                className="h-4 w-4 text-gray-300 transition group-hover:text-[#C5A059]"
                aria-hidden
              />
            </Link>
          </div>
        );
      })}
    </div>
  );
}

function memoryPlaceLabel(memory: ClientMemory): string {
  const cityHint = memory.city?.trim() || memory.destination?.trim() || '';
  const candidates = [
    memory.stationName,
    memory.locationName,
    memory.title,
    memory.caption,
    memory.location,
  ];
  for (const candidate of candidates) {
    const text = candidate?.trim();
    if (
      text &&
      !isPlaceholderLocationName(text) &&
      !isDayOrCityLabelOnly(text, cityHint)
    ) {
      return text;
    }
  }
  return 'مكان غير محدد';
}

function memoryCityLabel(memory: ClientMemory): string {
  const place = memoryPlaceLabel(memory);
  const candidates = [memory.city, memory.destination];
  for (const candidate of candidates) {
    const text = candidate?.trim();
    if (
      text &&
      text !== place &&
      !isPlaceholderLocationName(text) &&
      !isDayOrCityLabelOnly(text)
    ) {
      return text;
    }
  }
  return '';
}

function memoryDateLabel(memory: ClientMemory): string {
  const raw = memory.memoryDate?.trim();
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return /^\d{4}-\d{2}-\d{2}/.test(raw) ? formatShortArabicDate(raw) : raw;
  }
  return parsed.toLocaleDateString('ar-SA');
}

/** Real DB map link, else Google search for exact place + city (never city-only). */
function memoryMapsUrl(
  memory: ClientMemory,
  placeName: string,
  cityName: string,
): string | null {
  return resolveMemoryGoogleMapsUrl(memory, null, {
    placeName,
    cityName,
    allowSearchFallback: true,
  });
}

function GoogleMapsPinLink({
  href,
  className = '',
  iconClassName = 'h-4 w-4',
}: {
  href: string | null | undefined;
  className?: string;
  iconClassName?: string;
}) {
  const url = String(href ?? '').trim();
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`z-10 inline-flex cursor-pointer items-center justify-center transition-all duration-200 hover:scale-110 hover:text-[#C5A059] ${className || 'text-gray-400'}`}
      title="عرض المكان على الخريطة"
      aria-label="عرض المكان على الخريطة"
    >
      <MapPin className={iconClassName} aria-hidden />
    </a>
  );
}

function hideBrokenMemoryCard(img: HTMLImageElement) {
  const card = img.closest('.memory-card-wrapper');
  if (card instanceof HTMLElement) card.style.display = 'none';
}

function AlbumPhotoCard({
  memory,
  profileCode,
  onDeleted,
  onReplaced,
}: {
  memory: ClientMemory;
  profileCode?: string;
  onDeleted?: (memoryId: string) => void;
  onReplaced?: (memoryId: string, imageUrl: string) => void;
}) {
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState<'delete' | 'replace' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (hidden || !memory.imageUrl) return null;

  const placeName = memoryPlaceLabel(memory);
  const cityName = memoryCityLabel(memory);
  const dateLabel = memoryDateLabel(memory);
  const exactMapUrl = memoryMapsUrl(memory, placeName, cityName);
  const canManage = Boolean(profileCode?.trim());

  async function handleDelete() {
    if (!profileCode || busy) return;
    if (!window.confirm('حذف هذه الصورة من الألبوم؟')) return;
    setBusy('delete');
    try {
      const res = await fetch(
        `/api/portal/memories?code=${encodeURIComponent(profileCode)}&id=${encodeURIComponent(memory.id)}`,
        { method: 'DELETE' },
      );
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        window.alert(data.error || 'تعذر حذف الصورة');
        return;
      }
      onDeleted?.(memory.id);
      setHidden(true);
    } catch {
      window.alert('تعذر الاتصال بالخادم');
    } finally {
      setBusy(null);
    }
  }

  async function handleReplaceFile(file: File | null) {
    if (!profileCode || !file || busy) return;
    setBusy('replace');
    try {
      const form = new FormData();
      form.append('code', profileCode);
      form.append('id', memory.id);
      form.append('file', file);
      const res = await fetch('/api/portal/memories', { method: 'POST', body: form });
      const data = (await res.json()) as { ok?: boolean; imageUrl?: string; error?: string };
      if (!res.ok || !data.ok || !data.imageUrl) {
        window.alert(data.error || 'تعذر استبدال الصورة');
        return;
      }
      onReplaced?.(memory.id, data.imageUrl);
    } catch {
      window.alert('تعذر الاتصال بالخادم');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="memory-card-wrapper group relative aspect-square overflow-hidden rounded-xl shadow-md ring-1 ring-[#C5A059]/15">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={memory.imageUrl}
        alt={place}
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        onError={(e) => {
          setHidden(true);
          hideBrokenMemoryCard(e.currentTarget);
        }}
      />
      {canManage ? (
        <div className="pointer-events-auto absolute left-2 top-2 z-20 flex gap-1.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
          <button
            type="button"
            disabled={busy != null}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-[#1A3B2A] disabled:opacity-50"
            title="استبدال الصورة"
            aria-label="استبدال الصورة"
          >
            {busy === 'replace' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Replace className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
          <button
            type="button"
            disabled={busy != null}
            onClick={() => void handleDelete()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-red-600 disabled:opacity-50"
            title="حذف الصورة"
            aria-label="حذف الصورة"
          >
            {busy === 'delete' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              e.target.value = '';
              void handleReplaceFile(file);
            }}
          />
        </div>
      ) : null}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/20 to-transparent p-3">
        {/* PRIMARY TEXT & MAP PIN */}
        <div className="pointer-events-auto flex items-center gap-2">
          <span className="truncate text-lg font-bold text-white drop-shadow-md md:text-xl">
            {placeName}
          </span>
          <GoogleMapsPinLink
            href={exactMapUrl}
            className="inline-flex items-center justify-center text-white/70 hover:text-[#C5A059]"
            iconClassName="h-5 w-5 drop-shadow-md"
          />
        </div>
        {/* SECONDARY TEXT: City and Date */}
        <div className="mt-1 flex items-center justify-between text-xs font-medium text-gray-200">
          <span className="max-w-[50%] truncate">{cityName}</span>
          <span>{dateLabel}</span>
        </div>
      </div>
    </div>
  );
}

function TripAlbumCover({
  title,
  subtitle,
  coverUrl,
  photoCount,
  onOpen,
}: {
  title: string;
  subtitle: string | null;
  coverUrl: string | null;
  photoCount: number;
  onOpen: () => void;
}) {
  const [coverBroken, setCoverBroken] = useState(false);
  const showCover = Boolean(coverUrl) && !coverBroken;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="memory-card-wrapper group relative aspect-square w-full overflow-hidden rounded-xl bg-[#1A3B2A]/5 text-right shadow-md ring-1 ring-[#C5A059]/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
      aria-label={`فتح ألبوم ${title}`}
    >
      {showCover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl!}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={() => setCoverBroken(true)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#1A3B2A] to-[#0f2419]">
          <Images className="h-8 w-8 text-[#C5A059]/60" aria-hidden />
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-3 text-white">
        <p className="truncate text-sm font-black leading-snug md:text-base">{title}</p>
        {subtitle ? (
          <p className="mt-0.5 truncate text-[10px] font-semibold text-white/70" dir="ltr">
            {subtitle}
          </p>
        ) : null}
        <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm">
          <Images className="h-3 w-3 text-[#C5A059]" aria-hidden />
          {photoCount} {photoCount === 1 ? 'صورة' : 'صور'}
        </p>
      </div>
    </button>
  );
}

function MemoriesAlbumsSection({
  memories,
  trips,
  profileCode,
  onMemoriesChange,
}: {
  memories: ClientMemory[];
  trips: ClientItineraryBridge[];
  profileCode?: string;
  onMemoriesChange?: (memories: ClientMemory[]) => void;
}) {
  const [selectedTripAlbum, setSelectedTripAlbum] = useState<string | null>(null);
  const [localMemories, setLocalMemories] = useState(memories);

  useEffect(() => {
    setLocalMemories(memories);
  }, [memories]);

  const albums = useMemo(
    () => groupClientMemoriesByJourney(localMemories, trips),
    [localMemories, trips],
  );

  const selectedAlbum = useMemo(
    () => albums.find((album) => album.key === selectedTripAlbum) ?? null,
    [albums, selectedTripAlbum],
  );

  function commitMemories(next: ClientMemory[]) {
    setLocalMemories(next);
    onMemoriesChange?.(next);
  }

  if (albums.length === 0) return null;

  if (selectedAlbum) {
    return (
      <section aria-labelledby="client-memories-title">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSelectedTripAlbum(null)}
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-[#1A3B2A] shadow-sm transition hover:border-[#C5A059]/40 hover:text-[#C5A059]"
          >
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            العودة للألبومات
          </button>
          <div className="text-left sm:text-right">
            <h2
              id="client-memories-title"
              className="text-lg font-black text-[#1A3B2A]"
            >
              {selectedAlbum.title}
            </h2>
            {selectedAlbum.subtitle ? (
              <p className="mt-0.5 text-xs font-semibold text-gray-400" dir="ltr">
                {selectedAlbum.subtitle}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 space-y-8">
          {selectedAlbum.locationGroups.map((cityGroup) => (
            <div key={cityGroup.key}>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-[#1A3B2A]">
                <GoogleMapsPinLink
                  href={
                    cityGroup.title === 'مدينة غير محددة'
                      ? ''
                      : googleMapsSearchUrl(cityGroup.title)
                  }
                  className="text-[#C5A059]"
                  iconClassName="h-4 w-4"
                />
                {cityGroup.title}
                <span className="rounded-full bg-[#1A3B2A]/8 px-2 py-0.5 text-[10px] font-bold text-[#1A3B2A]/70">
                  {cityGroup.memories.length}
                </span>
              </h3>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {cityGroup.memories.map((memory) => (
                  <AlbumPhotoCard
                    key={memory.id}
                    memory={memory}
                    profileCode={profileCode}
                    onDeleted={(id) => {
                      commitMemories(localMemories.filter((m) => m.id !== id));
                    }}
                    onReplaced={(id, imageUrl) => {
                      commitMemories(
                        localMemories.map((m) =>
                          m.id === id ? { ...m, imageUrl } : m,
                        ),
                      );
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="client-memories-title">
      <h2
        id="client-memories-title"
        className="mb-4 flex items-center gap-2 text-lg font-black text-[#1A3B2A]"
      >
        <Images className="h-5 w-5 text-[#C5A059]" aria-hidden />
        ذكريات الرحلة
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {albums.map((album) => {
          const coverUrl =
            album.memories.find((m) => Boolean(m.imageUrl))?.imageUrl ?? null;
          return (
            <TripAlbumCover
              key={album.key}
              title={album.title}
              subtitle={album.subtitle}
              coverUrl={coverUrl}
              photoCount={album.memories.length}
              onOpen={() => setSelectedTripAlbum(album.key)}
            />
          );
        })}
      </div>
    </section>
  );
}

export default function ClientProfileVipDashboard({
  client,
  clientTrips,
  pastTrips,
  activeTrip,
  memories,
  activeItinerarySlug,
  profileCode,
  onMemoriesChange,
}: ClientProfileVipDashboardProps) {
  const isSameItineraryPage =
    Boolean(activeItinerarySlug) &&
    Boolean(activeTrip?.slug) &&
    activeTrip!.slug === activeItinerarySlug;

  const totalTrips = Math.max(client.tripsCount || 0, clientTrips.length);
  const totalSpent = Math.max(0, Number(client.totalSpent) || 0);
  const remainingBalance = Math.max(0, Number(client.remainingBalance) || 0);
  const walletBalance = client.walletBalance ?? 0;
  const archiveTrips = pastTrips.length > 0 ? pastTrips : clientTrips;
  const referralCode = client.referralCode?.trim() || null;
  const tripsForAlbums = useMemo(() => {
    const byId = new Map<string, ClientItineraryBridge>();
    for (const trip of [...clientTrips, ...pastTrips]) {
      if (trip?.id) byId.set(String(trip.id), trip);
    }
    if (activeTrip?.id) byId.set(String(activeTrip.id), activeTrip);
    return [...byId.values()];
  }, [clientTrips, pastTrips, activeTrip]);

  return (
    <div
      className="min-h-screen bg-[#F9F9F6] p-4 md:p-8"
      aria-label="لوحة الكونسيرج VIP"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left column — Black Card + quick actions */}
        <aside className="space-y-6 lg:col-span-1">
          <WanderloomBlackCard
            name={client.name}
            tier={client.vipTier}
            upcomingDestination={activeTrip?.destination ?? null}
          />

          <div className="rounded-2xl border border-gray-100 bg-white/70 p-5 shadow-sm backdrop-blur-md">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#C5A059]">
              تفاصيل العضوية
            </p>
            <p className="mt-3 text-xs font-semibold text-gray-500">
              انتهاء الجواز:{' '}
              <span className="font-bold text-[#1A3B2A]">
                {formatPassportExpiry(client.passportExpiry)}
              </span>
            </p>
            {activeTrip && !isSameItineraryPage ? (
              <Link
                href={activeTrip.viewUrl}
                className="group mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1A3B2A] px-5 py-3 text-sm font-black text-[#C5A059] shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
              >
                <Ticket className="h-4 w-4" aria-hidden />
                الذهاب إلى مسار {activeTrip.destination}
                <ChevronLeft className="h-4 w-4 opacity-70" aria-hidden />
              </Link>
            ) : null}
          </div>

          {activeTrip ? (
            <UpcomingItineraryBridge
              trip={activeTrip}
              variant="light"
              isSameItineraryPage={isSameItineraryPage}
            />
          ) : null}
        </aside>

        {/* Right column — wealth, archive, memories */}
        <div className="space-y-8 lg:col-span-2">
          <ReferralWealthCard
            referralCode={referralCode}
            walletBalance={walletBalance}
            totalSpent={totalSpent}
            remainingBalance={remainingBalance}
            tripsCount={totalTrips}
          />

          <section aria-labelledby="past-trips-title">
            <h2
              id="past-trips-title"
              className="mb-4 flex items-center gap-2 text-lg font-black text-[#1A3B2A]"
            >
              <History className="h-5 w-5 text-[#C5A059]" aria-hidden />
              أرشيف الرحلات
            </h2>
            <TripArchiveList
              trips={archiveTrips}
              activeTripId={activeTrip?.id ?? null}
            />
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white/70 p-5 shadow-sm backdrop-blur-md">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-black text-[#1A3B2A]">
              <Wallet className="h-4 w-4 text-[#C5A059]" aria-hidden />
              سجل المحفظة
            </h2>
            <VipClientWalletLedger clientId={client.id} />
          </section>

          {memories && memories.length > 0 ? (
            <MemoriesAlbumsSection
              memories={memories}
              trips={tripsForAlbums}
              profileCode={profileCode}
              onMemoriesChange={onMemoriesChange}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
