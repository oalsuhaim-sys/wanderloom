'use client';

import { useMemo } from 'react';

import { usePlacesBankDestinations } from '@/hooks/usePlacesBankDestinations';

const CHIP_ACTIVE =
  'border-slate-900 bg-slate-900 text-white dark:border-[#D4AF37]/50 dark:bg-[#D4AF37]/20 dark:text-[#D4AF37]';
const CHIP_IDLE =
  'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-slate-300';

export function splitSpecialtyTags(value: string): string[] {
  return String(value ?? '')
    .split(/[,،/|·]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function joinSpecialtyTags(tags: string[]): string {
  return [...new Set(tags.map((t) => t.trim()).filter(Boolean))].join('، ');
}

type Props = {
  /** قيم محفوظة كنص مفصول بفواصل (دول + مدن) */
  value: string;
  onChange: (next: string) => void;
  /** عنوان القسم */
  legend?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * اختيار البلد / المدن المغطاة من بنك الأماكن — مصدر الحقيقة الوحيد للوجهات.
 */
export default function PlacesBankSpecialtyPicker({
  value,
  onChange,
  legend = 'البلد / المدن المغطاة',
  disabled = false,
  className = '',
}: Props) {
  const { countries, citiesByCountry, loading, error } = usePlacesBankDestinations();
  const selected = useMemo(() => splitSpecialtyTags(value), [value]);

  const toggle = (label: string) => {
    if (disabled) return;
    const next = selected.includes(label)
      ? selected.filter((item) => item !== label)
      : [...selected, label];
    onChange(joinSpecialtyTags(next));
  };

  const selectedCountries = countries.filter((c) => selected.includes(c));

  return (
    <fieldset className={`space-y-3 ${className}`} disabled={disabled}>
      <legend className="mb-1 text-xs font-bold text-slate-600 dark:text-slate-400">
        {legend}
      </legend>

      {loading ? (
        <p className="text-xs font-medium text-slate-500">جاري تحميل وجهات بنك الأماكن…</p>
      ) : null}
      {error ? (
        <p className="text-xs font-bold text-rose-600">تعذر تحميل الوجهات: {error}</p>
      ) : null}
      {!loading && !countries.length ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-xs font-medium text-slate-500 dark:border-[#2D3F3A] dark:bg-[#1A2421]">
          لا دول في بنك الأماكن بعد — أضف أماكن من الخزنة لتظهر هنا كخيارات تخصص للخبير.
        </p>
      ) : null}

      {countries.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-slate-500">الدول</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
            {countries.map((country) => {
              const isOn = selected.includes(country);
              return (
                <button
                  key={country}
                  type="button"
                  aria-pressed={isOn}
                  disabled={disabled}
                  onClick={() => toggle(country)}
                  className={`rounded-xl border px-3 py-2 text-xs font-medium transition disabled:opacity-50 ${
                    isOn ? CHIP_ACTIVE : CHIP_IDLE
                  }`}
                >
                  {isOn ? '✓ ' : ''}
                  {country}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {selectedCountries.length > 0 ? (
        <div className="space-y-3 border-t border-slate-100 pt-3 dark:border-[#2D3F3A]">
          <p className="text-[11px] font-semibold text-slate-500">المدن (حسب الدولة المختارة)</p>
          {selectedCountries.map((country) => {
            const cities = citiesByCountry[country] ?? [];
            if (!cities.length) {
              return (
                <p key={country} className="text-[11px] text-slate-400">
                  {country}: لا مدن في بنك الأماكن بعد
                </p>
              );
            }
            return (
              <div key={country} className="space-y-1.5">
                <p className="text-[10px] font-bold text-slate-400">{country}</p>
                <div className="flex flex-wrap gap-2">
                  {cities.map((city) => {
                    const isOn = selected.includes(city);
                    return (
                      <button
                        key={`${country}:${city}`}
                        type="button"
                        aria-pressed={isOn}
                        disabled={disabled}
                        onClick={() => toggle(city)}
                        className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition disabled:opacity-50 ${
                          isOn ? CHIP_ACTIVE : CHIP_IDLE
                        }`}
                      >
                        {isOn ? '✓ ' : ''}
                        {city}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : countries.length > 0 ? (
        <p className="text-[11px] font-medium text-slate-400">
          اختر دولة أولاً لعرض مدنها من بنك الأماكن.
        </p>
      ) : null}

      {/* احتفظ بقيم محفوظة غير موجودة في البنك (توافق خلفي) */}
      {selected.some((tag) => !countries.includes(tag) && !Object.values(citiesByCountry).flat().includes(tag)) ? (
        <div className="flex flex-wrap gap-2">
          {selected
            .filter(
              (tag) =>
                !countries.includes(tag) &&
                !Object.values(citiesByCountry).flat().includes(tag),
            )
            .map((tag) => (
              <button
                key={`legacy-${tag}`}
                type="button"
                onClick={() => toggle(tag)}
                disabled={disabled}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-bold ${CHIP_ACTIVE}`}
                title="قيمة قديمة — انقر لإزالتها"
              >
                ✓ {tag}
              </button>
            ))}
        </div>
      ) : null}
    </fieldset>
  );
}
