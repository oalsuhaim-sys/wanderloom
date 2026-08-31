'use client';

import type { FlightDetailsDraft, PrimaryHotelBookingDraft } from '@/lib/itinerary-builder-model';
import { FLIGHT_CLASS_OPTIONS } from '@/lib/itinerary-builder-model';
import {
  VipDateField,
  VipTimeSlotSelect,
} from '@/app/crm/itineraries/_components/VipBookingFields';
import {
  VIP_CARD,
  VIP_INPUT,
  VIP_LABEL,
} from '@/app/crm/itineraries/[id]/edit/vip-crm-theme';

type Props = {
  flight: FlightDetailsDraft;
  hotel: PrimaryHotelBookingDraft;
  onFlightChange: (flight: FlightDetailsDraft) => void;
  onHotelChange: (hotel: PrimaryHotelBookingDraft) => void;
};

function pf(
  f: FlightDetailsDraft,
  k: keyof FlightDetailsDraft,
  v: string,
): FlightDetailsDraft {
  const n = { ...f, [k]: v };
  if (k === 'departure_time') n.flight_time = v;
  return n;
}

function ph(
  h: PrimaryHotelBookingDraft,
  k: keyof PrimaryHotelBookingDraft,
  v: string,
): PrimaryHotelBookingDraft {
  return { ...h, [k]: v };
}

export default function FlightAndBookingDetailsBar({
  flight,
  hotel,
  onFlightChange,
  onHotelChange,
}: Props) {
  return (
    <section className={`${VIP_CARD} p-4 sm:p-5`} aria-labelledby="flight-hotel-heading">
      <h2 id="flight-hotel-heading" className="mb-4 text-base font-bold text-[#1E2720]">
        Flight &amp; Hotel Details — بيانات الطيران والحجز
      </h2>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
        <label>
          <span className={VIP_LABEL}>رقم الرحلة</span>
          <input
            className={VIP_INPUT}
            dir="ltr"
            placeholder="SV130"
            value={flight.flight_number}
            onChange={(e) => onFlightChange(pf(flight, 'flight_number', e.target.value))}
          />
        </label>
        <label>
          <span className={VIP_LABEL}>مغادرة</span>
          <VipTimeSlotSelect
            className={VIP_INPUT}
            value={flight.departure_time || flight.flight_time}
            onChange={(v) => onFlightChange(pf(flight, 'departure_time', v))}
          />
        </label>
        <label>
          <span className={VIP_LABEL}>وصول</span>
          <VipTimeSlotSelect
            className={VIP_INPUT}
            value={flight.arrival_time}
            onChange={(v) => onFlightChange(pf(flight, 'arrival_time', v))}
          />
        </label>
        <label>
          <span className={VIP_LABEL}>المبنى</span>
          <input
            className={VIP_INPUT}
            dir="ltr"
            placeholder="T1"
            value={flight.terminal}
            onChange={(e) => onFlightChange(pf(flight, 'terminal', e.target.value))}
          />
        </label>
        <label>
          <span className={VIP_LABEL}>درجة الإركاب</span>
          <select
            className={VIP_INPUT}
            dir="ltr"
            value={flight.flight_class}
            onChange={(e) => onFlightChange(pf(flight, 'flight_class', e.target.value))}
          >
            <option value="">—</option>
            {FLIGHT_CLASS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={VIP_LABEL}>البوابة</span>
          <input
            className={VIP_INPUT}
            dir="ltr"
            value={flight.gate}
            onChange={(e) => onFlightChange(pf(flight, 'gate', e.target.value))}
          />
        </label>
        <label>
          <span className={VIP_LABEL}>المقعد</span>
          <input
            className={VIP_INPUT}
            dir="ltr"
            value={flight.flight_seat}
            onChange={(e) => onFlightChange(pf(flight, 'flight_seat', e.target.value))}
          />
        </label>
        <label>
          <span className={VIP_LABEL}>PNR</span>
          <input
            className={VIP_INPUT}
            dir="ltr"
            value={flight.booking_reference}
            onChange={(e) =>
              onFlightChange(pf(flight, 'booking_reference', e.target.value))
            }
          />
        </label>
        <label className="sm:col-span-2 lg:col-span-1">
          <span className={VIP_LABEL}>المسار</span>
          <div className="flex gap-1">
            <input
              className={VIP_INPUT}
              dir="ltr"
              placeholder="من"
              value={flight.flight_from}
              onChange={(e) => onFlightChange(pf(flight, 'flight_from', e.target.value))}
            />
            <input
              className={VIP_INPUT}
              dir="ltr"
              placeholder="إلى"
              value={flight.flight_to}
              onChange={(e) => onFlightChange(pf(flight, 'flight_to', e.target.value))}
            />
          </div>
        </label>
        <label>
          <span className={VIP_LABEL}>دولة المغادرة</span>
          <input
            className={VIP_INPUT}
            placeholder="السعودية"
            value={flight.departure_country}
            onChange={(e) => onFlightChange(pf(flight, 'departure_country', e.target.value))}
          />
        </label>
        <label>
          <span className={VIP_LABEL}>دولة الوصول</span>
          <input
            className={VIP_INPUT}
            placeholder="هنغاريا"
            value={flight.arrival_country}
            onChange={(e) => onFlightChange(pf(flight, 'arrival_country', e.target.value))}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 border-t border-[#D4AF37]/40 pt-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="sm:col-span-2">
          <span className={VIP_LABEL}>اسم الفندق</span>
          <input
            className={VIP_INPUT}
            value={hotel.name}
            onChange={(e) => onHotelChange(ph(hotel, 'name', e.target.value))}
          />
        </label>
        <label className="sm:col-span-2 lg:col-span-2">
          <span className={VIP_LABEL}>العنوان</span>
          <input
            className={VIP_INPUT}
            dir="ltr"
            value={hotel.address}
            onChange={(e) => onHotelChange(ph(hotel, 'address', e.target.value))}
          />
        </label>
        <label>
          <span className={VIP_LABEL}>التأكيد</span>
          <input
            className={VIP_INPUT}
            dir="ltr"
            value={hotel.booking_reference}
            onChange={(e) =>
              onHotelChange(ph(hotel, 'booking_reference', e.target.value))
            }
          />
        </label>
        <label>
          <span className={VIP_LABEL}>دخول</span>
          <VipDateField
            value={hotel.check_in}
            onChange={(v) => onHotelChange(ph(hotel, 'check_in', v))}
          />
        </label>
        <label>
          <span className={VIP_LABEL}>خروج</span>
          <VipDateField
            value={hotel.check_out}
            onChange={(v) => onHotelChange(ph(hotel, 'check_out', v))}
          />
        </label>
      </div>
    </section>
  );
}
