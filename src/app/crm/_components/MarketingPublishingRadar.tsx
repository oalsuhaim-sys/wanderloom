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
      className={`relative flex gap-3 rounded-2xl border px-4 py-3.5 transition ${meta.cardClass}`}
    >
      <span className="relative mt-1.5 flex h-3 w-3 shrink-0 items-center justify-center">
        <span className={`h-2.5 w-2.5 rounded-full ${meta.dotClass}`} aria-hidden />
      </span>

      <div className="min-w-0 flex-1 text-right">
        <div className="mb-1 flex flex-wrap items-center justify-end gap-2">
          <span className="text-[10px] font-black text-[#1E2720]/70">
            {meta.emoji} {meta.badge}
          </span>
          {item.media_type ? (
            <span className="rounded-full bg-[#001f3f]/8 px-2 py-0.5 text-[9px] font-bold text-[#001f3f]">
              {item.media_type}
            </span>
          ) : null}
        </div>
        <p className="truncate text-sm font-black text-[#1E2720]" title={item.campaign_name}>
          {item.campaign_name}
        </p>
        <p className="mt-0.5 text-xs font-semibold text-[#1c4532]/85">{item.content_category}</p>
        <p className="mt-2 text-[11px] font-bold text-slate-600" dir="ltr">
          {formatPublishScheduleTime(item.scheduledAt)}
        </p>
        <p className="mt-1 text-[10px] font-black text-[#D4AF37]">{meta.label}</p>
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
      className={`overflow-hidden rounded-2xl border border-[#1E2720]/12 bg-white shadow-lg ${
        compact ? '' : 'h-full'
      }`}
      aria-label="رادار النشر التسويقي"
      dir="rtl"
    >
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D4AF37]/20 px-5 py-4"
        style={{
          background: 'linear-gradient(to left, rgba(0,31,63,0.05), rgba(212,175,55,0.06))',
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-inner"
            style={{ backgroundColor: '#001f3f', color: '#D4AF37' }}
          >
            <Radio className="h-5 w-5" aria-hidden strokeWidth={2.2} />
          </span>
          <div className="text-right">
            <h2 className="text-base font-black text-[#001f3f] sm:text-lg">
              📡 رادار النشر التسويقي
            </h2>
            <p className="text-[11px] font-semibold text-slate-600">
              Marketing Publishing Radar · {items.length} عنصر
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {todayCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-black text-red-800">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" aria-hidden />
              {todayCount} اليوم
            </span>
          ) : null}
          {tomorrowCount > 0 ? (
            <span className="rounded-full border border-[#D4AF37]/35 bg-[#FFFBF0] px-2.5 py-1 text-[10px] font-black text-[#8a6f1a]">
              {tomorrowCount} غداً
            </span>
          ) : null}
          <Link
            href="/crm/marketing"
            className="inline-flex items-center gap-1 text-[11px] font-black text-[#001f3f] underline decoration-[#D4AF37]/60 underline-offset-4"
          >
            <Megaphone className="h-3.5 w-3.5" aria-hidden />
            مركز التسويق
          </Link>
        </div>
      </div>

      <div className="px-4 py-4 sm:px-5">
        {error ? (
          <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold leading-relaxed text-rose-900">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="flex min-h-[180px] items-center justify-center gap-2 text-[#001f3f]">
            <Loader2 className="h-6 w-6 animate-spin text-[#D4AF37]" aria-hidden />
            <span className="text-sm font-bold">جاري مسح جدول النشر…</span>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-[#F6F4F0]/60 px-4 py-10 text-center text-sm font-bold text-slate-500">
            لا يوجد محتوى مجدول قريباً.
          </div>
        ) : (
          <ol className="relative space-y-3">
            <div
              aria-hidden
              className="pointer-events-none absolute bottom-2 start-5 top-2 w-px bg-gradient-to-b from-[#D4AF37]/40 via-[#1E2720]/10 to-transparent"
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
