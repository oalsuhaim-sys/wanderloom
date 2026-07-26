'use client';

import {
  DNA_INVITE_TRIP_TYPE_OPTIONS,
  type DnaInviteTripType,
} from '@/lib/client-intake-pipeline';

type DnaInviteTripTypePickerProps = {
  value: DnaInviteTripType;
  onChange: (value: DnaInviteTripType) => void;
  disabled?: boolean;
  className?: string;
};

/** اختيار نوع الرحلة لصيغة رسالة واتساب فقط — الرابط واحد دائماً */
export default function DnaInviteTripTypePicker({
  value,
  onChange,
  disabled = false,
  className = '',
}: DnaInviteTripTypePickerProps) {
  return (
    <div className={`space-y-2 ${className}`} dir="rtl">
      <p className="text-[11px] font-black text-slate-600">نوع الرحلة لرسالة الواتساب</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {DNA_INVITE_TRIP_TYPE_OPTIONS.map((option) => {
          const selected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.id)}
              className={`rounded-xl border px-3 py-2.5 text-xs font-black transition disabled:opacity-50 ${
                selected
                  ? 'border-[#D4AF37] bg-[#D4AF37]/15 text-[#1E2720] ring-2 ring-[#D4AF37]/35'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-[#D4AF37]/40 hover:bg-[#FEFDF9]'
              }`}
              aria-pressed={selected}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
