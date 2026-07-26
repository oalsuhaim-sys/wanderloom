'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, Sparkles, X, Zap } from 'lucide-react';

import { getClientAccessToken } from '@/lib/crm-session-token';
import {
  aiActivityTypeLabelAr,
  aiSuggestionToPlacePayload,
  arabicMonthNameFromIso,
  buildClientDnaForAi,
  buildPredictiveWishSuggestion,
  predictiveWishToPlacePayload,
  type AiItinerarySuggestion,
  type PredictiveWishContext,
} from '@/lib/ai-predictive-wishes';

export type AiPredictiveWishesCardProps = {
  context: PredictiveWishContext;
  /** رابط مساحة البناء مع سياق العميل/الوجهة */
  builderHref?: string;
  /** عند التوفّر: يُضاف النشاط المقترح إلى اليوم النشط في المسار */
  onApply?: (place: Record<string, unknown>) => void;
  /** معرّف فريد لتخزين حالة التجاهل محلياً */
  storageKey?: string;
  className?: string;
};

export default function AiPredictiveWishesCard({
  context,
  builderHref = '/crm/itineraries/builder',
  onApply,
  storageKey = 'wanderloom-predictive-wish',
  className = '',
}: AiPredictiveWishesCardProps) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.sessionStorage.getItem(`${storageKey}:dismissed`) === '1';
    } catch {
      return false;
    }
  });
  const [appliedKeys, setAppliedKeys] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<AiItinerarySuggestion[]>([]);

  /** Locks auto-fetch to exactly once per client/destination key (stops Strict Mode + parent re-render thrash). */
  const hasGeneratedAI = useRef(false);
  const lastAutoKeyRef = useRef('');
  const contextRef = useRef(context);
  contextRef.current = context;

  const clientId = String(context.clientRow?.id ?? '').trim();
  const destination = context.destination?.trim() || 'وجهة الرحلة';
  const month = arabicMonthNameFromIso(context.tripDateFrom ?? '');
  /** Stable primitive key — never depend on object identity of `context` / `clientDNA`. */
  const autoRunKey = `${storageKey}|${clientId || 'no-client'}|${destination}|${month}`;

  const fallback = useMemo(
    () => buildPredictiveWishSuggestion(context),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuild only when stable key changes
    [autoRunKey],
  );

  async function runAiFetch() {
    setLoading(true);
    setError(null);
    setWarning(null);
    try {
      let accessToken = '';
      try {
        accessToken = await getClientAccessToken();
      } catch (authErr) {
        throw new Error(
          authErr instanceof Error
            ? authErr.message
            : 'انتهت الجلسة — يرجى تسجيل الدخول مرة أخرى.',
        );
      }

      const liveContext = contextRef.current;
      const clientDNA = buildClientDnaForAi(liveContext);
      const dest = liveContext.destination?.trim() || 'وجهة الرحلة';
      const mon = arabicMonthNameFromIso(liveContext.tripDateFrom ?? '');

      const res = await fetch('/api/ai-itinerary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ destination: dest, month: mon, clientDNA }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        warning?: string;
        suggestions?: AiItinerarySuggestion[];
      };
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || 'تعذر جلب اقتراحات الذكاء الاصطناعي');
      }
      setAiSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      if (data.warning) setWarning(data.warning);
    } catch (err) {
      console.error('[AiPredictiveWishesCard]', err);
      setError(err instanceof Error ? err.message : 'تعذر جلب الاقتراحات');
      setAiSuggestions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (dismissed) return;

    // Skip only if we already finished a run for this exact key
    if (hasGeneratedAI.current && lastAutoKeyRef.current === autoRunKey) return;

    hasGeneratedAI.current = true; // LOCK immediately (before await)
    lastAutoKeyRef.current = autoRunKey;

    let cancelled = false;
    let completed = false;

    const generateAI = async () => {
      setLoading(true);
      setError(null);
      setWarning(null);
      try {
        let accessToken = '';
        try {
          accessToken = await getClientAccessToken();
        } catch (authErr) {
          throw new Error(
            authErr instanceof Error
              ? authErr.message
              : 'انتهت الجلسة — يرجى تسجيل الدخول مرة أخرى.',
          );
        }

        if (cancelled) return;

        const liveContext = contextRef.current;
        const clientDNA = buildClientDnaForAi(liveContext);
        const dest = liveContext.destination?.trim() || 'وجهة الرحلة';
        const mon = arabicMonthNameFromIso(liveContext.tripDateFrom ?? '');

        const res = await fetch('/api/ai-itinerary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ destination: dest, month: mon, clientDNA }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          warning?: string;
          suggestions?: AiItinerarySuggestion[];
        };
        if (cancelled) return;
        if (!res.ok || data.ok === false) {
          throw new Error(data.error || 'تعذر جلب اقتراحات الذكاء الاصطناعي');
        }
        setAiSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
        if (data.warning) setWarning(data.warning);
        completed = true;
      } catch (err) {
        if (cancelled) return;
        console.error('[AiPredictiveWishesCard]', err);
        setError(err instanceof Error ? err.message : 'تعذر جلب الاقتراحات');
        setAiSuggestions([]);
        completed = true; // don't retry-loop on error from parent re-renders
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void generateAI();
    return () => {
      cancelled = true;
      // Strict Mode abort only — keep lock after a finished run
      if (!completed) hasGeneratedAI.current = false;
    };
  }, [dismissed, autoRunKey]);

  if (dismissed) return null;

  function handleDismiss() {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(`${storageKey}:dismissed`, '1');
    } catch {
      /* ignore */
    }
  }

  function handleApplyAi(suggestion: AiItinerarySuggestion) {
    if (!onApply) return;
    const key = `${suggestion.title}|${suggestion.time}`;
    onApply(aiSuggestionToPlacePayload(suggestion, destination));
    setAppliedKeys((prev) => new Set(prev).add(key));
  }

  function handleApplyFallback() {
    if (!onApply) return;
    onApply(predictiveWishToPlacePayload(fallback));
    setAppliedKeys((prev) => new Set(prev).add('fallback'));
  }

  function handleRegenerate() {
    // Manual only — does not unlock the auto-effect loop
    void runAiFetch();
  }

  return (
    <aside
      className={`relative overflow-hidden rounded-2xl border border-[#D4AF37]/45 bg-gradient-to-br from-[#0a1210] via-[#121816] to-[#001f3f] p-[1px] shadow-[0_0_40px_rgba(212,175,55,0.18)] ${className}`}
      dir="rtl"
      aria-live="polite"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -left-8 -top-8 h-32 w-32 rounded-full bg-[#D4AF37]/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-10 -right-6 h-36 w-36 rounded-full bg-amber-500/10 blur-3xl"
      />

      <div className="relative rounded-[calc(1rem-1px)] bg-[#0d1210]/95 p-4 sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-black text-[#D4AF37]">
              <Sparkles className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
              ✨ سحر واندرلوم التنبؤي
            </p>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
              Wanderloom Predictive AI
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-lg border border-white/10 p-1.5 text-white/45 transition hover:bg-white/10 hover:text-white/80"
            aria-label="تجاهل"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          <span className="rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-2.5 py-1 text-[10px] font-bold text-[#f0dfa0]">
            DNA: {fallback.dnaEcho}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-white/65">
            {fallback.contextLine}
          </span>
        </div>

        {/* Reserved height — prevents CLS / page jitter while AI loads */}
        <div className="relative flex min-h-[168px] w-full flex-col justify-center overflow-hidden rounded-xl border border-white/5 bg-black/25 px-3 py-4 sm:min-h-[180px]">
          {loading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-2 text-center">
              <Loader2
                className="h-5 w-5 shrink-0 animate-spin text-[#D4AF37]"
                aria-hidden
              />
              <span className="max-w-[18rem] text-sm font-bold leading-relaxed text-white/70">
                جاري توليد اقتراحات مخصّصة من DNA العميل…
              </span>
            </div>
          ) : null}

          {!loading && error ? (
            <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-200">
              {error}
            </p>
          ) : null}

          {!loading && warning ? (
            <p className="mb-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100/90">
              {warning}
            </p>
          ) : null}

          {!loading && aiSuggestions.length > 0 ? (
            <ul className="w-full space-y-3">
              {aiSuggestions.map((item) => {
                const key = `${item.title}|${item.time}`;
                const applied = appliedKeys.has(key);
                return (
                  <li
                    key={key}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-white">{item.title}</p>
                        <p className="mt-1 text-[11px] font-bold text-[#D4AF37]/90">
                          {item.time} · {aiActivityTypeLabelAr(item.type)}
                        </p>
                        {item.ai_reasoning ? (
                          <p className="mt-2 text-xs font-semibold leading-relaxed text-white/75">
                            {item.ai_reasoning}
                          </p>
                        ) : null}
                      </div>
                      {onApply ? (
                        <button
                          type="button"
                          onClick={() => handleApplyAi(item)}
                          disabled={applied}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-l from-[#D4AF37] via-[#e8c96a] to-[#C9A227] px-3 py-2 text-[11px] font-black text-[#0d1210] transition hover:brightness-105 disabled:opacity-60"
                        >
                          <Zap className="h-3.5 w-3.5" aria-hidden />
                          {applied ? 'تمت الإضافة ✓' : 'إضافة للمسار'}
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {!loading && aiSuggestions.length === 0 && !error ? (
            <p className="w-full text-sm font-semibold leading-[1.85] text-white/92">
              {fallback.bodyAr}
            </p>
          ) : null}
        </div>

        {!loading && aiSuggestions.length === 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {onApply ? (
              <button
                type="button"
                onClick={handleApplyFallback}
                disabled={appliedKeys.has('fallback')}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#D4AF37] via-[#e8c96a] to-[#C9A227] px-4 py-2.5 text-xs font-black text-[#0d1210] shadow-[0_8px_24px_rgba(212,175,55,0.35)] transition hover:brightness-105 disabled:opacity-60 sm:flex-none"
              >
                <Zap className="h-4 w-4" aria-hidden />
                {appliedKeys.has('fallback') ? 'تم تطبيق التعديل ✓' : '⚡ تطبيق التعديل على المسار'}
              </button>
            ) : (
              <Link
                href={builderHref}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#D4AF37] via-[#e8c96a] to-[#C9A227] px-4 py-2.5 text-xs font-black text-[#0d1210] shadow-[0_8px_24px_rgba(212,175,55,0.35)] transition hover:brightness-105 sm:flex-none"
              >
                <Zap className="h-4 w-4" aria-hidden />
                ⚡ تطبيق التعديل على المسار
              </Link>
            )}
            <button
              type="button"
              onClick={handleRegenerate}
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-white/12 bg-transparent px-4 py-2.5 text-xs font-bold text-white/55 transition hover:border-white/25 hover:bg-white/5 hover:text-white/80 sm:flex-none"
            >
              إعادة التوليد
            </button>
          </div>
        ) : null}

        {!loading && aiSuggestions.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRegenerate}
              className="inline-flex items-center justify-center rounded-xl border border-white/12 px-3 py-2 text-[11px] font-bold text-white/60 transition hover:bg-white/5 hover:text-white/85"
            >
              إعادة التوليد
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="inline-flex items-center justify-center rounded-xl border border-white/12 px-3 py-2 text-[11px] font-bold text-white/45 transition hover:bg-white/5"
            >
              تجاهل
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
