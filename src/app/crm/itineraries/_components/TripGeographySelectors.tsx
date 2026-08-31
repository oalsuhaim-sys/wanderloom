'use client';

import { useCountries } from '@/hooks/useCountries';
import {
  cityOptionsForCountries,
  type GeoTripType,
} from '@/lib/itinerary-geography';
import {
  WL_BTN_PRIMARY,
  WL_HINT,
  WL_INPUT,
  WL_LABEL,
  WL_TOGGLE_ACTIVE,
  WL_TOGGLE_BASE,
  WL_TOGGLE_INACTIVE,
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
  const { countries: dynamicCountries } = useCountries();
  const countryOptions = dynamicCountries.map((country) => country.name);
  const cityOptions = cityOptionsForCountries(countries);

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
      <div>
        <p className={WL_LABEL}>نوع المسار</p>
        <div className="flex flex-wrap gap-3">
          {(
            [
              { value: 'single' as const, label: 'دولة واحدة' },
              { value: 'multi' as const, label: 'دول متعددة' },
            ] as const
          ).map((opt) => (
            <label
              key={opt.value}
              className={`${WL_TOGGLE_BASE} cursor-pointer ${
                geoTripType === opt.value ? WL_TOGGLE_ACTIVE : WL_TOGGLE_INACTIVE
              }`}
            >
              <input
                type="radio"
                name="geo-trip-type"
                value={opt.value}
                checked={geoTripType === opt.value}
                onChange={() => {
                  onGeoTripTypeChange(opt.value);
                  if (opt.value === 'single' && countries.length > 1) {
                    onCountriesChange(countries.slice(0, 1));
                  }
                }}
                className="me-2 accent-[#D4AF37]"
              />
              <span
                className={
                  geoTripType === opt.value
                    ? 'font-black text-slate-950'
                    : 'font-bold text-slate-600'
                }
              >
                {opt.label}
              </span>
            </label>
          ))}
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
                اختر الدولة أولاً لعرض المدن المتاحة.
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
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span className={WL_LABEL}>الدول</span>
            <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap gap-2">
                {countryOptions.map((country) => (
                  <label
                    key={country}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                      countries.includes(country)
                        ? 'border-[#D4AF37] bg-[#D4AF37] text-slate-950'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={countries.includes(country)}
                      onChange={(e) => {
                        const next = toggleValue(countries, country, e.target.checked);
                        onCountriesChange(next);
                        if (!e.target.checked) {
                          const allowed = new Set(cityOptionsForCountries(next));
                          onCitiesChange(cities.filter((c) => allowed.has(c)));
                        }
                      }}
                      className="accent-[#0F172A]"
                    />
                    {country}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className={WL_LABEL}>المدن</span>
            {!countries.length ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                اختر دولة واحدة على الأقل لعرض المدن.
              </p>
            ) : (
              <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
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
                        onChange={(e) =>
                          onCitiesChange(toggleValue(cities, city, e.target.checked))
                        }
                        className="accent-[#0F172A]"
                      />
                      {city}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <label className="flex flex-col gap-2">
        <span className={WL_LABEL}>عنوان الرحلة (يظهر للعميل)</span>
        <input
          type="text"
          value={tripTitle}
          onChange={(e) => onTripTitleChange(e.target.value)}
          readOnly={titleReadOnly}
          disabled={titleReadOnly}
          placeholder="مثال: عطلة الصيف في أوروبا"
          className={`${WL_INPUT} ${
            titleReadOnly ? 'cursor-not-allowed opacity-70' : ''
          }`}
        />
        <span className={WL_HINT}>
          {titleReadOnly
            ? 'مأخوذ تلقائياً من عرض السعر المحدد — للقراءة فقط.'
            : 'هذا العنوان الرئيسي في بوابة العميل — منفصل عن مدن برنامج الأيام.'}
        </span>
      </label>

      {countries.length > 0 || cities.length > 0 ? (
        <p className="rounded-xl border border-[#D4AF37]/30 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
          {countries.length ? `الدول: ${countries.join(' · ')}` : null}
          {countries.length && cities.length ? ' — ' : null}
          {cities.length ? `المدن: ${cities.join(' · ')}` : null}
        </p>
      ) : null}
    </div>
  );
}
