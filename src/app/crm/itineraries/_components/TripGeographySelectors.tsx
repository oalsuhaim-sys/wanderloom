'use client';

import { TRIP_DESTINATIONS } from '@/lib/trip-destination-data';
import {
  cityOptionsForCountries,
  type GeoTripType,
} from '@/lib/itinerary-geography';

const FIELD =
  'w-full rounded-lg border border-gray-200 bg-gray-50 p-3 outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/50 text-gray-900';

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
  const countryOptions = TRIP_DESTINATIONS.map((c) => c.labelAr);
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
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-bold text-gray-700">نوع المسار</p>
        <div className="flex flex-wrap gap-3">
          {(
            [
              { value: 'single' as const, label: 'دولة واحدة' },
              { value: 'multi' as const, label: 'دول متعددة' },
            ] as const
          ).map((opt) => (
            <label
              key={opt.value}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition ${
                geoTripType === opt.value
                  ? 'border-[#D4AF37] bg-[#FFFBF0] text-[#1E2720]'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-[#D4AF37]/40'
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
                className="accent-[#D4AF37]"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {geoTripType === 'single' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-bold text-gray-700">الدولة</span>
            <select
              value={countries[0] ?? ''}
              onChange={(e) => handleSingleCountry(e.target.value)}
              className={FIELD}
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
            <span className="text-sm font-bold text-gray-700">المدينة / المدن</span>
            {!countries[0] ? (
              <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-sm text-gray-500">
                اختر الدولة أولاً لعرض المدن المتاحة.
              </p>
            ) : (
              <>
                <div className="max-h-36 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3">
                  <div className="flex flex-wrap gap-2">
                    {cityOptions.map((city) => (
                      <label
                        key={city}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                          cities.includes(city)
                            ? 'border-[#D4AF37] bg-[#FFFBF0] text-[#1E2720]'
                            : 'border-gray-200 bg-gray-50 text-gray-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={cities.includes(city)}
                          onChange={(e) => handleSingleCityToggle(city, e.target.checked)}
                          className="accent-[#D4AF37]"
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
                    className={`${FIELD} flex-1 text-sm`}
                  />
                  <button
                    type="button"
                    onClick={applyCustomCities}
                    disabled={!customCitiesText.trim()}
                    className="shrink-0 rounded-lg border border-[#D4AF37]/40 bg-[#1E2720] px-3 py-2 text-xs font-bold text-[#D4AF37] disabled:opacity-50"
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
            <span className="text-sm font-bold text-gray-700">الدول</span>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3">
              <div className="flex flex-wrap gap-2">
                {countryOptions.map((country) => (
                  <label
                    key={country}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                      countries.includes(country)
                        ? 'border-[#D4AF37] bg-[#FFFBF0] text-[#1E2720]'
                        : 'border-gray-200 bg-gray-50 text-gray-600'
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
                      className="accent-[#D4AF37]"
                    />
                    {country}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-bold text-gray-700">المدن</span>
            {!countries.length ? (
              <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-sm text-gray-500">
                اختر دولة واحدة على الأقل لعرض المدن.
              </p>
            ) : (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3">
                <div className="flex flex-wrap gap-2">
                  {cityOptions.map((city) => (
                    <label
                      key={city}
                      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                        cities.includes(city)
                          ? 'border-[#D4AF37] bg-[#FFFBF0] text-[#1E2720]'
                          : 'border-gray-200 bg-gray-50 text-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={cities.includes(city)}
                        onChange={(e) => handleSingleCityToggle(city, e.target.checked)}
                        className="accent-[#D4AF37]"
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
        <span className="text-sm font-bold text-gray-700">عنوان الرحلة (يظهر للعميل)</span>
        <input
          type="text"
          value={tripTitle}
          onChange={(e) => onTripTitleChange(e.target.value)}
          placeholder="مثال: عطلة الصيف في أوروبا"
          readOnly={titleReadOnly}
          disabled={titleReadOnly}
          className={`${FIELD} ${titleReadOnly ? 'cursor-not-allowed bg-slate-100 text-slate-700' : ''}`}
        />
        <p className="text-xs text-gray-500">
          {titleReadOnly
            ? 'مأخوذ تلقائياً من عرض السعر المحدد — للقراءة فقط.'
            : 'هذا العنوان الرئيسي في بوابة العميل — منفصل عن مدن برنامج الأيام.'}
        </p>
      </label>

      {(countries.length > 0 || cities.length > 0) && (
        <p className="rounded-lg border border-[#D4AF37]/25 bg-[#FEFDF9] px-3 py-2 text-xs font-bold text-[#1E2720]">
          {countries.length ? `الدول: ${countries.join(' · ')}` : null}
          {countries.length && cities.length ? ' — ' : null}
          {cities.length ? `المدن: ${cities.join(' · ')}` : null}
        </p>
      )}
    </div>
  );
}
