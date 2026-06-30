'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  createEmptyHotelEntry,
  type ItineraryHotelEntry,
} from '@/app/crm/itineraries/_components/simple-itinerary-day-utils';
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
            className="rounded-xl border border-[#1e3f20]/10 bg-[#FAFAFA] p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-[#1E2720]">فندق {index + 1}</span>
              {hotels.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeHotel(hotel.id)}
                  className="text-xs font-bold text-red-600 hover:underline"
                >
                  حذف
                </button>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <label className="flex flex-col gap-1.5 md:col-span-2">
                <span className="text-sm font-bold text-gray-600">اسم الفندق</span>
                <input
                  type="text"
                  value={hotel.name}
                  onChange={(e) => updateHotel(hotel.id, { name: e.target.value })}
                  placeholder="فندق الريتز كارلتون"
                  className="rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 outline-none focus:border-[#cda04c]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-bold text-gray-600">رقم التأكيد (PNR)</span>
                <input
                  type="text"
                  value={hotel.pnr}
                  onChange={(e) => updateHotel(hotel.id, { pnr: e.target.value })}
                  placeholder="ABC12X"
                  className="rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 outline-none focus:border-[#cda04c]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-bold text-gray-600">تسجيل الدخول</span>
                <input
                  type="date"
                  value={hotel.checkIn}
                  onChange={(e) => updateHotel(hotel.id, { checkIn: e.target.value })}
                  className="rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 outline-none focus:border-[#cda04c]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-bold text-gray-600">تسجيل الخروج</span>
                <input
                  type="date"
                  value={hotel.checkOut}
                  onChange={(e) => updateHotel(hotel.id, { checkOut: e.target.value })}
                  className="rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 outline-none focus:border-[#cda04c]"
                />
              </label>
            </div>

            <div className="mt-3 border-t border-gray-200 pt-3">
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
        className="self-start rounded-lg border border-dashed border-[#cda04c]/60 bg-[#FFFBF0] px-4 py-2 text-sm font-bold text-[#1e3f20] transition hover:border-[#cda04c]"
      >
        + إضافة فندق آخر
      </button>
    </div>
  );
}
