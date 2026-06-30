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
      className={`rounded-2xl border border-[#d4af37]/25 bg-gradient-to-br from-[#fffdf8] via-white to-amber-50/40 p-5 shadow-[0_12px_40px_rgba(212,175,55,0.08)] ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3
            className={`inline-flex items-center gap-2 font-black text-[#001f3f] ${compact ? 'text-sm' : 'text-base'}`}
          >
            <Sparkles className="h-4 w-4 text-[#d4af37]" aria-hidden />
            ✨ الفعاليات والمواسم المرشحة للعميل
          </h3>
          <p className="mt-1 text-[11px] font-semibold leading-relaxed text-slate-500">
            مطابقة ذكية بين اهتمامات DNA والفعاليات الإيجابية فقط (اذهب — بدون تجنب).
          </p>
        </div>
        {interestList.length > 0 ? (
          <span className="shrink-0 rounded-full bg-[#001f3f]/5 px-2.5 py-1 text-[10px] font-black text-[#001f3f]">
            {events.length} مطابقة
          </span>
        ) : null}
      </div>

      {!interestList.length ? (
        <div className="rounded-xl border border-dashed border-[#d4af37]/30 bg-white/70 px-4 py-6 text-center text-sm font-semibold text-slate-500">
          أضف اهتمامات السفر في قسم DNA لعرض التوصيات الذكية.
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-[#d4af37]" aria-hidden />
          <span className="text-sm font-bold">جارٍ تحليل الاهتمامات…</span>
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-slate-200/80 bg-white/80 px-4 py-6 text-center text-sm font-semibold text-slate-500">
          لا توجد فعاليات مطابقة لاهتمامات العميل حالياً.
        </div>
      ) : (
        <ul className={`grid gap-3 ${compact ? '' : 'sm:grid-cols-2'}`}>
          {events.map((ev) => (
            <li
              key={ev.id}
              className="group rounded-xl border border-[#d4af37]/20 bg-white/90 p-4 shadow-sm transition hover:border-[#d4af37]/45 hover:shadow-md"
            >
              <div className="font-black text-[#001f3f]">{ev.name || 'فعالية'}</div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600">
                <span className="inline-flex items-center gap-1">
                  <MapPin size={12} className="text-[#d4af37]" aria-hidden />
                  {[ev.city, ev.country].filter(Boolean).join(' · ') || '—'}
                </span>
                {(ev.start_date || ev.end_date) && (
                  <span className="inline-flex items-center gap-1 text-slate-500">
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
                      className="rounded-full bg-[#d4af37]/15 px-2.5 py-0.5 text-[10px] font-black text-[#7a5c00] ring-1 ring-[#d4af37]/25"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}

              {ev.season ? (
                <div className="mt-2 text-[10px] font-bold text-slate-400">موسم: {ev.season}</div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
