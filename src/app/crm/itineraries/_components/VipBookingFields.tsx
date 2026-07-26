'use client';

import { useMemo } from 'react';

import {
  flightTimeSelectOptions,
  normalizeFlightTimeValue,
} from '@/lib/flight-time-slots';

export const VIP_TIME_SELECT_CLASS =
  'w-full cursor-pointer appearance-none rounded-lg border border-[#D4AF37]/60 bg-[#FFFBF0] bg-[length:1rem] bg-[position:left_0.65rem_center] bg-no-repeat px-3 py-2.5 ps-9 text-sm font-semibold text-[#1E2720] outline-none transition focus:border-[#1E2720] focus:ring-2 focus:ring-[#D4AF37]/40';

export const VIP_DATE_INPUT_CLASS =
  'w-full cursor-pointer rounded-lg border border-[#D4AF37]/60 bg-[#FFFBF0] px-3 py-2.5 text-sm font-semibold text-[#1E2720] outline-none transition focus:border-[#1E2720] focus:ring-2 focus:ring-[#D4AF37]/40 [color-scheme:light]';

const TIME_SELECT_CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%231E2720' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

type VipTimeSlotSelectProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
  placeholder?: string;
};

export function VipTimeSlotSelect({
  value,
  onChange,
  className,
  id,
  placeholder = 'اختر الوقت',
}: VipTimeSlotSelectProps) {
  const normalized = normalizeFlightTimeValue(value);
  const options = useMemo(() => flightTimeSelectOptions(value), [value]);

  return (
    <select
      id={id}
      value={normalized}
      onChange={(e) => onChange(e.target.value)}
      dir="ltr"
      className={`cursor-pointer appearance-none bg-no-repeat bg-[length:1rem] bg-[position:left_0.65rem_center] ps-9 ${className ?? VIP_TIME_SELECT_CLASS}`}
      style={{ backgroundImage: TIME_SELECT_CHEVRON }}
    >
      <option value="">{placeholder}</option>
      {options.map((slot) => (
        <option key={slot} value={slot}>
          {slot}
        </option>
      ))}
    </select>
  );
}

type VipDateFieldProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
  min?: string;
  max?: string;
};

function openNativeDatePicker(el: HTMLInputElement) {
  if (typeof el.showPicker === 'function') {
    try {
      el.showPicker();
    } catch {
      /* Safari / unsupported — ignore */
    }
  }
}

export function VipDateField({
  value,
  onChange,
  className,
  id,
  min,
  max,
}: VipDateFieldProps) {
  return (
    <input
      type="date"
      id={id}
      value={value}
      min={min}
      max={max}
      dir="ltr"
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => openNativeDatePicker(e.currentTarget)}
      onFocus={(e) => openNativeDatePicker(e.currentTarget)}
      className={`cursor-pointer ${className ?? VIP_DATE_INPUT_CLASS}`}
    />
  );
}
