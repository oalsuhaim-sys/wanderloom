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
  buildDnaBadgeLines,
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
  const [simulated, setSimulated] = useState(false);
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

  const dnaSignature = [
    context.clientRow?.preferred_seat,
    context.clientRow?.flight_seat,
    context.clientRow?.food_allergies,
    context.clientRow?.dietary,
    context.clientRow?.hotel_preference,
    context.clientRow?.hotel_style,
    context.clientRow?.favorite_drink,
    context.clientRow?.drink_coffee,
    context.destination,
    context.tripDateFrom,
    context.tripDateTo,
  ]
    .map((v) => String(v ?? '').trim())
    .join('|');
  const dnaBadges = useMemo(
    () => buildDnaBadgeLines(context),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- live DNA fields for badges only
    [dnaSignature],
  );

  /**
   * Always POST to the server route. Never read ANTHROPIC_API_KEY in the browser.
   * Surface every server failure — never silently keep empty state.
   */
  async function requestPredictiveSuggestions(): Promise<{
    suggestions: AiItinerarySuggestion[];
    provider?: string;
  }> {
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

    const dnaContext = {
      destination: dest,
      month: mon,
      tripDateFrom: liveContext.tripDateFrom ?? '',
      tripDateTo: liveContext.tripDateTo ?? '',
      clientDNA,
    };

    const res = await fetch('/api/admin/predictive-ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(dnaContext),
    });

    let data: {
      ok?: boolean;
      error?: string;
      provider?: string;
      stops?: AiItinerarySuggestion[];
      suggestions?: AiItinerarySuggestion[];
    } = {};
    try {
      data = (await res.json()) as typeof data;
    } catch {
      throw new Error(`استجابة غير صالحة من الخادم (${res.status})`);
    }

    if (!res.ok || data.error) {
      throw new Error(data.error || 'فشلت عملية التوليد');
    }

    const stops = Array.isArray(data.stops)
      ? data.stops
      : Array.isArray(data.suggestions)
        ? data.suggestions
        : [];

    if (!stops.length) {
      throw new Error('لم يُرجع Claude أي محطات. أعد التوليد.');
    }

    return {
      suggestions: stops,
      provider: data.provider || 'anthropic',
    };
  }

  async function runAiFetch() {
    setLoading(true);
    setError(null);
    setWarning(null);
    setSimulated(false);
    try {
      const result = await requestPredictiveSuggestions();
      setAiSuggestions(result.suggestions);
      setSimulated(false);
      setWarning(null);
    } catch (err) {
      console.error('[AiPredictiveWishesCard] server response error:', err);
      setError(err instanceof Error ? err.message : 'تعذر جلب الاقتراحات');
      setAiSuggestions([]);
      setSimulated(false);
      setWarning(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (dismissed) return;

    if (hasGeneratedAI.current && lastAutoKeyRef.current === autoRunKey) return;

    hasGeneratedAI.current = true;
    lastAutoKeyRef.current = autoRunKey;

    let cancelled = false;
    let completed = false;

    const generateAI = async () => {
      setLoading(true);
      setError(null);
      setWarning(null);
      setSimulated(false);
      try {
        const result = await requestPredictiveSuggestions();
        if (cancelled) return;
        setAiSuggestions(result.suggestions);
        setSimulated(false);
        setWarning(null);
        completed = true;
      } catch (err) {
        if (cancelled) return;
        console.error('[AiPredictiveWishesCard] server response error:', err);
        setError(err instanceof Error ? err.message : 'تعذر جلب الاقتراحات');
        setAiSuggestions([]);
        setSimulated(false);
        setWarning(null);
        completed = true;
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void generateAI();
    return () => {
      cancelled = true;
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

  function handleApplyAllToItinerary() {
    if (!onApply) return;
    if (aiSuggestions.length > 0) {
      const nextKeys = new Set(appliedKeys);
      for (const suggestion of aiSuggestions) {
        const key = `${suggestion.title}|${suggestion.time}`;
        onApply(aiSuggestionToPlacePayload(suggestion, destination));
        nextKeys.add(key);
      }
      nextKeys.add('apply-all');
      setAppliedKeys(nextKeys);
      return;
    }
    onApply(predictiveWishToPlacePayload(fallback));
    setAppliedKeys((prev) => new Set(prev).add('fallback'));
  }

  function handleRegenerate() {
    void runAiFetch();
  }

  return (
    <aside
      className={`relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-6 text-slate-800 shadow-sm ${className}`}
      dir="rtl"
      aria-live="polite"
      data-wl-predictive-ai="v5-claude-sonnet-4-5"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-sans text-lg font-extrabold text-slate-900">
            <Sparkles className="h-5 w-5 shrink-0 text-[#b8952d]" aria-hidden />
            سحر واندرلوم التنبؤي
          </p>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
            Wanderloom Predictive AI · Claude Sonnet
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          aria-label="تجاهل"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-[#b8952d]">
          DNA: {fallback.dnaEcho}
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600">
          {fallback.contextLine}
        </span>
        {dnaBadges.map((badge) => (
          <span
            key={badge}
            className="rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2.5 py-1 text-[10px] font-medium text-[#8A6B2A]"
          >
            {badge}
          </span>
        ))}
        {simulated ? (
          <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[10px] font-medium text-amber-800">
            وضع احتياطي · DNA محلي
          </span>
        ) : null}
      </div>

      <div className="relative flex min-h-[168px] w-full flex-col justify-center overflow-hidden sm:min-h-[180px]">
        {loading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-8 text-center">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#D4AF37]" aria-hidden />
            <span className="max-w-[18rem] text-sm font-medium leading-relaxed text-slate-600">
              Claude يهندس مساراً حسياً من DNA العميل…
            </span>
          </div>
        ) : null}

        {!loading && error ? (
          <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
            <p className="text-xs font-medium leading-relaxed text-rose-800">{error}</p>
            <button
              type="button"
              onClick={() => void runAiFetch()}
              className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : null}

        {!loading && warning ? (
          <p className="mb-3 rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-3 text-xs font-medium text-[#8A6B2A]">
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
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm transition-all hover:bg-white"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-[11px] font-medium text-[#D4AF37]">
                        {item.time} · {aiActivityTypeLabelAr(item.type)}
                      </p>
                      {item.ai_reasoning ? (
                        <p className="mt-2 text-xs font-normal leading-relaxed text-slate-500">
                          {item.ai_reasoning}
                        </p>
                      ) : null}
                    </div>
                    {onApply ? (
                      <button
                        type="button"
                        onClick={() => handleApplyAi(item)}
                        disabled={applied}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#D4AF37]/40 bg-[#D4AF37]/15 px-3 py-2 text-[11px] font-semibold text-[#D4AF37] transition hover:bg-[#D4AF37]/25 disabled:opacity-60"
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
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium leading-[1.85] text-slate-700">{fallback.bodyAr}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {onApply ? (
          <button
            type="button"
            onClick={handleApplyAllToItinerary}
            disabled={
              appliedKeys.has('apply-all') ||
              (aiSuggestions.length === 0 && appliedKeys.has('fallback'))
            }
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/15 px-4 py-2.5 text-xs font-semibold text-[#D4AF37] transition hover:bg-[#D4AF37]/25 disabled:opacity-60 sm:flex-none"
          >
            <Zap className="h-4 w-4" aria-hidden />
            {appliedKeys.has('apply-all') || appliedKeys.has('fallback')
              ? 'تم تطبيق التعديل ✓'
              : 'تطبيق التعديل على المسار'}
          </button>
        ) : (
          <Link
            href={builderHref}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/15 px-4 py-2.5 text-xs font-semibold text-[#D4AF37] transition hover:bg-[#D4AF37]/25 sm:flex-none"
          >
            <Zap className="h-4 w-4" aria-hidden />
            تطبيق التعديل على المسار
          </Link>
        )}
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={loading}
          className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50 sm:flex-none"
        >
          إعادة التوليد
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-500 transition hover:bg-slate-100"
        >
          تجاهل
        </button>
      </div>
    </aside>
  );
}
