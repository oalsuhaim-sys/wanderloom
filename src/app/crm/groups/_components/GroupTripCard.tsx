'use client';

import {
  CalendarDays,
  ClipboardList,
  Link2,
  Loader2,
  Pencil,
  Trash2,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import toast from 'react-hot-toast';

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
  const [copying, setCopying] = useState(false);
  const fromRegistered = Array.isArray(trip.registered_client_ids)
    ? trip.registered_client_ids.length
    : 0;
  const fromBooked = Number(trip.booked_seats);
  const booked = Number.isFinite(fromBooked)
    ? Math.max(fromBooked, fromRegistered)
    : fromRegistered;
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

  async function copyRegistrationLink() {
    const link = `${window.location.origin}/group-onboarding?tripId=${trip.id}`;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(link);
      toast.success('تم نسخ رابط التسجيل المباشر بنجاح!');
    } catch {
      try {
        const input = document.createElement('input');
        input.value = link;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        toast.success('تم نسخ رابط التسجيل المباشر بنجاح!');
      } catch {
        toast.error('تعذر نسخ الرابط — انسخه يدوياً بعد الفتح.');
        window.open(link, '_blank', 'noopener,noreferrer');
      }
    } finally {
      setCopying(false);
    }
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative h-36 w-full overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={banner}
          alt=""
          className="h-36 w-full object-cover"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent"
          aria-hidden
        />
        <span
          className={`absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 shadow-sm ${badge.className}`}
        >
          {badge.label}
        </span>
        {trip.price?.trim() ? (
          <span className="absolute bottom-3 left-3 rounded-lg bg-white/95 px-2.5 py-1 text-xs font-semibold text-slate-900 shadow-sm backdrop-blur-sm">
            {trip.price.trim()}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-600/10">
            {trip.badge_ar || 'مجموعة'}
          </span>
          {trip.allow_waitlist !== false ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-600/20">
              قائمة انتظار
            </span>
          ) : null}
        </div>

        <h3 className="mt-3 text-lg font-semibold leading-snug text-slate-900">
          <Link
            href={`/crm/groups/${encodeURIComponent(String(trip.id))}`}
            className="transition hover:text-sky-700"
          >
            {trip.title_ar}
          </Link>
        </h3>
        {trip.title_en?.trim() ? (
          <p className="mt-0.5 text-xs text-slate-500" dir="ltr">
            {trip.title_en}
          </p>
        ) : null}

        <div className="mt-3">
          {trip.leader_name?.trim() ? (
            <GroupTripLeaderBadge name={trip.leader_name.trim()} compact />
          ) : (
            <span className="text-xs text-slate-400">بدون مشرف</span>
          )}
        </div>

        <div className="mt-4 flex items-start gap-2 text-sm text-slate-600">
          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
          <div>
            <p className="font-medium text-slate-800">{datesAr.trim() || '— بدون تواريخ —'}</p>
            {datesEn.trim() ? (
              <p className="text-xs text-slate-500" dir="ltr">
                {datesEn}
              </p>
            ) : null}
          </div>
        </div>

        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-500">
          {trip.description_ar?.trim() || '—'}
        </p>

        <div className="mt-5">
          <div className="mb-1.5 flex justify-between text-sm">
            <span className="text-slate-500">المقاعد المحجوزة</span>
            <span className="font-semibold text-slate-900">
              {booked} / {capacity || '—'}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                isFull ? 'bg-rose-500' : fillPct >= 80 ? 'bg-amber-500' : 'bg-sky-500'
              }`}
              style={{ width: `${capacity > 0 ? fillPct : 0}%` }}
            />
          </div>
          {expectedFromCard > 0 ? (
            <p className="mt-1.5 text-xs text-slate-500" dir="ltr">
              إيراد محجوز ≈ {expectedFromCard.toLocaleString('en-US')} ر.س
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <Link
            href={`/crm/groups/${encodeURIComponent(String(trip.id))}`}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90 active:scale-[0.98] sm:w-auto"
          >
            <ClipboardList className="h-3.5 w-3.5" aria-hidden />
            إدارة القروب
          </Link>
          <button
            type="button"
            disabled={copying}
            onClick={() => void copyRegistrationLink()}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-60 sm:w-auto"
          >
            {copying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Link2 className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            )}
            نسخ الرابط
          </button>
          <button
            type="button"
            onClick={onFellowship}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 active:scale-[0.98] sm:w-auto"
          >
            <Users className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            التطابق البشري
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 active:scale-[0.98] sm:flex-none"
          >
            <Pencil className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            تعديل
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={onDelete}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 ring-1 ring-rose-600/20 transition hover:bg-rose-100 active:scale-[0.98] disabled:opacity-50 sm:flex-none"
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
