'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, Loader2, MapPin, Sparkles } from 'lucide-react'

import {
  fetchDnaMatchedEvents,
  formatEventDateRange,
  type DnaMatchedEvent,
} from '@/lib/client-dna-event-match'
import { parseDnaInterests } from '@/lib/clientsTravelDna'
import { supabase } from '@/lib/supabase'

type ClientDnaSmartEventRecommendationsProps = {
  dnaInterests: string
  className?: string
  compact?: boolean
}

export default function ClientDnaSmartEventRecommendations({
  dnaInterests,
  className = '',
  compact = false,
}: ClientDnaSmartEventRecommendationsProps) {
  const [events, setEvents] = useState<DnaMatchedEvent[]>([])
  const [loading, setLoading] = useState(false)

  const interestList = parseDnaInterests(dnaInterests)

  useEffect(() => {
    if (!supabase || !interestList.length) {
      setEvents([])
      return
    }

    let cancelled = false
    setLoading(true)

    void fetchDnaMatchedEvents(supabase, dnaInterests)
      .then((rows) => {
        if (!cancelled) setEvents(rows)
      })
      .catch((e) => {
        console.error('[ClientDnaSmartEventRecommendations]', e)
        if (!cancelled) setEvents([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [dnaInterests, interestList.length])

  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-slate-50/50 p-5 shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C] ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3
            className={`flex items-center gap-2 font-bold text-slate-900 dark:text-gray-100 ${compact ? 'text-base' : 'text-lg'}`}
          >
            <span className="inline-block select-none fill-none" aria-hidden>
              ✨
            </span>
            <Sparkles className="h-4 w-4 shrink-0 text-[#D4AF37]" aria-hidden />
            الفعاليات والمواسم المرشحة للعميل
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            مطابقة ذكية بين اهتمامات DNA والفعاليات الإيجابية فقط (اذهب — بدون تجنب).
          </p>
        </div>
        {interestList.length > 0 ? (
          <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-700 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-[#D4AF37]">
            {events.length} مطابقة
          </span>
        ) : null}
      </div>

      {!interestList.length ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-6 text-center text-sm text-slate-600 dark:border-[#2D3F3A] dark:bg-[#1A2421]/50 dark:text-slate-300">
          أضف اهتمامات السفر في قسم DNA لعرض التوصيات الذكية.
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-slate-600 dark:text-slate-300">
          <Loader2 className="h-5 w-5 animate-spin text-[#D4AF37]" aria-hidden />
          <span className="text-sm font-medium">جارٍ تحليل الاهتمامات…</span>
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-600 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-slate-300">
          لا توجد فعاليات مطابقة لاهتمامات العميل حالياً.
        </div>
      ) : (
        <ul className={`grid gap-3 ${compact ? '' : 'sm:grid-cols-2'}`}>
          {events.map((ev) => (
            <li
              key={ev.id}
              className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#D4AF37]/45 hover:shadow-md dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:hover:border-[#D4AF37]/40"
            >
              <div className="font-bold text-slate-900 dark:text-white">{ev.name || 'فعالية'}</div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                <span className="inline-flex items-center gap-1">
                  <MapPin size={12} className="text-[#D4AF37]" aria-hidden />
                  {[ev.city, ev.country].filter(Boolean).join(' · ') || '—'}
                </span>
                {(ev.start_date || ev.end_date) && (
                  <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                    <CalendarDays size={12} aria-hidden />
                    {formatEventDateRange(ev.start_date, ev.end_date)}
                  </span>
                )}
              </div>

              {ev.matchedInterests.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {ev.matchedInterests.map((tag) => (
                    <span
                      key={`${ev.id}-${tag}`}
                      className="rounded-full bg-[#D4AF37]/15 px-2.5 py-0.5 text-[10px] font-bold text-[#8B7355] ring-1 ring-[#D4AF37]/25 dark:text-[#D4AF37]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}

              {ev.season ? (
                <div className="mt-2 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  موسم: {ev.season}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
