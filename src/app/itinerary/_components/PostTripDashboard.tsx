'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  ChevronLeft,
  History,
  MapPin,
  Sparkles,
  User,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import ItineraryReferralShareCard from '@/app/itinerary/_components/ItineraryReferralShareCard';
import VipClientWalletLedger from '@/app/itinerary/_components/VipClientWalletLedger';
import UpcomingItineraryBridge from '@/app/itinerary/_components/UpcomingItineraryBridge';
import VipSpendingTierBadge from '@/components/VipSpendingTierBadge';
import {
  itineraryBridgeFromPublicTrip,
  type ClientItineraryBridge,
} from '@/lib/client-active-itinerary';
import { isTripFinished } from '@/lib/client-portal-trip-phase';
import { formatTripDateRange, type PublicItinerary } from '@/lib/public-itinerary';

type PostTripDashboardProps = {
  trip: PublicItinerary;
  dateRange?: string | null;
  /** مسارات منتهية — تُمرَّر من بوابة الملف أو تُجلب تلقائياً */
  pastTrips?: ClientItineraryBridge[];
  /** light = بوابة العميل الفاتحة · dark = واجهة VIP الداكنة */
  variant?: 'light' | 'dark';
  /** slug الصفحة الحالية — لإغلاق البوابة والعودة للمسار */
  currentItinerarySlug?: string;
  onReturnToItinerary?: () => void;
};

const PANEL_LIGHT =
  'rounded-2xl border border-[#D4AF37]/25 bg-white p-5 shadow-sm';
const PANEL_DARK =
  'rounded-2xl border border-[#d4af37]/30 bg-[#1E2720]/55 p-5 shadow-[0_0_15px_rgba(212,175,55,0.2)] backdrop-blur-md';

function PlaceholderCard({
  variant,
  icon: Icon,
  title,
  description,
}: {
  variant: 'light' | 'dark';
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  const isDark = variant === 'dark';
  return (
    <div className={isDark ? PANEL_DARK : PANEL_LIGHT}>
      <div className="flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            isDark
              ? 'bg-[#d4af37]/15 ring-1 ring-[#d4af37]/30'
              : 'bg-[#1E2720]/5 ring-1 ring-[#1E2720]/10'
          }`}
        >
          <Icon
            className={`h-5 w-5 ${isDark ? 'text-[#d4af37]' : 'text-[#1E2720]'}`}
            aria-hidden
          />
        </span>
        <div className="min-w-0">
          <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-[#1E2720]'}`}>
            {title}
          </p>
          <p
            className={`mt-1 text-xs font-semibold leading-relaxed ${
              isDark ? 'text-white/55' : 'text-gray-600'
            }`}
          >
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

function PastTripCard({
  trip,
  variant,
}: {
  trip: ClientItineraryBridge;
  variant: 'light' | 'dark';
}) {
  const isDark = variant === 'dark';
  const dateRange = formatTripDateRange(trip.startDate, trip.endDate);

  return (
    <Link
      href={trip.viewUrl}
      className={`group block ${isDark ? PANEL_DARK : PANEL_LIGHT} transition hover:border-[#D4AF37]/45`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            isDark
              ? 'bg-[#d4af37]/15 ring-1 ring-[#d4af37]/30'
              : 'bg-[#1E2720]/5 ring-1 ring-[#1E2720]/10'
          }`}
        >
          <MapPin
            className={`h-5 w-5 ${isDark ? 'text-[#d4af37]' : 'text-[#1E2720]'}`}
            aria-hidden
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-[#1E2720]'}`}>
            {trip.destination}
          </p>
          {trip.title && trip.title !== trip.destination ? (
            <p
              className={`mt-0.5 truncate text-xs font-semibold ${
                isDark ? 'text-white/55' : 'text-gray-600'
              }`}
            >
              {trip.title}
            </p>
          ) : null}
          {dateRange && dateRange !== 'التواريخ قريباً' ? (
            <p
              className={`mt-1 text-[11px] font-bold ${isDark ? 'text-white/45' : 'text-gray-500'}`}
              dir="ltr"
            >
              {dateRange}
            </p>
          ) : null}
        </div>
        <ChevronLeft
          className={`h-4 w-4 shrink-0 opacity-40 transition group-hover:opacity-100 ${
            isDark ? 'text-[#d4af37]' : 'text-[#1E2720]'
          }`}
          aria-hidden
        />
      </div>
    </Link>
  );
}

export default function PostTripDashboard({
  trip,
  dateRange,
  pastTrips: pastTripsProp,
  variant = 'light',
  currentItinerarySlug,
  onReturnToItinerary,
}: PostTripDashboardProps) {
  const isDark = variant === 'dark';
  const resolvedDateRange =
    dateRange?.trim() ||
    formatTripDateRange(trip.startDate, trip.endDate ?? trip.startDate);

  const [fetchedBridge, setFetchedBridge] = useState<ClientItineraryBridge | null>(null);
  const [fetchedPastTrips, setFetchedPastTrips] = useState<ClientItineraryBridge[] | null>(null);
  const [fetchedAllTrips, setFetchedAllTrips] = useState<ClientItineraryBridge[] | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  const currentTripBridge = useMemo(
    () =>
      itineraryBridgeFromPublicTrip({
        id: trip.id,
        magicLinkId: trip.magicLinkId,
        title: trip.title,
        destination: trip.destination,
        startDate: trip.startDate,
        endDate: trip.endDate,
      }),
    [trip],
  );

  useEffect(() => {
    const clientId = trip.clientId;
    if (clientId == null || String(clientId).trim() === '') {
      setFetchedBridge(null);
      setFetchedPastTrips(null);
      setFetchedAllTrips(null);
      setReferralCode(null);
      return;
    }

    if (pastTripsProp != null) {
      setFetchedPastTrips(null);
    }

    let cancelled = false;

    void (async () => {
      try {
        const params = new URLSearchParams({
          client_id: String(clientId),
        });
        if (trip.id != null) params.set('trip_id', String(trip.id));

        const [tripRes, referralRes] = await Promise.all([
          fetch(`/api/itinerary/client-active-trip?clientId=${encodeURIComponent(String(clientId))}`),
          fetch(`/api/itinerary/client-referral?${params.toString()}`, { cache: 'no-store' }),
        ]);

        const data = (await tripRes.json()) as {
          ok?: boolean;
          trip?: ClientItineraryBridge | null;
          pastTrips?: ClientItineraryBridge[];
          allTrips?: ClientItineraryBridge[];
        };
        const referralData = (await referralRes.json()) as {
          ok?: boolean;
          referralCode?: string | null;
        };

        if (cancelled) return;
        setFetchedBridge(data.ok && data.trip ? data.trip : null);
        if (pastTripsProp == null) {
          setFetchedPastTrips(data.ok && Array.isArray(data.pastTrips) ? data.pastTrips : []);
        }
        setFetchedAllTrips(data.ok && Array.isArray(data.allTrips) ? data.allTrips : []);
        setReferralCode(
          referralData.ok && referralData.referralCode
            ? String(referralData.referralCode).trim()
            : null,
        );
      } catch {
        if (!cancelled) {
          setFetchedBridge(null);
          if (pastTripsProp == null) setFetchedPastTrips([]);
          setFetchedAllTrips([]);
          setReferralCode(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [trip.clientId, trip.id, pastTripsProp]);

  const pastTrips = pastTripsProp ?? fetchedPastTrips ?? [];
  const allTrips = fetchedAllTrips ?? [];
  const archiveTrips =
    pastTrips.length > 0
      ? pastTrips
      : allTrips.filter((t) => t.id !== String(trip.id));
  const activeBridge = fetchedBridge ?? currentTripBridge;
  const normalizedCurrentSlug = currentItinerarySlug?.trim() ?? '';
  const isSameItineraryPage =
    Boolean(normalizedCurrentSlug) &&
    Boolean(activeBridge?.slug) &&
    activeBridge!.slug === normalizedCurrentSlug;
  const profileEndDate = trip.endDate ?? trip.startDate;
  const showPostTripWelcome = isTripFinished(profileEndDate);
  const showResolvedDateRange =
    resolvedDateRange && resolvedDateRange !== 'التواريخ قريباً';

  return (
    <div
      className={`space-y-6 transition-opacity duration-500 ease-out ${
        isDark ? 'text-white' : 'text-gray-900'
      }`}
      aria-label="لوحة ما بعد الرحلة"
    >
      {activeBridge ? (
        <UpcomingItineraryBridge
          trip={activeBridge}
          variant={variant}
          isSameItineraryPage={isSameItineraryPage}
          onReturnToItinerary={onReturnToItinerary}
        />
      ) : null}

      <section
        className={`relative overflow-hidden rounded-2xl p-6 text-center sm:p-8 ${
          isDark
            ? 'border border-[#d4af37]/35 bg-gradient-to-br from-[#2A362C] via-[#1E2720] to-[#141a17] shadow-[0_0_22px_rgba(212,175,55,0.25)]'
            : 'border border-[#D4AF37]/30 bg-gradient-to-br from-[#FFFBF0] via-white to-[#FDFBF7] shadow-md'
        }`}
      >
        <div
          className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-[#D4AF37]/15 blur-3xl"
          aria-hidden
        />
        <Sparkles
          className={`mx-auto mb-3 h-7 w-7 ${isDark ? 'text-[#d4af37]' : 'text-[#D4AF37]'}`}
          aria-hidden
        />
        <p
          className={`text-[10px] font-black uppercase tracking-[0.35em] ${
            isDark ? 'text-[#d4af37]/75' : 'text-[#D4AF37]/80'
          }`}
        >
          {showPostTripWelcome ? 'Welcome Back' : 'Wanderloom VIP'}
        </p>
        <h2 className="mt-2 text-2xl font-black sm:text-3xl">
          {showPostTripWelcome ? 'الحمد لله على السلامة' : 'أهلاً بك في ملفك الشخصي'}
        </h2>
        <p
          className={`mx-auto mt-3 max-w-sm text-sm font-semibold leading-relaxed ${
            isDark ? 'text-white/70' : 'text-gray-600'
          }`}
        >
          {showPostTripWelcome ? (
            <>
              نتمنى أن تكون رحلتك إلى{' '}
              <span className={isDark ? 'text-[#d4af37]' : 'text-[#1E2720]'}>
                {trip.destination}
              </span>{' '}
              قد ملأت قلبك بذكريات جميلة. بوابتك الآن للملف الشخصي والمكافآت.
            </>
          ) : (
            <>
              رحباً <span className={isDark ? 'text-[#d4af37]' : 'text-[#1E2720]'}>{trip.customerName}</span>
              — تابع محفظتك ومكافآتك، وارجع لمسار رحلتك متى شئت.
            </>
          )}
        </p>
      </section>

      {referralCode ? (
        <ItineraryReferralShareCard referralCode={referralCode} />
      ) : trip.clientId != null ? (
        <ItineraryReferralShareCard showPending />
      ) : null}

      <section className={isDark ? PANEL_DARK : PANEL_LIGHT}>
        <div className="flex items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              isDark
                ? 'bg-[#d4af37]/15 ring-1 ring-[#d4af37]/30'
                : 'bg-[#1E2720]/5 ring-1 ring-[#1E2720]/10'
            }`}
          >
            <User
              className={`h-5 w-5 ${isDark ? 'text-[#d4af37]' : 'text-[#1E2720]'}`}
              aria-hidden
            />
          </span>
          <div className="min-w-0 flex-1">
            <p
              className={`text-[10px] font-black uppercase tracking-[0.25em] ${
                isDark ? 'text-[#d4af37]/70' : 'text-[#D4AF37]'
              }`}
            >
              ملفك الشخصي
            </p>
            <h3 className={`mt-1 text-lg font-black ${isDark ? 'text-white' : 'text-[#1E2720]'}`}>
              {trip.customerName}
            </h3>
            <p
              className={`mt-1 text-sm font-semibold ${isDark ? 'text-white/60' : 'text-gray-600'}`}
            >
              {trip.title}
            </p>
            {showResolvedDateRange ? (
              <p
                className={`mt-1 text-xs font-bold ${isDark ? 'text-white/45' : 'text-gray-500'}`}
                dir="ltr"
              >
                {resolvedDateRange}
              </p>
            ) : null}
            {trip.clientVipTier ? (
              <div className="mt-3">
                <VipSpendingTierBadge tier={trip.clientVipTier} />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="post-trip-wallet-title">
        <h3
          id="post-trip-wallet-title"
          className={`flex items-center gap-2 text-sm font-black ${
            isDark ? 'text-[#d4af37]' : 'text-[#1E2720]'
          }`}
        >
          <Wallet className="h-4 w-4 shrink-0" aria-hidden />
          المحفظة والمكافآت
        </h3>
        {trip.clientId != null ? (
          <VipClientWalletLedger clientId={trip.clientId} />
        ) : (
          <PlaceholderCard
            variant={variant}
            icon={Award}
            title="برنامج المكافآت VIP"
            description="رصيد العهدة، نقاط الولاء، وعروض الحجز القادمة — ستظهر هنا بعد ربط حسابك."
          />
        )}
      </section>

      <section className="space-y-3" aria-labelledby="post-trip-history-title">
        <h3
          id="post-trip-history-title"
          className={`flex items-center gap-2 text-sm font-black ${
            isDark ? 'text-[#d4af37]' : 'text-[#1E2720]'
          }`}
        >
          <History className="h-4 w-4 shrink-0" aria-hidden />
          رحلاتك السابقة
        </h3>
        {archiveTrips.length > 0 ? (
          <div className="space-y-2">
            {archiveTrips.map((pastTrip) => (
              <PastTripCard key={pastTrip.id} trip={pastTrip} variant={variant} />
            ))}
          </div>
        ) : (
          <PlaceholderCard
            variant={variant}
            icon={History}
            title="أرشيف الرحلات"
            description="ستجد هنا ملخصاً لرحلاتك السابقة مع Wanderloom — الوجهات، التواريخ، وأبرز اللحظات."
          />
        )}
      </section>
    </div>
  );
}
