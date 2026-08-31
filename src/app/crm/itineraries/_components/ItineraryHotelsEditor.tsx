'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  createEmptyHotelEntry,
  type ItineraryHotelEntry,
} from '@/app/crm/itineraries/_components/simple-itinerary-day-utils';
import { VipDateField } from '@/app/crm/itineraries/_components/VipBookingFields';
import SupplierContactActions, {
  resolveHotelManualSupplier,
} from '@/app/crm/itineraries/_components/SupplierContactActions';
import {
  fetchCrmSuppliers,
  filterSuppliersForItinerary,
  type CrmSupplier,
} from '@/lib/crm-suppliers';
import { type SupplierBriefClientContext } from '@/lib/supplier-whatsapp-brief';
import { supabase } from '@/lib/supabase';

const labelClass = 'mb-2 block text-xs font-semibold text-slate-700';
const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 outline-none transition focus:border-[#D4AF37] placeholder:text-slate-600 [color-scheme:light]';

type Props = {
  hotels: ItineraryHotelEntry[];
  onChange: (hotels: ItineraryHotelEntry[]) => void;
  supplierBrief?: SupplierBriefClientContext | null;
  /** موردون مفلترون حسب الوجهة — يُمرَّر من الصفحة الأب عند التوفر */
  filteredSuppliers?: CrmSupplier[];
  destinationLabel?: string;
  tripCountries?: string[];
  tripCities?: string[];
};

export default function ItineraryHotelsEditor({
  hotels,
  onChange,
  filteredSuppliers,
  destinationLabel = 'المختارة',
  tripCountries = [],
  tripCities = [],
}: Props) {
  const [fetchedSuppliers, setFetchedSuppliers] = useState<CrmSupplier[]>([]);

  useEffect(() => {
    if (filteredSuppliers != null) return;

    let cancelled = false;
    void (async () => {
      if (!supabase) return;
      try {
        const rows = await fetchCrmSuppliers(supabase);
        if (!cancelled) setFetchedSuppliers(rows);
      } catch {
        if (!cancelled) setFetchedSuppliers([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filteredSuppliers]);

  const suppliers = useMemo(() => {
    if (filteredSuppliers != null) return filteredSuppliers;
    return filterSuppliersForItinerary(fetchedSuppliers, {
      countries: tripCountries,
      cities: tripCities,
      destination: destinationLabel !== 'المختارة' ? destinationLabel : undefined,
    });
  }, [filteredSuppliers, fetchedSuppliers, tripCountries, tripCities, destinationLabel]);

  const updateHotel = (id: string, patch: Partial<ItineraryHotelEntry>) => {
    onChange(hotels.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  };

  const addHotel = () => {
    onChange([...hotels, createEmptyHotelEntry()]);
  };

  const removeHotel = (id: string) => {
    if (hotels.length <= 1) {
      onChange([createEmptyHotelEntry()]);
      return;
    }
    onChange(hotels.filter((h) => h.id !== id));
  };

  return (
    <div className="flex flex-col gap-4">
      {hotels.map((hotel, index) => {
        const isManual = resolveHotelManualSupplier(hotel, suppliers);

        return (
          <div
            key={hotel.id}
            className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-xl"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-base font-bold text-[#D4AF37]">
                فندق {index + 1}
              </span>
              {hotels.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeHotel(hotel.id)}
                  className="text-xs font-bold text-red-400 hover:text-red-300 hover:underline"
                >
                  حذف
                </button>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
              <label className="block md:col-span-2 lg:col-span-2">
                <span className={labelClass}>اسم الفندق</span>
                <input
                  type="text"
                  value={hotel.name}
                  onChange={(e) => updateHotel(hotel.id, { name: e.target.value })}
                  placeholder="فندق الريتز كارلتون"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className={labelClass}>رقم التأكيد (PNR)</span>
                <input
                  type="text"
                  value={hotel.pnr}
                  onChange={(e) => updateHotel(hotel.id, { pnr: e.target.value })}
                  placeholder="ABC12X"
                  dir="ltr"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className={labelClass}>تسجيل الدخول</span>
                <VipDateField
                  value={hotel.checkIn}
                  onChange={(v) => updateHotel(hotel.id, { checkIn: v })}
                />
              </label>
              <label className="block">
                <span className={labelClass}>تسجيل الخروج</span>
                <VipDateField
                  value={hotel.checkOut}
                  onChange={(v) => updateHotel(hotel.id, { checkOut: v })}
                />
              </label>
            </div>

            <div className="mt-5 border-t border-slate-200 pt-5">
              <SupplierContactActions
                hotel={{
                  name: hotel.name,
                  pnr: hotel.pnr,
                  check_in: hotel.checkIn,
                  check_out: hotel.checkOut,
                }}
                supplierContact={hotel.supplier_contact}
                onSupplierContactChange={(value) =>
                  updateHotel(hotel.id, { supplier_contact: value })
                }
                suppliers={suppliers}
                destinationLabel={destinationLabel}
                isManualSupplier={isManual}
                onManualSupplierChange={(manual) => {
                  if (manual) {
                    updateHotel(hotel.id, { isManualSupplier: true });
                    return;
                  }
                  const contact = hotel.supplier_contact.trim();
                  const inList = suppliers.some((s) => s.phone.trim() === contact);
                  updateHotel(hotel.id, {
                    isManualSupplier: false,
                    ...(inList ? {} : { supplier_contact: '' }),
                  });
                }}
              />
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={addHotel}
        className="self-start rounded-xl border border-dashed border-[#D4AF37]/50 bg-white px-4 py-2.5 text-sm font-bold text-[#D4AF37] transition hover:border-[#D4AF37] hover:bg-slate-50"
      >
        + إضافة فندق آخر
      </button>
    </div>
  );
}
