'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  Bus,
  CalendarDays,
  Car,
  Check,
  CheckCircle2,
  Church,
  Hotel,
  Landmark,
  Loader2,
  MapPin,
  MessageCircle,
  Mountain,
  Plane,
  Sparkles,
  Ticket,
  Train,
  Trees,
  Wallet,
  Waves,
  X,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

import { submitQuotationClientFeedbackAction } from '@/app/actions/submitQuotationFeedback';
import { clientAcceptQuotationAction } from '@/app/actions/quotationActions';
import {
  formatDestinationsLabel,
  formatQuotationDateRange,
  quotationClientName,
  quotationTotalPrice,
  type QuotationRow,
} from '@/lib/crm-quotations';
import {
  buildSelectedCostSummary,
  emptyClientFeedback,
  groupHotelsByCity,
  uniqueRouteCities,
  type QuotationActivityOption,
  type QuotationClientFeedback,
  type QuotationHotelOption,
  type QuotationTransportOption,
} from '@/lib/interactive-quotation';

type FeedbackTarget =
  | { kind: 'day'; id: string; label: string }
  | { kind: 'hotel'; id: string; label: string }
  | { kind: 'transport'; id: string; label: string }
  | { kind: 'activity'; id: string; label: string }
  | null;

type Props = {
  quotation: QuotationRow;
};

/** Keep Tailwind arbitrary values in JS strings (avoids SWC JSX attribute parse bugs). */
const LUXURY_CARD =
  'bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-6 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1';
const LUXURY_CARD_SELECTED = 'ring-2 ring-[#b8954d] bg-[#fbf9f2]';
const PAGE = 'min-h-screen bg-[#FDFBF7] pb-36 text-[#243223]';
const PAGE_DONE = 'min-h-screen bg-[#FDFBF7] text-[#243223]';
const GOLD = 'text-[#b8954d]';
const OLIVE = 'text-[#243223]';
const GOLD_BRIGHT = 'text-[#d4af37]';

function formatSar(value: number): string {
  return `${value.toLocaleString('ar-SA')} ر.س`;
}

function transportIcon(name: string) {
  const n = name.toLowerCase();
  if (/train|قطار|jr|rail/i.test(n)) return <Train className="h-6 w-6" aria-hidden />;
  if (/bus|حافلة/i.test(n)) return <Bus className="h-6 w-6" aria-hidden />;
  return <Car className="h-6 w-6" aria-hidden />;
}

function destinationIcon(city: string, className = 'h-5 w-5') {
  const c = city.toLowerCase();
  if (/tokyo|طوكيو|osaka|أوساكا|kyoto|كيوتو|japan|اليابان|nara|نارا/i.test(c))
    return <Sparkles className={className} aria-hidden />;
  if (/paris|باريس|rome|روما|london|لندن|istanbul|إسطنبول/i.test(c))
    return <Landmark className={className} aria-hidden />;
  if (/dubai|دبي|abu|أبوظبي|nyc|new york|نيويورك/i.test(c))
    return <Building2 className={className} aria-hidden />;
  if (/maldives|المالديف|bali|بالي|santorini|سانتوريني|beach|شاطئ/i.test(c))
    return <Waves className={className} aria-hidden />;
  if (/alps|جبال|swiss|سويسرا|nepal|نبال|everest/i.test(c))
    return <Mountain className={className} aria-hidden />;
  if (/vatican|كاتدرائ|مسجد|mosque|church/i.test(c))
    return <Church className={className} aria-hidden />;
  if (/forest|غابة|nature|طبيعة/i.test(c))
    return <Trees className={className} aria-hidden />;
  if (/airport|مطار|flight|طيران/i.test(c))
    return <Plane className={className} aria-hidden />;
  return <MapPin className={className} aria-hidden />;
}

function dayRowIcon(
  day: { title: string; description: string; city: string },
) {
  const blob = `${day.title} ${day.description} ${day.city}`;
  if (/وصول|استقبال|مغادرة|مطار|طيران|flight|airport|depart|arriv/i.test(blob)) {
    return <Plane className="h-4 w-4 text-white" aria-hidden />;
  }
  return destinationIcon(day.city || day.title || '', 'h-4 w-4 text-white');
}

function formatDayNumberLabel(dayNumber: number): string {
  return `يوم ${String(Math.max(0, dayNumber)).padStart(2, '0')}`;
}

function formatTimelineDate(raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('ar-SA', { day: 'numeric', month: 'long' });
  }
  return value;
}

function EditFeedbackButton({
  hasNote,
  onClick,
}: {
  hasNote: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ' +
        (hasNote
          ? 'border-[#b8954d]/50 bg-[#fbf9f2] text-[#b8954d]'
          : 'border-[#e8d9b5] bg-white/80 text-slate-500 hover:border-[#b8954d]/40 hover:bg-[#fbf9f2] hover:text-[#b8954d]')
      }
      aria-label="إضافة تعديل"
    >
      <MessageCircle className="h-3.5 w-3.5" aria-hidden />
      تعديل
    </button>
  );
}

/** Premium curved route map connecting itinerary cities */
function VoyageRouteMap({ cities }: { cities: string[] }) {
  if (cities.length === 0) return null;

  const W = 900;
  const H = 260;
  const padX = 90;
  const midY = H / 2;

  const nodes = cities.map((city, i) => {
    const t = cities.length === 1 ? 0.5 : i / (cities.length - 1);
    const x = padX + t * (W - padX * 2);
    const wave = cities.length <= 2 ? 0 : Math.sin(t * Math.PI) * -48;
    const zig = cities.length <= 2 ? 0 : i % 2 === 0 ? -18 : 22;
    return { city, x, y: midY + wave + zig, i };
  });

  let pathD = '';
  if (nodes.length === 1) {
    pathD = `M ${nodes[0].x} ${nodes[0].y}`;
  } else {
    pathD = `M ${nodes[0].x} ${nodes[0].y}`;
    for (let i = 1; i < nodes.length; i++) {
      const prev = nodes[i - 1];
      const curr = nodes[i];
      const cx = (prev.x + curr.x) / 2;
      const cy = (prev.y + curr.y) / 2 - 36;
      pathD += ` Q ${cx} ${cy} ${curr.x} ${curr.y}`;
    }
  }

  return (
    <div
      className={
        'overflow-hidden rounded-3xl border border-[#e8d9b5]/80 bg-gradient-to-b from-white to-[#f7f1e6] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] sm:p-8'
      }
    >
      <div className="mb-4 text-center">
        <p className={'text-[11px] font-semibold uppercase tracking-[0.28em] ' + GOLD}>
          Journey Cartography
        </p>
        <h3 className={'mt-2 font-serif text-2xl font-semibold ' + OLIVE}>
          خارطة الرحلة
        </h3>
      </div>

      <div className="relative mx-auto w-full max-w-3xl" dir="ltr">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={`مسار الرحلة: ${cities.join(' ← ')}`}
        >
          <defs>
            <linearGradient id="routeGlow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#b8954d" stopOpacity="0.15" />
              <stop offset="50%" stopColor="#d4af37" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#b8954d" stopOpacity="0.15" />
            </linearGradient>
            <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {nodes.length > 1 ? (
            <>
              <path
                d={pathD}
                fill="none"
                stroke="url(#routeGlow)"
                strokeWidth="10"
                strokeLinecap="round"
                opacity="0.55"
              />
              <path
                d={pathD}
                fill="none"
                stroke="#b8954d"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeDasharray="7 9"
                filter="url(#softGlow)"
              />
            </>
          ) : null}

          {nodes.map((node) => {
            const labelAbove = node.i % 2 === 0;
            return (
              <g key={`${node.city}-${node.i}`}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="16"
                  fill="#FDFBF7"
                  stroke="#b8954d"
                  strokeWidth="2"
                  filter="url(#softGlow)"
                />
                <circle cx={node.x} cy={node.y} r="5.5" fill="#b8954d" />
                <foreignObject
                  x={node.x - 70}
                  y={labelAbove ? node.y - 58 : node.y + 22}
                  width="140"
                  height="36"
                >
                  <div className="flex justify-center" dir="rtl">
                    <span
                      className={
                        'inline-flex max-w-[130px] items-center gap-1 truncate rounded-full border border-[#e8d9b5] bg-white/95 px-3 py-1 text-[11px] font-semibold shadow-sm ' +
                        OLIVE
                      }
                      title={node.city}
                    >
                      <span className={GOLD}>
                        {destinationIcon(node.city, 'h-3 w-3')}
                      </span>
                      {node.city}
                    </span>
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </svg>
      </div>

      {cities.length > 1 ? (
        <p className="mt-2 text-center text-xs tracking-wide text-slate-500" dir="rtl">
          {cities.join('  ←  ')}
        </p>
      ) : null}
    </div>
  );
}

function FeedbackPopover({
  target,
  value,
  onChange,
  onClose,
}: {
  target: NonNullable<FeedbackTarget>;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={
        'absolute z-40 mt-2 w-72 rounded-2xl border border-[#e8d9b5] bg-white p-3 shadow-[0_20px_50px_rgba(15,23,42,0.14)]'
      }
      dir="rtl"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className={'text-[11px] font-semibold tracking-wide ' + GOLD}>
          تعديل · {target.label}
        </p>
        <button
          type="button"
          onClick={onClose}
          className={
            'rounded-full p-1 text-slate-400 hover:bg-[#fbf9f2] hover:text-[#243223]'
          }
          aria-label="إغلاق"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <textarea
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder="اكتب طلب التعديل هنا…"
        className={
          'w-full rounded-xl border border-gray-100 bg-[#FDFBF7] px-3 py-2 text-sm leading-relaxed text-[#243223] outline-none focus:border-[#b8954d] focus:ring-2 focus:ring-[#b8954d]/30'
        }
      />
    </div>
  );
}

function GoldCheck() {
  return (
    <span
      className={
        'absolute end-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#b8954d] text-white shadow-[0_4px_14px_rgba(184,149,77,0.45)]'
      }
    >
      <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
    </span>
  );
}

export function PremiumInteractiveQuotation({ quotation }: Props) {
  const [hotels, setHotels] = useState<QuotationHotelOption[]>(() =>
    quotation.hotel_options.map((h) => ({ ...h })),
  );
  const [transports, setTransports] = useState<QuotationTransportOption[]>(() =>
    quotation.transport_options.map((t) => ({ ...t })),
  );
  const [activities, setActivities] = useState<QuotationActivityOption[]>(() =>
    (quotation.activity_options ?? []).map((a) => ({ ...a })),
  );
  const [feedback, setFeedback] = useState<QuotationClientFeedback>(() => ({
    ...emptyClientFeedback(),
    ...quotation.client_feedback,
    days: { ...(quotation.client_feedback.days ?? {}) },
    hotels: { ...(quotation.client_feedback.hotels ?? {}) },
    transport: { ...(quotation.client_feedback.transport ?? {}) },
    activities: { ...(quotation.client_feedback.activities ?? {}) },
  }));
  const [popover, setPopover] = useState<FeedbackTarget>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(
    quotation.status === 'needs_revision' || quotation.status === 'client_responded',
  );

  const days = useMemo(
    () =>
      [...quotation.itinerary_days].sort(
        (a, b) => (a.dayNumber || 0) - (b.dayNumber || 0),
      ),
    [quotation.itinerary_days],
  );
  const costs = quotation.cost_breakdown;
  const routeCities = useMemo(() => {
    const fromDays = uniqueRouteCities(days);
    if (fromDays.length > 0) return fromDays;
    return quotation.destinations.map((d) => String(d).trim()).filter(Boolean);
  }, [days, quotation.destinations]);
  const hotelsByCity = useMemo(() => groupHotelsByCity(hotels), [hotels]);
  const clientName = quotationClientName(quotation);
  const grandTotal = quotationTotalPrice(quotation);
  const costSummary = useMemo(
    () =>
      buildSelectedCostSummary({
        hotels,
        transports,
        activities,
        additional: costs,
      }),
    [hotels, transports, activities, costs],
  );
  const hasSelectionPricing =
    hotels.some((h) => h.is_selected_by_client) ||
    transports.some((t) => t.is_selected_by_client) ||
    activities.some((a) => a.is_selected_by_client);
  const showCostSection =
    hotels.length > 0 ||
    transports.length > 0 ||
    activities.length > 0 ||
    costs.length > 0 ||
    grandTotal > 0;
  const displayTotal =
    costSummary.total > 0
      ? costSummary.total
      : !hasSelectionPricing && grandTotal > 0
        ? grandTotal
        : 0;

  const toggleHotel = useCallback((id: string) => {
    setHotels((prev) =>
      prev.map((h) =>
        h.id === id ? { ...h, is_selected_by_client: !h.is_selected_by_client } : h,
      ),
    );
  }, []);

  const toggleTransport = useCallback((id: string) => {
    setTransports((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, is_selected_by_client: !t.is_selected_by_client } : t,
      ),
    );
  }, []);

  const toggleActivity = useCallback((id: string) => {
    setActivities((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, is_selected_by_client: !a.is_selected_by_client } : a,
      ),
    );
  }, []);

  const popoverValue = useMemo(() => {
    if (!popover) return '';
    if (popover.kind === 'day') return feedback.days?.[popover.id] ?? '';
    if (popover.kind === 'hotel') return feedback.hotels?.[popover.id] ?? '';
    if (popover.kind === 'activity') return feedback.activities?.[popover.id] ?? '';
    return feedback.transport?.[popover.id] ?? '';
  }, [feedback, popover]);

  const setPopoverValue = useCallback(
    (value: string) => {
      if (!popover) return;
      setFeedback((prev) => {
        if (popover.kind === 'day') {
          return { ...prev, days: { ...(prev.days ?? {}), [popover.id]: value } };
        }
        if (popover.kind === 'hotel') {
          return { ...prev, hotels: { ...(prev.hotels ?? {}), [popover.id]: value } };
        }
        if (popover.kind === 'activity') {
          return {
            ...prev,
            activities: { ...(prev.activities ?? {}), [popover.id]: value },
          };
        }
        return {
          ...prev,
          transport: { ...(prev.transport ?? {}), [popover.id]: value },
        };
      });
    },
    [popover],
  );

  const handleSubmit = useCallback(async () => {
    if (submitting || submitted) return;
    setSubmitting(true);
    const loadingId = toast.loading('جاري إرسال اختياراتكم وملاحظاتكم…');
    try {
      const result = await submitQuotationClientFeedbackAction({
        quoteId: quotation.id,
        hotelOptions: hotels,
        transportOptions: transports,
        activityOptions: activities,
        feedback,
      });
      if (!result.ok) throw new Error(result.error);
      setSubmitted(true);
      toast.success('تم استلام ملاحظاتكم — سيراجعها مصمم رحلتكم قريباً ✨', {
        id: loadingId,
        duration: 5000,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذر الإرسال', {
        id: loadingId,
        duration: 5000,
      });
    } finally {
      setSubmitting(false);
    }
  }, [activities, feedback, hotels, quotation.id, submitted, submitting, transports]);

  const handleAcceptQuote = useCallback(async () => {
    if (submitting || submitted) return;
    setSubmitting(true);
    const loadingId = toast.loading('جاري اعتماد العرض…');
    try {
      const result = await clientAcceptQuotationAction(quotation.id);
      if (!result.ok) throw new Error(result.error);
      setSubmitted(true);
      toast.success('تم اعتماد العرض — سيتم إرسال رابط الدفع قريباً ✨', {
        id: loadingId,
        duration: 5000,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذر اعتماد العرض', {
        id: loadingId,
        duration: 5000,
      });
    } finally {
      setSubmitting(false);
    }
  }, [quotation.id, submitted, submitting]);

  if (submitted) {
    return (
      <div className={PAGE_DONE} dir="rtl">
        <Toaster position="top-center" />
        <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-28 text-center">
          <div
            className={
              'mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-[#e8d9b5] bg-white text-[#b8954d] shadow-[0_8px_30px_rgb(0,0,0,0.06)]'
            }
          >
            <CheckCircle2 className="h-10 w-10" aria-hidden />
          </div>
          <p
            className={
              'text-[11px] font-semibold uppercase tracking-[0.28em] ' + GOLD
            }
          >
            Wanderloom Concierge
          </p>
          <h1
            className={
              'mt-3 font-serif text-4xl font-semibold tracking-tight ' + OLIVE
            }
          >
            شكراً لثقتكم
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            تم إرسال اختيارات الفنادق والمواصلات مع ملاحظاتكم. سيعود إليكم مصمم الرحلة
            بالتعديلات المناسبة.
          </p>
          <p className={'mt-10 text-sm ' + GOLD}>{quotation.title}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={PAGE} dir="rtl">
      <Toaster position="top-center" />

      <header className={'relative overflow-hidden border-b border-[#e8d9b5]/70'}>
        <div
          className="pointer-events-none absolute inset-0 opacity-45"
          style={{
            backgroundImage:
              'radial-gradient(circle at 18% 18%, rgba(184,149,77,0.22), transparent 44%), radial-gradient(circle at 82% 8%, rgba(15,23,42,0.07), transparent 42%)',
          }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-4xl px-6 pb-14 pt-14 text-center">
          <p
            className={
              'inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.32em] ' +
              GOLD
            }
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Private Voyage Proposal
          </p>
          <h1
            className={
              'mt-6 font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl md:text-6xl ' +
              OLIVE
            }
          >
            {quotation.title || 'رحلتكم القادمة'}
          </h1>
          <p className="mt-4 text-base text-slate-600">
            مُعدّ خصيصاً لـ{' '}
            <span className={'font-semibold ' + OLIVE}>
              {clientName !== '—' ? clientName : 'ضيف Wanderloom'}
            </span>
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-5 text-sm text-slate-500">
            <span className="inline-flex items-center gap-2">
              <CalendarDays className={'h-4 w-4 ' + GOLD} aria-hidden />
              {formatQuotationDateRange(quotation.start_date, quotation.end_date)}
            </span>
            {quotation.destinations.length > 0 ? (
              <span className="inline-flex items-center gap-2">
                <MapPin className={'h-4 w-4 ' + GOLD} aria-hidden />
                {formatDestinationsLabel(quotation.destinations)}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-20 px-6 py-14">
        {routeCities.length > 0 ? (
          <section>
            <VoyageRouteMap cities={routeCities} />
          </section>
        ) : null}

        {days.length > 0 ? (
          <section>
            <SectionHeading eyebrow="Itinerary" title="يومًا بيوم" />
            <div className="relative mt-10">
              {/* Vertical timeline line — physical right in RTL */}
              <div
                className={'absolute top-0 bottom-0 right-[20px] w-0.5 bg-[#D4C4A8]'}
                aria-hidden
              />

              <div className="relative">
                {days.map((day, index) => {
                  const noteKey = day.id;
                  const hasNote = Boolean(feedback.days?.[noteKey]?.trim());
                  const isFirst = index === 0;
                  const dateLabel = formatTimelineDate(day.date);

                  return (
                    <div key={day.id} className="relative mb-6 pr-14">
                      {/* Timeline dot — first filled gold, rest outlined */}
                      <div
                        className={
                          isFirst
                            ? 'absolute right-[15px] top-4 h-3 w-3 rounded-full border-2 border-[#b8954d] bg-[#b8954d]'
                            : 'absolute right-[15px] top-4 h-3 w-3 rounded-full border-2 border-[#D4C4A8] bg-[#FDFBF7]'
                        }
                        aria-hidden
                      />

                      <div
                        className={
                          'flex items-center justify-between gap-3 rounded-xl border border-[#E5E0D5] bg-[#F8F6F0] p-4 shadow-sm'
                        }
                      >
                        {/* Right (RTL start): icon + date/title */}
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={
                              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#243223]'
                            }
                          >
                            {dayRowIcon(day)}
                          </div>
                          <div className="flex min-w-0 flex-col">
                            {dateLabel ? (
                              <span className="text-xs text-gray-500">
                                {dateLabel}
                                {day.city ? ` · ${day.city}` : ''}
                              </span>
                            ) : day.city ? (
                              <span className="text-xs text-gray-500">{day.city}</span>
                            ) : null}
                            <span className="text-lg font-bold text-[#243223]">
                              {day.title || `يوم ${day.dayNumber}`}
                            </span>
                            {day.description ? (
                              <span className="mt-1 line-clamp-2 text-sm leading-6 text-gray-600">
                                {day.description}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {/* Left (RTL end): day number + تعديل */}
                        <div className="relative flex shrink-0 flex-col items-end gap-2">
                          <span className="text-sm text-gray-400">
                            {formatDayNumberLabel(day.dayNumber)}
                          </span>
                          <EditFeedbackButton
                            hasNote={hasNote}
                            onClick={() =>
                              setPopover({
                                kind: 'day',
                                id: noteKey,
                                label: day.title || `يوم ${day.dayNumber}`,
                              })
                            }
                          />
                          {popover?.kind === 'day' && popover.id === noteKey ? (
                            <FeedbackPopover
                              target={popover}
                              value={popoverValue}
                              onChange={setPopoverValue}
                              onClose={() => setPopover(null)}
                            />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        {hotels.length > 0 ? (
          <section>
            <SectionHeading eyebrow="Stay" title="الفنادق المقترحة" />
            <p className="mt-3 text-center text-sm text-slate-500">
              اضغط على البطاقة لاختيار خيارك · استخدم «تعديل» لإضافة ملاحظة
            </p>
            <div className="mt-10 space-y-12">
              {hotelsByCity.map(({ city, hotels: cityHotels }) => (
                <div key={city}>
                  <div className="mb-6 flex items-center gap-4">
                    <div
                      className={
                        'h-px flex-1 bg-gradient-to-l from-[#b8954d]/50 to-transparent'
                      }
                    />
                    <h3
                      className={
                        'inline-flex items-center gap-2 font-serif text-xl font-semibold tracking-wide ' +
                        GOLD
                      }
                    >
                      {destinationIcon(city, 'h-4 w-4')}
                      {city}
                    </h3>
                    <div
                      className={
                        'h-px flex-1 bg-gradient-to-r from-[#b8954d]/50 to-transparent'
                      }
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    {cityHotels.map((hotel) => {
                      const selected = hotel.is_selected_by_client;
                      const hasNote = Boolean(feedback.hotels?.[hotel.id]?.trim());
                      return (
                        <div key={hotel.id} className="relative">
                          <button
                            type="button"
                            onClick={() => toggleHotel(hotel.id)}
                            className={
                              'relative w-full pb-14 text-right ' +
                              LUXURY_CARD +
                              (selected ? ' ' + LUXURY_CARD_SELECTED : '')
                            }
                          >
                            {selected ? <GoldCheck /> : null}
                            <div className="flex items-start gap-3 pe-10">
                              <span
                                className={
                                  'mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ' +
                                  (selected
                                    ? 'bg-[#b8954d]/15 text-[#b8954d]'
                                    : 'bg-[#FDFBF7] text-[#b8954d]')
                                }
                              >
                                <Hotel className="h-5 w-5" aria-hidden />
                              </span>
                              <div>
                                <h4
                                  className={
                                    'font-serif text-xl font-semibold ' + OLIVE
                                  }
                                >
                                  {hotel.name || 'فندق'}
                                </h4>
                                {hotel.description ? (
                                  <p className="mt-3 text-sm leading-7 text-slate-600">
                                    {hotel.description}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                            {hotel.price > 0 ? (
                              <p className="mt-5 text-end text-xs tracking-wide text-slate-500">
                                التكلفة التقديرية:{' '}
                                <span className={'font-semibold ' + GOLD} dir="ltr">
                                  {formatSar(hotel.price)}
                                </span>
                              </p>
                            ) : null}
                          </button>
                          <div className="absolute bottom-4 start-4 z-10">
                            <EditFeedbackButton
                              hasNote={hasNote}
                              onClick={() =>
                                setPopover({
                                  kind: 'hotel',
                                  id: hotel.id,
                                  label: hotel.name || 'فندق',
                                })
                              }
                            />
                            {popover?.kind === 'hotel' && popover.id === hotel.id ? (
                              <div className="absolute bottom-12 start-0 z-40">
                                <FeedbackPopover
                                  target={popover}
                                  value={popoverValue}
                                  onChange={setPopoverValue}
                                  onClose={() => setPopover(null)}
                                />
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {transports.length > 0 ? (
          <section>
            <SectionHeading eyebrow="Mobility" title="وسائل التنقل" />
            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
              {transports.map((row) => {
                const selected = row.is_selected_by_client;
                const hasNote = Boolean(feedback.transport?.[row.id]?.trim());
                return (
                  <div key={row.id} className="relative">
                    <button
                      type="button"
                      onClick={() => toggleTransport(row.id)}
                      className={
                        'relative w-full pb-14 text-right ' +
                        LUXURY_CARD +
                        (selected ? ' ' + LUXURY_CARD_SELECTED : '')
                      }
                    >
                      {selected ? <GoldCheck /> : null}
                      <div className="flex items-start gap-3 pe-10">
                        <span
                          className={
                            'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ' +
                            (selected
                              ? 'bg-[#b8954d]/15 text-[#b8954d]'
                              : 'bg-[#FDFBF7] text-[#b8954d]')
                          }
                        >
                          {transportIcon(row.name)}
                        </span>
                        <div>
                          <h3
                            className={'font-serif text-xl font-semibold ' + OLIVE}
                          >
                            {row.name || 'مواصلات'}
                          </h3>
                          {row.description ? (
                            <p className="mt-2 text-sm leading-7 text-slate-600">
                              {row.description}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      {row.price > 0 ? (
                        <p className="mt-5 text-end text-xs tracking-wide text-slate-500">
                          التكلفة التقديرية:{' '}
                          <span className={'font-semibold ' + GOLD} dir="ltr">
                            {formatSar(row.price)}
                          </span>
                        </p>
                      ) : null}
                    </button>
                    <div className="absolute bottom-4 start-4 z-10">
                      <EditFeedbackButton
                        hasNote={hasNote}
                        onClick={() =>
                          setPopover({
                            kind: 'transport',
                            id: row.id,
                            label: row.name || 'مواصلات',
                          })
                        }
                      />
                      {popover?.kind === 'transport' && popover.id === row.id ? (
                        <div className="absolute bottom-12 start-0 z-40">
                          <FeedbackPopover
                            target={popover}
                            value={popoverValue}
                            onChange={setPopoverValue}
                            onClose={() => setPopover(null)}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {activities.length > 0 ? (
          <section>
            <SectionHeading eyebrow="Experiences" title="الأنشطة والفعاليات" />
            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
              {activities.map((row) => {
                const selected = row.is_selected_by_client;
                const hasNote = Boolean(feedback.activities?.[row.id]?.trim());
                return (
                  <div key={row.id} className="relative">
                    <button
                      type="button"
                      onClick={() => toggleActivity(row.id)}
                      className={
                        'relative w-full pb-14 text-right ' +
                        LUXURY_CARD +
                        (selected ? ' ' + LUXURY_CARD_SELECTED : '')
                      }
                    >
                      {selected ? <GoldCheck /> : null}
                      <div className="flex items-start gap-3 pe-10">
                        <span
                          className={
                            'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ' +
                            (selected
                              ? 'bg-[#b8954d]/15 text-[#b8954d]'
                              : 'bg-[#FDFBF7] text-[#b8954d]')
                          }
                        >
                          <Ticket className="h-6 w-6" aria-hidden />
                        </span>
                        <div>
                          <h3
                            className={'font-serif text-xl font-semibold ' + OLIVE}
                          >
                            {row.name || 'فعالية'}
                          </h3>
                          {row.description ? (
                            <p className="mt-2 text-sm leading-7 text-slate-600">
                              {row.description}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      {row.price > 0 ? (
                        <p className="mt-5 text-end text-xs tracking-wide text-slate-500">
                          التكلفة التقديرية:{' '}
                          <span className={'font-semibold ' + GOLD} dir="ltr">
                            {formatSar(row.price)}
                          </span>
                        </p>
                      ) : null}
                    </button>
                    <div className="absolute bottom-4 start-4 z-10">
                      <EditFeedbackButton
                        hasNote={hasNote}
                        onClick={() =>
                          setPopover({
                            kind: 'activity',
                            id: row.id,
                            label: row.name || 'فعالية',
                          })
                        }
                      />
                      {popover?.kind === 'activity' && popover.id === row.id ? (
                        <div className="absolute bottom-12 start-0 z-40">
                          <FeedbackPopover
                            target={popover}
                            value={popoverValue}
                            onChange={setPopoverValue}
                            onClose={() => setPopover(null)}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {showCostSection ? (
          <section>
            <SectionHeading eyebrow="Investment" title="التكلفة التقديرية للفرد" />
            <div
              className={
                'mt-8 overflow-hidden rounded-3xl border border-[#b8954d]/35 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]'
              }
            >
              {!hasSelectionPricing &&
              (hotels.length > 0 || transports.length > 0 || activities.length > 0) ? (
                <p className="border-b border-gray-100 px-6 py-4 text-center text-sm text-slate-500">
                  اختر فندقاً ووسيلة تنقل وفعاليات لإضافة تكلفتها إلى الملخص
                </p>
              ) : null}
              {costSummary.lines.map((line) => (
                <div
                  key={line.id}
                  className="flex items-center justify-between border-b border-gray-100 px-6 py-4 last:border-0"
                >
                  <span className="text-sm text-slate-600">{line.label}</span>
                  <span className={'text-sm font-semibold ' + OLIVE} dir="ltr">
                    {formatSar(line.price)}
                  </span>
                </div>
              ))}
              <div
                className={
                  'relative bg-[#243223] px-6 py-8 text-center shadow-[inset_0_0_40px_rgba(212,175,55,0.12)]'
                }
              >
                <div
                  className={
                    'pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#d4af37]/70 to-transparent'
                  }
                  aria-hidden
                />
                <p
                  className={
                    'inline-flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] ' +
                    GOLD_BRIGHT
                  }
                >
                  <Wallet className="h-3.5 w-3.5" aria-hidden />
                  الإجمالي التقديري للفرد
                </p>
                <p
                  className={
                    'mt-3 font-serif text-4xl font-semibold tracking-tight ' +
                    GOLD_BRIGHT
                  }
                  dir="ltr"
                >
                  {formatSar(displayTotal)}
                </p>
              </div>
            </div>
          </section>
        ) : null}
      </main>

      <div
        className={
          'fixed inset-x-0 bottom-0 z-40 border-t border-[#e8d9b5]/80 bg-[#FDFBF7]/95 px-4 py-4 backdrop-blur-md'
        }
      >
        <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-center text-xs text-slate-500 sm:text-right">
            اختياراتكم وملاحظاتكم تُرسل لمصمم الرحلة مباشرة
          </p>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleSubmit()}
              className={
                'inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#243223]/25 bg-white px-5 py-3.5 text-sm font-semibold text-[#243223] transition hover:bg-slate-50 disabled:opacity-70 sm:w-auto'
              }
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : null}
              إرسال الملاحظات فقط
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleAcceptQuote()}
              className={
                'inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#243223] px-6 py-3.5 text-sm font-semibold text-[#d4af37] shadow-lg transition hover:bg-[#30402c] disabled:opacity-70 sm:w-auto'
              }
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <CheckCircle2 className="h-5 w-5" aria-hidden />
              )}
              أوافق على العرض
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="text-center">
      <p
        className={
          'text-[11px] font-semibold uppercase tracking-[0.28em] ' + GOLD
        }
      >
        {eyebrow}
      </p>
      <h2
        className={
          'mt-2 font-serif text-3xl font-semibold tracking-tight ' + OLIVE
        }
      >
        {title}
      </h2>
      <div
        className={
          'mx-auto mt-4 h-px w-16 bg-gradient-to-l from-transparent via-[#b8954d] to-transparent'
        }
      />
    </div>
  );
}
