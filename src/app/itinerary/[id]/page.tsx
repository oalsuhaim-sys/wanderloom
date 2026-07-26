'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AlertCircle, Loader2, Map, RefreshCw, User } from 'lucide-react';

import VipButlerFab from '../_components/VipButlerFab';
import VipLuxuryBookingVoucherPrint from '../_components/VipLuxuryBookingVoucherPrint';
import PremiumBoardingPass from '../_components/PremiumBoardingPass';
import VipClientBookingsTab from '../_components/VipClientBookingsTab';
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
    // No linked client — never invent a referral code from itinerary columns
    return normalizePublicItinerary({ ...trip, referralCode: null });
  }

  // Prefer service-role API (bypasses RLS) so portal matches Admin CRM
  let referral: string | null = null;
  try {
    const params = new URLSearchParams({
      client_id: String(resolvedClientId),
    });
    if (trip.id != null) params.set('trip_id', String(trip.id));
    const res = await fetch(`/api/itinerary/client-referral?${params.toString()}`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const body = (await res.json()) as { ok?: boolean; referralCode?: string | null };
      if (body.ok && body.referralCode != null) {
        referral = String(body.referralCode).trim() || null;
      }
    }
  } catch (err) {
    console.warn('[vip-itinerary] client-referral API failed', err);
  }

  // Soft fallback via browser supabase (may be blocked by RLS)
  if (!referral) {
    const { data, error } = await supabase
      .from('clients')
      .select('referral_code, ref_code')
      .eq('id', resolvedClientId)
      .maybeSingle();

    if (error) {
      console.warn('[vip-itinerary] clients referral lookup:', error.message);
    } else {
      // Same priority as Admin: ref_code || referral_code
      referral =
        String(data?.ref_code ?? data?.referral_code ?? '').trim() || null;
    }
  }

  return normalizePublicItinerary({
    ...trip,
    clientId: resolvedClientId,
    referralCode: referral,
  });
}

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

function normalizeResolvedEntityId(raw: unknown): string {
  if (raw == null) return '';
  return String(raw)
    .trim()
    .replace(/^(client-|vip-)/i, '');
}

function applyOfflineTripCache(
  slug: string,
  cached: PublicItinerary,
  setters: {
    setTrip: (trip: PublicItinerary) => void;
    setPasscode: (code: string | null) => void;
    setAuthenticated: (value: boolean) => void;
    setFetchError: (value: string) => void;
    setResolvedTripId?: (id: string) => void;
    setResolvedClientId?: (id: string | null) => void;
  },
): boolean {
  if (cached.hasPin && !hasItineraryUnlock(slug)) {
    setters.setFetchError('لا يوجد اتصال. اتصل بالإنترنت وأدخل رمز الوصول لمسارك.');
    setters.setPasscode(null);
    setters.setAuthenticated(false);
    return false;
  }

  const tripId = normalizeResolvedEntityId(cached.id);
  const clientId = normalizeResolvedEntityId(cached.clientId) || null;

  setters.setTrip(cached);
  setters.setResolvedTripId?.(tripId);
  setters.setResolvedClientId?.(clientId);
  setters.setPasscode(null);
  setters.setAuthenticated(!cached.hasPin || hasItineraryUnlock(slug));
  setters.setFetchError('');
  console.log('[vip-itinerary] resolved IDs (offline cache):', { tripId, clientId });
  return true;
}

async function fetchItineraryByTripId(
  supabase: SupabaseClient,
  tripId: string,
): Promise<{ row: Record<string, unknown> | null; error: string | null }> {
  const id = tripId.trim().replace(/^(client-|vip-)/i, '');
  console.log('CURRENT TRIP ID:', id);

  if (!/^\d+$/.test(id)) {
    return { row: null, error: 'معرّف الرحلة غير صالح.' };
  }

  const { data, error } = await supabase
    .from('itineraries')
    .select(ITINERARY_FETCH_SELECT)
    .eq('id', Number(id))
    .single();

  if (error) {
    console.error('[vip-itinerary] trip id fetch failed:', id, error.message);
    return { row: null, error: error.message };
  }

  return { row: (data as Record<string, unknown> | null) ?? null, error: null };
}

async function fetchLatestItineraryForClient(
  supabase: SupabaseClient,
  clientId: string | number,
): Promise<{ row: Record<string, unknown> | null; error: string | null }> {
  const key =
    typeof clientId === 'number'
      ? clientId
      : /^\d+$/.test(String(clientId).trim())
        ? Number(clientId)
        : String(clientId).trim();

  console.log('CURRENT TRIP ID: (client fallback)', key);

  const query = () =>
    supabase
      .from('itineraries')
      .select(ITINERARY_FETCH_SELECT)
      .eq('client_id', key)
      .or('is_template.is.null,is_template.eq.false');

  let res = await query().order('created_at', { ascending: false }).limit(1);
  if (res.error && /created_at|column|schema cache/i.test(res.error.message)) {
    res = await query().order('id', { ascending: false }).limit(1);
  }

  if (res.error) return { row: null, error: res.error.message };
  const rows = (res.data ?? []) as Record<string, unknown>[];
  if (rows[0]) {
    console.log('CURRENT TRIP ID: resolved →', String(rows[0].id ?? ''));
    return { row: rows[0], error: null };
  }
  return { row: null, error: null };
}

async function fetchItineraryBySlug(
  supabase: SupabaseClient,
  slug: string,
  preferredItineraryId?: string | null,
  preferredClientId?: string | null,
): Promise<{ row: Record<string, unknown> | null; error: string | null }> {
  const rawSlug = slug.trim();
  const isClientPrefixed = /^(client-|vip-)/i.test(rawSlug);
  const trimmed = rawSlug.replace(/^(client-|vip-)/i, '');
  const pinned = String(preferredItineraryId ?? '')
    .trim()
    .replace(/^(client-|vip-)/i, '');
  const clientFromQuery = String(preferredClientId ?? '')
    .trim()
    .replace(/^(client-|vip-)/i, '');

  // 1) Explicit trip_id / numeric itinerary id in path (when not a client-prefixed slug)
  const numericTripId = /^\d+$/.test(pinned)
    ? pinned
    : !isClientPrefixed && /^\d+$/.test(trimmed)
      ? trimmed
      : '';

  if (numericTripId) {
    return fetchItineraryByTripId(supabase, numericTripId);
  }

  // 2) Legacy Magic Link: magic_link_id
  if (trimmed && !isClientPrefixed) {
    console.log('CURRENT TRIP ID: (legacy magic slug)', trimmed);
    const { data, error } = await supabase
      .from('itineraries')
      .select(ITINERARY_FETCH_SELECT)
      .eq('magic_link_id', trimmed)
      .limit(1);

    if (!error) {
      const rows = (data ?? []) as Record<string, unknown>[];
      if (rows[0]) {
        console.log(
          'CURRENT TRIP ID: resolved from magic_link_id →',
          String(rows[0].id ?? ''),
        );
        return { row: rows[0], error: null };
      }
    } else if (!/column|schema cache|does not exist|invalid input/i.test(error.message)) {
      return { row: null, error: error.message };
    }

    // Legacy passcode
    const byPass = await supabase
      .from('itineraries')
      .select(ITINERARY_FETCH_SELECT)
      .eq('passcode', trimmed.toUpperCase())
      .order('id', { ascending: false })
      .limit(1);
    if (!byPass.error) {
      const rows = (byPass.data ?? []) as Record<string, unknown>[];
      if (rows[0]) {
        console.log(
          'CURRENT TRIP ID: resolved from passcode →',
          String(rows[0].id ?? ''),
        );
        return { row: rows[0], error: null };
      }
    }
  }

  // 3) Client fallback — most recent trip (old links / client-prefixed paths)
  const clientId =
    (/^\d+$/.test(clientFromQuery) && clientFromQuery) ||
    (isClientPrefixed && /^\d+$/.test(trimmed) ? trimmed : '') ||
    '';

  if (clientId) {
    return fetchLatestItineraryForClient(supabase, clientId);
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
      className={`relative min-h-screen overflow-x-hidden bg-[#F9F9F6] font-[family-name:var(--font-tajawal),system-ui,sans-serif] text-gray-900 ${className}`}
    >
      <link href={MAPBOX_CSS_CDN} rel="stylesheet" />
      <ConfidentialWatermark />
      {children}
    </div>
  );
}

type ClientViewProps = {
  itinerary: PublicItinerary;
  /** Stable PK from parent fetch — never parsed from the URL in children */
  tripId: string;
  /** Stable client PK from parent fetch — never parsed from the URL in children */
  clientId: string | null;
  /** magic_link_id from fetched row — secondary upload resolver */
  magicLinkId?: string | null;
  dateRange: string | null;
  isUnlocked: boolean;
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
  tripId,
  clientId,
  magicLinkId = null,
  dateRange,
  isUnlocked,
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
  const salonServices = filterNonMedicalPreTripServices(itinerary?.preTripServices ?? []);
  const destination = itinerary?.destination ?? '';
  const tripFinished = isTripFinished(itinerary?.endDate);

  if (!tripId || itinerary?.id == null || String(itinerary.id).trim() === '') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-6 text-center text-sm font-semibold text-gray-600">
        لم يتم العثور على المسار.
      </div>
    );
  }

  if (profilePortalActive && profileUnlocked) {
    return (
      <div className="min-h-screen bg-[#F9F9F6] text-gray-900">
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
      <div className="min-h-screen bg-[#F9F9F6] text-gray-900">
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
          ) : hasLinkedClient ? (
            <ItineraryReferralShareCard showPending />
          ) : null}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9F9F6] text-gray-900">
      <PremiumBoardingPass trip={itinerary} dateRange={dateRange} />

      <div className="mx-auto flex max-w-lg justify-center px-4 pt-3 sm:max-w-xl">
        <VipPwaInstallButton />
      </div>

      <div className="mx-auto max-w-lg px-4 pt-4 sm:max-w-xl">
        {itinerary?.isMedical ? (
          <VipMedicalConciergeBanner services={itinerary?.preTripServices ?? []} />
        ) : null}
        {itinerary.referralCode ? (
          <ItineraryReferralShareCard referralCode={itinerary.referralCode} />
        ) : hasLinkedClient ? (
          <ItineraryReferralShareCard showPending />
        ) : null}
      </div>

      <div className="border-b border-gray-200 bg-[#F9F9F6]">
        <div className="my-8 flex justify-center gap-4 px-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#1E2720] px-6 py-2.5 font-bold text-white shadow-md ring-2 ring-[#D4AF37]/50">
            <Map className="h-4 w-4 shrink-0 text-[#D4AF37]" strokeWidth={2} aria-hidden />
            مسار الرحلة
          </div>
        </div>
      </div>

      <VipClientTabNav activeTab={clientSectionTab} onTabChange={onClientSectionTabChange} />

      {clientSectionTab === 'itinerary' ? (
        <div className="relative z-10 mx-auto mb-4 max-w-lg px-4 sm:max-w-xl">
          <VipLiveWeatherWidget
            destination={destination}
            fallback={itinerary?.weather}
          />
        </div>
      ) : null}

      <main
        className={`relative z-10 mx-auto p-4 pb-28 font-[family-name:var(--font-tajawal),system-ui,sans-serif] sm:px-6 sm:pb-32 ${
          clientSectionTab === 'itinerary'
            ? 'max-w-3xl sm:max-w-4xl'
            : 'max-w-lg sm:max-w-xl'
        }`}
      >
        {clientSectionTab === 'itinerary' ? (
          !isUnlocked ? (
            <div className="locked-vault-card">
              <VipVaultCountdown
                startDate={itinerary.startDate}
                destination={itinerary.destination}
              />
            </div>
          ) : (
            <div className="daily-timeline rounded-3xl bg-[#F9F9F6]">
              {salonServices.length > 0 ? (
                <div className="mb-6">
                  <VipPreTripServicesCard services={salonServices} />
                </div>
              ) : null}
              {safeDays.length > 0 ? (
                <VipDailyItineraryTimeline
                  days={safeDays}
                  destination={destination}
                  tripTitle={itinerary.title}
                  coverImage={itinerary.coverImage}
                  startDate={itinerary.startDate}
                  endDate={itinerary.endDate}
                  dateRangeLabel={dateRange}
                  tripWeather={itinerary?.weather}
                  tripId={tripId}
                  magicLinkId={magicLinkId ?? itinerary.magicLinkId}
                  clientId={
                    clientId ??
                    (itinerary.clientId != null ? String(itinerary.clientId).trim() : null)
                  }
                />
              ) : (
                <p className="rounded-2xl border border-[#C5A059]/20 bg-white py-12 text-center text-sm text-gray-500 shadow-sm">
                  لا توجد أيام مُنسّقة بعد في هذا المسار.
                </p>
              )}
            </div>
          )
        ) : null}

        {clientSectionTab === 'bookings' ? (
          <VipClientBookingsTab
            trip={itinerary}
            dateRange={dateRange}
            scheduleLocked={!isUnlocked}
          />
        ) : null}

        {clientSectionTab === 'packing' ? (
          <VipClientPackingTab trip={itinerary} profileUnlocked={profileUnlocked} />
        ) : null}
      </main>
    </div>
  );
}

export default function VipItineraryPage() {
  const params = useParams<{ id: string | string[] }>();
  const searchParams = useSearchParams();
  const slug = resolveRouteSlug(params?.id);
  const pinnedItineraryId =
    searchParams.get('trip_id')?.trim() ||
    searchParams.get('itinerary_id')?.trim() ||
    searchParams.get('trip')?.trim() ||
    null;
  const pinnedClientId =
    searchParams.get('client_id')?.trim() ||
    searchParams.get('clientId')?.trim() ||
    null;

  const [trip, setTrip] = useState<PublicItinerary | null>(null);
  /** Stable IDs from successful fetch (exact URL or fallback) — source of truth for children */
  const [resolvedTripId, setResolvedTripId] = useState<string>('');
  const [resolvedClientId, setResolvedClientId] = useState<string | null>(null);
  const [passcode, setPasscode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const [authenticated, setAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinExiting, setPinExiting] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  const [clientSectionTab, setClientSectionTab] = useState<VipClientTab>('itinerary');
  const [sessionExpired, setSessionExpired] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileUnlocked, setProfileUnlocked] = useState(false);
  const [profilePortalActive, setProfilePortalActive] = useState(false);

  useEffect(() => {
    if (!resolvedTripId && !resolvedClientId) return;
    console.log('[vip-itinerary] stable resolved IDs:', {
      tripId: resolvedTripId || null,
      clientId: resolvedClientId,
    });
  }, [resolvedTripId, resolvedClientId]);

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
    if (resolvedClientId) {
      setProfileUnlocked(hasClientProfileUnlock(resolvedClientId));
    } else {
      setProfileUnlocked(false);
      setProfilePortalActive(false);
    }
  }, [resolvedClientId]);

  const loadTrip = useCallback(async () => {
    setLoading(true);
    setFetchError('');

    const clearResolvedIds = () => {
      setResolvedTripId('');
      setResolvedClientId(null);
    };

    const offlineSetters = {
      setTrip,
      setPasscode,
      setAuthenticated,
      setFetchError,
      setResolvedTripId,
      setResolvedClientId,
    };

    try {
      if (!slug) {
        setFetchError('معرّف الرحلة غير صالح.');
        setTrip(null);
        setPasscode(null);
        clearResolvedIds();
        return;
      }

      const supabase = getSupabase();
      if (!supabase) {
        const cached = hydrateTripFromOfflineCache(slug);
        if (cached) {
          const applied = applyOfflineTripCache(slug, cached, offlineSetters);
          if (applied) return;
        }
        setFetchError(
          'Supabase غير مهيأ. تحقق من NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY وأعد تشغيل السيرفر.',
        );
        setTrip(null);
        setPasscode(null);
        clearResolvedIds();
        return;
      }

      const { row, error } = await fetchItineraryBySlug(
        supabase,
        slug,
        pinnedItineraryId,
        pinnedClientId,
      );

      if (error) {
        const cached = hydrateTripFromOfflineCache(slug);
        if (cached) {
          const applied = applyOfflineTripCache(slug, cached, offlineSetters);
          if (applied) return;
        }
        setFetchError(error);
        setTrip(null);
        setPasscode(null);
        clearResolvedIds();
        return;
      }

      if (!row) {
        const cached = hydrateTripFromOfflineCache(slug);
        if (cached) {
          const applied = applyOfflineTripCache(slug, cached, offlineSetters);
          if (applied) return;
        }
        clearWanderloomAccessKey();
        clearItineraryUnlock(slug);
        setFetchError('لم يتم العثور على المسار. تحقق من الرابط أو تواصل مع الكونسيرج.');
        setTrip(null);
        setPasscode(null);
        clearResolvedIds();
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

      const nextTripId = normalizeResolvedEntityId(tripWithClient.id);
      const nextClientId = normalizeResolvedEntityId(tripWithClient.clientId) || null;

      setTrip(tripWithClient);
      setResolvedTripId(nextTripId);
      setResolvedClientId(nextClientId);
      setPasscode(code);

      console.log('[vip-itinerary] resolved IDs after fetch:', {
        tripId: nextTripId,
        clientId: nextClientId,
        source: pinnedItineraryId ? 'pinned_trip_id' : 'slug_or_fallback',
      });

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
          setResolvedTripId,
          setResolvedClientId,
        });
        if (applied) return;
      }
      setFetchError(
        errorMessageFromUnknown(err) ||
          'تعذر قراءة بيانات المسار. قد يكون البرنامج ناقصاً — تواصل مع الكونسيرج أو أعد المحاولة.',
      );
      setTrip(null);
      setPasscode(null);
      setResolvedTripId('');
      setResolvedClientId(null);
    } finally {
      setLoading(false);
    }
  }, [slug, pinnedItineraryId, pinnedClientId]);

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

  const effectiveClientId =
    resolvedClientId || normalizeResolvedEntityId(trip.clientId) || null;
  const hasLinkedClient = Boolean(effectiveClientId);

  const handleOpenProfile = () => {
    if (profileUnlocked) {
      setProfilePortalActive(true);
      return;
    }
    setProfileModalOpen(true);
  };

  const handleProfilePinSuccess = () => {
    if (effectiveClientId) {
      persistClientProfileUnlock(effectiveClientId);
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
          tripId={resolvedTripId || normalizeResolvedEntityId(trip.id)}
          clientId={effectiveClientId}
          magicLinkId={trip.magicLinkId}
          dateRange={dateRange}
          isUnlocked={isUnlocked}
          clientSectionTab={clientSectionTab}
          onClientSectionTabChange={setClientSectionTab}
          hasLinkedClient={hasLinkedClient}
          profilePortalActive={profilePortalActive}
          profileUnlocked={profileUnlocked}
          onRequestProfilePin={handleOpenProfile}
          onCloseProfilePortal={() => setProfilePortalActive(false)}
          currentItinerarySlug={slug}
        />

        {hasLinkedClient && effectiveClientId ? (
          <ClientProfilePinModal
            open={profileModalOpen}
            clientId={effectiveClientId}
            tripId={resolvedTripId || normalizeResolvedEntityId(trip.id)}
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
