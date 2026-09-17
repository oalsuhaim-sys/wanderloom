'use client';

import type { Dispatch, SetStateAction } from 'react';
import { useState } from 'react';
import { Bus, CalendarRange, Hotel, ImagePlus, Plus, Sparkles, Ticket, Trash2, Wallet } from 'lucide-react';

import {
  filterQuotationHotelsByCity,
  type QuotationHotelPlace,
} from '@/lib/crm-quotations';
import { getClientAccessToken } from '@/lib/crm-session-token';
import { toast } from '@/lib/crm-toast';
import {
  createEmptyActivityOption,
  createEmptyCostLine,
  createEmptyHotelOption,
  createEmptyItineraryDay,
  createEmptyItineraryStop,
  createEmptyTransportOption,
  type QuotationActivityOption,
  type QuotationCostLine,
  type QuotationHotelOption,
  type QuotationItineraryDay,
  type QuotationItineraryStop,
  type QuotationTransportOption,
} from '@/lib/interactive-quotation';
import { PLACE_CATEGORY_OPTIONS } from '@/lib/places-bank';
import { getVipPlaceCategoryMeta } from '@/lib/vip-place-category';

const cellInputClass =
  'w-full min-w-[4rem] border-0 bg-transparent px-2 py-2 text-xs font-bold text-[#1A3B2A] outline-none focus:bg-[#C5A059]/10 focus:ring-1 focus:ring-inset focus:ring-[#C5A059]/40';
const thClass =
  'bg-[#1A3B2A]/5 px-2 py-3 text-start text-xs font-semibold text-[#1A3B2A] border-b border-gray-200';
const cardClass =
  'rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5';
const fieldClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-[#1A3B2A] outline-none focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/30';

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

function StopEditorCard({
  stop,
  onChange,
  onRemove,
}: {
  stop: QuotationItineraryStop;
  onChange: (patch: Partial<QuotationItineraryStop>) => void;
  onRemove: () => void;
}) {
  const meta = getVipPlaceCategoryMeta(stop.category || 'o');
  const thumb = stop.image_url?.trim();
  const [curating, setCurating] = useState(false);

  async function handleCurateImage() {
    const title = stop.title?.trim();
    if (!title && !stop.search_keyword?.trim()) {
      toast.error('أدخل عنوان المحطة أولاً لجلب صورة تلقائياً.');
      return;
    }
    setCurating(true);
    try {
      const accessToken = await getClientAccessToken();
      const res = await fetch('/api/admin/fetch-stop-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title,
          search_keyword: stop.search_keyword,
          category: stop.category,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        imageUrl?: string;
        message?: string;
        error?: string;
      } | null;
      if (!res.ok || !json?.ok || !json.imageUrl) {
        throw new Error(json?.message || json?.error || 'تعذر جلب الصورة');
      }
      onChange({ image_url: json.imageUrl });
      toast.success('تم جلب صورة فاخرة تلقائياً ✨');
    } catch (err) {
      console.error('[brochure-stop-curate]', err);
      toast.error(err instanceof Error ? err.message : 'فشل جلب الصورة');
    } finally {
      setCurating(false);
    }
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${meta.accentClass}`}
        >
          <meta.Icon className="h-3 w-3" aria-hidden />
          {meta.label}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-red-600 hover:bg-red-50"
          aria-label="حذف المحطة"
        >
          <Trash2 size={14} aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[10px] font-black text-slate-500">الوقت</span>
          <input
            type="time"
            value={stop.time || ''}
            onChange={(e) => onChange({ time: e.target.value })}
            className={fieldClass}
            dir="ltr"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-black text-slate-500">التصنيف</span>
          <select
            value={stop.category || 'o'}
            onChange={(e) => onChange({ category: e.target.value })}
            className={fieldClass}
          >
            {PLACE_CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
            <option value="h">فندق 🏨</option>
            <option value="s">تسوق 🛍️</option>
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-[10px] font-black text-slate-500">عنوان المحطة</span>
          <input
            value={stop.title || ''}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="اسم المكان / التجربة"
            className={fieldClass}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-[10px] font-black text-slate-500">ملاحظات حسية</span>
          <textarea
            value={stop.notes || ''}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder="أجواء، نكهات، تفاصيل تُشعر العميل بالمكان…"
            rows={2}
            className={`${fieldClass} resize-y`}
          />
        </label>
        <div className="sm:col-span-2">
          <span className="mb-1 flex items-center gap-1 text-[10px] font-black text-slate-500">
            <ImagePlus className="h-3 w-3" aria-hidden />
            رابط صورة المحطة
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              inputMode="url"
              dir="ltr"
              value={stop.image_url || ''}
              onChange={(e) => onChange({ image_url: e.target.value })}
              placeholder="https://…"
              className={`${fieldClass} min-w-0 flex-1`}
            />
            <button
              type="button"
              disabled={curating}
              onClick={() => void handleCurateImage()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#C9A84C]/50 bg-[#FEFDF9] px-3 py-2 text-[10px] font-black text-[#1C4532] hover:bg-amber-50 disabled:opacity-60"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#C9A84C]" aria-hidden />
              {curating ? 'جاري الجلب…' : 'جلب صورة تلقائياً ✨'}
            </button>
          </div>
        </div>
        {stop.place_real_name?.trim() ? (
          <p
            className="rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-black text-[#8a6412] sm:col-span-2"
            title="مرجع داخلي للخبير — لا يظهر للعميل"
          >
            🔒 مرجع الخبير: {stop.place_real_name.trim()}
            {stop.place_id ? (
              <span className="font-mono font-semibold text-[#a98a3c]"> · #{stop.place_id}</span>
            ) : null}
          </p>
        ) : null}
        {stop.search_keyword?.trim() ? (
          <p className="text-[10px] font-semibold text-slate-500 sm:col-span-2" dir="ltr">
            search: {stop.search_keyword.trim()}
          </p>
        ) : null}
      </div>

      {thumb ? (
        <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumb} alt="" className="max-h-36 w-full object-cover transition duration-500" />
        </div>
      ) : null}
    </article>
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
          stops: Array.isArray(day.stops) ? day.stops : [],
          ...patch,
        };
      });
      return next;
    });
  };

  const updateStop = (
    dayIndex: number,
    stopIndex: number,
    patch: Partial<QuotationItineraryStop>,
  ) => {
    setItineraryDays((prev) =>
      prev.map((day, i) => {
        if (i !== dayIndex) return day;
        const stops = [...(day.stops ?? [])];
        const current = stops[stopIndex] ?? createEmptyItineraryStop();
        stops[stopIndex] = { ...current, ...patch };
        return { ...day, stops };
      }),
    );
  };

  const addStop = (dayIndex: number) => {
    setItineraryDays((prev) =>
      prev.map((day, i) =>
        i === dayIndex
          ? { ...day, stops: [...(day.stops ?? []), createEmptyItineraryStop()] }
          : day,
      ),
    );
  };

  const removeStop = (dayIndex: number, stopIndex: number) => {
    setItineraryDays((prev) =>
      prev.map((day, i) =>
        i === dayIndex
          ? { ...day, stops: (day.stops ?? []).filter((_, si) => si !== stopIndex) }
          : day,
      ),
    );
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
          أيّام الرحلة بمحطات مفصّلة (وقت · عنوان · صورة · تصنيف · ملاحظات) — باقي الجداول للحفظ في
          JSONB.
        </p>
      </div>

      <section className={`${cardClass} mb-5`}>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-sm font-black text-[#1C4532] sm:text-base">
            <CalendarRange size={18} className="text-[#C9A84C]" aria-hidden />
            أيام الرحلة · المحطات المفصّلة
          </h2>
          <button
            type="button"
            onClick={() =>
              setItineraryDays((prev) => [
                ...prev,
                createEmptyItineraryDay(prev.length + 1),
              ])
            }
            className="inline-flex items-center gap-1 rounded-lg border border-[#C9A84C]/40 bg-[#FEFDF9] px-3 py-1.5 text-[10px] font-black text-[#1C4532] hover:bg-amber-50"
          >
            <Plus size={12} aria-hidden />
            إضافة يوم
          </button>
        </div>

        <div className="space-y-6">
          {itineraryDays.map((day, index) => (
            <div
              key={day.id || `day-${index}`}
              className="rounded-2xl border border-[#E5E0D5] bg-[#F8F6F0] p-4 sm:p-5"
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#b8954d]">
                    اليوم {day.dayNumber || index + 1}
                  </p>
                  <p className="mt-1 text-sm font-bold text-[#1A3B2A]">
                    ترويسة اليوم + محطات المسار
                  </p>
                </div>
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
                  className="rounded-lg border border-red-200 bg-white px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50"
                >
                  حذف اليوم
                </button>
              </div>

              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-black text-slate-500">رقم اليوم</span>
                  <input
                    type="number"
                    min={1}
                    value={day.dayNumber || index + 1}
                    onChange={(e) =>
                      updateDay(index, { dayNumber: Number(e.target.value) || 1 })
                    }
                    className={fieldClass}
                    dir="ltr"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-black text-slate-500">التاريخ</span>
                  <input
                    type="date"
                    value={day.date || ''}
                    onChange={(e) => updateDay(index, { date: e.target.value })}
                    className={fieldClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-black text-slate-500">المدينة</span>
                  <input
                    value={day.city || ''}
                    onChange={(e) => updateDay(index, { city: e.target.value })}
                    placeholder="طوكيو"
                    className={fieldClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-black text-slate-500">عنوان اليوم</span>
                  <input
                    value={day.title || ''}
                    onChange={(e) => updateDay(index, { title: e.target.value })}
                    placeholder="عنوان اليوم"
                    className={fieldClass}
                  />
                </label>
                <label className="block sm:col-span-2 lg:col-span-4">
                  <span className="mb-1 block text-[10px] font-black text-slate-500">
                    ملخص اليوم (اختياري)
                  </span>
                  <input
                    value={day.description || ''}
                    onChange={(e) => updateDay(index, { description: e.target.value })}
                    placeholder="وصف موجز يظهر فوق المحطات عند الحاجة"
                    className={fieldClass}
                  />
                </label>
              </div>

              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-xs font-black text-[#1A3B2A]">محطات اليوم</h3>
                <button
                  type="button"
                  onClick={() => addStop(index)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#C9A84C]/40 bg-white px-2.5 py-1 text-[10px] font-black text-[#1C4532] hover:bg-amber-50"
                >
                  <Plus size={12} aria-hidden />
                  إضافة محطة
                </button>
              </div>

              {(day.stops ?? []).length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 bg-white/70 py-6 text-center text-xs font-semibold text-slate-500">
                  لا محطات بعد — أضف محطة (وقت · عنوان · صورة · تصنيف · ملاحظات حسية)
                </p>
              ) : (
                <div className="space-y-3">
                  {(day.stops ?? []).map((stop, stopIndex) => (
                    <StopEditorCard
                      key={stop.id || `stop-${index}-${stopIndex}`}
                      stop={stop}
                      onChange={(patch) => updateStop(index, stopIndex, patch)}
                      onRemove={() => removeStop(index, stopIndex)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

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
