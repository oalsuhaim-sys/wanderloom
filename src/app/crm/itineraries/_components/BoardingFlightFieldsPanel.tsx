'use client';

import { Plane } from 'lucide-react';

import { VipTimeSlotSelect } from '@/app/crm/itineraries/_components/VipBookingFields';
import { FLIGHT_CLASS_OPTIONS } from '@/lib/itinerary-builder-model';
import { normalizeSingleArrivalCity } from '@/lib/vip-flight-voucher';

const labelClass = 'mb-2 block text-xs font-semibold text-slate-700';
const inputClass =
  'w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 outline-none transition focus:border-[#D4AF37] placeholder:text-slate-600 [color-scheme:light]';
const darkTimeSelectClass =
  'w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 bg-[length:1rem] bg-[position:left_0.65rem_center] bg-no-repeat px-4 py-2.5 ps-9 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/40 [color-scheme:light]';

const sectionTitleClass =
  'mb-4 text-[11px] font-black uppercase tracking-[0.14em] text-[#D4AF37]';

export type BoardingFlightFieldsValue = {
  originCity: string;
  departureCountry: string;
  flightArrivalCity: string;
  arrivalCountry: string;
  flightNumber: string;
  pnr: string;
  flightClass: string;
  departureTime: string;
  arrivalTime: string;
  terminal: string;
  gate: string;
  seat: string;
};

type Props = {
  value: BoardingFlightFieldsValue;
  onChange: (patch: Partial<BoardingFlightFieldsValue>) => void;
  tripCities?: string[];
  datalistId?: string;
  title?: string;
  subtitle?: string;
};

export default function BoardingFlightFieldsPanel({
  value,
  onChange,
  tripCities = [],
  datalistId = 'boarding-flight-arrival-city-suggestions',
  title = 'بيانات البوردينق والحجوزات الفندقية',
  subtitle = 'تنظيم واضح لمسار الرحلة وبيانات الصعود',
}: Props) {
  const arrivalPlaceholder = tripCities[0]
    ? `مثال: ${tripCities[0]}`
    : 'مثال: سيول';

  return (
    <div className="w-full max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-6">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-200">
          <Plane className="h-5 w-5 text-[#D4AF37]" aria-hidden />
        </div>
        <div>
          <h3 className="text-lg font-extrabold text-slate-900">{title}</h3>
          {subtitle ? (
            <p className="mt-0.5 text-xs font-medium text-slate-500">{subtitle}</p>
          ) : null}
        </div>
      </div>

      {/* SECTION A — Departure & Arrival */}
      <div className="mb-8">
        <h4 className={sectionTitleClass}>المغادرة والوصول</h4>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-5 rounded-xl border border-slate-200/70 bg-slate-50/80 p-4">
            <label className="block">
              <span className={labelClass}>من مدينة (رحلة الطيران)</span>
              <input
                type="text"
                value={value.originCity}
                onChange={(e) => onChange({ originCity: e.target.value })}
                placeholder="مثال: الرياض"
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className={labelClass}>دولة المغادرة</span>
              <input
                type="text"
                value={value.departureCountry}
                onChange={(e) => onChange({ departureCountry: e.target.value })}
                placeholder="السعودية"
                className={inputClass}
              />
            </label>
          </div>

          <div className="space-y-5 rounded-xl border border-slate-200/70 bg-slate-50/80 p-4">
            <label className="block">
              <span className={labelClass}>إلى مدينة (رحلة الطيران)</span>
              <input
                type="text"
                list={datalistId}
                value={value.flightArrivalCity}
                onChange={(e) => onChange({ flightArrivalCity: e.target.value })}
                onBlur={(e) =>
                  onChange({
                    flightArrivalCity: normalizeSingleArrivalCity(e.target.value),
                  })
                }
                placeholder={arrivalPlaceholder}
                className={inputClass}
              />
              {tripCities.length > 0 ? (
                <datalist id={datalistId}>
                  {tripCities.map((city) => (
                    <option key={city} value={city} />
                  ))}
                </datalist>
              ) : null}
              <span className="mt-1.5 block text-[11px] text-slate-500">
                مدينة هبوط الطيران فقط — لا تُربط تلقائياً بكل مدن المسار.
              </span>
            </label>
            <label className="block">
              <span className={labelClass}>دولة الوصول</span>
              <input
                type="text"
                value={value.arrivalCountry}
                onChange={(e) => onChange({ arrivalCountry: e.target.value })}
                placeholder="هنغاريا"
                className={inputClass}
              />
            </label>
          </div>
        </div>
      </div>

      {/* SECTION B — Flight Identification */}
      <div className="mb-8">
        <h4 className={sectionTitleClass}>تعريف الرحلة</h4>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className={labelClass}>رقم الرحلة</span>
            <input
              type="text"
              value={value.flightNumber}
              onChange={(e) => onChange({ flightNumber: e.target.value })}
              placeholder="SV130"
              dir="ltr"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>رقم تأكيد الطيران (PNR)</span>
            <input
              type="text"
              value={value.pnr}
              onChange={(e) => onChange({ pnr: e.target.value })}
              placeholder="ABC12X"
              dir="ltr"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>الدرجة</span>
            <select
              value={value.flightClass}
              onChange={(e) => onChange({ flightClass: e.target.value })}
              dir="ltr"
              className={inputClass}
            >
              <option value="">— اختر —</option>
              {FLIGHT_CLASS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* SECTION C — Timings & Seating */}
      <div>
        <h4 className={sectionTitleClass}>المواعيد والمقعد</h4>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className={labelClass}>وقت المغادرة</span>
            <VipTimeSlotSelect
              value={value.departureTime}
              onChange={(v) => onChange({ departureTime: v })}
              className={darkTimeSelectClass}
              chevron="light"
            />
          </label>
          <label className="block">
            <span className={labelClass}>وقت الوصول</span>
            <VipTimeSlotSelect
              value={value.arrivalTime}
              onChange={(v) => onChange({ arrivalTime: v })}
              className={darkTimeSelectClass}
              chevron="light"
            />
          </label>
          <div className="block">
            <span className={labelClass}>المبنى / البوابة</span>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={value.terminal}
                onChange={(e) => onChange({ terminal: e.target.value })}
                placeholder="T1"
                dir="ltr"
                aria-label="المبنى"
                className={inputClass}
              />
              <input
                type="text"
                value={value.gate}
                onChange={(e) => onChange({ gate: e.target.value })}
                placeholder="A12"
                dir="ltr"
                aria-label="البوابة"
                className={inputClass}
              />
            </div>
          </div>
          <label className="block">
            <span className={labelClass}>المقعد</span>
            <input
              type="text"
              value={value.seat}
              onChange={(e) => onChange({ seat: e.target.value })}
              placeholder="5A"
              dir="ltr"
              className={inputClass}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
