'use client';

import type { ReactNode } from 'react';
import { Clock, MapPin } from 'lucide-react';

import {
  resolveQuotationDayStops,
  type QuotationItineraryDay,
  type QuotationItineraryStop,
} from '@/lib/interactive-quotation';
import { getVipPlaceCategoryMeta } from '@/lib/vip-place-category';

function formatStopTime(raw: string): string {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  const m = /^(\d{1,2}):(\d{2})/.exec(text);
  if (!m) return text;
  const hour = Number(m[1]);
  const minute = m[2];
  if (!Number.isFinite(hour)) return text;
  const period = hour >= 12 ? 'م' : 'ص';
  const h12 = hour % 12 || 12;
  return `${h12}:${minute} ${period}`;
}

function formatDayDate(date: string): string {
  const raw = String(date ?? '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const [y, m, d] = raw.split('-').map(Number);
  const dt = new Date(y!, m! - 1, d!);
  if (Number.isNaN(dt.getTime())) return raw;
  return dt.toLocaleDateString('ar-SA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function CategoryTag({ category }: { category: string }) {
  const meta = getVipPlaceCategoryMeta(category || 'o');
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold sm:text-[11px] ${meta.accentClass}`}
    >
      <meta.Icon className="h-3 w-3 shrink-0" aria-hidden />
      {meta.label}
    </span>
  );
}

function StopCard({ stop }: { stop: QuotationItineraryStop }) {
  const timeText = formatStopTime(stop.time);
  const thumb = stop.image_url?.trim();
  const notes = stop.notes?.trim();
  const title = stop.title?.trim() || 'محطة';

  return (
    <article className="group relative flex flex-col gap-4 rounded-2xl border border-[#E5E0D5] bg-white p-4 shadow-sm transition-all duration-300 hover:border-[#b8954d]/40 hover:shadow-md sm:flex-row sm:gap-5 sm:p-5">
      <div className="flex min-w-[72px] flex-row items-center justify-center gap-3 border-b border-[#EFE9DF] pb-3 sm:flex-col sm:border-b-0 sm:border-l sm:pb-0 sm:pl-4">
        {timeText ? (
          <span
            className="inline-flex items-center gap-1 text-sm font-black tabular-nums text-[#243223]"
            dir="ltr"
          >
            <Clock className="h-3.5 w-3.5 text-[#b8954d]" aria-hidden />
            {timeText}
          </span>
        ) : (
          <span className="text-[10px] font-bold text-gray-400">وقت مرن</span>
        )}
      </div>

      {thumb ? (
        <div className="relative max-h-48 w-full shrink-0 overflow-hidden rounded-2xl sm:max-h-44 sm:w-36">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb}
            alt=""
            className="h-full max-h-48 w-full object-cover transition duration-500 ease-out group-hover:scale-110 sm:max-h-44"
            loading="lazy"
          />
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <CategoryTag category={stop.category} />
        </div>
        <h4 className="text-base font-bold text-[#243223] sm:text-lg">{title}</h4>
        {notes ? (
          <div className="mt-2 rounded-xl border border-amber-100/60 bg-amber-50/50 px-3 py-2 text-xs font-medium leading-relaxed text-gray-600 sm:text-sm">
            <span className="me-1" aria-hidden>
              ✨
            </span>
            {notes}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export type ProposalItineraryStopsTimelineProps = {
  days: QuotationItineraryDay[];
  /** Optional trailing actions per day (e.g. client feedback button) */
  renderDayActions?: (day: QuotationItineraryDay, index: number) => ReactNode;
  className?: string;
};

/**
 * Read-only detailed itinerary timeline for proposal / brochure views.
 * Day header + stop cards (time, title, image, category, sensory notes).
 */
export function ProposalItineraryStopsTimeline({
  days,
  renderDayActions,
  className = '',
}: ProposalItineraryStopsTimelineProps) {
  if (!days.length) return null;

  return (
    <div className={`relative ${className}`} dir="rtl">
      <div
        className="absolute bottom-0 top-0 right-[20px] w-0.5 bg-[#D4C4A8]"
        aria-hidden
      />

      <div className="relative space-y-10">
        {days.map((day, index) => {
          const stops = resolveQuotationDayStops(day);
          const dateLabel = formatDayDate(day.date);
          const isFirst = index === 0;

          return (
            <div key={day.id || `day-${index}`} className="relative pr-14">
              <div
                className={
                  isFirst
                    ? 'absolute right-[15px] top-5 h-3 w-3 rounded-full border-2 border-[#b8954d] bg-[#b8954d]'
                    : 'absolute right-[15px] top-5 h-3 w-3 rounded-full border-2 border-[#D4C4A8] bg-[#FDFBF7]'
                }
                aria-hidden
              />

              {/* Day header */}
              <header className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-[#E5E0D5] bg-[#F8F6F0] p-4 shadow-sm sm:p-5">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#b8954d]/90">
                    اليوم {day.dayNumber || index + 1}
                  </p>
                  <h3 className="mt-1 text-xl font-bold text-[#243223]">
                    {day.title?.trim() || `يوم ${day.dayNumber || index + 1}`}
                  </h3>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-500">
                    {dateLabel ? <span>{dateLabel}</span> : null}
                    {day.city?.trim() ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-[#b8954d]" aria-hidden />
                        {day.city.trim()}
                      </span>
                    ) : null}
                  </div>
                  {day.description?.trim() && stops.length > 1 ? (
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-600">
                      {day.description.trim()}
                    </p>
                  ) : null}
                </div>
                {renderDayActions ? (
                  <div className="relative shrink-0">{renderDayActions(day, index)}</div>
                ) : null}
              </header>

              {/* Stop cards */}
              {stops.length > 0 ? (
                <div className="space-y-3">
                  {stops.map((stop) => (
                    <StopCard key={stop.id} stop={stop} />
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-[#E5E0D5] bg-white/70 py-8 text-center text-sm font-medium text-gray-500">
                  لا توجد محطات مفصّلة لهذا اليوم بعد
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
