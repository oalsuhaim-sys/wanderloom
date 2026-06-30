'use client';

import { BedDouble, Car, MapPin, Plus, Trash2 } from 'lucide-react';

import PlaceSearchInput from '@/app/crm/itineraries/_components/PlaceSearchInput';
import type { AlternativeHotel, HotelTier, ItineraryDayDraft } from '@/lib/itinerary-builder-model';
import { TIER_LABELS, createEmptyStop, createTransportStop } from '@/lib/itinerary-builder-model';

type Props = {
  day: ItineraryDayDraft;
  index: number;
  onChange: (day: ItineraryDayDraft) => void;
  onPickHotel: () => void;
  onPickExperience: () => void;
  onPickAlternative: () => void;
  onRemoveAlternative: (altId: string) => void;
  onAlternativeTier: (altId: string, tier: HotelTier) => void;
  isPickerActive?: boolean;
};

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-amber-400/50';
const labelClass = 'mb-1 block text-[11px] font-black text-slate-600';

const actionBtnClass =
  'inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-black transition active:scale-[0.98]';

export default function ItineraryBuilderDayCard({
  day,
  index,
  onChange,
  onPickHotel,
  onPickExperience,
  onPickAlternative,
  onRemoveAlternative,
  onAlternativeTier,
  isPickerActive = false,
}: Props) {
  const updateStop = (stopId: string, patch: Partial<ItineraryDayDraft['stops'][number]>) => {
    onChange({
      ...day,
      stops: day.stops.map((s) => (s.id === stopId ? { ...s, ...patch } : s)),
    });
  };

  const addPlaceStop = () => {
    onChange({ ...day, stops: [...day.stops, createEmptyStop()] });
  };

  const addTransportStop = () => {
    onChange({ ...day, stops: [...day.stops, createTransportStop()] });
  };

  const removeStop = (stopId: string) => {
    const next = day.stops.filter((s) => s.id !== stopId);
    onChange({ ...day, stops: next.length > 0 ? next : [createEmptyStop()] });
  };

  const isTransportStop = (category: string) => category === 'transport';

  return (
    <article
      className={`rounded-2xl border-2 bg-white p-4 shadow-sm transition ${
        isPickerActive ? 'border-amber-400 ring-2 ring-amber-400/25' : 'border-slate-200'
      }`}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#D4AF37]">اليوم {index + 1}</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              value={day.title}
              onChange={(e) => onChange({ ...day, title: e.target.value })}
              placeholder="عنوان اليوم"
              className={inputClass}
            />
            <input
              value={day.city}
              onChange={(e) => onChange({ ...day, city: e.target.value })}
              placeholder="المدينة — مثال: باريس"
              className={inputClass}
            />
          </div>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={addPlaceStop}
          className={`${actionBtnClass} border-amber-300/80 bg-amber-50 text-amber-950 hover:bg-amber-100`}
        >
          <MapPin className="h-3.5 w-3.5" />
          إضافة مكان
        </button>
        <button
          type="button"
          onClick={onPickHotel}
          className={`${actionBtnClass} border-slate-200 bg-slate-50 text-slate-800 hover:bg-white`}
        >
          <BedDouble className="h-3.5 w-3.5" />
          {day.hotel ? day.hotel.name : 'إضافة فندق'}
        </button>
        <button
          type="button"
          onClick={addTransportStop}
          className={`${actionBtnClass} border-slate-200 bg-slate-50 text-slate-800 hover:bg-white`}
        >
          <Car className="h-3.5 w-3.5" />
          نقل / مواصلات
        </button>
        <button
          type="button"
          onClick={onPickExperience}
          className={`${actionBtnClass} border-dashed border-slate-300 bg-white text-slate-600 hover:border-slate-400`}
        >
          <Plus className="h-3.5 w-3.5" />
          {day.experience ? day.experience.title : 'تجربة'}
        </button>
      </div>

      {day.hotel ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-3 py-2">
          <p className="text-xs font-black text-emerald-900">
            <BedDouble className="mb-0.5 inline h-3.5 w-3.5" /> {day.hotel.name}
            {day.hotel.city ? ` · ${day.hotel.city}` : ''}
          </p>
          <button
            type="button"
            onClick={() => onChange({ ...day, hotel: null })}
            className="text-[10px] font-bold text-red-600 hover:underline"
          >
            إزالة
          </button>
        </div>
      ) : null}

      <div className="space-y-3">
        {day.stops.map((stop, si) => {
          const transportOnly = isTransportStop(stop.category);
          return (
            <div
              key={stop.id}
              className={`rounded-xl border p-3 ${
                transportOnly ? 'border-sky-200/90 bg-sky-50/50' : 'border-slate-100 bg-slate-50/60'
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[10px] font-black text-slate-500">
                  {transportOnly ? `مواصلات ${si + 1}` : `مكان ${si + 1}`}
                </span>
                <button
                  type="button"
                  onClick={() => removeStop(stop.id)}
                  className="rounded p-1 text-red-600 hover:bg-red-50"
                  aria-label="حذف"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {!transportOnly ? (
                <label className="mb-2 block">
                  <span className={labelClass}>بحث ذكي عن المكان</span>
                  <PlaceSearchInput
                    value={stop.place_name}
                    onQueryChange={(v) => updateStop(stop.id, { place_name: v })}
                    onPlaceResolved={(place) =>
                      updateStop(stop.id, {
                        place_name: place.place_name,
                        story: place.story,
                        maps_url: place.maps_url,
                        lat: place.lat,
                        lng: place.lng,
                      })
                    }
                  />
                </label>
              ) : (
                <label className="mb-2 block">
                  <span className={labelClass}>وصف الانتقال (اختياري)</span>
                  <input
                    value={stop.place_name}
                    onChange={(e) => updateStop(stop.id, { place_name: e.target.value })}
                    placeholder="مثال: من الفندق إلى المطار"
                    className={inputClass}
                  />
                </label>
              )}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClass}>الوقت</span>
                  <input
                    value={stop.time_slot}
                    onChange={(e) => updateStop(stop.id, { time_slot: e.target.value })}
                    placeholder="09:30"
                    className={inputClass}
                    dir="ltr"
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>النقل — taxi / transport</span>
                  <input
                    value={stop.transport_type}
                    onChange={(e) => updateStop(stop.id, { transport_type: e.target.value })}
                    placeholder="أوبر · 15 دقيقة"
                    className={inputClass}
                  />
                </label>
              </div>

              {!transportOnly ? (
                <>
                  <label className="mt-2 block">
                    <span className={labelClass}>القصة — story (قابلة للتعديل)</span>
                    <textarea
                      value={stop.story}
                      onChange={(e) => updateStop(stop.id, { story: e.target.value })}
                      rows={2}
                      className={inputClass}
                    />
                  </label>
                  <label className="mt-2 block">
                    <span className={labelClass}>رابط الخريطة — maps_url</span>
                    <input
                      value={stop.maps_url}
                      onChange={(e) => updateStop(stop.id, { maps_url: e.target.value })}
                      placeholder="https://maps.google.com/..."
                      className={inputClass}
                      dir="ltr"
                    />
                  </label>
                  <label className="mt-2 block">
                    <span className={labelClass}>ملاحظة داخلية</span>
                    <input
                      value={stop.note}
                      onChange={(e) => updateStop(stop.id, { note: e.target.value })}
                      className={inputClass}
                    />
                  </label>
                </>
              ) : null}
            </div>
          );
        })}
      </div>

      {day.notes ? (
        <label className="mt-3 block">
          <span className={labelClass}>ملاحظات اليوم</span>
          <textarea
            value={day.notes}
            onChange={(e) => onChange({ ...day, notes: e.target.value })}
            rows={2}
            className={inputClass}
          />
        </label>
      ) : (
        <button
          type="button"
          onClick={() => onChange({ ...day, notes: ' ' })}
          className="mt-3 text-[10px] font-bold text-slate-400 hover:text-slate-600"
        >
          + ملاحظات اليوم
        </button>
      )}

      {day.alternative_hotels.length > 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-2">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-600">فنادق بديلة</p>
            <button
              type="button"
              onClick={onPickAlternative}
              className="text-[10px] font-bold text-amber-800 hover:underline"
            >
              + بديل
            </button>
          </div>
          <ul className="space-y-1.5">
            {day.alternative_hotels.map((alt) => (
              <li
                key={alt.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5"
              >
                <p className="truncate text-[11px] font-black text-slate-900">{alt.hotel.name}</p>
                <div className="flex gap-1">
                  <select
                    value={alt.tier}
                    onChange={(e) => onAlternativeTier(alt.id, e.target.value as HotelTier)}
                    className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[10px] font-bold"
                  >
                    {(Object.keys(TIER_LABELS) as HotelTier[]).map((tier) => (
                      <option key={tier} value={tier}>
                        {TIER_LABELS[tier]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => onRemoveAlternative(alt.id)}
                    className="rounded border border-red-200 px-1.5 py-0.5 text-[10px] font-bold text-red-700"
                  >
                    حذف
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
