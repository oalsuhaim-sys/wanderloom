'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Bus, CalendarRange, Hotel, Plus, Ticket, Trash2, Wallet } from 'lucide-react';

import {
  filterQuotationHotelsByCity,
  type QuotationHotelPlace,
} from '@/lib/crm-quotations';
import {
  createEmptyActivityOption,
  createEmptyCostLine,
  createEmptyHotelOption,
  createEmptyItineraryDay,
  createEmptyTransportOption,
  type QuotationActivityOption,
  type QuotationCostLine,
  type QuotationHotelOption,
  type QuotationItineraryDay,
  type QuotationTransportOption,
} from '@/lib/interactive-quotation';

const cellInputClass =
  'w-full min-w-[4rem] border-0 bg-transparent px-2 py-2 text-xs font-bold text-[#1A3B2A] outline-none focus:bg-[#C5A059]/10 focus:ring-1 focus:ring-inset focus:ring-[#C5A059]/40';
const thClass =
  'bg-[#1A3B2A]/5 px-2 py-3 text-start text-xs font-semibold text-[#1A3B2A] border-b border-gray-200';
const cardClass =
  'rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5';

type InteractiveBrochureEditorProps = {
  itineraryDays: QuotationItineraryDay[];
  setItineraryDays: Dispatch<SetStateAction<QuotationItineraryDay[]>>;
  hotelOptions: QuotationHotelOption[];
  setHotelOptions: Dispatch<SetStateAction<QuotationHotelOption[]>>;
  transportOptions: QuotationTransportOption[];
  setTransportOptions: Dispatch<SetStateAction<QuotationTransportOption[]>>;
  activityOptions: QuotationActivityOption[];
  setActivityOptions: Dispatch<SetStateAction<QuotationActivityOption[]>>;
  costBreakdown: QuotationCostLine[];
  setCostBreakdown: Dispatch<SetStateAction<QuotationCostLine[]>>;
  destinations: string[];
  hotelPlaces: QuotationHotelPlace[];
};

function TableSection({
  title,
  icon,
  onAdd,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className={`${cardClass} mb-5`}>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-2 text-sm font-black text-[#1C4532] sm:text-base">
          {icon}
          {title}
        </h2>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1 rounded-lg border border-[#C9A84C]/40 bg-[#FEFDF9] px-3 py-1.5 text-[10px] font-black text-[#1C4532] hover:bg-amber-50"
        >
          <Plus size={12} aria-hidden />
          أضف صف جديد
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200">{children}</div>
    </section>
  );
}

export function InteractiveBrochureEditor({
  itineraryDays,
  setItineraryDays,
  hotelOptions,
  setHotelOptions,
  transportOptions,
  setTransportOptions,
  activityOptions,
  setActivityOptions,
  costBreakdown,
  setCostBreakdown,
  destinations,
  hotelPlaces,
}: InteractiveBrochureEditorProps) {
  const updateDay = (index: number, patch: Partial<QuotationItineraryDay>) => {
    setItineraryDays((prev) => {
      const next = prev.map((day, i) => {
        if (i !== index) return day;
        return {
          ...day,
          id: String(day.id ?? '').trim()
            ? String(day.id)
            : createEmptyItineraryDay(i + 1).id,
          ...patch,
        };
      });
      return next;
    });
  };

  const updateHotelOption = (id: string, patch: Partial<QuotationHotelOption>) => {
    setHotelOptions((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  };

  const updateTransportOption = (
    id: string,
    patch: Partial<QuotationTransportOption>,
  ) => {
    setTransportOptions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    );
  };

  const updateActivityOption = (
    id: string,
    patch: Partial<QuotationActivityOption>,
  ) => {
    setActivityOptions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    );
  };

  return (
    <div className="mb-5" dir="rtl">
      <div className="mb-4 rounded-xl border border-[#C5A059]/30 bg-[#FEFDF9] px-4 py-3">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8A6B2A]">
          كتيّب العرض التفاعلي · إدخال بيانات فقط
        </p>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          جداول كثيفة للحفظ في JSONB — العرض الفاخر يظهر للعميل فقط في صفحة البروشور.
        </p>
      </div>

      <TableSection
        title="أيام الرحلة"
        icon={<CalendarRange size={18} className="text-[#C9A84C]" aria-hidden />}
        onAdd={() =>
          setItineraryDays((prev) => [...prev, createEmptyItineraryDay(prev.length + 1)])
        }
      >
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr>
              <th className={`${thClass} w-16`}>اليوم</th>
              <th className={thClass}>التاريخ</th>
              <th className={thClass}>المدينة</th>
              <th className={thClass}>العنوان</th>
              <th className={thClass}>الوصف</th>
              <th className={`${thClass} w-10`} />
            </tr>
          </thead>
          <tbody>
            {itineraryDays.map((day, index) => (
              <tr key={day.id || `day-${index}`} className="border-t border-slate-100">
                <td className="border-l border-slate-100 p-0">
                  <input
                    type="number"
                    min={1}
                    value={day.dayNumber || index + 1}
                    onChange={(e) =>
                      updateDay(index, { dayNumber: Number(e.target.value) || 1 })
                    }
                    className={`${cellInputClass} text-center`}
                    dir="ltr"
                  />
                </td>
                <td className="border-l border-slate-100 p-0">
                  <input
                    type="date"
                    value={day.date || ''}
                    onChange={(e) => updateDay(index, { date: e.target.value })}
                    className={cellInputClass}
                  />
                </td>
                <td className="border-l border-slate-100 p-0">
                  <input
                    value={day.city || ''}
                    onChange={(e) => updateDay(index, { city: e.target.value })}
                    placeholder="طوكيو"
                    className={cellInputClass}
                  />
                </td>
                <td className="border-l border-slate-100 p-0">
                  <input
                    value={day.title || ''}
                    onChange={(e) => updateDay(index, { title: e.target.value })}
                    placeholder="عنوان اليوم"
                    className={cellInputClass}
                  />
                </td>
                <td className="border-l border-slate-100 p-0">
                  <input
                    value={day.description || ''}
                    onChange={(e) => updateDay(index, { description: e.target.value })}
                    placeholder="تفاصيل مختصرة"
                    className={cellInputClass}
                  />
                </td>
                <td className="border-l border-slate-100 p-1 text-center">
                  <button
                    type="button"
                    onClick={() =>
                      setItineraryDays((prev) =>
                        prev.length <= 1
                          ? [createEmptyItineraryDay(1)]
                          : prev
                              .filter((_, i) => i !== index)
                              .map((d, i) => ({ ...d, dayNumber: i + 1 })),
                      )
                    }
                    className="rounded p-1 text-red-600 hover:bg-red-50"
                    aria-label="حذف"
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableSection>

      <TableSection
        title="خيارات الفنادق"
        icon={<Hotel size={18} className="text-[#C9A84C]" aria-hidden />}
        onAdd={() => setHotelOptions((prev) => [...prev, createEmptyHotelOption()])}
      >
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr>
              <th className={thClass}>المدينة</th>
              <th className={thClass}>الفندق</th>
              <th className={thClass}>نوع الغرفة</th>
              <th className={thClass}>السعر</th>
              <th className={`${thClass} w-10`} />
            </tr>
          </thead>
          <tbody>
            {hotelOptions.map((hotel) => {
              const cityHotels = filterQuotationHotelsByCity(
                hotelPlaces,
                hotel.city ?? '',
              );
              return (
                <tr key={hotel.id} className="border-t border-slate-100">
                  <td className="border-l border-slate-100 p-0">
                    <select
                      value={hotel.city ?? ''}
                      onChange={(e) =>
                        updateHotelOption(hotel.id, { city: e.target.value, name: '' })
                      }
                      className={cellInputClass}
                      disabled={destinations.length === 0}
                    >
                      <option value="">— المدينة —</option>
                      {destinations.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border-l border-slate-100 p-0">
                    {cityHotels.length > 0 ? (
                      <select
                        value={hotel.name ?? ''}
                        onChange={(e) => updateHotelOption(hotel.id, { name: e.target.value })}
                        className={cellInputClass}
                        disabled={!hotel.city}
                      >
                        <option value="">— الفندق —</option>
                        {cityHotels.map((h) => (
                          <option key={`${h.name}-${h.id}`} value={h.name}>
                            {h.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={hotel.name ?? ''}
                        onChange={(e) => updateHotelOption(hotel.id, { name: e.target.value })}
                        className={cellInputClass}
                        placeholder="اسم الفندق"
                        disabled={!hotel.city}
                      />
                    )}
                  </td>
                  <td className="border-l border-slate-100 p-0">
                    <input
                      value={hotel.description ?? ''}
                      onChange={(e) =>
                        updateHotelOption(hotel.id, { description: e.target.value })
                      }
                      className={cellInputClass}
                      placeholder="نوع الغرفة"
                    />
                  </td>
                  <td className="border-l border-slate-100 p-0">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={hotel.price || ''}
                      onChange={(e) =>
                        updateHotelOption(hotel.id, {
                          price: Number(e.target.value) || 0,
                        })
                      }
                      className={`${cellInputClass} text-end`}
                      dir="ltr"
                      placeholder="0"
                    />
                  </td>
                  <td className="border-l border-slate-100 p-1 text-center">
                    <button
                      type="button"
                      onClick={() =>
                        setHotelOptions((prev) =>
                          prev.length <= 1
                            ? [createEmptyHotelOption()]
                            : prev.filter((h) => h.id !== hotel.id),
                        )
                      }
                      className="rounded p-1 text-red-600 hover:bg-red-50"
                      aria-label="حذف"
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableSection>

      <TableSection
        title="خيارات المواصلات"
        icon={<Bus size={18} className="text-[#C9A84C]" aria-hidden />}
        onAdd={() => setTransportOptions((prev) => [...prev, createEmptyTransportOption()])}
      >
        <table className="w-full min-w-[620px] border-collapse text-sm">
          <thead>
            <tr>
              <th className={thClass}>الوسيلة</th>
              <th className={thClass}>الوصف</th>
              <th className={thClass}>السعر</th>
              <th className={`${thClass} w-10`} />
            </tr>
          </thead>
          <tbody>
            {transportOptions.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="border-l border-slate-100 p-0">
                  <input
                    value={row.name ?? ''}
                    onChange={(e) =>
                      setTransportOptions((prev) =>
                        prev.map((t) =>
                          t.id === row.id ? { ...t, name: e.target.value } : t,
                        ),
                      )
                    }
                    className={cellInputClass}
                    placeholder="JR Pass · سيارة خاصة"
                  />
                </td>
                <td className="border-l border-slate-100 p-0">
                  <input
                    value={row.description ?? ''}
                    onChange={(e) =>
                      setTransportOptions((prev) =>
                        prev.map((t) =>
                          t.id === row.id ? { ...t, description: e.target.value } : t,
                        ),
                      )
                    }
                    className={cellInputClass}
                    placeholder="تفاصيل الوسيلة"
                  />
                </td>
                <td className="border-l border-slate-100 p-0">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={row.price || ''}
                    onChange={(e) =>
                      setTransportOptions((prev) =>
                        prev.map((t) =>
                          t.id === row.id
                            ? { ...t, price: Number(e.target.value) || 0 }
                            : t,
                        ),
                      )
                    }
                    className={`${cellInputClass} text-end`}
                    dir="ltr"
                    placeholder="0"
                  />
                </td>
                <td className="border-l border-slate-100 p-1 text-center">
                  <button
                    type="button"
                    onClick={() =>
                      setTransportOptions((prev) =>
                        prev.length <= 1
                          ? [createEmptyTransportOption()]
                          : prev.filter((t) => t.id !== row.id),
                      )
                    }
                    className="rounded p-1 text-red-600 hover:bg-red-50"
                    aria-label="حذف"
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableSection>

      <TableSection
        title="خيارات الفعاليات"
        icon={<Ticket size={18} className="text-[#C9A84C]" aria-hidden />}
        onAdd={() =>
          setActivityOptions((prev) => [...prev, createEmptyActivityOption()])
        }
      >
        <table className="w-full min-w-[620px] border-collapse text-sm">
          <thead>
            <tr>
              <th className={thClass}>الفعالية</th>
              <th className={thClass}>الوصف</th>
              <th className={thClass}>السعر</th>
              <th className={`${thClass} w-10`} />
            </tr>
          </thead>
          <tbody>
            {activityOptions.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="border-l border-slate-100 p-0">
                  <input
                    value={row.name ?? ''}
                    onChange={(e) =>
                      updateActivityOption(row.id, { name: e.target.value })
                    }
                    className={cellInputClass}
                    placeholder="اسم الفعالية"
                  />
                </td>
                <td className="border-l border-slate-100 p-0">
                  <input
                    value={row.description ?? ''}
                    onChange={(e) =>
                      updateActivityOption(row.id, { description: e.target.value })
                    }
                    className={cellInputClass}
                    placeholder="تفاصيل مختصرة"
                  />
                </td>
                <td className="border-l border-slate-100 p-0">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={row.price || ''}
                    onChange={(e) =>
                      updateActivityOption(row.id, {
                        price: Number(e.target.value) || 0,
                      })
                    }
                    className={`${cellInputClass} text-end`}
                    dir="ltr"
                    placeholder="0"
                  />
                </td>
                <td className="border-l border-slate-100 p-1 text-center">
                  <button
                    type="button"
                    onClick={() =>
                      setActivityOptions((prev) =>
                        prev.length <= 1
                          ? [createEmptyActivityOption()]
                          : prev.filter((a) => a.id !== row.id),
                      )
                    }
                    className="rounded p-1 text-red-600 hover:bg-red-50"
                    aria-label="حذف"
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableSection>

      <TableSection
        title="تكاليف إضافية (تأشيرة · طيران · أخرى)"
        icon={<Wallet size={18} className="text-[#C9A84C]" aria-hidden />}
        onAdd={() => setCostBreakdown((prev) => [...prev, createEmptyCostLine()])}
      >
        <table className="w-full min-w-[420px] border-collapse text-sm">
          <thead>
            <tr>
              <th className={thClass}>البند</th>
              <th className={thClass}>السعر (ر.س)</th>
              <th className={`${thClass} w-10`} />
            </tr>
          </thead>
          <tbody>
            {costBreakdown.map((line) => (
              <tr key={line.id} className="border-t border-slate-100">
                <td className="border-l border-slate-100 p-0">
                  <input
                    value={line.item_name ?? ''}
                    onChange={(e) =>
                      setCostBreakdown((prev) =>
                        prev.map((c) =>
                          c.id === line.id ? { ...c, item_name: e.target.value } : c,
                        ),
                      )
                    }
                    className={cellInputClass}
                    placeholder="تأشيرة · تذاكر طيران…"
                  />
                </td>
                <td className="border-l border-slate-100 p-0">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.price || ''}
                    onChange={(e) =>
                      setCostBreakdown((prev) =>
                        prev.map((c) =>
                          c.id === line.id
                            ? { ...c, price: Number(e.target.value) || 0 }
                            : c,
                        ),
                      )
                    }
                    className={`${cellInputClass} text-end`}
                    dir="ltr"
                    placeholder="0"
                  />
                </td>
                <td className="border-l border-slate-100 p-1 text-center">
                  <button
                    type="button"
                    onClick={() =>
                      setCostBreakdown((prev) =>
                        prev.length <= 1
                          ? [createEmptyCostLine()]
                          : prev.filter((c) => c.id !== line.id),
                      )
                    }
                    className="rounded p-1 text-red-600 hover:bg-red-50"
                    aria-label="حذف"
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableSection>
    </div>
  );
}
