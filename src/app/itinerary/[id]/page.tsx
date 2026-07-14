'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AlertCircle, Loader2, Map, RefreshCw, User } from 'lucide-react';

import VipButlerFab from '../_components/VipButlerFab';
import VipLuxuryBookingVoucherPrint from '../_components/VipLuxuryBookingVoucherPrint';
import VipClientBoardingPass from '../_components/VipClientBoardingPass';
import VipClientBookingsTab from '../_components/VipClientBookingsTab';
import VipClientFashionTab from '../_components/VipClientFashionTab';
import VipClientPackingTab from '../_components/VipClientPackingTab';
import VipClientTabNav, { type VipClientTab } from '../_components/VipClientTabNav';
import ClientProfilePinModal from '../_components/ClientProfilePinModal';
import ItineraryReferralShareCard from '../_components/ItineraryReferralShareCard';
import TripFinishedNotice from '../_components/TripFinishedNotice';
import VipMedicalConciergeBanner, {
  filterNonMedicalPreTripServices,
} from '../_components/VipMedicalConciergeBanner';
import VipDailyItineraryTimeline from '../_components/VipDailyItineraryTimeline';
import PostTripDashboard from '../_components/PostTripDashboard';
import VipPreTripServicesCard from '../_components/VipPreTripServicesCard';
import VipVaultCountdown from '../_components/VipVaultCountdown';
import VipLiveWeatherWidget from '../_components/VipLiveWeatherWidget';
import VipPwaInstallButton from '../_components/VipPwaInstallButton';
import VipItineraryPinGate from '../_components/VipItineraryPinGate';
import ClientPortalSignOutButton from '../_components/ClientPortalSignOutButton';
import { useVipSessionIdleLock } from '@/lib/use-vip-session-idle-lock';
import {
  buildTripMatchContext,
  filterWardrobeForTrip,
  type WardrobeMatchRow,
} from '@/lib/travel-wardrobe-trip';

import {
  clearItineraryUnlock,
  clearWanderloomAccessKey,
  hasItineraryUnlock,
  hydrateTripFromOfflineCache,
  loadWanderloomAccessKey,
  passcodeMatchesAccessKey,
  persistItineraryCache,
  persistItineraryUnlock,
  persistWanderloomAccessKey,
  registerItineraryServiceWorker,
  warmItineraryOfflineAssets,
} from '@/lib/itinerary-offline-cache';
import {
  coerceAdminSummaryString,
  formatTripDateRange,
  normalizePublicItinerary,
  parseDaysDataFromRow,
  parseVipSummaries,
  toPublicItinerary,
  type PublicItinerary,
} from '@/lib/public-itinerary';
import { isTripFinished } from '@/lib/client-portal-trip-phase';
import {
  hasClientProfileUnlock,
  persistClientProfileUnlock,
} from '@/lib/client-profile-unlock';
import { isVipClientItineraryUnlocked } from '@/lib/vip-vault-reveal';
import { supabase } from '@/lib/supabase/universal';

/** جلب آمن — بدون أعمدة قد لا تكون في المخطط (مثل start_date) */
const ITINERARY_FETCH_SELECT = '*';

const MAPBOX_CSS_CDN = 'https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css';
const WATERMARK_TEXT = 'WANDERLOOM CONFIDENTIAL';
const WATERMARK_TILES = 48;

function getSupabase(): SupabaseClient {
  return supabase;
}

function resolveRouteSlug(raw: string | string[] | undefined): string {
  const id = Array.isArray(raw) ? raw[0] : raw;
  return String(id ?? '').trim();
}

function buildPublicTripFromRow(row: Record<string, unknown>): PublicItinerary {
  const normalizedRow = normalizeFetchedItineraryRow(row);
  const baseTrip = toPublicItinerary(normalizedRow);
  const rowSummaries = parseVipSummaries(normalizedRow);

  return normalizePublicItinerary({
    ...baseTrip,
    vipSummaries: rowSummaries,
    weather_summary:
      coerceAdminSummaryString(normalizedRow.weather_summary) ?? rowSummaries.weather,
    packing_summary:
      coerceAdminSummaryString(normalizedRow.packing_summary) ?? rowSummaries.packing,
    budget_summary:
      coerceAdminSummaryString(normalizedRow.budget_summary) ?? rowSummaries.budget,
    flight_summary:
      coerceAdminSummaryString(normalizedRow.flight_summary) ?? rowSummaries.flight,
  });
}

async function enrichTripWithClientPublicFields(
  supabase: SupabaseClient,
  trip: PublicItinerary,
): Promise<PublicItinerary> {
  let resolvedClientId = trip.clientId;

  if (
    (resolvedClientId == null || String(resolvedClientId).trim() === '') &&
    trip.id != null
  ) {
    const { data: row } = await supabase
      .from('itineraries')
      .select('client_id')
      .eq('id', trip.id)
      .maybeSingle();

    if (row?.client_id != null) {
      resolvedClientId = row.client_id as string | number;
    }
  }

  if (resolvedClientId == null || String(resolvedClientId).trim() === '') {
    return normalizePublicItinerary({ ...trip, referralCode: trip.referralCode ?? null });
  }

  const { data } = await supabase
    .from('clients')
    .select('referral_code, ref_code')
    .eq('id', resolvedClientId)
    .maybeSingle();

  const referral =
    String(data?.referral_code ?? data?.ref_code ?? trip.referralCode ?? '').trim() || null;

  return normalizePublicItinerary({ ...trip, clientId: resolvedClientId, referralCode: referral });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function passcodeFromRow(row: Record<string, unknown>): string | null {
  const raw = row.passcode;
  if (raw == null) return null;
  const s = String(raw).trim();
  return s ? s.toUpperCase() : null;
}

function parseJsonArrayField(raw: unknown, label: string): unknown[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) return parsed;
      console.error(`[vip-itinerary] ${label}: parsed JSON is not an array`, parsed);
      return [];
    } catch (e) {
      console.error(`[vip-itinerary] Failed to parse ${label} string`, e);
      return [];
    }
  }
  return [];
}

function parseJsonObjectField(raw: unknown, label: string): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      console.error(`[vip-itinerary] ${label}: parsed JSON is not an object`, parsed);
      return null;
    } catch (e) {
      console.error(`[vip-itinerary] Failed to parse ${label} string`, e);
      return null;
    }
  }
  return null;
}

function normalizeFetchedItineraryRow(row: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...row };

  const daysSource = row.days_data ?? row.days;
  const { days: envelopeDays } = parseDaysDataFromRow(daysSource);
  let parsedDays =
    envelopeDays.length > 0
      ? envelopeDays
      : (parseJsonArrayField(daysSource, 'days_data') as Array<Record<string, unknown>>);

  parsedDays = parsedDays.map((day, index) => {
    if (!day || typeof day !== 'object') return day;
    const d = { ...(day as Record<string, unknown>) };
    const stops = parseJsonArrayField(d.stops ?? d.itinerary_stops, `day[${index}].stops`);
    d.stops = stops;
    d.itinerary_stops = stops;
    if (d.alternative_hotels != null) {
      d.alternative_hotels = parseJsonArrayField(d.alternative_hotels, `day[${index}].alternative_hotels`);
    }
    return d;
  });

  next.days_data = parsedDays;
  next.days = parsedDays;

  if (next.highlights != null) {
    const highlights = parseJsonArrayField(next.highlights, 'highlights');
    if (highlights.length > 0 || typeof next.highlights === 'string') {
      next.highlights = highlights;
    }
  }
  if (typeof next.hotel_details === 'string') {
    next.hotel_details = parseJsonArrayField(next.hotel_details, 'hotel_details');
  }
  if (typeof next.experiences_details === 'string') {
    next.experiences_details = parseJsonArrayField(next.experiences_details, 'experiences_details');
  }
  if (typeof next.flight_details === 'string') {
    const flight = parseJsonObjectField(next.flight_details, 'flight_details');
    if (flight) next.flight_details = flight;
  }
  if (typeof next.budget_options === 'string') {
    const budget = parseJsonObjectField(next.budget_options, 'budget_options');
    if (budget) next.budget_options = budget;
  }

  return next;
}

function errorMessageFromUnknown(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const msg = (err as { message?: unknown }).message;
    if (msg != null && String(msg).trim()) return String(msg);
  }
  return String(err);
}

function applyOfflineTripCache(
  slug: string,
  cached: PublicItinerary,
  setters: {
    setTrip: (trip: PublicItinerary) => void;
    setPasscode: (code: string | null) => void;
    setAuthenticated: (value: boolean) => void;
    setFetchError: (value: string) => void;
  },
): boolean {
  if (cached.hasPin && !hasItineraryUnlock(slug)) {
    setters.setFetchError('لا يوجد اتصال. اتصل بالإنترنت وأدخل رمز الوصول لمسارك.');
    setters.setPasscode(null);
    setters.setAuthenticated(false);
    return false;
  }

  setters.setTrip(cached);
  setters.setPasscode(null);
  setters.setAuthenticated(!cached.hasPin || hasItineraryUnlock(slug));
  setters.setFetchError('');
  return true;
}

async function fetchItineraryBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<{ row: Record<string, unknown> | null; error: string | null }> {
  // معرّفات اصطناعية قديمة (client-… / vip-…) تكسر مطابقة uuid — ننزع البادئة قبل الاستعلام
  const trimmed = slug.trim().replace(/^(client-|vip-)/i, '');
  if (!trimmed) return { row: null, error: null };

  const query = () => supabase.from('itineraries').select(ITINERARY_FETCH_SELECT);

  if (/^\d+$/.test(trimmed)) {
    const res = await query().eq('id', Number(trimmed)).maybeSingle();
    if (res.error) return { row: null, error: res.error.message };
    if (res.data) return { row: res.data as Record<string, unknown>, error: null };
  }

  if (UUID_RE.test(trimmed)) {
    const res = await query().eq('magic_link_id', trimmed).maybeSingle();
    if (res.error) return { row: null, error: res.error.message };
    if (res.data) return { row: res.data as Record<string, unknown>, error: null };
  } else {
    // نص غير uuid — نجرب magic_link_id ثم id مع تجاهل أخطاء صيغة uuid/الأرقام
    const byMagic = await query().eq('magic_link_id', trimmed).maybeSingle();
    if (byMagic.data) return { row: byMagic.data as Record<string, unknown>, error: null };
    if (byMagic.error && !/invalid input syntax/i.test(byMagic.error.message)) {
      return { row: null, error: byMagic.error.message };
    }

    const byId = await query().eq('id', trimmed).maybeSingle();
    if (byId.data) return { row: byId.data as Record<string, unknown>, error: null };
    if (byId.error && !/invalid input syntax/i.test(byId.error.message)) {
      return { row: null, error: byId.error.message };
    }
  }

  return { row: null, error: null };
}

function ConfidentialWatermark() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
      aria-hidden
    >
      <div className="absolute left-1/2 top-1/2 flex w-[220vmax] -translate-x-1/2 -translate-y-1/2 -rotate-45 flex-wrap items-center justify-center gap-x-16 gap-y-12">
        {Array.from({ length: WATERMARK_TILES }, (_, i) => (
          <span
            key={i}
            className="whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.35em] text-[#1E2720]/[0.04] sm:text-xs"
          >
            {WATERMARK_TEXT}
          </span>
        ))}
      </div>
    </div>
  );
}

function VipErrorPanel({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-5 px-6 text-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full border border-[#D4AF37]/35 bg-[#2A362C]/60 shadow-[0_0_20px_rgba(212,175,55,0.15)]"
        aria-hidden
      >
        <AlertCircle className="h-7 w-7 text-[#D4AF37]" />
      </div>
      <div className="w-full rounded-2xl border border-[#D4AF37]/25 bg-[#2A362C]/50 px-6 py-5 text-start backdrop-blur-md">
        <p className="text-sm font-semibold leading-relaxed text-white/90">
          تعذر تحميل المسار. التفاصيل التقنية:
        </p>
        <p className="mt-2 break-words font-mono text-xs leading-relaxed text-[#D4AF37]/90">{message}</p>
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/45 bg-[#D4AF37]/10 px-5 py-2.5 text-sm font-bold text-[#D4AF37] transition hover:bg-[#D4AF37]/20"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          إعادة المحاولة
        </button>
      ) : null}
    </div>
  );
}

function Shell({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      dir="rtl"
      className={`relative min-h-screen overflow-x-hidden bg-[#FDFBF7] font-[family-name:var(--font-tajawal),system-ui,sans-serif] text-gray-900 ${className}`}
    >
      <link href={MAPBOX_CSS_CDN} rel="stylesheet" />
      <ConfidentialWatermark />
      {children}
    </div>
  );
}

const WARDROBE_PLACEHOLDER =
  'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1200&auto=format&fit=crop';

function VipGoldHangerIcon({
  active = false,
  className = 'h-[18px] w-[18px] shrink-0',
}: {
  active?: boolean;
  className?: string;
}) {
  const stroke = active ? '#D4AF37' : 'currentColor';
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M12 2.75v2.1M12 2.75c-1.15 0-2.08.93-2.08 2.08 0 .62.27 1.18.71 1.56"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M12 2.75c1.15 0 2.08.93 2.08 2.08 0 .62-.27 1.18-.71 1.56"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M4.25 11.25c0-3.58 3.47-5.75 7.75-5.75s7.75 2.17 7.75 5.75"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M3.5 11.25h17"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M5.25 11.25v1.75h13.5v-1.75"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function filterWardrobeForDestination(
  rows: WardrobeMatchRow[],
  trip: PublicItinerary,
): WardrobeMatchRow[] {
  const destination = String(trip.destination ?? '').trim();
  if (!destination) return [];

  const ctx = buildTripMatchContext({
    title: `${trip.title} ${destination}`,
    dates:
      trip.startDate && trip.endDate
        ? `${trip.startDate} → ${trip.endDate}`
        : trip.startDate ?? '',
    days: (trip.days ?? []).map((d) => ({
      title: d.title,
      notes: d.cityLabel,
    })),
  });

  const matched = filterWardrobeForTrip(rows, ctx);
  if (matched.length > 0) return matched;

  const needle = destination.toLowerCase();
  return rows.filter((row) => {
    const tags = [
      ...(Array.isArray(row.destinations) ? row.destinations : []),
      ...(Array.isArray(row.destination_tags) ? row.destination_tags : []),
    ].map((t) => String(t).toLowerCase());

    return tags.some(
      (tag) =>
        tag.includes(needle) ||
        needle.includes(tag) ||
        needle.split(/[\s،,]+/).some((part) => part.length > 2 && tag.includes(part)),
    );
  });
}

type PortalActiveTab = 'itinerary' | 'wardrobe';

type ClientViewProps = {
  itinerary: PublicItinerary;
  dateRange: string | null;
  isUnlocked: boolean;
  activeTab: PortalActiveTab;
  setActiveTab: (tab: PortalActiveTab) => void;
  wardrobeItems: Record<string, unknown>[];
  clientSectionTab: VipClientTab;
  onClientSectionTabChange: (tab: VipClientTab) => void;
  hasLinkedClient: boolean;
  profilePortalActive: boolean;
  profileUnlocked: boolean;
  onRequestProfilePin: () => void;
  onCloseProfilePortal: () => void;
  currentItinerarySlug?: string;
};

/** واجهة العميل VIP — هيكل لوحة التحكم الثابت (بوردينق · طقس · تبويبات · محتوى) */
function ClientView({
  itinerary,
  dateRange,
  isUnlocked,
  activeTab,
  setActiveTab,
  wardrobeItems,
  clientSectionTab,
  onClientSectionTabChange,
  hasLinkedClient,
  profilePortalActive,
  profileUnlocked,
  onRequestProfilePin,
  onCloseProfilePortal,
  currentItinerarySlug,
}: ClientViewProps) {
  const safeDays = itinerary?.days ?? [];
  const totalActivities = safeDays.reduce((n, d) => n + (d?.activities?.length ?? 0), 0);
  const salonServices = filterNonMedicalPreTripServices(itinerary?.preTripServices ?? []);
  const destination = itinerary?.destination ?? '';
  const showFashion = itinerary?.showFashionServices === true;
  const tripFinished = isTripFinished(itinerary?.endDate);

  if (itinerary?.id == null || String(itinerary.id).trim() === '') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-6 text-center text-sm font-semibold text-gray-600">
        لم يتم العثور على المسار.
      </div>
    );
  }

  if (profilePortalActive && profileUnlocked) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] text-gray-900">
        <div className="mx-auto max-w-lg px-4 pt-4 sm:max-w-xl">
          <button
            type="button"
            onClick={onCloseProfilePortal}
            className="mb-4 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 shadow-sm transition hover:border-[#D4AF37]/40"
          >
            العودة للمسار
          </button>
        </div>
        <main className="relative z-10 mx-auto max-w-lg p-4 pb-28 font-[family-name:var(--font-tajawal),system-ui,sans-serif] sm:max-w-xl sm:px-6 sm:pb-32">
          <PostTripDashboard
            trip={itinerary}
            dateRange={dateRange}
            currentItinerarySlug={currentItinerarySlug}
            onReturnToItinerary={onCloseProfilePortal}
          />
        </main>
      </div>
    );
  }

  if (tripFinished) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] text-gray-900">
        <div className="mx-auto flex max-w-lg justify-center px-4 pt-3 sm:max-w-xl">
          <VipPwaInstallButton />
        </div>
        <main className="relative z-10 mx-auto max-w-lg space-y-4 p-4 pb-28 font-[family-name:var(--font-tajawal),system-ui,sans-serif] sm:max-w-xl sm:px-6 sm:pb-32">
          <TripFinishedNotice
            destination={destination}
            customerName={itinerary.customerName}
            showProfileButton={hasLinkedClient}
            onOpenProfile={onRequestProfilePin}
          />
          {itinerary.referralCode ? (
            <ItineraryReferralShareCard referralCode={itinerary.referralCode} />
          ) : null}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-gray-900">
      <VipClientBoardingPass trip={itinerary} dateRange={dateRange} />

      <div className="mx-auto flex max-w-lg justify-center px-4 pt-3 sm:max-w-xl">
        <VipPwaInstallButton />
      </div>

      <div className="mx-auto max-w-lg px-4 pt-4 sm:max-w-xl">
        {itinerary?.isMedical ? (
          <VipMedicalConciergeBanner services={itinerary?.preTripServices ?? []} />
        ) : null}
        {itinerary.referralCode ? (
          <ItineraryReferralShareCard referralCode={itinerary.referralCode} />
        ) : null}
      </div>

      <div className="border-b border-gray-200 bg-[#FDFBF7]">
        <div className="my-8 flex justify-center gap-4 px-4">
          <button
            type="button"
            onClick={() => setActiveTab('itinerary')}
            className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 font-bold transition-all ${
              activeTab === 'itinerary'
                ? 'bg-[#1E2720] text-white shadow-md ring-2 ring-[#D4AF37]/50'
                : 'border border-gray-200 bg-white text-gray-600 shadow-sm hover:ring-[#D4AF37]/40'
            }`}
          >
            <Map
              className={`h-4 w-4 shrink-0 ${activeTab === 'itinerary' ? 'text-[#D4AF37]' : 'text-gray-400'}`}
              strokeWidth={2}
              aria-hidden
            />
            مسار الرحلة
          </button>
          {showFashion ? (
          <button
            type="button"
            onClick={() => setActiveTab('wardrobe')}
            className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 font-bold transition-all ${
              activeTab === 'wardrobe'
                ? 'bg-[#1E2720] text-white shadow-md ring-2 ring-[#D4AF37]/50'
                : 'border border-gray-200 bg-white text-gray-600 shadow-sm hover:ring-[#D4AF37]/40'
            }`}
          >
            <VipGoldHangerIcon active={activeTab === 'wardrobe'} />
            أزياء السفر
          </button>
          ) : null}
        </div>
      </div>

      {activeTab === 'itinerary' ? (
        <VipClientTabNav activeTab={clientSectionTab} onTabChange={onClientSectionTabChange} />
      ) : null}

      {activeTab === 'itinerary' && clientSectionTab === 'itinerary' ? (
        <div className="relative z-10 mx-auto mb-4 max-w-lg px-4 sm:max-w-xl">
          <VipLiveWeatherWidget
            destination={destination}
            fallback={itinerary?.weather}
          />
        </div>
      ) : null}

      <main
        className={`relative z-10 mx-auto p-4 pb-28 font-[family-name:var(--font-tajawal),system-ui,sans-serif] sm:px-6 sm:pb-32 ${
          activeTab === 'wardrobe' ? 'max-w-6xl' : 'max-w-lg sm:max-w-xl'
        }`}
      >
        {activeTab === 'wardrobe' ? (
          <VipClientFashionTab itinerary={itinerary} wardrobeItems={wardrobeItems} />
        ) : null}

        {activeTab === 'itinerary' && clientSectionTab === 'itinerary' ? (
          !isUnlocked ? (
            <div className="locked-vault-card">
              <VipVaultCountdown
                startDate={itinerary.startDate}
                destination={itinerary.destination}
              />
            </div>
          ) : (
            <div className="daily-timeline">
              <header className="mb-5 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#D4AF37]">
                  برنامجك اليومي
                </p>
                <h2 className="mt-1 text-lg font-black tracking-wide text-gray-900 sm:text-xl">
                  مسار الأماكن المختارة
                </h2>
                {safeDays.length > 0 ? (
                  <p className="mt-1 text-xs font-semibold text-gray-600">
                    {safeDays.length} يوم
                    {totalActivities > 0 ? ` · ${totalActivities} محطة` : ''}
                  </p>
                ) : null}
              </header>
              {showFashion ? (
                <VipPreTripServicesCard services={salonServices} />
              ) : null}
              {safeDays.length > 0 ? (
                <VipDailyItineraryTimeline
                  days={safeDays}
                  destination={destination}
                  tripWeather={itinerary?.weather}
                  itineraryId={itinerary.id}
                  clientId={itinerary.clientId}
                />
              ) : (
                <p className="rounded-2xl border border-[#D4AF37]/30 bg-white py-12 text-center text-sm text-gray-600 shadow-sm">
                  لا توجد أيام مُنسّقة بعد في هذا المسار.
                </p>
              )}
            </div>
          )
        ) : null}

        {activeTab === 'itinerary' && clientSectionTab === 'bookings' ? (
          <VipClientBookingsTab
            trip={itinerary}
            dateRange={dateRange}
            scheduleLocked={!isUnlocked}
          />
        ) : null}

        {activeTab === 'itinerary' && clientSectionTab === 'packing' ? (
          <VipClientPackingTab trip={itinerary} profileUnlocked={profileUnlocked} />
        ) : null}
      </main>
    </div>
  );
}

export default function VipItineraryPage() {
  const params = useParams<{ id: string | string[] }>();
  const slug = resolveRouteSlug(params?.id);

  const [trip, setTrip] = useState<PublicItinerary | null>(null);
  const [passcode, setPasscode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const [authenticated, setAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinExiting, setPinExiting] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  const [activeTab, setActiveTab] = useState<PortalActiveTab>('itinerary');
  const [wardrobeItems, setWardrobeItems] = useState<Record<string, unknown>[]>([]);
  const [clientSectionTab, setClientSectionTab] = useState<VipClientTab>('itinerary');
  const [sessionExpired, setSessionExpired] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileUnlocked, setProfileUnlocked] = useState(false);
  const [profilePortalActive, setProfilePortalActive] = useState(false);

  const { sessionLocked, resetSessionLock } = useVipSessionIdleLock(
    authenticated && !!trip?.hasPin,
  );

  useEffect(() => {
    if (!sessionLocked) return;
    setSessionExpired(true);
    setAuthenticated(false);
    clearItineraryUnlock(slug);
    setPinInput('');
    setPinError('');
  }, [sessionLocked, slug]);

  useEffect(() => {
    if (!authenticated || !trip || !trip.showFashionServices) {
      if (!trip?.showFashionServices) setWardrobeItems([]);
      return;
    }

    const fetchWardrobe = async () => {
      const supabase = getSupabase();
      if (!supabase) return;

      const destination = String(trip.destination ?? '').trim();
      if (!destination) {
        setWardrobeItems([]);
        return;
      }

      const { data, error } = await supabase.from('travel_wardrobe').select('*');
      if (error || !data) {
        setWardrobeItems([]);
        return;
      }

      const filtered = filterWardrobeForDestination(data as WardrobeMatchRow[], trip);
      setWardrobeItems(filtered as Record<string, unknown>[]);
    };

    void fetchWardrobe();
  }, [authenticated, trip]);

  useEffect(() => {
    if (trip?.clientId != null && String(trip.clientId).trim() !== '') {
      setProfileUnlocked(hasClientProfileUnlock(trip.clientId));
    } else {
      setProfileUnlocked(false);
      setProfilePortalActive(false);
    }
  }, [trip?.clientId]);

  useEffect(() => {
    if (trip && !trip.showFashionServices && activeTab === 'wardrobe') {
      setActiveTab('itinerary');
    }
  }, [trip, activeTab]);

  const loadTrip = useCallback(async () => {
    setLoading(true);
    setFetchError('');

    try {
      if (!slug) {
        setFetchError('معرّف الرحلة غير صالح.');
        setTrip(null);
        setPasscode(null);
        return;
      }

      const supabase = getSupabase();
      if (!supabase) {
        const cached = hydrateTripFromOfflineCache(slug);
        if (cached) {
          const applied = applyOfflineTripCache(slug, cached, {
            setTrip,
            setPasscode,
            setAuthenticated,
            setFetchError,
          });
          if (applied) return;
        }
        setFetchError(
          'Supabase غير مهيأ. تحقق من NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY وأعد تشغيل السيرفر.',
        );
        setTrip(null);
        setPasscode(null);
        return;
      }

      const { row, error } = await fetchItineraryBySlug(supabase, slug);

      if (error) {
        const cached = hydrateTripFromOfflineCache(slug);
        if (cached) {
          const applied = applyOfflineTripCache(slug, cached, {
            setTrip,
            setPasscode,
            setAuthenticated,
            setFetchError,
          });
          if (applied) return;
        }
        setFetchError(error);
        setTrip(null);
        setPasscode(null);
        return;
      }

      if (!row) {
        const cached = hydrateTripFromOfflineCache(slug);
        if (cached) {
          const applied = applyOfflineTripCache(slug, cached, {
            setTrip,
            setPasscode,
            setAuthenticated,
            setFetchError,
          });
          if (applied) return;
        }
        clearWanderloomAccessKey();
        clearItineraryUnlock(slug);
        setFetchError('لم يتم العثور على المسار. تحقق من الرابط أو تواصل مع الكونسيرج.');
        setTrip(null);
        setPasscode(null);
        return;
      }

      const parsed = await enrichTripWithClientPublicFields(
        supabase,
        buildPublicTripFromRow(row),
      );
      const tripWithClient =
        parsed.clientId == null && row.client_id != null
          ? normalizePublicItinerary({
              ...parsed,
              clientId: row.client_id as string | number,
            })
          : parsed;
      const code = passcodeFromRow(normalizeFetchedItineraryRow(row));

      setTrip(tripWithClient);
      setPasscode(code);

      const needsPin = parsed.hasPin && !!code;
      const savedKey = typeof window !== 'undefined' ? loadWanderloomAccessKey() : null;
      const unlocked =
        !needsPin ||
        hasItineraryUnlock(slug) ||
        (!!code && passcodeMatchesAccessKey(code, savedKey ?? undefined));
      setAuthenticated(unlocked);

      if (unlocked && savedKey && code && passcodeMatchesAccessKey(code, savedKey)) {
        setPinInput(savedKey);
        persistWanderloomAccessKey(savedKey);
      }

      if (!needsPin || unlocked) {
        persistItineraryUnlock(slug);
        persistItineraryCache(slug, tripWithClient);
      }
    } catch (err) {
      console.error('[vip-itinerary] load failed', err);
      const cached = hydrateTripFromOfflineCache(slug);
      if (cached) {
        const applied = applyOfflineTripCache(slug, cached, {
          setTrip,
          setPasscode,
          setAuthenticated,
          setFetchError,
        });
        if (applied) return;
      }
      setFetchError(
        errorMessageFromUnknown(err) ||
          'تعذر قراءة بيانات المسار. قد يكون البرنامج ناقصاً — تواصل مع الكونسيرج أو أعد المحاولة.',
      );
      setTrip(null);
      setPasscode(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadTrip();
  }, [loadTrip]);

  useEffect(() => {
    if (!trip) return;
    void registerItineraryServiceWorker();
    void warmItineraryOfflineAssets(slug);
    persistItineraryCache(slug, trip);
  }, [trip, slug]);

  const isUnlocked = useMemo(() => {
    if (!trip) return true;
    return isVipClientItineraryUnlocked(trip.startDate, trip.bypass_24h_lock === true);
  }, [trip]);

  useEffect(() => {
    if (loading || authenticated || !passcode) return;
    const savedKey = loadWanderloomAccessKey();
    if (!savedKey) return;
    setPinInput(savedKey);
    if (passcodeMatchesAccessKey(passcode, savedKey)) {
      persistItineraryUnlock(slug);
      persistWanderloomAccessKey(savedKey);
      if (trip) persistItineraryCache(slug, trip);
      setAuthenticated(true);
    }
  }, [loading, authenticated, passcode, slug, trip]);

  const handlePinSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!passcode) return;
    const entered = (pinInput || '').trim().toUpperCase();
    if (entered === (passcode || '').trim().toUpperCase()) {
      setPinError('');
      setSessionExpired(false);
      resetSessionLock();
      setUnlocking(true);
      setPinExiting(true);
      persistWanderloomAccessKey(entered);
      persistItineraryUnlock(slug);
      if (trip) persistItineraryCache(slug, trip);
      window.setTimeout(() => {
        setAuthenticated(true);
        setUnlocking(false);
        setPinExiting(false);
      }, 320);
    } else {
      clearWanderloomAccessKey();
      clearItineraryUnlock(slug);
      setPinError('الرمز غير صحيح. حاول مرة أخرى.');
    }
  };

  if (loading) {
    return (
      <Shell className="flex flex-col items-center justify-center text-[#D4AF37]">
        <Loader2 className="mb-4 h-10 w-10 animate-spin" aria-hidden />
        <p className="text-sm font-semibold tracking-wide">جاري تحميل مسار رحلتك…</p>
      </Shell>
    );
  }

  if (fetchError || !trip) {
    return (
      <Shell className="flex flex-col items-center justify-center px-6">
        <VipErrorPanel
          message={fetchError || 'لم يتم العثور على المسار.'}
          onRetry={() => void loadTrip()}
        />
      </Shell>
    );
  }

  if (!authenticated && trip.hasPin && passcode) {
    return (
      <Shell>
        <VipItineraryPinGate
          pinInput={pinInput}
          onPinChange={setPinInput}
          pinError={pinError}
          onSubmit={handlePinSubmit}
          exiting={pinExiting}
          unlocking={unlocking}
          sessionExpired={sessionExpired}
        />
      </Shell>
    );
  }

  const dateRange = trip.startDate
    ? formatTripDateRange(trip.startDate, trip.endDate)
    : null;

  const hasLinkedClient = trip.clientId != null && String(trip.clientId).trim() !== '';

  const handleOpenProfile = () => {
    if (profileUnlocked) {
      setProfilePortalActive(true);
      return;
    }
    setProfileModalOpen(true);
  };

  const handleProfilePinSuccess = () => {
    if (trip.clientId != null) {
      persistClientProfileUnlock(trip.clientId);
    }
    setProfileUnlocked(true);
    setProfilePortalActive(true);
    setProfileModalOpen(false);
  };

  return (
    <Shell>
      <div className="print:hidden">
        <div className="relative z-50 flex items-center justify-between gap-3 border-b border-[#1E2720]/8 bg-[#FAFAFA] px-4 py-3">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-[#1E2720] transition-colors hover:text-[#D4AF37]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
            العودة للموقع الأساسي
          </a>
          <div className="flex items-center gap-2">
            {hasLinkedClient ? (
              <button
                type="button"
                onClick={handleOpenProfile}
                className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/40 bg-[#1E2720] px-4 py-2 text-xs font-black text-[#D4AF37] shadow-sm transition hover:bg-black"
              >
                <User className="h-3.5 w-3.5 shrink-0" aria-hidden />
                الملف الشخصي
              </button>
            ) : null}
            {trip.hasPin ? <ClientPortalSignOutButton slug={slug} /> : null}
          </div>
        </div>

        <ClientView
          itinerary={trip}
          dateRange={dateRange}
          isUnlocked={isUnlocked}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          wardrobeItems={wardrobeItems}
          clientSectionTab={clientSectionTab}
          onClientSectionTabChange={setClientSectionTab}
          hasLinkedClient={hasLinkedClient}
          profilePortalActive={profilePortalActive}
          profileUnlocked={profileUnlocked}
          onRequestProfilePin={handleOpenProfile}
          onCloseProfilePortal={() => setProfilePortalActive(false)}
          currentItinerarySlug={slug}
        />

        {hasLinkedClient && trip.clientId != null ? (
          <ClientProfilePinModal
            open={profileModalOpen}
            clientId={trip.clientId}
            itineraryId={trip.id}
            onClose={() => setProfileModalOpen(false)}
            onSuccess={handleProfilePinSuccess}
          />
        ) : null}

        <VipButlerFab />
      </div>

        <VipLuxuryBookingVoucherPrint trip={trip} dateRange={dateRange} />
    </Shell>
  );
}
