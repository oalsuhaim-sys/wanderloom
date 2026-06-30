'use client';

import { Building2, Plane, Ticket } from 'lucide-react';

import VipClientDocumentsSection from '@/app/itinerary/_components/VipClientDocumentsSection';
import type { ActivityTicket } from '@/lib/itinerary-tickets';
import {
  buildVipFlightVoucherFields,
  hasVipFlightVoucherData,
  vipFlightLineAny,
  type VipFlightDetails,
} from '@/lib/vip-flight-voucher';
import type { PublicItinerary, PublicItineraryHotel } from '@/lib/public-itinerary';

const MASKED_SECRET = '[يظهر بعد الاعتماد]';

type Props = {
  trip: PublicItinerary;
  dateRange: string | null;
  scheduleLocked: boolean;
  /** عند عرض السعر — إخفاء PNR وأرقام التأكيد */
  maskSecrets?: boolean;
};

const thClass =
  'bg-[#1E2720] px-3 py-2.5 text-start text-[10px] font-black uppercase tracking-wider text-[#D4AF37] sm:px-4';
const tdClass = 'border-t border-[#1E2720]/8 px-3 py-3 text-sm font-medium text-[#1E2720] sm:px-4';

function hotelAddress(h: PublicItineraryHotel): string {
  const parts = [h.address, h.mapsQuery, h.city, h.country].filter(Boolean);
  const unique = [...new Set(parts.map((p) => p?.trim()).filter(Boolean))];
  return unique.join(' · ') || '—';
}

function FlightsTable({ trip, maskSecrets }: { trip: PublicItinerary; maskSecrets: boolean }) {
  const fd = trip.flightDetails as VipFlightDetails;
  const flightSummary = (trip.flight_summary ?? trip.vipSummaries?.flight ?? '').trim();

  if (!fd || !hasVipFlightVoucherData(fd)) {
    if (!flightSummary) {
      return (
        <p className="rounded-xl border border-[#D4AF37]/20 bg-[#FAFAFA] px-4 py-6 text-center text-sm text-[#1E2720]/55">
          لم تُضف تفاصيل طيران بعد — يتواصل معك الكونسيرج قبل السفر.
        </p>
      );
    }
    return (
      <p className="whitespace-pre-wrap rounded-xl border border-[#D4AF37]/20 bg-white p-4 text-sm leading-relaxed text-[#1E2720]/85">
        {flightSummary}
      </p>
    );
  }

  const f = buildVipFlightVoucherFields(fd);
  const pnrRaw = vipFlightLineAny(fd, ['booking_reference', 'pnr']);

  return (
    <div className="overflow-x-auto rounded-2xl border border-[#D4AF37]/30 bg-white shadow-sm">
      <table className="w-full min-w-[320px] border-collapse text-start">
        <thead>
          <tr>
            <th className={thClass}>رقم الرحلة</th>
            <th className={thClass}>المسار</th>
            <th className={thClass}>مغادرة</th>
            <th className={thClass}>وصول</th>
            <th className={thClass}>مقعد</th>
            <th className={thClass}>بوابة</th>
          </tr>
        </thead>
        <tbody>
          <tr className="bg-[#FAFAFA]/80">
            <td className={`${tdClass} font-mono font-black text-[#D4AF37]`} dir="ltr">
              {f.flightNumber}
            </td>
            <td className={`${tdClass} font-bold`} dir="ltr">
              {f.routeLabel}
            </td>
            <td className={tdClass} dir="ltr">
              {f.departure}
            </td>
            <td className={tdClass} dir="ltr">
              {f.arrival}
            </td>
            <td className={tdClass} dir="ltr">
              {maskSecrets ? MASKED_SECRET : f.seat}
            </td>
            <td className={tdClass} dir="ltr">
              {maskSecrets ? MASKED_SECRET : f.gate}
            </td>
          </tr>
          {pnrRaw || maskSecrets ? (
            <tr className="bg-white">
              <td colSpan={6} className={`${tdClass} text-xs`}>
                <span className="font-bold text-[#1E2720]/45">PNR: </span>
                <span className="font-mono font-black text-[#D4AF37]" dir="ltr">
                  {maskSecrets ? MASKED_SECRET : pnrRaw}
                </span>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      {flightSummary ? (
        <p className="border-t border-[#1E2720]/8 px-4 py-3 text-xs leading-relaxed text-[#1E2720]/65">
          {flightSummary}
        </p>
      ) : null}
    </div>
  );
}

function HotelsTable({
  hotels,
  maskSecrets,
}: {
  hotels: PublicItineraryHotel[];
  maskSecrets: boolean;
}) {
  if (hotels.length === 0) {
    return (
      <p className="rounded-xl border border-[#D4AF37]/20 bg-[#FAFAFA] px-4 py-6 text-center text-sm text-[#1E2720]/55">
        لا توجد حجوزات فندقية مُدرجة بعد.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[#D4AF37]/30 bg-white shadow-sm">
      <table className="w-full min-w-[360px] border-collapse text-start">
        <thead>
          <tr>
            <th className={thClass}>الفندق</th>
            <th className={thClass}>تأكيد</th>
            <th className={thClass}>دخول / خروج</th>
            <th className={thClass}>العنوان</th>
          </tr>
        </thead>
        <tbody>
          {hotels.map((h, i) => (
            <tr key={h.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]/80'}>
              <td className={`${tdClass} font-black`}>{h.name}</td>
              <td className={`${tdClass} font-mono text-xs`} dir="ltr">
                {maskSecrets
                  ? MASKED_SECRET
                  : h.bookingReference?.trim() || '—'}
              </td>
              <td className={`${tdClass} text-xs`} dir="ltr">
                {[h.checkIn, h.checkOut].filter(Boolean).join(' → ') || '—'}
              </td>
              <td className={`${tdClass} text-xs leading-relaxed text-[#1E2720]/75`}>
                {hotelAddress(h)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActivityTicketsTable({
  tickets,
  maskSecrets,
}: {
  tickets: ActivityTicket[];
  maskSecrets: boolean;
}) {
  const safeTickets = Array.isArray(tickets) ? tickets : [];

  if (safeTickets.length === 0) {
    return (
      <p className="rounded-xl border border-[#D4AF37]/20 bg-[#FAFAFA] px-4 py-6 text-center text-sm text-[#1E2720]/55">
        لا توجد تذاكر فعاليات مُدرجة بعد.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[#D4AF37]/30 bg-white shadow-sm">
      <table className="w-full min-w-[360px] border-collapse text-start">
        <thead>
          <tr>
            <th className={thClass}>اسم الفعالية</th>
            <th className={thClass}>تاريخ ووقت الدخول</th>
            <th className={thClass}>رقم التذكرة / التأكيد</th>
          </tr>
        </thead>
        <tbody>
          {safeTickets.map((ticket, i) => (
            <tr key={ticket?.id ?? `ticket-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]/80'}>
              <td className={`${tdClass} font-black`}>{ticket?.title?.trim() || '—'}</td>
              <td className={`${tdClass} text-xs`} dir="ltr">
                {ticket?.date?.trim() || '—'}
              </td>
              <td className={`${tdClass} font-mono text-xs`} dir="ltr">
                {maskSecrets ? MASKED_SECRET : ticket?.ticket_number?.trim() || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function VipClientBookingsTab({ trip, maskSecrets = false }: Props) {
  const hotels = trip.hotels ?? [];
  const tickets = trip.ticketDetails ?? [];

  return (
    <div className="bookings-tab space-y-8">
      {!maskSecrets ? <VipClientDocumentsSection documents={trip.documents ?? []} /> : null}

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-[#1E2720]">
          <Plane className="h-4 w-4 text-[#D4AF37]" aria-hidden />
          الطيران
        </h2>
        <FlightsTable trip={trip} maskSecrets={maskSecrets} />
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-[#1E2720]">
          <Building2 className="h-4 w-4 text-[#D4AF37]" aria-hidden />
          الفنادق
        </h2>
        <HotelsTable hotels={hotels} maskSecrets={maskSecrets} />
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-[#1E2720]">
          <Ticket className="h-4 w-4 text-[#D4AF37]" aria-hidden />
          تذاكر الفعاليات 🎟️
        </h2>
        <ActivityTicketsTable tickets={tickets} maskSecrets={maskSecrets} />
      </section>
    </div>
  );
}
