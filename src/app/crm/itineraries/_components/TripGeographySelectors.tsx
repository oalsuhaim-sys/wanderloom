'use client';

import { usePlacesBankDestinations } from '@/hooks/usePlacesBankDestinations';
import {
  type GeoTripType,
} from '@/lib/itinerary-geography';
import {
  WL_BTN_PRIMARY,
  WL_HINT,
  WL_INPUT,
  WL_LABEL,
} from '@/lib/itinerary-builder-ui';

type Props = {
  geoTripType: GeoTripType;
  onGeoTripTypeChange: (value: GeoTripType) => void;
  countries: string[];
  onCountriesChange: (value: string[]) => void;
  cities: string[];
  onCitiesChange: (value: string[]) => void;
  tripTitle: string;
  onTripTitleChange: (value: string) => void;
  /** مدن مخصصة (نص) في وضع دولة واحدة */
  customCitiesText?: string;
  onCustomCitiesTextChange?: (value: string) => void;
  /** عنوان مقفول من عرض السعر */
  titleReadOnly?: boolean;
};

function toggleValue(list: string[], value: string, checked: boolean): string[] {
  if (checked) return list.includes(value) ? list : [...list, value];
  return list.filter((item) => item !== value);
}

export default function TripGeographySelectors({
  geoTripType,
  onGeoTripTypeChange,
  countries,
  onCountriesChange,
  cities,
  onCitiesChange,
  tripTitle,
  onTripTitleChange,
  customCitiesText = '',
  onCustomCitiesTextChange,
  titleReadOnly = false,
}: Props) {
  const { countries: countryOptions, citiesForCountries } = usePlacesBankDestinations();
  const cityOptions = citiesForCountries(countries);

  const handleSingleCountry = (country: string) => {
    onCountriesChange(country ? [country] : []);
    onCitiesChange([]);
    onCustomCitiesTextChange?.('');
  };

  const handleSingleCityToggle = (city: string, checked: boolean) => {
    onCitiesChange(toggleValue(cities, city, checked));
  };

  const applyCustomCities = () => {
    const extra = customCitiesText
      .split(/[,،]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const merged = [...new Set([...cities, ...extra])];
    onCitiesChange(merged);
    onCustomCitiesTextChange?.('');
  };

  return (
    <div className="space-y-4 text-slate-800">
      <div className="space-y-2">
        <label className="block text-xs font-bold text-slate-800">نوع المسار</label>
        <div className="flex flex-wrap items-center gap-3">
          {(
            [
              { value: 'single' as const, label: 'دولة واحدة' },
              { value: 'multi' as const, label: 'دول متعددة' },
            ] as const
          ).map((opt) => {
            const active = geoTripType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onGeoTripTypeChange(opt.value);
                  if (opt.value === 'single' && countries.length > 1) {
                    onCountriesChange(countries.slice(0, 1));
                  }
                }}
                className={`flex items-center gap-2 rounded-2xl border px-6 py-3 text-xs font-bold transition-all ${
                  active
                    ? 'border-[#C59B4B] bg-[#C59B4B] text-slate-900 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span
                  className={`h-3 w-3 rounded-full border-2 ${
                    active ? 'border-slate-900 bg-slate-900' : 'border-slate-400'
                  }`}
                />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {geoTripType === 'single' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className={WL_LABEL}>الدولة</span>
            <select
              value={countries[0] ?? ''}
              onChange={(e) => handleSingleCountry(e.target.value)}
              className={WL_INPUT}
            >
              <option value="">— اختر الدولة —</option>
              {countryOptions.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-2">
            <span className={WL_LABEL}>المدينة / المدن</span>
            {!countries[0] ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                اختر الدولة أولاً لعرض المدن المتاحة من بنك الأماكن.
              </p>
            ) : cityOptions.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                لا مدن في بنك الأماكن لهذه الدولة — أضف مدينة يدوياً أدناه.
              </p>
            ) : (
              <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap gap-2">
                  {cityOptions.map((city) => (
                    <label
                      key={city}
                      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                        cities.includes(city)
                          ? 'border-[#D4AF37] bg-[#D4AF37] text-slate-950'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={cities.includes(city)}
                        onChange={(e) => handleSingleCityToggle(city, e.target.checked)}
                        className="accent-[#0F172A]"
                      />
                      {city}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {countries[0] ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customCitiesText}
                  onChange={(e) => onCustomCitiesTextChange?.(e.target.value)}
                  placeholder="مدن إضافية (مثال: نيس، ليون)"
                  className={`${WL_INPUT} flex-1 text-sm`}
                />
                <button
                  type="button"
                  onClick={applyCustomCities}
                  disabled={!customCitiesText.trim()}
                  className={`${WL_BTN_PRIMARY} shrink-0 !px-3 !py-2 text-xs`}
                >
                  إضافة
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span className="block text-xs font-bold text-slate-800">الدول</span>
            <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-2xl border border-slate-200 bg-[#F8F5EE]/40 p-4">
              {countryOptions.map((country) => {
                const selected = countries.includes(country);
                return (
                  <label
                    key={country}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition-all ${
                      selected
                        ? 'border-[#C59B4B] bg-white text-slate-900 shadow-sm'
                        : 'border-slate-200 bg-white/60 text-slate-600 hover:bg-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(e) => {
                        const next = toggleValue(countries, country, e.target.checked);
                        onCountriesChange(next);
                        if (!e.target.checked) {
                          const allowed = new Set(citiesForCountries(next));
                          onCitiesChange(cities.filter((c) => allowed.has(c)));
                        }
                      }}
                      className="h-3.5 w-3.5 rounded accent-[#C59B4B]"
                    />
                    <span>{country}</span>
                  </label>
                );
              })}
            </div>
            {!countryOptions.length ? (
              <p className={WL_HINT}>لا دول في بنك الأماكن بعد — أضف أماكن من الخزنة أولاً.</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <span className={WL_LABEL}>المدن (اختياري)</span>
            {!countries.length ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                اختر دولة واحدة أو أكثر لعرض المدن.
              </p>
            ) : (
              <>
                <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap gap-2">
                    {cityOptions.map((city) => (
                      <label
                        key={city}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                          cities.includes(city)
                            ? 'border-[#D4AF37] bg-[#D4AF37] text-slate-950'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={cities.includes(city)}
                          onChange={(e) => handleSingleCityToggle(city, e.target.checked)}
                          className="accent-[#0F172A]"
                        />
                        {city}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customCitiesText}
                    onChange={(e) => onCustomCitiesTextChange?.(e.target.value)}
                    placeholder="مدن إضافية"
                    className={`${WL_INPUT} flex-1 text-sm`}
                  />
                  <button
                    type="button"
                    onClick={applyCustomCities}
                    disabled={!customCitiesText.trim()}
                    className={`${WL_BTN_PRIMARY} shrink-0 !px-3 !py-2 text-xs`}
                  >
                    إضافة
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <label className="flex flex-col gap-2">
        <span className={WL_LABEL}>عنوان الرحلة</span>
        <input
          type="text"
          value={tripTitle}
          onChange={(e) => onTripTitleChange(e.target.value)}
          readOnly={titleReadOnly}
          className={`${WL_INPUT} ${titleReadOnly ? 'cursor-not-allowed bg-slate-50 opacity-80' : ''}`}
          placeholder="مثال: رحلة باريس الرومانسية"
        />
      </label>
    </div>
  );
}
