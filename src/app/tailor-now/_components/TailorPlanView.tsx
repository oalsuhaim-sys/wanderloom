'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, Loader2, Lock, MapPin, MessageCircle, Printer, Upload } from 'lucide-react';

import { useLanguage } from '@/context/LanguageContext';
import { WANDERLOOM_BANK_DETAILS } from '@/lib/bank-checkout';
import { supabase } from '@/lib/supabase';
import { formatSar, type PublicTailorPlan, type TailorDay, type TailorDaySlot } from '@/lib/tailor-now';

import { BANK_EN, PLAN_COPY, TAILOR_COPY, WANDERLOOM_WA_NUMBER } from './copy';
import { tailorCityName, tailorCountryName } from './labels';

type LoadState = 'loading' | 'ready' | 'not_found' | 'error';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function WeaveLoader({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-[24px] border border-[#9C7A3C]/28 bg-white px-6 py-10 text-center shadow-[0_24px_50px_-36px_rgba(28,46,58,0.6)]">
      <svg aria-hidden viewBox="0 0 120 24" className="mx-auto h-6 w-32 overflow-visible">
        <path d="M4 12 C 30 0 50 24 60 12 S 90 0 116 12" fill="none" stroke="#D9B238" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="1 7">
          <animate attributeName="stroke-dashoffset" from="0" to="-32" dur="1.2s" repeatCount="indefinite" />
        </path>
      </svg>
      <p className="mt-4 text-lg font-black text-[#1C2E3A]">{title}</p>
      <p className="mt-2 text-sm font-bold text-[#6B7780]">{hint}</p>
    </div>
  );
}

export function TailorPlanView({ token }: { token: string }) {
  const { locale, setLocale, dir, t } = useLanguage();
  const lang = locale === 'en' ? 'en' : 'ar';
  const p = PLAN_COPY[lang];
  const w = TAILOR_COPY[lang];
  const countries = t.tripLabels.countries as Record<string, string>;

  const [state, setState] = useState<LoadState>('loading');
  const [plan, setPlan] = useState<PublicTailorPlan | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const runningRef = useRef(false);
  const localeSyncedRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/tailor-now/${encodeURIComponent(token)}`, { cache: 'no-store' });
      if (res.status === 404) {
        setState('not_found');
        return null;
      }
      const json = (await res.json()) as { ok?: boolean; plan?: PublicTailorPlan };
      if (!json.ok || !json.plan) {
        setState('error');
        return null;
      }
      setPlan(json.plan);
      setState('ready');
      return json.plan;
    } catch {
      setState('error');
      return null;
    }
  }, [token]);

  const runGeneration = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setGenerating(true);
    setGenError(null);
    try {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const res = await fetch(`/api/tailor-now/${encodeURIComponent(token)}/generate`, { method: 'POST' });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; plan?: PublicTailorPlan; error?: string };
        if (json.ok && json.plan) {
          setPlan(json.plan);
          if (!json.plan.pendingDays.length) break;
          continue;
        }
        if (json.error === 'in_progress') {
          await sleep(8000);
          const fresh = await load();
          if (fresh && !fresh.pendingDays.length) break;
          continue;
        }
        setGenError(json.error === 'generation_limit' ? 'limit' : 'failed');
        break;
      }
    } catch {
      setGenError('failed');
    } finally {
      runningRef.current = false;
      setGenerating(false);
    }
  }, [token, load]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const first = await load();
      if (cancelled || !first) return;
      if (first.pendingDays.length) void runGeneration();
    })();
    return () => {
      cancelled = true;
    };
  }, [load, runGeneration]);

  // Keep the page in the plan's language (the plan was written in it).
  useEffect(() => {
    if (!plan || localeSyncedRef.current) return;
    localeSyncedRef.current = true;
    if (plan.locale !== locale) setLocale(plan.locale);
  }, [plan, locale, setLocale]);

  // Waiting for the transfer to be confirmed: check back every minute.
  useEffect(() => {
    if (!plan || plan.unlocked || !plan.receiptSubmitted) return;
    const id = window.setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      const fresh = await load();
      if (fresh?.unlocked && fresh.pendingDays.length) void runGeneration();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [plan, load, runGeneration]);

  const uploadReceipt = async (file: File | undefined) => {
    if (!file || !plan) return;
    setUploadError(null);
    const allowed = file.type.startsWith('image/') || file.type === 'application/pdf';
    if (!allowed || file.size > 10 * 1024 * 1024) {
      setUploadError(p.uploadError);
      return;
    }
    setUploading(true);
    try {
      const safe = file.name.replace(/[^\w.-]+/g, '_').slice(-60) || 'receipt';
      // Random folder (not the plan token) so receipt paths never reveal plan links.
      const path = `tailor-now/${crypto.randomUUID()}/${Date.now()}_${safe}`;
      const { error } = await supabase.storage.from('payment_receipts').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream',
      });
      if (error) throw error;
      const { data } = supabase.storage.from('payment_receipts').getPublicUrl(path);
      const res = await fetch(`/api/tailor-now/${encodeURIComponent(token)}/receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptUrl: data.publicUrl }),
      });
      const json = (await res.json()) as { ok?: boolean; plan?: PublicTailorPlan };
      if (!json.ok || !json.plan) throw new Error('save_failed');
      setPlan(json.plan);
    } catch {
      setUploadError(p.uploadError);
    } finally {
      setUploading(false);
    }
  };

  const copyIban = async () => {
    try {
      await navigator.clipboard.writeText(WANDERLOOM_BANK_DETAILS.iban);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the IBAN is visible to copy by hand */
    }
  };

  if (state === 'loading') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center text-sm font-bold text-[#6B7780]">
        <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-[#9C7A3C]" aria-hidden />
        {p.loading}
      </div>
    );
  }
  if (state !== 'ready' || !plan) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-lg font-black text-[#1C2E3A]">{state === 'not_found' ? p.notFound : w.errors.generic}</p>
        <Link href="/tailor-now" className="mt-6 inline-block text-sm font-black text-[#9C7A3C] underline underline-offset-4">
          {w.brand}
        </Link>
      </div>
    );
  }

  const country = { id: plan.countryId, label: plan.countryLabel };
  const countryName = tailorCountryName(plan.countryId, plan.countryLabel, countries, lang);
  const cityName = (label: string) => tailorCityName(label, country, countries, lang, p.variousCities);
  const dayByNumber = new Map(plan.days.map((d) => [d.dayNumber, d]));
  const builtCount = plan.unlocked ? plan.days.length : Math.min(1, plan.days.length);
  const planLink = typeof window !== 'undefined' ? window.location.href : '';
  const waHref = `https://wa.me/${WANDERLOOM_WA_NUMBER}?text=${encodeURIComponent(p.waMessage(planLink))}`;
  const bankName = lang === 'en' ? BANK_EN.bankName : WANDERLOOM_BANK_DETAILS.bankName;
  const accountName = lang === 'en' ? BANK_EN.accountName : WANDERLOOM_BANK_DETAILS.accountName;
  const day1Pending = !dayByNumber.has(1);

  return (
    <div dir={dir} className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-8 sm:py-16">
      <header className="mb-10 text-center">
        <p className="text-xs font-black tracking-[0.2em] text-[#9C7A3C]">{w.brand}</p>
        <p className="mt-3 text-base font-bold text-[#3E4F5A]">{p.hello(plan.firstName)}</p>
        <h1 className="mt-1 text-3xl font-black text-[#1C2E3A] sm:text-4xl">{p.planTitle(countryName, w.daysUnit(plan.daysTotal))}</h1>
        <ul className="mt-5 flex flex-wrap justify-center gap-2">
          {plan.segments.map((s, i) => (
            <li key={s.city} className="rounded-full border border-[#9C7A3C]/35 bg-white/70 px-3.5 py-1.5 text-xs font-black text-[#1C2E3A]">
              {i + 1}. {cityName(s.city)} · {w.daysUnit(s.days)}
            </li>
          ))}
        </ul>
      </header>

      <div className="space-y-6">
        {day1Pending && (generating || !genError) ? <WeaveLoader title={p.weavingFirst} hint={p.weavingFirstHint} /> : null}

        {plan.slots.map((slot) => {
          const day = dayByNumber.get(slot.dayNumber);
          if (day) return <DayCard key={slot.dayNumber} day={day} slot={slot} label={p.dayLabel(slot.dayNumber)} cityName={cityName(slot.city)} openMap={p.openMap} />;
          return null;
        })}

        {!plan.unlocked && !day1Pending ? (
          <LockedDays
            slots={plan.slots.filter((s) => s.dayNumber > 1)}
            dayLabel={p.dayLabel}
            cityName={cityName}
            title={p.lockedTitle}
            hint={p.lockedHint}
          />
        ) : null}

        {plan.unlocked && plan.pendingDays.length && !day1Pending ? (
          <WeaveLoader title={p.weavingRest(builtCount, plan.daysTotal)} hint={p.weavingRestHint} />
        ) : null}

        {genError && !generating ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-center print:hidden">
            <p className="text-sm font-black text-amber-900">{genError === 'limit' ? p.limit : p.failed}</p>
            {genError !== 'limit' ? (
              <button type="button" onClick={() => void runGeneration()} className="mt-3 rounded-full bg-[#1C2E3A] px-5 py-2 text-sm font-black text-[#F4EFE6]">
                {p.retry}
              </button>
            ) : (
              <a href={waHref} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-black text-[#9C7A3C] underline">
                {p.whatsapp}
              </a>
            )}
          </div>
        ) : null}

        {!plan.unlocked && !day1Pending ? (
          <section className="relative overflow-hidden rounded-[24px] bg-[#1C2E3A] p-6 text-[#F4EFE6] shadow-[0_24px_50px_-30px_rgba(28,46,58,0.8)] sm:p-8 print:hidden">
            <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-[#D9B238]" />
            <h2 className="text-2xl font-black">{p.payTitle}</h2>
            <p className="mt-3 text-[15px] font-semibold leading-[1.9] text-[#C9D1D6]">
              {p.payBody(plan.daysTotal, formatSar(plan.pricePerDay, lang))}
            </p>
            <div className="mt-5 flex items-baseline justify-between gap-3 rounded-2xl bg-white/5 px-4 py-3">
              <span className="text-sm font-black text-[#C9D1D6]">{p.total}</span>
              <span className="text-2xl font-black text-[#E9CB6A]">{formatSar(plan.totalPrice, lang)}</span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-2xl bg-white/5 px-4 py-3">
                <dt className="text-[11px] font-bold text-[#C9D1D6]">{p.bank}</dt>
                <dd className="mt-1 font-black">{bankName}</dd>
              </div>
              <div className="rounded-2xl bg-white/5 px-4 py-3">
                <dt className="text-[11px] font-bold text-[#C9D1D6]">{p.accountName}</dt>
                <dd className="mt-1 font-black">{accountName}</dd>
              </div>
              <div className="rounded-2xl bg-white/5 px-4 py-3 sm:col-span-2">
                <dt className="text-[11px] font-bold text-[#C9D1D6]">{p.iban}</dt>
                <dd className="mt-1 flex flex-wrap items-center justify-between gap-3">
                  <span dir="ltr" className="font-mono text-[15px] font-black tracking-wider">{WANDERLOOM_BANK_DETAILS.iban}</span>
                  <button type="button" onClick={copyIban} className="inline-flex items-center gap-1.5 rounded-full border border-[#D9B238]/50 px-3 py-1 text-xs font-black text-[#E9CB6A]">
                    {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                    {copied ? p.copied : p.copy}
                  </button>
                </dd>
              </div>
            </dl>

            {plan.receiptSubmitted ? (
              <p className="mt-5 flex items-start gap-2 rounded-2xl bg-[#D9B238]/15 px-4 py-3 text-sm font-black text-[#E9CB6A]">
                <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {p.receiptDone}
              </p>
            ) : (
              <div className="mt-5">
                <label className="wl-gold-cta inline-flex min-h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-full px-6 text-base font-black sm:w-auto">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Upload className="h-5 w-5" aria-hidden />}
                  {uploading ? p.uploading : p.uploadReceipt}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="sr-only"
                    disabled={uploading}
                    onChange={(e) => void uploadReceipt(e.target.files?.[0])}
                  />
                </label>
                <p className="mt-2 text-[11px] font-bold text-[#C9D1D6]">{p.fileTypes}</p>
                {uploadError ? <p className="mt-2 text-sm font-bold text-red-300">{uploadError}</p> : null}
              </div>
            )}
            <a href={waHref} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#E9CB6A] underline decoration-[#E9CB6A]/40 underline-offset-4">
              <MessageCircle className="h-4 w-4" aria-hidden /> {p.whatsapp}
            </a>
          </section>
        ) : null}

        {plan.status === 'ready' ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#D9B238]/60 bg-[#FBF8F1] px-5 py-5 text-center print:hidden">
            <p className="text-sm font-black text-[#1C2E3A]">{p.readyNote}</p>
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full bg-[#1C2E3A] px-5 py-2.5 text-sm font-black text-[#F4EFE6]">
              <Printer className="h-4 w-4" aria-hidden /> {p.print}
            </button>
          </div>
        ) : null}

        <div className="rounded-2xl border border-[#9C7A3C]/25 bg-white/70 px-5 py-5 text-center print:hidden">
          <p className="text-sm font-bold text-[#3E4F5A]">{p.expert}</p>
          <Link href={`/?dest=${encodeURIComponent(plan.countryId)}#lead`} className="mt-3 inline-block text-sm font-black text-[#9C7A3C] underline underline-offset-4">
            {p.expertCta}
          </Link>
        </div>
      </div>
    </div>
  );
}

function DayCard({ day, slot, label, cityName, openMap }: { day: TailorDay; slot: TailorDaySlot; label: string; cityName: string; openMap: string }) {
  return (
    <article className="relative overflow-hidden rounded-[24px] border border-[#9C7A3C]/28 bg-white p-5 shadow-[0_24px_50px_-36px_rgba(28,46,58,0.6)] sm:p-7 print:break-inside-avoid print:shadow-none">
      <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-[#D9B238]" />
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-black text-[#9C7A3C]">
            {label} · {cityName}
          </p>
          <h2 className="mt-1 text-2xl font-black text-[#1C2E3A]">{day.title}</h2>
        </div>
        <span className="text-[11px] font-bold text-[#6B7780]">
          {slot.dayInCity}/{slot.cityDays}
        </span>
      </div>
      {day.summary ? <p className="mb-5 text-[15px] font-semibold leading-[1.9] text-[#3E4F5A]">{day.summary}</p> : null}
      <ol className="relative space-y-4 before:absolute before:inset-y-2 before:start-[3.4rem] before:w-px before:bg-[#E8E1D3]">
        {day.stops.map((stop, i) => (
          <li key={`${stop.time}-${i}`} className="relative grid grid-cols-[3rem_1fr] gap-4">
            <span dir="ltr" className="pt-0.5 text-center text-sm font-black text-[#1C2E3A]">{stop.time}</span>
            <div className="relative ps-4">
              <span aria-hidden className="absolute start-[-0.36rem] top-2 h-2.5 w-2.5 rounded-full bg-[#D9B238] ring-4 ring-white" />
              <p className="text-[11px] font-black text-[#9C7A3C]">{stop.beat}</p>
              <h3 className="text-base font-black text-[#1C2E3A]">{stop.title}</h3>
              {stop.notes ? <p className="mt-1 text-sm font-semibold leading-[1.8] text-[#3E4F5A]">{stop.notes}</p> : null}
              {stop.placeName ? (
                <a
                  href={stop.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#F7F2E8] px-3 py-1 text-xs font-black text-[#1C2E3A] hover:bg-[#F1E6C8]"
                >
                  <MapPin className="h-3.5 w-3.5 text-[#B8921E]" aria-hidden />
                  <span dir="auto">{stop.placeName}</span>
                  <span className="text-[#9C7A3C] print:hidden">· {openMap}</span>
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </article>
  );
}

function LockedDays({
  slots,
  dayLabel,
  cityName,
  title,
  hint,
}: {
  slots: TailorDaySlot[];
  dayLabel: (n: number) => string;
  cityName: (label: string) => string;
  title: string;
  hint: string;
}) {
  if (!slots.length) return null;
  return (
    <section className="relative overflow-hidden rounded-[24px] border border-dashed border-[#9C7A3C]/45 bg-[#FBF8F1] p-5 sm:p-6 print:hidden">
      <div className="flex items-center gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1C2E3A] text-[#E9CB6A]">
          <Lock className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-black text-[#1C2E3A]">{title}</p>
          <p className="text-xs font-bold text-[#6B7780]">{hint}</p>
        </div>
      </div>
      <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
        {slots.map((slot) => (
          <li key={slot.dayNumber} className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3">
            <Lock className="h-3.5 w-3.5 shrink-0 text-[#9C7A3C]" aria-hidden />
            <span className="text-sm font-black text-[#1C2E3A]">{dayLabel(slot.dayNumber)}</span>
            <span className="truncate text-xs font-bold text-[#6B7780]">{cityName(slot.city)}</span>
            <span aria-hidden className="ms-auto hidden h-2.5 w-16 rounded-full bg-[#E8E1D3] blur-[2px] min-[380px]:block" />
          </li>
        ))}
      </ul>
    </section>
  );
}
