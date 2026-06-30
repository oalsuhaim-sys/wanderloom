'use client';

import { Plane } from 'lucide-react';

import type { FlightDetailsDraft } from '@/lib/itinerary-builder-model';

const inputClass =
  'w-full rounded-lg border border-[#1E2720]/15 bg-white px-3 py-2 text-sm font-bold text-[#1E2720] outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/40';

type Props = {
  flight: FlightDetailsDraft;
  onChange: (flight: FlightDetailsDraft) => void;
};

function patch(
  flight: FlightDetailsDraft,
  key: keyof FlightDetailsDraft,
  value: string,
): FlightDetailsDraft {
  const next = { ...flight, [key]: value };
  if (key === 'departure_time') {
    next.flight_time = value;
  }
  return next;
}

export default function ItineraryBoardingDetailsForm({ flight, onChange }: Props) {
  return (
    <section
      className="rounded-[1.25rem] border border-[#D4AF37]/35 bg-white p-4 shadow-[0_8px_28px_rgba(30,39,32,0.06)] ring-1 ring-[#1E2720]/5 sm:p-5"
      aria-labelledby="boarding-details-title"
    >
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1E2720]">
          <Plane className="h-5 w-5 text-[#D4AF37]" aria-hidden />
        </div>
        <div>
          <h2 id="boarding-details-title" className="text-base font-black text-[#1E2720]">
            بيانات البوردينق
          </h2>
          <p className="text-[11px] font-medium text-[#1E2720]/55">
            Boarding Details — تظهر فوراً في بطاقة صعود العميل
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-[#D4AF37]">
            من (مطار المغادرة)
          </span>
          <input
            value={flight.flight_from}
            onChange={(e) => onChange(patch(flight, 'flight_from', e.target.value))}
            className={inputClass}
            placeholder="RUH"
            dir="ltr"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-[#D4AF37]">
            إلى (الوجهة)
          </span>
          <input
            value={flight.flight_to}
            onChange={(e) => onChange(patch(flight, 'flight_to', e.target.value))}
            className={inputClass}
            placeholder="CDG"
            dir="ltr"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-[#D4AF37]">
            رقم الرحلة
          </span>
          <input
            value={flight.flight_number}
            onChange={(e) => onChange(patch(flight, 'flight_number', e.target.value))}
            className={inputClass}
            placeholder="SV130"
            dir="ltr"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-[#D4AF37]">
            رقم الحجز (PNR)
          </span>
          <input
            value={flight.booking_reference}
            onChange={(e) => onChange(patch(flight, 'booking_reference', e.target.value))}
            className={inputClass}
            placeholder="ABC12X"
            dir="ltr"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-[#D4AF37]">
            البوابة
          </span>
          <input
            value={flight.gate}
            onChange={(e) => onChange(patch(flight, 'gate', e.target.value))}
            className={inputClass}
            placeholder="A12"
            dir="ltr"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-[#D4AF37]">
            المقعد
          </span>
          <input
            value={flight.flight_seat}
            onChange={(e) => onChange(patch(flight, 'flight_seat', e.target.value))}
            className={inputClass}
            placeholder="12A"
            dir="ltr"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-[#D4AF37]">
            وقت المغادرة
          </span>
          <input
            value={flight.departure_time || flight.flight_time}
            onChange={(e) => onChange(patch(flight, 'departure_time', e.target.value))}
            className={inputClass}
            placeholder="14:30"
            dir="ltr"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-[#D4AF37]">
            وقت الوصول
          </span>
          <input
            value={flight.arrival_time}
            onChange={(e) => onChange(patch(flight, 'arrival_time', e.target.value))}
            className={inputClass}
            placeholder="18:45"
            dir="ltr"
          />
        </label>
      </div>

      <p className="mt-3 text-[10px] font-medium text-[#1E2720]/45">
        يُحفظ في <span className="font-mono">flight_details</span> عند «حفظ المسار».
      </p>
    </section>
  );
}
