'use client';

import React, { memo, useEffect, useRef, useState } from 'react';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import { ChevronDown, ChevronUp, GripVertical, ImagePlus, Pencil, Sparkles, X } from 'lucide-react';
import { toast } from '@/lib/crm-toast';

import SupplierWhatsAppButton from '@/app/crm/itineraries/_components/SupplierWhatsAppButton';
import {
  TRANSPORT_MODES,
  type SimpleItineraryDay,
} from '@/app/crm/itineraries/_components/simple-itinerary-day-utils';
import { formatAdminDayLabel } from '@/lib/itinerary-geography';
import { CRM_INPUT, CRM_SELECT, CRM_TIMELINE_CARD, CRM_TIMELINE_DOT } from '@/lib/crm-luxury-ui';
import { WL_ICON_BTN_GOLD, WL_ICON_BTN_NEUTRAL } from '@/lib/itinerary-builder-ui';
import {
  buildActivitySupplierBrief,
  buildDriverSupplierBrief,
  type SupplierBriefClientContext,
} from '@/lib/supplier-whatsapp-brief';

function DayHotelStartCard({ hotelName }: { hotelName: string }) {
  return (
    <div className="mb-3 flex items-center justify-between rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 p-4">
      <div>
        <span className="mb-1 block text-xs font-bold text-[#b8952d]">📍 بداية اليوم (الانطلاق)</span>
        <h4 className="text-lg font-extrabold text-slate-900">{hotelName}</h4>
      </div>
      <div className="text-sm font-medium text-slate-500">فندق الإقامة</div>
    </div>
  );
}

function DayHotelEndCard({ hotelName }: { hotelName: string }) {
  return (
    <div className="mt-3 flex items-center justify-between rounded-xl border border-gray-200 bg-[#F9F9F6] p-4">
      <div>
        <span className="mb-1 block text-xs font-bold text-slate-600">🏁 نهاية اليوم (العودة)</span>
        <h4 className="text-lg font-bold text-[#1A3B2A]">{hotelName}</h4>
      </div>
      <div className="text-sm font-medium text-slate-600">فندق الإقامة</div>
    </div>
  );
}

function StopImageField({
  imageUrl,
  placeName,
  searchKeyword,
  category,
  city,
  onChange,
}: {
  imageUrl?: string;
  placeName?: string;
  searchKeyword?: string;
  category?: string;
  city?: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [curating, setCurating] = useState(false);
  const [draftUrl, setDraftUrl] = useState(() => String(imageUrl ?? ''));
  const preview = String(draftUrl || imageUrl || '').trim();
  const looksLikeHttpUrl = /^https?:\/\//i.test(preview);

  useEffect(() => {
    setDraftUrl(String(imageUrl ?? ''));
  }, [imageUrl]);

  function commitUrl(raw: string) {
    setDraftUrl(raw);
    onChange(String(raw ?? '').trim());
  }

  async function handleCurateImage() {
    const title = String(placeName ?? '').trim();
    if (!title && !String(searchKeyword ?? '').trim()) {
      toast.error('أدخل عنوان المحطة أولاً لجلب صورة تلقائياً.');
      return;
    }

    setCurating(true);
    try {
      let accessToken = '';
      try {
        const { getClientAccessToken } = await import('@/lib/crm-session-token');
        accessToken = await getClientAccessToken();
      } catch (authErr) {
        throw new Error(
          authErr instanceof Error ? authErr.message : 'انتهت الجلسة — سجّل الدخول مجدداً.',
        );
      }

      const res = await fetch('/api/admin/fetch-stop-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title,
          search_keyword: searchKeyword,
          category,
          city,
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

      commitUrl(json.imageUrl);
      toast.success('تم جلب صورة فاخرة تلقائياً ✨');
    } catch (err) {
      console.error('[stop-image-curate]', err);
      toast.error(err instanceof Error ? err.message : 'فشل جلب الصورة');
    } finally {
      setCurating(false);
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار صورة (JPG / PNG / WebP).');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('حجم الصورة كبير جداً (الحد 8MB).');
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      if (placeName?.trim()) form.append('placeName', placeName.trim());

      const res = await fetch('/api/crm/itinerary-stop-image', {
        method: 'POST',
        body: form,
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; publicUrl?: string; error?: string; hint?: string }
        | null;

      if (!res.ok || !json?.ok || !json.publicUrl) {
        const msg = json?.error || 'upload_failed';
        const pasteHint =
          /bucket not found/i.test(msg) || Boolean(json?.hint)
            ? ' — يمكنك لصق رابط https:// مباشرة في الحقل.'
            : '';
        throw new Error(`${msg}${pasteHint}`);
      }

      setDraftUrl(json.publicUrl);
      onChange(json.publicUrl);
      toast.success('تم رفع صورة المحطة');
    } catch (err) {
      console.error('[stop-image-upload]', err);
      toast.error(
        err instanceof Error ? `فشل الرفع: ${err.message}` : 'فشل رفع صورة المحطة',
        { duration: 6000 },
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <span className="block text-xs font-bold text-slate-700">صورة المحطة</span>
      {looksLikeHttpUrl ? (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="max-h-36 w-full object-cover transition duration-500" />
          <button
            type="button"
            title="إزالة الصورة"
            aria-label="إزالة الصورة"
            onClick={() => {
              setDraftUrl('');
              onChange('');
            }}
            className="absolute left-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/40 bg-black/50 text-white transition hover:bg-black/70"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          inputMode="url"
          dir="ltr"
          placeholder="الصق رابط صورة https://… مباشرة"
          value={draftUrl}
          onChange={(e) => commitUrl(e.target.value)}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData('text').trim();
            if (/^https?:\/\//i.test(pasted)) {
              e.preventDefault();
              commitUrl(pasted);
            }
          }}
          className="min-w-0 flex-1 rounded border border-gray-200 p-2 text-xs focus:border-[#C5A059] focus:outline-none"
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            void handleFile(file);
          }}
        />
        <button
          type="button"
          disabled={curating || uploading}
          onClick={() => void handleCurateImage()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4AF37]/50 bg-[#D4AF37]/15 px-3 py-2 text-xs font-bold text-[#9C7A3C] transition hover:bg-[#D4AF37]/25 disabled:opacity-60"
          title="جلب صورة فاخرة من Unsplash"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {curating ? 'جاري الجلب…' : 'جلب صورة تلقائياً ✨'}
        </button>
        <button
          type="button"
          disabled={uploading || curating}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4AF37]/40 bg-white px-3 py-2 text-xs font-bold text-[#9C7A3C] transition hover:border-[#D4AF37] hover:bg-[#D4AF37]/10 disabled:opacity-60"
        >
          <ImagePlus className="h-3.5 w-3.5" aria-hidden />
          {uploading ? 'جاري الرفع…' : 'رفع'}
        </button>
      </div>
      <p className="text-[10px] font-medium text-slate-500">
        لصق رابط، جلب تلقائي من Unsplash، أو رفع إلى bucket{' '}
        <span dir="ltr">itinerary-images</span>.
      </p>
    </div>
  );
}

export type SimpleItineraryDayCardProps = {
  day: SimpleItineraryDay;
  dayIdx: number;
  daysCount: number;
  allDays: SimpleItineraryDay[];
  isActive: boolean;
  hotelOptions: string[];
  editingDayId: number | null;
  editDayTitle: string;
  onActiveDayIdChange: (dayId: number) => void;
  onMoveDay?: (dayId: number, direction: 'up' | 'down') => void;
  onStartEditTitle: (day: SimpleItineraryDay, dayIdx: number) => void;
  onEditDayTitleChange: (value: string) => void;
  onSaveDayTitle: (dayId: number) => void;
  onCancelEditTitle: () => void;
  onRemovePlace: (dayId: number, placeIndex: number) => void;
  onMovePlaceToDay: (currentDayId: number, placeIndex: number, targetDayId: number) => void;
  onUpdateDayHotel: (dayId: number, hotelName: string) => void;
  onUpdateDayCity: (dayId: number, city: string) => void;
  onUpdateTransport: (
    dayId: number,
    placeIndex: number,
    field: 'transportToNext' | 'transportDuration',
    value: string,
  ) => void;
  onUpdateVisitTime: (dayId: number, placeIndex: number, visit_time: string) => void;
  onUpdatePlaceNotes: (dayId: number, placeIndex: number, notes: string) => void;
  onUpdatePlaceImageUrl: (dayId: number, placeIndex: number, imageUrl: string) => void;
  dayDroppableId: (dayId: number) => string;
  supplierBrief?: SupplierBriefClientContext | null;
};

function SimpleItineraryDayCardInner({
  day,
  dayIdx,
  daysCount,
  allDays,
  isActive,
  hotelOptions,
  editingDayId,
  editDayTitle,
  onActiveDayIdChange,
  onMoveDay,
  onStartEditTitle,
  onEditDayTitleChange,
  onSaveDayTitle,
  onCancelEditTitle,
  onRemovePlace,
  onMovePlaceToDay,
  onUpdateDayHotel,
  onUpdateDayCity,
  onUpdateTransport,
  onUpdateVisitTime,
  onUpdatePlaceNotes,
  onUpdatePlaceImageUrl,
  dayDroppableId,
  supplierBrief,
}: SimpleItineraryDayCardProps) {
  return (
    <div className="relative">
      <span className={CRM_TIMELINE_DOT} aria-hidden />
      <div
        className={`${CRM_TIMELINE_CARD} p-4 sm:p-5 ${isActive ? 'ring-2 ring-[#C5A059]/35' : ''}`}
        onClick={() => onActiveDayIdChange(day.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onActiveDayIdChange(day.id);
        }}
        role="button"
        tabIndex={0}
      >
        <div className="mb-4 flex w-full items-center justify-between gap-3">
          {editingDayId === day.id ? (
            <div
              className="min-w-0 flex-1"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <input
                type="text"
                autoFocus
                value={editDayTitle}
                onChange={(e) => onEditDayTitleChange(e.target.value)}
                onBlur={() => onSaveDayTitle(day.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onSaveDayTitle(day.id);
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    onCancelEditTitle();
                  }
                }}
                placeholder="مثال: اليوم الأول - وصول سيول"
                aria-label="تعديل عنوان اليوم"
                className={`${CRM_INPUT} h-10 w-full py-0 text-base font-extrabold text-slate-900`}
              />
            </div>
          ) : (
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate text-xl font-extrabold text-slate-900">
                {formatAdminDayLabel(day, dayIdx)}
              </h3>
              <button
                type="button"
                title="تعديل عنوان اليوم"
                aria-label="تعديل عنوان اليوم"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartEditTitle(day, dayIdx);
                }}
                className={WL_ICON_BTN_GOLD}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          )}

          <div
            className="flex shrink-0 items-center gap-3"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {onMoveDay ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={dayIdx === 0}
                  onClick={() => onMoveDay(day.id, 'up')}
                  title="نقل اليوم للأعلى"
                  aria-label="نقل اليوم للأعلى"
                  className={WL_ICON_BTN_NEUTRAL}
                >
                  <ChevronUp className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  disabled={dayIdx >= daysCount - 1}
                  onClick={() => onMoveDay(day.id, 'down')}
                  title="نقل اليوم للأسفل"
                  aria-label="نقل اليوم للأسفل"
                  className={WL_ICON_BTN_NEUTRAL}
                >
                  <ChevronDown className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ) : null}
            {isActive ? (
              <span className="rounded-md border border-[#D4AF37]/40 bg-[#D4AF37]/15 px-2 py-1 text-xs font-bold text-[#D4AF37]">
                اليوم النشط
              </span>
            ) : null}
          </div>
        </div>

        <div
          className="mb-4 grid grid-cols-1 gap-4 rounded-2xl border border-slate-200/90 bg-slate-50/80 p-4 md:grid-cols-2"
          onClick={(e) => e.stopPropagation()}
        >
          <label className="flex flex-col gap-1">
            <span className="mb-2 block text-xs font-semibold text-slate-600">مدينة اليوم</span>
            <input
              type="text"
              value={day.city ?? ''}
              onChange={(e) => onUpdateDayCity(day.id, e.target.value)}
              placeholder="مثال: باريس"
              className={`${CRM_INPUT} h-10 w-full px-3 py-0`}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="mb-2 block text-xs font-semibold text-slate-600">فندق الإقامة لهذا اليوم:</span>
            <select
              value={day.hotelName ?? ''}
              onChange={(e) => onUpdateDayHotel(day.id, e.target.value)}
              className={`${CRM_SELECT} h-10 w-full px-3 py-0`}
            >
              <option value="">-- بدون فندق --</option>
              {hotelOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          {day.hotelName ? (
            <p className="mt-1 text-xs text-slate-500 md:col-span-2">
              🏠 نقطة الانطلاق والعودة:{' '}
              <span className="font-semibold text-slate-800">{day.hotelName}</span>
            </p>
          ) : null}
        </div>

        {day.hotelName ? <DayHotelStartCard hotelName={day.hotelName} /> : null}

        <div onClick={(e) => e.stopPropagation()}>
          <Droppable
            droppableId={dayDroppableId(day.id)}
            key={`${dayDroppableId(day.id)}:${day.places.map((p) => p._dragId).join(',')}`}
          >
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`min-h-[72px] rounded-xl transition-colors ${
                  snapshot.isDraggingOver ? 'bg-[#C5A059]/10 ring-2 ring-[#C5A059]/30' : ''
                }`}
              >
                {day.places.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 py-8 text-center text-sm font-medium text-slate-500">
                    اسحب الأماكن هنا أو اضغط «إضافة للمسار» (اليوم النشط)
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {day.places.map((place, placeIndex) => (
                      <React.Fragment key={place._dragId}>
                        <Draggable draggableId={place._dragId} index={placeIndex}>
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              className={`mb-4 flex items-start justify-between gap-3 rounded-2xl border bg-slate-50/80 p-5 shadow-sm ${
                                dragSnapshot.isDragging
                                  ? 'border-[#D4AF37] shadow-md'
                                  : 'border-slate-200/90 hover:border-[#D4AF37]/40'
                              } transition-colors`}
                            >
                              <div className="flex min-w-0 flex-1 items-start gap-2">
                                <span
                                  {...dragProvided.dragHandleProps}
                                  className="mt-0.5 cursor-grab text-slate-500 active:cursor-grabbing"
                                  aria-hidden
                                >
                                  <GripVertical className="h-4 w-4" />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center justify-end gap-2">
                                    {String(place.branch_name ?? '').trim() ? (
                                      <span className="rounded-md border border-amber-200 bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                                        {String(place.branch_name)}
                                      </span>
                                    ) : null}
                                    <h4 className="text-lg font-black text-slate-900">{place.name}</h4>
                                  </div>
                                  {place.category ? (
                                    <p className="mt-1 text-xs font-bold text-slate-700">
                                      {place.category}
                                    </p>
                                  ) : null}
                                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500">
                                    {place.city ? <span>{place.city}</span> : null}
                                    {String(place.branch_name ?? '').trim() ? (
                                      <>
                                        {place.city ? <span aria-hidden>•</span> : null}
                                        <span className="rounded border border-amber-200/60 bg-amber-50 px-1.5 py-0.5 font-bold text-amber-700">
                                          {String(place.branch_name)}
                                        </span>
                                      </>
                                    ) : null}
                                  </div>
                                  <div className="mt-2 flex items-center gap-2">
                                    <label className="text-xs font-bold text-slate-700">وقت الزيارة:</label>
                                    <input
                                      type="time"
                                      value={place.visit_time || ''}
                                      onChange={(e) =>
                                        onUpdateVisitTime(day.id, placeIndex, e.target.value)
                                      }
                                      className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#D4AF37] [color-scheme:light]"
                                    />
                                  </div>
                                  <div className="mt-2">
                                    <input
                                      type="text"
                                      placeholder="ملاحظات المحطة (اختياري)..."
                                      value={place.notes || ''}
                                      onChange={(e) =>
                                        onUpdatePlaceNotes(day.id, placeIndex, e.target.value)
                                      }
                                      className="w-full rounded border border-gray-200 p-2 text-xs focus:border-[#C5A059] focus:outline-none"
                                    />
                                  </div>
                                  <StopImageField
                                    imageUrl={place.image_url}
                                    placeName={
                                      typeof place.name === 'string' ? place.name : undefined
                                    }
                                    searchKeyword={
                                      typeof place.search_keyword === 'string'
                                        ? place.search_keyword
                                        : undefined
                                    }
                                    category={
                                      typeof place.category === 'string' ? place.category : undefined
                                    }
                                    city={typeof place.city === 'string' ? place.city : undefined}
                                    onChange={(url) =>
                                      onUpdatePlaceImageUrl(day.id, placeIndex, url)
                                    }
                                  />
                                  {daysCount > 1 ? (
                                    <div
                                      className="mt-2 flex items-center gap-1.5 text-xs"
                                      onClick={(e) => e.stopPropagation()}
                                      onKeyDown={(e) => e.stopPropagation()}
                                    >
                                      <span className="font-semibold text-gray-500">نقل إلى:</span>
                                      <select
                                        value={day.id}
                                        onChange={(e) => {
                                          const targetDayId = Number(e.target.value);
                                          if (Number.isFinite(targetDayId)) {
                                            onMovePlaceToDay(day.id, placeIndex, targetDayId);
                                          }
                                        }}
                                        aria-label={`نقل ${place.name ?? 'المحطة'} إلى يوم آخر`}
                                        className="rounded border border-gray-200 bg-gray-50 p-1 text-xs text-gray-700 focus:border-[#C5A059] focus:outline-none"
                                      >
                                        {allDays.map((d, idx) => (
                                          <option key={d.id} value={d.id}>
                                            اليوم {idx + 1}
                                            {d.title?.trim() ? ` (${d.title.trim()})` : ''}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  ) : null}
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {supplierBrief ? (
                                      <SupplierWhatsAppButton
                                        compact
                                        message={buildActivitySupplierBrief(supplierBrief, {
                                          name: String(place.name ?? ''),
                                          category: place.category,
                                          city: place.city,
                                          dayTitle: day.title,
                                        })}
                                      />
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => onRemovePlace(day.id, placeIndex)}
                                className="shrink-0 text-xs font-bold text-rose-600 hover:text-rose-800 hover:underline"
                              >
                                حذف
                              </button>
                            </div>
                          )}
                        </Draggable>

                        {placeIndex < day.places.length - 1 ? (
                          <div className="flex flex-col items-center gap-1 py-1">
                            <div className="h-3 w-px border-r-2 border-dashed border-[#D4AF37]/30" />
                            <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                              {TRANSPORT_MODES.map((mode) => {
                                const selected = (place.transportToNext ?? 'سيارة') === mode.value;
                                return (
                                  <button
                                    key={mode.value}
                                    type="button"
                                    title={mode.value}
                                    onClick={() =>
                                      onUpdateTransport(
                                        day.id,
                                        placeIndex,
                                        'transportToNext',
                                        mode.value,
                                      )
                                    }
                                    className={`min-w-[2.5rem] rounded-xl border px-2 py-1.5 text-base transition-all ${
                                      selected
                                        ? 'border-[#D4AF37] bg-[#D4AF37] text-black shadow-sm'
                                        : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                                  >
                                    {mode.icon}
                                  </button>
                                );
                              })}
                              <input
                                type="text"
                                value={place.transportDuration ?? ''}
                                onChange={(e) =>
                                  onUpdateTransport(
                                    day.id,
                                    placeIndex,
                                    'transportDuration',
                                    e.target.value,
                                  )
                                }
                                placeholder="المدة (مثال: 15 د)"
                                className={`${CRM_INPUT} min-w-[8rem] flex-1 py-1.5 text-xs`}
                              />
                              {supplierBrief &&
                              (place.transportToNext ?? 'سيارة') === 'سيارة' &&
                              day.places[placeIndex + 1] ? (
                                <SupplierWhatsAppButton
                                  compact
                                  variant="driver"
                                  label="إبلاغ السائق 💬"
                                  message={buildDriverSupplierBrief(supplierBrief, {
                                    fromLabel: String(place.name ?? ''),
                                    toLabel: String(day.places[placeIndex + 1]?.name ?? ''),
                                    mode: place.transportToNext ?? 'سيارة',
                                    duration: place.transportDuration,
                                    serviceDate: supplierBrief.tripDateFrom,
                                  })}
                                />
                              ) : null}
                            </div>
                            <div className="h-3 w-px border-r-2 border-dashed border-[#D4AF37]/30" />
                          </div>
                        ) : null}
                      </React.Fragment>
                    ))}
                  </div>
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>

        {day.hotelName ? <DayHotelEndCard hotelName={day.hotelName} /> : null}
      </div>
    </div>
  );
}

const SimpleItineraryDayCard = memo(SimpleItineraryDayCardInner);
export default SimpleItineraryDayCard;
