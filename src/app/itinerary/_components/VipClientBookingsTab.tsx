'use client';

import { useMemo } from 'react';
import { BedDouble, Moon, Plane, Ticket } from 'lucide-react';

import VipClientDocumentsSection from '@/app/itinerary/_components/VipClientDocumentsSection';
import type { ActivityTicket } from '@/lib/itinerary-tickets';
import {
  formatShortArabicDate,
  formatTripDateRangeShort,
  googleMapsSearchUrl,
  type PublicItinerary,
  type PublicItineraryHotel,
} from '@/lib/public-itinerary';
import {
  buildVipFlightVoucherFields,
  hasVipFlightVoucherData,
  vipBoardingBarcodeCaption,
  vipFlightArrivalCity,
  vipFlightDepartureCity,
  vipFlightLineAny,
  type VipFlightDetails,
} from '@/lib/vip-flight-voucher';
import { barcodeWidthsFromSeed } from '@/lib/vip-boarding-barcode';

const MASKED_SECRET = '[يظهر بعد الاعتماد]';
const INK = '#1e3f20';
const GOLD = '#cda04c';

const TICKET_CARD =
  'relative overflow-hidden rounded-3xl border border-[#cda04c]/20 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] sm:p-8';

type Props = {
  trip: PublicItinerary;
  dateRange: string | null;
  scheduleLocked: boolean;
  maskSecrets?: boolean;
};

function dash(value: string | null | undefined): string {
  const s = value?.trim();
  return s && s !== '—' ? s : '-';
}

function containsArabic(value: string): boolean {
  return /[\u0600-\u06FF]/.test(value);
}

function textDir(value: string): 'rtl' | 'ltr' {
  return containsArabic(value) ? 'rtl' : 'ltr';
}

function formatHotelDate(raw: string | null): string {
  if (!raw?.trim()) return '-';
  if (/^\d{4}-\d{2}-\d{2}/.test(raw.trim())) {
    return formatShortArabicDate(raw);
  }
  return raw.trim();
}

function hotelAddress(h: PublicItineraryHotel): string {
  const parts = [h.address, h.mapsQuery, h.city, h.country].filter(Boolean);
  const unique = [...new Set(parts.map((p) => p?.trim()).filter(Boolean))];
  return unique.join(' · ') || '-';
}

function TicketGoldAccent() {
  return (
    <>
      <span
        className="pointer-events-none absolute -end-8 -top-8 h-24 w-24 rounded-full bg-[#cda04c]/8"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute -bottom-6 -start-6 h-20 w-20 rounded-full bg-[#F9F9F6]"
        aria-hidden
      />
    </>
  );
}

function GoldTimelineConnector({ icon: Icon }: { icon: typeof Plane }) {
  return (
    <div className="flex shrink-0 flex-col items-center justify-center px-2">
      <div className="flex w-full items-center gap-1">
        <span className="h-px flex-1 bg-gradient-to-l from-[#cda04c]/50 to-[#cda04c]/10" aria-hidden />
        <Icon className="h-4 w-4 shrink-0 text-[#cda04c]" aria-hidden />
        <span className="h-px flex-1 bg-gradient-to-r from-[#cda04c]/50 to-[#cda04c]/10" aria-hidden />
      </div>
    </div>
  );
}

function hotelMapsQuery(h: PublicItineraryHotel): string {
  const address = hotelAddress(h);
  if (address !== '-') return address;
  return h.name.trim() || '-';
}

function DetailCell({
  label,
  value,
  highlight = false,
  ltr = true,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  ltr?: boolean;
}) {
  return (
    <div className="min-w-0 text-center">
      <p className="text-xs text-gray-400">{label}</p>
      <p
        className={`mt-1 truncate text-sm font-bold text-gray-900 ${highlight ? 'font-mono text-[#cda04c]' : ''}`}
        style={highlight ? { color: GOLD } : undefined}
        dir={ltr ? 'ltr' : textDir(value)}
      >
        {value}
      </p>
    </div>
  );
}

function PnrTearOff({ pnr }: { pnr: string }) {
  const widths = useMemo(() => barcodeWidthsFromSeed(pnr, 48), [pnr]);

  return (
    <div className="text-center">
      <div
        className="mx-auto flex h-12 max-w-[260px] items-stretch justify-center gap-px overflow-hidden bg-white px-1"
        role="img"
        aria-label={`باركود الحجز ${pnr}`}
      >
        {widths.map((w, i) => (
          <div
            key={`${pnr}-${i}`}
            className="h-full shrink-0 bg-[#1e3f20]"
            style={{ width: w }}
          />
        ))}
      </div>
      <p
        className="mt-3 font-mono text-sm font-bold tracking-[0.28em]"
        style={{ color: INK }}
        dir="ltr"
      >
        {pnr}
      </p>
      <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-gray-400">
        PNR / Booking Reference
      </p>
    </div>
  );
}

function LuxuryFlightTicketCard({
  trip,
  maskSecrets,
}: {
  trip: PublicItinerary;
  maskSecrets: boolean;
}) {
  const fd = trip.flightDetails as VipFlightDetails;
  const flightSummary = (trip.flight_summary ?? trip.vipSummaries?.flight ?? '').trim();

  if (!fd || !hasVipFlightVoucherData(fd)) {
    if (!flightSummary) {
      return (
        <p className="rounded-3xl border border-[#cda04c]/20 bg-[#F9F9F6] px-4 py-8 text-center text-sm text-[#1E2720]/55">
          لم تُضف تفاصيل طيران بعد — يتواصل معك الكونسيرج قبل السفر.
        </p>
      );
    }
    return (
      <p className="whitespace-pre-wrap rounded-3xl border border-[#cda04c]/20 bg-white p-6 text-sm leading-relaxed text-[#1E2720]/85 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        {flightSummary}
      </p>
    );
  }

  const f = buildVipFlightVoucherFields(fd);
  const from = vipFlightDepartureCity(fd) || 'المغادرة';
  const to = vipFlightArrivalCity(fd) || 'الوصول';
  const pnrRaw = vipFlightLineAny(fd, ['booking_reference', 'pnr']);
  const pnr = maskSecrets
    ? MASKED_SECRET
    : pnrRaw ||
      vipBoardingBarcodeCaption(
        fd,
        trip.magicLinkId?.slice(0, 12) ?? `WL-${String(trip.id).slice(0, 8)}`,
      );
  const dateLabel = trip.startDate
    ? formatTripDateRangeShort(trip.startDate, trip.endDate)
    : null;

  const seatRaw = maskSecrets ? MASKED_SECRET : dash(f.seat);
  const hasSeat = maskSecrets || (f.seat.trim() && f.seat !== '—' && f.seat !== '-');

  const gridItems: { label: string; value: string; highlight?: boolean }[] = [
    { label: 'رقم الرحلة', value: dash(f.flightNumber), highlight: true },
    { label: 'البوابة', value: maskSecrets ? MASKED_SECRET : dash(f.gate) },
    { label: 'المبنى', value: dash(f.terminal) },
    { label: 'الدرجة', value: dash(f.flightClass) },
  ];
  if (hasSeat) {
    gridItems.push({ label: 'المقعد', value: seatRaw });
  }

  const gridCols =
    gridItems.length >= 5
      ? 'grid-cols-2 sm:grid-cols-5'
      : 'grid-cols-2 sm:grid-cols-4';

  return (
    <article className={TICKET_CARD} dir="rtl">
      <TicketGoldAccent />

      <div className="relative mb-2 flex items-center justify-end">
        <span className="shrink-0 rounded-full bg-[#cda04c]/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#cda04c]">
          VIP
        </span>
      </div>

      {dateLabel ? (
        <p className="relative mb-5 text-center text-xs font-semibold text-gray-500">{dateLabel}</p>
      ) : null}

      {/* Flight path — cities then times */}
      <div className="relative rounded-2xl bg-[#F9F9F6] px-4 py-5" dir="rtl">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1 text-right">
            <p
              className="truncate text-lg font-black leading-tight sm:text-xl"
              style={{ color: INK }}
              dir={textDir(from)}
            >
              {from}
            </p>
          </div>

          <GoldTimelineConnector icon={Plane} />

          <div className="min-w-0 flex-1 text-left">
            <p
              className="truncate text-lg font-black leading-tight sm:text-xl"
              style={{ color: INK }}
              dir={textDir(to)}
            >
              {to}
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-4">
          <p className="font-mono text-base font-bold sm:text-lg" style={{ color: INK }} dir="ltr">
            {dash(f.departure)}
          </p>
          <p className="font-mono text-base font-bold sm:text-lg" style={{ color: INK }} dir="ltr">
            {dash(f.arrival)}
          </p>
        </div>
      </div>

      {/* Details grid */}
      <div className={`relative my-6 grid w-full gap-4 text-center ${gridCols}`}>
        {gridItems.map((item) => (
          <DetailCell
            key={item.label}
            label={item.label}
            value={item.value}
            highlight={item.highlight}
            ltr
          />
        ))}
      </div>

      {/* Tear-off PNR */}
      <div className="relative -mx-6 mt-6 border-t-2 border-dashed border-gray-200 px-6 pt-5 sm:-mx-8 sm:px-8">
        {maskSecrets ? (
          <div className="text-center">
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-gray-400">
              PNR / Booking Reference
            </p>
            <p className="mt-2 font-mono text-sm font-bold text-[#1E2720]/45">{MASKED_SECRET}</p>
          </div>
        ) : (
          <PnrTearOff pnr={pnr} />
        )}
      </div>

      {flightSummary ? (
        <p className="relative mt-4 text-xs leading-relaxed text-[#1E2720]/60">{flightSummary}</p>
      ) : null}
    </article>
  );
}

function LuxuryHotelTicketCard({
  hotel,
  maskSecrets,
}: {
  hotel: PublicItineraryHotel;
  maskSecrets: boolean;
}) {
  const checkIn = formatHotelDate(hotel.checkIn);
  const checkOut = formatHotelDate(hotel.checkOut);
  const confirm = maskSecrets ? MASKED_SECRET : dash(hotel.bookingReference);
  const address = hotelAddress(hotel);
  const mapsQuery = hotelMapsQuery(hotel);
  const mapsHref =
    mapsQuery !== '-'
      ? hotel.bookingUrl?.trim() || googleMapsSearchUrl(mapsQuery)
      : null;

  return (
    <article className={TICKET_CARD} dir="rtl">
      <TicketGoldAccent />

      {/* Header */}
      <div className="relative mb-5 flex items-start gap-3" dir="rtl">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F9F9F6] ring-1 ring-[#cda04c]/25">
          <BedDouble className="h-5 w-5 text-[#cda04c]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
            Hotel Stay
          </p>
          <h3
            className="mt-0.5 truncate text-lg font-black leading-snug sm:text-xl"
            style={{ color: INK }}
            dir={textDir(hotel.name)}
          >
            {hotel.name}
          </h3>
          {hotel.categoryLabel ? (
            <p className="mt-1 text-xs font-semibold text-[#cda04c]">{hotel.categoryLabel}</p>
          ) : null}
        </div>
      </div>

      {/* Stay timeline */}
      <div className="relative rounded-2xl bg-[#F9F9F6] px-4 py-5" dir="rtl">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1 text-right">
            <p className="text-[10px] font-semibold tracking-wide text-[#cda04c]/90">
              تسجيل الدخول
            </p>
            <p className="mt-1 text-sm font-bold sm:text-base" style={{ color: INK }} dir="rtl">
              {checkIn}
            </p>
          </div>

          <GoldTimelineConnector icon={Moon} />

          <div className="min-w-0 flex-1 text-left">
            <p className="text-[10px] font-semibold tracking-wide text-[#cda04c]/90">
              تسجيل الخروج
            </p>
            <p className="mt-1 text-sm font-bold sm:text-base" style={{ color: INK }} dir="rtl">
              {checkOut}
            </p>
          </div>
        </div>
      </div>

      {/* Tear-off confirmation + address */}
      <div className="relative -mx-6 mt-6 border-t-2 border-dashed border-gray-200 px-6 pt-5 sm:-mx-8 sm:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 text-center sm:text-start">
            <p className="text-xs text-gray-400">رقم التأكيد</p>
            <p className="mt-1 font-mono text-sm font-bold text-[#cda04c]" dir="ltr">
              {confirm}
            </p>
          </div>

          {address !== '-' && mapsHref ? (
            <div className="min-w-0 flex-1 text-center sm:text-end">
              <p className="text-xs text-gray-400">العنوان</p>
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex max-w-full items-center justify-center gap-1.5 text-xs leading-relaxed text-[#1E2720]/80 transition-colors hover:text-[#cda04c] hover:underline sm:justify-end"
                dir={textDir(address)}
              >
                <span aria-hidden>📍</span>
                <span className="truncate">{address}</span>
              </a>
            </div>
          ) : null}
        </div>
      </div>

      {hotel.notes ? (
        <p className="relative mt-4 text-xs leading-relaxed text-[#1E2720]/60">{hotel.notes}</p>
      ) : null}
    </article>
  );
}

function ActivityTicketCard({
  ticket,
  maskSecrets,
}: {
  ticket: ActivityTicket;
  maskSecrets: boolean;
}) {
  return (
    <article className={TICKET_CARD}>
      <TicketGoldAccent />
      <div dir="rtl">
        <p className="text-[10px] font-semibold tracking-wide text-[#cda04c]/90">اسم الفعالية</p>
        <p className="mt-1 text-base font-black" style={{ color: INK }}>
          {ticket?.title?.trim() || '—'}
        </p>
        <div className="mt-5 grid grid-cols-1 gap-4 border-t-2 border-dashed border-gray-200 pt-4 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold tracking-wide text-[#cda04c]/90">
              تاريخ ووقت الدخول
            </p>
            <p className="mt-1 text-sm font-bold" style={{ color: INK }} dir="ltr">
              {ticket?.date?.trim() || '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-wide text-[#cda04c]/90">
              رقم التذكرة
            </p>
            <p className="mt-1 font-mono text-sm font-bold text-[#cda04c]" dir="ltr">
              {maskSecrets ? MASKED_SECRET : ticket?.ticket_number?.trim() || '—'}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function VipClientBookingsTab({ trip, maskSecrets = false }: Props) {
  const hotels = trip.hotels ?? [];
  const tickets = trip.ticketDetails ?? [];

  return (
    <div className="bookings-tab space-y-8" dir="rtl">
      {!maskSecrets ? <VipClientDocumentsSection documents={trip.documents ?? []} /> : null}

      <section>
        <h2 className="mb-4 flex items-center gap-2 text-sm font-black text-[#1E2720]">
          <Plane className="h-4 w-4 text-[#cda04c]" aria-hidden />
          الطيران
        </h2>
        <div className="flex flex-col gap-4">
          <LuxuryFlightTicketCard trip={trip} maskSecrets={maskSecrets} />
        </div>
      </section>

      <section>
        <h2 className="mb-4 flex items-center gap-2 text-sm font-black text-[#1E2720]">
          <BedDouble className="h-4 w-4 text-[#cda04c]" aria-hidden />
          الفنادق
        </h2>
        {hotels.length === 0 ? (
          <p className="rounded-3xl border border-[#cda04c]/20 bg-[#F9F9F6] px-4 py-8 text-center text-sm text-[#1E2720]/55">
            لا توجد حجوزات فندقية مُدرجة بعد.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {hotels.map((h) => (
              <LuxuryHotelTicketCard key={h.id} hotel={h} maskSecrets={maskSecrets} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 flex items-center gap-2 text-sm font-black text-[#1E2720]">
          <Ticket className="h-4 w-4 text-[#cda04c]" aria-hidden />
          تذاكر الفعاليات 🎟️
        </h2>
        {tickets.length === 0 ? (
          <p className="rounded-3xl border border-[#cda04c]/20 bg-[#F9F9F6] px-4 py-8 text-center text-sm text-[#1E2720]/55">
            لا توجد تذاكر فعاليات مُدرجة بعد.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {tickets.map((ticket, i) => (
              <ActivityTicketCard
                key={ticket?.id ?? `ticket-${i}`}
                ticket={ticket}
                maskSecrets={maskSecrets}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
