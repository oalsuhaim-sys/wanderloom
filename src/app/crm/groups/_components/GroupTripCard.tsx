'use client';

import {
  CalendarDays,
  Loader2,
  Pencil,
  Trash2,
  Users,
} from 'lucide-react';

import GroupTripLeaderBadge from '@/app/crm/groups/_components/GroupTripLeaderBadge';
import {
  groupSeatStatusBadge,
  parseGroupTripPriceNumber,
  resolveGroupSeatStatus,
  resolveGroupTripBannerUrl,
} from '@/lib/group-trip-card-ui';
import { parseGroupTripStoredDates } from '@/lib/group-trip-dates';
import type { GroupTripRow } from '@/types/group-trip';

type Props = {
  trip: GroupTripRow;
  datesAr: string;
  datesEn: string;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onFellowship: () => void;
};

export default function GroupTripCard({
  trip,
  datesAr,
  datesEn,
  deleting,
  onEdit,
  onDelete,
  onFellowship,
}: Props) {
  const booked = Array.isArray(trip.registered_client_ids)
    ? trip.registered_client_ids.length
    : 0;
  const capacity = Math.max(0, Number(trip.max_seats) || 0);
  const { to: endIso } = parseGroupTripStoredDates(trip.dates_ar, trip.dates_en);
  const status = resolveGroupSeatStatus({
    isActive: trip.is_active !== false,
    booked,
    capacity,
    endIso: endIso || null,
  });
  const badge = groupSeatStatusBadge(status);
  const isFull = status === 'full' || (capacity > 0 && booked >= capacity);
  const fillPct =
    capacity > 0 ? Math.min(100, Math.round((booked / capacity) * 100)) : 0;
  const banner = resolveGroupTripBannerUrl(trip.title_ar, trip.title_en);
  const priceNum = parseGroupTripPriceNumber(trip.price);
  const expectedFromCard = priceNum > 0 ? priceNum * booked : 0;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_8px_30px_rgba(30,39,32,0.06)] transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative h-32 w-full overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={banner}
          alt=""
          className="h-32 w-full rounded-t-xl object-cover"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1A3B2A]/85 via-[#1A3B2A]/25 to-transparent"
          aria-hidden
        />
        <span
          className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-black shadow-sm ${badge.className}`}
        >
          {badge.label}
        </span>
        {trip.price?.trim() ? (
          <span className="absolute bottom-3 left-3 rounded-lg bg-[#1A3B2A]/90 px-2.5 py-1 text-[11px] font-black text-[#C5A059] backdrop-blur-sm">
            {trip.price.trim()}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#1A3B2A]/8 px-2.5 py-0.5 text-[10px] font-black text-[#1A3B2A]">
            {trip.badge_ar || 'مجموعة'}
          </span>
          {trip.allow_waitlist !== false ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              قائمة انتظار
            </span>
          ) : null}
        </div>

        <h3 className="mt-2 text-lg font-black leading-snug text-[#1A3B2A]">
          {trip.title_ar}
        </h3>
        {trip.title_en?.trim() ? (
          <p className="mt-0.5 text-xs font-semibold text-gray-500" dir="ltr">
            {trip.title_en}
          </p>
        ) : null}

        <div className="mt-3">
          {trip.leader_name?.trim() ? (
            <GroupTripLeaderBadge name={trip.leader_name.trim()} compact />
          ) : (
            <span className="text-[11px] font-semibold text-gray-400">بدون مشرف</span>
          )}
        </div>

        <div className="mt-3 flex items-start gap-1.5 text-xs font-bold text-[#1A3B2A]/80">
          <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C5A059]" />
          <div>
            <p>{datesAr.trim() || '— بدون تواريخ —'}</p>
            {datesEn.trim() ? (
              <p className="text-[10px] font-semibold text-gray-500" dir="ltr">
                {datesEn}
              </p>
            ) : null}
          </div>
        </div>

        <p className="mt-3 line-clamp-2 text-sm font-semibold leading-relaxed text-gray-600">
          {trip.description_ar?.trim() || '—'}
        </p>

        <div className="mt-4">
          <div className="mb-1 flex justify-between text-sm">
            <span className="font-medium text-gray-600">المقاعد المحجوزة</span>
            <span className="font-bold text-[#1A3B2A]">
              {booked} / {capacity || '—'}
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-gray-200">
            <div
              className={`h-2.5 rounded-full transition-all ${
                isFull ? 'bg-red-500' : 'bg-[#C5A059]'
              }`}
              style={{ width: `${capacity > 0 ? fillPct : 0}%` }}
            />
          </div>
          {expectedFromCard > 0 ? (
            <p className="mt-1.5 text-[10px] font-bold text-slate-500" dir="ltr">
              إيراد محجوز ≈ {expectedFromCard.toLocaleString('en-US')} ر.س
            </p>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={onFellowship}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#C5A059]/40 bg-gradient-to-l from-[#001f3f] to-[#1A3B2A] px-4 py-2 text-xs font-bold text-[#C5A059] transition hover:brightness-110 sm:w-auto"
          >
            <Users className="h-3.5 w-3.5" aria-hidden />
            التطابق البشري
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#C5A059]/30 bg-[#1A3B2A] px-4 py-2 text-xs font-bold text-[#C5A059] transition hover:bg-[#152e21] sm:flex-none"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            تعديل
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={onDelete}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50 sm:flex-none"
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            )}
            حذف
          </button>
        </div>
      </div>
    </article>
  );
}
