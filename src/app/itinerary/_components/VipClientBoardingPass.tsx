'use client';

import { Calendar, Clock, Plane } from 'lucide-react';

import VipBoardingBarcode from '@/app/itinerary/_components/VipBoardingBarcode';
import VipSpendingTierBadge from '@/components/VipSpendingTierBadge';
import {
  buildVipFlightVoucherFields,
  hasVipFlightVoucherData,
  vipBoardingBarcodeCaption,
  type VipFlightDetails,
} from '@/lib/vip-flight-voucher';
import type { PublicItinerary } from '@/lib/public-itinerary';
import { resolveDestinationCoverImage } from '@/lib/destination-cover-image';

const EM = '—';

type Props = {
  trip: PublicItinerary;
  dateRange: string | null;
};

function FlightTicketBody({ fd }: { fd: Record<string, unknown> }) {
  const flight = fd;
  const f = buildVipFlightVoucherFields(fd);
  const from =
    String(flight?.departureCity ?? flight?.from_city ?? flight?.flight_from ?? '').trim() ||
    'وجهة غير محددة';
  const to =
    String(flight?.arrivalCity ?? flight?.to_city ?? flight?.flight_to ?? '').trim() ||
    'وجهة غير محددة';

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-[#D4AF37]/30 bg-[#FAFAFA]">
      <div className="grid grid-cols-3 border-b border-dashed border-[#D4AF37]/40 bg-white px-3 py-2 text-center sm:px-4">
        <div>
          <p className="text-[8px] font-bold uppercase tracking-wider text-[#1E2720]/40">من</p>
          <p className="text-sm font-black text-[#1E2720] sm:text-base" dir="ltr">
            {from}
          </p>
        </div>
        <div className="flex flex-col items-center justify-center">
          <Plane className="h-4 w-4 rotate-[-25deg] text-[#D4AF37]" aria-hidden />
          <p className="mt-0.5 font-mono text-xs font-black text-[#D4AF37]" dir="ltr">
            {f.flightNumber}
          </p>
        </div>
        <div>
          <p className="text-[8px] font-bold uppercase tracking-wider text-[#1E2720]/40">إلى</p>
          <p className="text-sm font-black text-[#1E2720] sm:text-base" dir="ltr">
            {to}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-[#D4AF37]/15 sm:grid-cols-4">
        <div className="bg-white px-3 py-3 text-center">
          <p className="flex items-center justify-center gap-1 text-[8px] font-bold uppercase text-[#1E2720]/40">
            <Clock className="h-3 w-3" aria-hidden />
            مغادرة
          </p>
          <p className="mt-1 font-mono text-sm font-bold text-[#1E2720]" dir="ltr">
            {f.departure}
          </p>
        </div>
        <div className="bg-white px-3 py-3 text-center">
          <p className="flex items-center justify-center gap-1 text-[8px] font-bold uppercase text-[#1E2720]/40">
            <Clock className="h-3 w-3" aria-hidden />
            وصول
          </p>
          <p className="mt-1 font-mono text-sm font-bold text-[#1E2720]" dir="ltr">
            {f.arrival}
          </p>
        </div>
        <div className="bg-white px-3 py-3 text-center">
          <p className="text-[8px] font-bold uppercase text-[#1E2720]/40">المقعد</p>
          <p className="mt-1 text-sm font-black text-[#D4AF37]" dir="ltr">
            {f.seat}
          </p>
        </div>
        <div className="bg-white px-3 py-3 text-center">
          <p className="text-[8px] font-bold uppercase text-[#1E2720]/40">البوابة</p>
          <p className="mt-1 text-sm font-black text-[#1E2720]" dir="ltr">
            {f.gate}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function VipClientBoardingPass({ trip, dateRange }: Props) {
  const fd = trip.flightDetails as VipFlightDetails;
  const showFlight = fd && hasVipFlightVoucherData(fd);
  const barcodeCaption = vipBoardingBarcodeCaption(
    fd,
    trip.magicLinkId?.slice(0, 12) ?? String(trip.id).slice(0, 12),
  );

  return (
    <header className="relative w-full overflow-hidden border-b border-[#1E2720]/8 bg-gradient-to-b from-[#F5F3EE] via-[#FAFAFA] to-[#FAFAFA]">
      <img
        src={resolveDestinationCoverImage(trip.destination, { coverImage: trip.coverImage })}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-[0.14]"
      />

      <div className="relative mx-auto max-w-lg px-4 pb-5 pt-5 sm:max-w-xl sm:px-6 sm:pb-6 sm:pt-6">
        <div className="overflow-hidden rounded-[1.25rem] border-2 border-[#D4AF37]/45 bg-white shadow-[0_16px_48px_rgba(30,39,32,0.1)] ring-1 ring-[#1E2720]/5">
          {/* perforation strip */}
          <div className="flex items-center justify-between border-b border-dashed border-[#D4AF37]/55 bg-[#1E2720] px-4 py-2.5 sm:px-5">
            <span className="text-[9px] font-black uppercase tracking-[0.32em] text-[#D4AF37]">
              Wanderloom VIP
            </span>
            <span className="rounded border border-[#D4AF37]/50 px-2 py-0.5 font-mono text-[9px] font-bold text-[#FAFAFA]/90">
              BOARDING PASS
            </span>
          </div>

          <div className="relative px-4 py-5 sm:px-6 sm:py-6">
            <div
              className="pointer-events-none absolute -left-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 rounded-full bg-[#FAFAFA] sm:block"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -right-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 rounded-full bg-[#FAFAFA] sm:block"
              aria-hidden
            />

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#1E2720]/45">
                  Passenger / الضيف
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-lg font-black text-[#1E2720] sm:text-xl">
                  <span>{trip.customerName || 'عميلنا المميز'}</span>
                  {trip.clientVipTier != null ? (
                    <VipSpendingTierBadge tier={trip.clientVipTier} subtle />
                  ) : null}
                </p>
              </div>
              <div className="shrink-0 text-end">
                <p className="text-[9px] font-bold uppercase text-[#1E2720]/45">Trip</p>
                <p className="max-w-[8rem] truncate text-xs font-bold text-[#D4AF37] sm:max-w-none">
                  VIP
                </p>
              </div>
            </div>

            <h1 className="mt-4 text-xl font-black leading-tight tracking-tight text-[#1E2720] sm:text-2xl">
              {trip.title}
            </h1>
            {dateRange ? (
              <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-[#1E2720]/8 bg-[#FAFAFA] px-3 py-1 text-xs font-semibold text-[#1E2720]/65">
                <Calendar className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]" aria-hidden />
                <span dir="ltr">{dateRange}</span>
              </p>
            ) : null}

            {showFlight && fd ? <FlightTicketBody fd={fd} /> : null}
          </div>

          <VipBoardingBarcode seed={barcodeCaption} caption={barcodeCaption} />

          <div className="flex border-t border-dashed border-[#D4AF37]/45 bg-[#FAFAFA]">
            <div className="flex flex-1 items-center justify-center border-e border-dashed border-[#D4AF37]/35 py-2.5 text-[9px] font-bold tracking-widest text-[#1E2720]/35">
              ★ CONFIDENTIAL
            </div>
            <div className="flex flex-[2] items-center justify-center py-2.5 font-mono text-[10px] tracking-[0.2em] text-[#1E2720]/40">
              WL · VIP
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
