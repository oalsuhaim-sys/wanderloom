'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, ShoppingBag, Sparkles } from 'lucide-react';

import { formatWardrobePrice } from '@/lib/format-wardrobe-price';
import type { PublicItinerary } from '@/lib/public-itinerary';
import { supabase } from '@/lib/supabase';
import {
  buildTripMatchContext,
  filterWardrobeForTrip,
  purchaseHref,
  type WardrobeMatchRow,
} from '@/lib/travel-wardrobe-trip';
import { buildVipButlerWhatsAppUrl } from '@/lib/vip-agency-whatsapp';

const PLACEHOLDER_IMG =
  'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1200&auto=format&fit=crop';

type Props = {
  trip: PublicItinerary;
};

function mergeTags(row: WardrobeMatchRow, key: 'seasons' | 'destinations'): string[] {
  const primary = Array.isArray(row[key]) ? row[key]! : [];
  const extraKey = key === 'seasons' ? 'season_tags' : 'destination_tags';
  const extra = Array.isArray(row[extraKey]) ? (row[extraKey] as string[]) : [];
  return [...new Set([...primary, ...extra].map((s) => String(s).trim()).filter(Boolean))];
}

function buildWardrobeRequestMessage(item: WardrobeMatchRow): string {
  return `مرحباً، أود طلب قطعة الأزياء: ${item.name} لرحلتي`;
}

export default function VipTravelWardrobeStore({ trip }: Props) {
  const [rows, setRows] = useState<WardrobeMatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestedId, setRequestedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      setError('تعذّر تحميل المتجر حالياً.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('travel_wardrobe')
        .select('*')
        .order('created_at', { ascending: false });
      if (fetchErr) throw fetchErr;
      setRows((data ?? []) as WardrobeMatchRow[]);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : 'تعذّر تحميل مجموعة الأزياء.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const tripDates =
    trip.startDate && trip.endDate
      ? `${trip.startDate} → ${trip.endDate}`
      : trip.startDate || trip.endDate || '';

  const { recommended, allItems } = useMemo(() => {
    const safeDays = trip.days ?? [];
    const ctx = buildTripMatchContext({
      title: `${trip.title ?? ''} ${trip.destination ?? ''}`.trim(),
      dates: tripDates,
      days: safeDays.map((d) => ({
        title: d?.title ?? '',
        notes: d?.cityLabel ?? '',
      })),
    });
    const safeRows = Array.isArray(rows) ? rows : [];
    const matched = filterWardrobeForTrip(safeRows, ctx);
    const matchedIds = new Set(matched.map((r) => r?.id).filter(Boolean));
    const rest = safeRows.filter((r) => r?.id && !matchedIds.has(r.id));
    return { recommended: matched, allItems: [...matched, ...rest] };
  }, [rows, trip.title, trip.destination, trip.days, tripDates]);

  const displayItems = recommended.length > 0 ? allItems : rows;

  function handleRequest(item: WardrobeMatchRow) {
    setRequestedId(item.id);
    const url = buildVipButlerWhatsAppUrl(buildWardrobeRequestMessage(item));
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <section className="pb-10 pt-2">
      <div className="mb-6 text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-[#D4AF37]">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Wanderloom Travel Fashion
        </p>
        <h2 className="mt-4 text-2xl font-black text-white">متجر أزياء السفر</h2>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-white/65">
          قطع مختارة بعناية لرحلتك إلى {trip.destination ?? 'وجهتك'}. اطلب القطعة عبر الكونسيرج.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-[#D4AF37]">
          <Loader2 className="h-9 w-9 animate-spin" aria-hidden />
          <p className="text-sm font-semibold text-white/70">جاري تحميل المجموعة…</p>
        </div>
      ) : error ? (
        <p className="rounded-2xl border border-rose-400/25 bg-rose-950/30 px-4 py-6 text-center text-sm font-semibold text-rose-100">
          {error}
        </p>
      ) : displayItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D4AF37]/25 bg-[#2A362C]/50 px-6 py-16 text-center">
          <ShoppingBag className="mx-auto mb-4 h-10 w-10 text-[#D4AF37]/50" aria-hidden />
          <p className="text-sm font-bold text-white/80">المجموعة قيد التجهيز</p>
          <p className="mt-2 text-xs text-white/50">تواصل مع الكونسيرج لاقتراحات مخصصة.</p>
        </div>
      ) : (
        <>
          {recommended.length > 0 ? (
            <p className="mb-4 text-center text-xs font-bold text-[#D4AF37]/90">
              ✦ {recommended.length} قطعة موصى بها لوجهتك
            </p>
          ) : null}
          <ul className="no-scrollbar grid grid-cols-1 gap-6 md:grid-cols-3">
            {displayItems.map((item, index) => {
              if (!item) return null;
              const itemId = String(item.id ?? `wardrobe-${index}`);
              const img = String(item.image_url ?? '').trim() || PLACEHOLDER_IMG;
              const isRecommended = recommended.some((r) => r?.id === item.id);
              const shopHref = purchaseHref(item);
              const seasons = mergeTags(item, 'seasons');
              const destinations = mergeTags(item, 'destinations');
              const itemName = String(item.name ?? 'قطعة').trim() || 'قطعة';

              return (
                <li key={itemId}>
                  <article
                    className={`flex h-full flex-col overflow-hidden rounded-2xl border bg-[#2A362C]/80 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm ${
                      isRecommended
                        ? 'border-[#D4AF37]/50 ring-1 ring-[#D4AF37]/25'
                        : 'border-[#D4AF37]/20'
                    }`}
                  >
                    <div className="relative aspect-[4/5] overflow-hidden bg-[#1E2720]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img}
                        alt={itemName}
                        className="h-full w-full object-cover"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1E2720] via-transparent to-transparent" />
                      {isRecommended ? (
                        <span className="absolute start-3 top-3 rounded-full border border-[#D4AF37]/40 bg-[#1E2720]/80 px-2.5 py-1 text-[10px] font-black text-[#D4AF37] backdrop-blur-sm">
                          موصى به
                        </span>
                      ) : null}
                      <span className="absolute end-3 top-3 rounded-full border border-white/15 bg-black/50 px-3 py-1 text-[11px] font-black text-[#D4AF37] backdrop-blur-md">
                        {formatWardrobePrice(item.price)}
                      </span>
                    </div>

                    <div className="flex flex-1 flex-col gap-3 p-4">
                      <div>
                        <h3 className="text-base font-black text-white">{itemName}</h3>
                        {item.description ? (
                          <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-white/60">
                            {item.description}
                          </p>
                        ) : null}
                      </div>

                      {(seasons.length > 0 || destinations.length > 0) && (
                        <div className="flex flex-wrap gap-1.5">
                          {destinations.slice(0, 2).map((d) => (
                            <span
                              key={`d-${d}`}
                              className="rounded-md border border-[#D4AF37]/20 bg-[#1E2720]/60 px-2 py-0.5 text-[10px] font-bold text-[#D4AF37]/90"
                            >
                              {d}
                            </span>
                          ))}
                          {seasons.slice(0, 2).map((s) => (
                            <span
                              key={`s-${s}`}
                              className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-white/70"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-auto flex flex-col gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleRequest(item)}
                          className="w-full rounded-xl bg-[#D4AF37] py-3 text-sm font-black text-[#1E2720] transition hover:bg-[#C5A028] active:scale-[0.98]"
                        >
                          {requestedId === itemId ? 'تم فتح الواتساب ✓' : 'اطلب القطعة عبر الواتساب'}
                        </button>
                        {shopHref ? (
                          <a
                            href={shopHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full rounded-xl border border-[#D4AF37]/35 py-2.5 text-center text-xs font-bold text-[#D4AF37] transition hover:bg-[#D4AF37]/10"
                          >
                            عرض في المتجر
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
