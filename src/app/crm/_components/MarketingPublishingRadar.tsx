'use client';

import Link from 'next/link';
import { Loader2, Megaphone, Radio } from 'lucide-react';

import {
  formatPublishScheduleTime,
  urgencyMeta,
  type MarketingPublishRadarItem,
} from '@/lib/marketing-publishing-radar';

type MarketingPublishingRadarProps = {
  items: MarketingPublishRadarItem[];
  loading?: boolean;
  error?: string;
  compact?: boolean;
};

function RadarTimelineItem({ item }: { item: MarketingPublishRadarItem }) {
  const meta = urgencyMeta(item.urgency);

  return (
    <li
      className={`relative flex gap-3 rounded-2xl border bg-white px-4 py-3.5 shadow-sm transition ${meta.cardClass}`}
    >
      <span className="relative mt-1.5 flex h-3 w-3 shrink-0 items-center justify-center">
        <span className={`h-2.5 w-2.5 rounded-full ${meta.dotClass}`} aria-hidden />
      </span>

      <div className="min-w-0 flex-1 text-right">
        <div className="mb-1 flex flex-wrap items-center justify-end gap-2">
          <span className="text-[10px] font-bold text-slate-600">
            {meta.emoji} {meta.badge}
          </span>
          {item.media_type ? (
            <span className="rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-2 py-0.5 text-[9px] font-bold text-[#b8952d]">
              {item.media_type}
            </span>
          ) : null}
        </div>
        <p className="truncate text-sm font-extrabold text-slate-900" title={item.campaign_name}>
          {item.campaign_name}
        </p>
        <p className="mt-0.5 text-xs font-medium text-slate-600">{item.content_category}</p>
        <p className="mt-2 text-[11px] font-medium text-slate-600" dir="ltr">
          {formatPublishScheduleTime(item.scheduledAt)}
        </p>
        <p className="mt-1 text-[10px] font-extrabold text-[#b8952d]">{meta.label}</p>
      </div>
    </li>
  );
}

export default function MarketingPublishingRadar({
  items,
  loading = false,
  error,
  compact = false,
}: MarketingPublishingRadarProps) {
  const todayCount = items.filter((i) => i.urgency === 'today').length;
  const tomorrowCount = items.filter((i) => i.urgency === 'tomorrow').length;

  return (
    <section
      className={`overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ${
        compact ? '' : 'h-full'
      }`}
      aria-label="رادار النشر التسويقي"
      dir="rtl"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-[#b8952d] shadow-sm">
            <Radio className="h-5 w-5" aria-hidden strokeWidth={2.2} />
          </span>
          <div className="text-right">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#b8952d]">
              📡 رادار النشر التسويقي
            </h2>
            <p className="text-xs font-medium text-slate-600">
              Marketing Publishing Radar · {items.length} عنصر
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {todayCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-[10px] font-bold text-rose-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" aria-hidden />
              {todayCount} اليوم
            </span>
          ) : null}
          {tomorrowCount > 0 ? (
            <span className="rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-3 py-1.5 text-[10px] font-bold text-[#b8952d]">
              {tomorrowCount} غداً
            </span>
          ) : null}
          <Link
            href="/crm/marketing"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-[11px] font-semibold text-slate-700 transition-all hover:bg-slate-200"
          >
            <Megaphone className="h-3.5 w-3.5 text-[#b8952d]" aria-hidden />
            مركز التسويق
          </Link>
        </div>
      </div>

      <div>
        {error ? (
          <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-medium leading-relaxed text-rose-700">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="flex min-h-[180px] items-center justify-center gap-2 text-slate-600">
            <Loader2 className="h-6 w-6 animate-spin text-[#b8952d]" aria-hidden />
            <span className="text-sm font-medium">جاري مسح جدول النشر…</span>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center text-sm font-medium text-slate-500">
            لا يوجد محتوى مجدول قريباً.
          </div>
        ) : (
          <ol className="relative space-y-3">
            <div
              aria-hidden
              className="pointer-events-none absolute bottom-2 start-5 top-2 w-px bg-gradient-to-b from-[#D4AF37]/50 via-slate-200 to-transparent"
            />
            {items.map((item) => (
              <RadarTimelineItem key={item.id} item={item} />
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
