'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AlertCircle, Calendar, Check, CheckCircle2, Compass, Sparkles, Thermometer } from 'lucide-react';

import { requestTripDestination } from '@/app/_components/home/loom/destination-intent';
import { LandmarkIcon, type LandmarkId } from '@/app/_components/home/loom/LandmarkIcon';

import { useTripDestinations } from '@/hooks/useCountries';
import {
  getCountryAdvisorData,
  SEASON_KEYS,
  SEASON_LABELS,
  type SeasonKey,
} from '@/lib/destination-advisor-data';

type Step = 1 | 2 | 3;

function AdvisorImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(!src?.trim());

  if (failed || !src?.trim()) {
    return (
      <div
        className={`flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#f4f0e6] via-[#F2F7F4] to-[#f9f6f0] p-6 text-center ${className ?? ''}`}
      >
        <Compass className="h-10 w-10 text-[#9C7A3C]/70" strokeWidth={1.5} aria-hidden />
        <p className="text-sm font-black text-[#1C2E3A]">وجهة واندرلوم</p>
        <p className="text-[11px] font-bold text-gray-500">Wanderloom Destination</p>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`h-full w-full bg-[#F4EFE6] object-cover ${className ?? ''}`}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

/** Countries that have a landmark knot in the loom identity */
const FEATURED: Array<Exclude<LandmarkId, 'onsen'>> = ['japan', 'korea', 'uk', 'france', 'italy', 'switzerland'];

const REGIONS: Array<{ label: string; ids: string[] }> = [
  { label: 'آسيا', ids: ['japan', 'korea', 'china', 'indonesia'] },
  {
    label: 'أوروبا',
    ids: ['uk', 'france', 'italy', 'switzerland', 'spain', 'portugal', 'germany', 'austria', 'netherlands', 'belgium', 'czech', 'hungary', 'poland', 'sweden', 'russia'],
  },
  { label: 'الأمريكتان وأفريقيا', ids: ['usa', 'canada', 'south_africa'] },
];

const SEASON_ICON: Record<SeasonKey, string> = {
  winter: 'M12 2v20M4.9 6.5l14.2 11M4.9 17.5l14.2-11M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5',
  spring: 'M12 7a2.5 2.5 0 1 1 0-.01M12 7c-3-4-7-1-4 2.5M12 7c3-4 7-1 4 2.5M8 9.5c-4 1-3 6 1 5M16 9.5c4 1 3 6-1 5M9 14.5c0 4 6 4 6 0M12 12v10',
  summer: 'M12 7a5 5 0 1 0 0.01 0M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  autumn: 'M5 19C5 10 11 4 20 4c0 9-6 15-15 15ZM5 19l9-9',
};

const STEP_NAMES = ['الدولة', 'الموسم', 'التوصية'] as const;

function AdvisorStepper({ step, onBack }: { step: Step; onBack: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 lg:items-end">
      <ol className="flex items-start" aria-label={`الخطوة ${step} من 3`}>
        {STEP_NAMES.map((name, i) => {
          const n = (i + 1) as Step;
          const done = n < step;
          const current = n === step;
          return (
            <li key={name} className="flex items-start">
              <span className="flex w-16 flex-col items-center gap-1.5">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-black transition-all duration-300 ${
                    current
                      ? 'bg-[#D9B238] text-[#1C2E3A] shadow-[0_0_0_5px_rgba(217,178,56,0.2)]'
                      : done
                        ? 'border-2 border-[#D9B238] bg-white text-[#B8921E]'
                        : 'border border-gray-200 bg-white text-gray-400'
                  }`}
                >
                  {done ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden /> : n}
                </span>
                <span className={`text-xs font-black ${current ? 'text-[#1C2E3A]' : done ? 'text-[#B8921E]' : 'text-gray-400'}`}>{name}</span>
              </span>
              {i < STEP_NAMES.length - 1 ? (
                <span aria-hidden className="mt-[19px] h-0.5 w-8 overflow-hidden rounded-full bg-[#ECE5D6] sm:w-12">
                  <span className="block h-full bg-[#D9B238] transition-[width] duration-500" style={{ width: done ? '100%' : '0%' }} />
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
      {step > 1 ? (
        <button type="button" onClick={onBack} className="text-sm font-extrabold text-[#3E4F5A] underline-offset-4 transition hover:text-[#1C2E3A] hover:underline">
          → رجوع
        </button>
      ) : null}
    </div>
  );
}

export default function DestinationAdvisor() {
  const { tripDestinations } = useTripDestinations();
  const [step, setStep] = useState<Step>(1);
  const [countryId, setCountryId] = useState<string | null>(null);
  const [seasonKey, setSeasonKey] = useState<SeasonKey | null>(null);

  const countryData = useMemo(() => {
    if (!countryId) return null;
    const label = tripDestinations.find((c) => c.id === countryId)?.labelAr;
    return getCountryAdvisorData(countryId, label);
  }, [countryId, tripDestinations]);

  const seasonData = useMemo(() => {
    if (!countryData || !seasonKey) return null;
    return countryData.seasons[seasonKey];
  }, [countryData, seasonKey]);

  const labelOf = (id: string) => tripDestinations.find((c) => c.id === id)?.labelAr ?? id;
  const available = new Set(tripDestinations.map((c) => c.id));
  const countryLabel = (countryId ? tripDestinations.find((c) => c.id === countryId)?.labelAr : '') || countryData?.name || '';
  const featured = FEATURED.filter((id) => available.has(id));
  const grouped = REGIONS.map((r) => ({ ...r, ids: r.ids.filter((id) => available.has(id)) })).filter((r) => r.ids.length);
  const known = new Set(REGIONS.flatMap((r) => r.ids));
  const others = tripDestinations.map((c) => c.id).filter((id) => !known.has(id));
  if (others.length) grouped.push({ label: 'وجهات أخرى', ids: others });
  const countryIcon = countryId && (FEATURED as string[]).includes(countryId) ? (countryId as LandmarkId) : null;

  const selectCountry = (id: string) => {
    setCountryId(id);
    setSeasonKey(null);
    setStep(2);
  };

  const selectSeason = (key: SeasonKey) => {
    setSeasonKey(key);
    setStep(3);
  };

  const goBack = () => {
    if (step === 3) {
      setSeasonKey(null);
      setStep(2);
      return;
    }
    if (step === 2) {
      setCountryId(null);
      setStep(1);
    }
  };

  return (
    <div className="relative flex w-full flex-col gap-10">
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div className="flex max-w-2xl flex-col gap-3.5">
          <p className="inline-flex items-center gap-2 text-xs font-extrabold tracking-wide text-[#9C7A3C] sm:text-[13px]">
            <Compass className="h-4 w-4" aria-hidden />
            مستشار الوجهة
          </p>
          <h2 className="text-[28px] font-black leading-tight text-[#1C2E3A] sm:text-4xl lg:text-[44px]">تعرف وجهتك؟ دعنا نرشدك للموسم المثالي</h2>
          <p className="text-base font-medium leading-loose text-[#3E4F5A] sm:text-[17px]">
            اختر الدولة، ثم الموسم، لنكشف لك درجات الحرارة، الأنشطة الحصرية، والفعاليات التي لا تجدها على جوجل.
          </p>
        </div>
        <AdvisorStepper step={step} onBack={goBack} />
      </div>

      <div className="w-full">
        {step === 1 ? (
          tripDestinations.length === 0 ? (
            <p className="text-center text-sm font-bold text-gray-500">لا وجهات في بنك الأماكن بعد — أضف أماكن من الخزنة لتظهر هنا.</p>
          ) : (
            <div className="flex flex-col gap-9">
              {featured.length ? (
                <div className="relative">
                  <span aria-hidden className="absolute inset-x-[6%] top-[42px] hidden border-t-[3px] border-[#D9B238] sm:block" />
                  <ul className="relative grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-6">
                    {featured.map((id) => (
                      <li key={id}>
                        <button type="button" onClick={() => selectCountry(id)} className="group flex w-full flex-col items-center gap-2.5 text-center">
                          <span className="flex h-[84px] w-[84px] items-center justify-center rounded-full border-2 border-[#9C7A3C] bg-[#F4EFE6] text-[#1C2E3A] shadow-[0_0_0_8px_#F4EFE6,0_14px_30px_-18px_rgba(28,46,58,0.6)] transition-all duration-300 group-hover:-translate-y-1 group-hover:border-[#D9B238] group-hover:bg-[#1C2E3A] group-hover:text-[#E9CB6A]">
                            <LandmarkIcon id={id} size={42} />
                          </span>
                          <span className="text-[15px] font-black text-[#1C2E3A]">{labelOf(id)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex items-center gap-4" aria-hidden>
                <span className="h-px flex-1 border-t border-dashed border-[#9C7A3C]/45" />
                <span className="text-xs font-extrabold text-[#9C7A3C]">أو اختر من كل الوجهات</span>
                <span className="h-px flex-1 border-t border-dashed border-[#9C7A3C]/45" />
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {grouped.map((region) => (
                  <div key={region.label} className="rounded-[22px] border border-[#9C7A3C]/25 bg-white/80 p-5 shadow-[0_18px_40px_-34px_rgba(28,46,58,0.6)]">
                    <p className="mb-4 flex items-center gap-2 text-sm font-black text-[#1C2E3A]">
                      <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[#D9B238]" />
                      {region.label}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {region.ids.map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => selectCountry(id)}
                          className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-[#1C2E3A]/12 bg-white px-4 text-sm font-bold text-[#1C2E3A] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#D9B238] hover:bg-[#1C2E3A] hover:text-[#F4EFE6]"
                        >
                          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#D9B238]" />
                          {labelOf(id)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : null}

        {step === 2 && countryData ? (
          <div className="flex flex-col gap-7">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#1C2E3A] text-[#E9CB6A]">
                {countryIcon ? <LandmarkIcon id={countryIcon} size={30} /> : <Compass className="h-7 w-7" aria-hidden />}
              </span>
              <div>
                <p className="text-xs font-extrabold text-[#9C7A3C]">اختر موسم السفر</p>
                <p className="text-2xl font-black text-[#1C2E3A]">{countryLabel}</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {SEASON_KEYS.map((key) => {
                const s = countryData.seasons[key];
                const isRec = s.status === 'recommended';
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectSeason(key)}
                    className={`group relative flex flex-col gap-3 overflow-hidden rounded-[22px] border bg-white p-5 text-start transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_44px_-28px_rgba(28,46,58,0.6)] ${
                      isRec ? 'border-[#D9B238]/55' : 'border-gray-200'
                    }`}
                  >
                    <span aria-hidden className={`absolute inset-x-0 top-0 h-1 ${isRec ? 'bg-[#D9B238]' : 'bg-amber-200'}`} />
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F4EFE6] text-[#1C2E3A] transition group-hover:bg-[#1C2E3A] group-hover:text-[#E9CB6A]">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d={SEASON_ICON[key]} />
                        </svg>
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${isRec ? 'bg-[#D9B238]/15 text-[#8A6A12]' : 'bg-amber-50 text-amber-800'}`}>
                        {isRec ? 'موصى به' : 'بحذر'}
                      </span>
                    </span>
                    <span className="text-xl font-black text-[#1C2E3A]">{SEASON_LABELS[key]}</span>
                    <span className="flex flex-wrap gap-1.5">
                      {s.months.map((m) => (
                        <span key={m} className="rounded-md bg-[#F4EFE6] px-2 py-0.5 text-[11px] font-bold text-[#3E4F5A]">
                          {m}
                        </span>
                      ))}
                    </span>
                    <span dir="ltr" className="flex items-center gap-1.5 self-end text-sm font-black text-[#1C2E3A]">
                      {s.avgTemp}
                      <Thermometer className="h-4 w-4 text-[#B8921E]" aria-hidden />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {step === 3 && seasonData && countryData ? (
          <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="flex flex-col gap-5">
              <div className="relative overflow-hidden rounded-[24px] border border-[#9C7A3C]/28 bg-white p-6 shadow-[0_24px_50px_-36px_rgba(28,46,58,0.6)] sm:p-7">
                <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-[#D9B238]" />
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="flex items-center gap-3 text-2xl font-black text-[#1C2E3A]">
                    {countryIcon ? (
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1C2E3A] text-[#E9CB6A]">
                        <LandmarkIcon id={countryIcon} size={24} />
                      </span>
                    ) : null}
                    {countryLabel} · {seasonData.name}
                  </h3>
                  {seasonData.status === 'recommended' ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D9B238]/60 bg-[#F1E6C8] px-3 py-1 text-xs font-black text-[#6E5410]">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      موسم موصى به
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-black text-amber-900">
                      <AlertCircle className="h-3.5 w-3.5" aria-hidden />
                      ننصح بالتخطيط بعناية
                    </span>
                  )}
                </div>

                <div className="mb-5 flex items-center gap-3 rounded-2xl bg-[#F7F2E8] px-4 py-3">
                  <Thermometer className="h-5 w-5 text-[#B8921E]" aria-hidden />
                  <div>
                    <p className="text-[11px] font-bold text-[#6B7780]">متوسط الحرارة</p>
                    <p dir="ltr" className="text-right text-base font-black text-[#1C2E3A]">{seasonData.avgTemp}</p>
                  </div>
                </div>

                <p className="text-[15px] font-semibold leading-[1.95] text-[#3E4F5A]">{seasonData.advice}</p>

                {seasonData.status === 'recommended' ? (
                  <>
                    <div className="mt-5 rounded-[18px] border-[1.5px] border-dashed border-[#D9B238]/80 bg-[#FBF8F1] p-4">
                      <p className="mb-1.5 flex items-center gap-2 text-xs font-black text-[#8A6A12]">
                        <Sparkles className="h-3.5 w-3.5" aria-hidden />
                        فعاليات حصرية
                      </p>
                      <p className="text-[15px] font-bold leading-relaxed text-[#1C2E3A]">{seasonData.hiddenEvents}</p>
                    </div>
                    <div className="mt-5">
                      <p className="mb-2.5 text-sm font-black text-[#1C2E3A]">أنشطة مقترحة</p>
                      <ul className="space-y-2.5">
                        {seasonData.activities.map((act) => (
                          <li key={act} className="flex items-start gap-2.5 text-[15px] font-bold text-[#3E4F5A]">
                            <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-[#B8921E]" aria-hidden />
                            {act}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : (
                  <div className="mt-5 rounded-[18px] border border-amber-200 bg-amber-50/80 p-4">
                    <p className="text-xs font-bold text-amber-900/80">
                      <span className="font-black">لمحة حصرية:</span> {seasonData.hiddenEvents}
                    </p>
                  </div>
                )}
              </div>

              <Link
                href={countryId ? `/?dest=${encodeURIComponent(countryId)}#lead` : '/#lead'}
                onClick={(e) => {
                  if (countryId && requestTripDestination(countryId)) e.preventDefault();
                }}
                className="wl-gold-cta inline-flex min-h-[56px] items-center justify-center rounded-full px-6 text-base font-black"
              >
                صمّم رحلتي إلى {countryLabel}
              </Link>
            </div>

            <div className="relative grid grid-cols-2 items-start gap-4 pt-4">
              <svg aria-hidden viewBox="0 0 400 60" className="pointer-events-none absolute -top-2 inset-x-[8%] h-12 w-[84%] overflow-visible">
                <path d="M10 40 C 120 0 280 0 390 40" fill="none" stroke="#D9B238" strokeWidth="2.5" strokeDasharray="1 7" strokeLinecap="round" />
                <circle cx="10" cy="40" r="5" fill="#D9B238" />
                <circle cx="390" cy="40" r="5" fill="#D9B238" />
              </svg>
              {seasonData.images.slice(0, 2).map((src, i) => (
                <figure
                  key={`${src}-${i}`}
                  className={`m-0 rounded-md bg-white p-2.5 pb-3 shadow-[0_24px_40px_-26px_rgba(28,46,58,0.65)] ring-1 ring-black/5 transition-transform duration-500 hover:rotate-0 ${
                    i === 0 ? '-rotate-2' : 'mt-10 rotate-[2.5deg]'
                  }`}
                >
                  <div className="aspect-[3/4] overflow-hidden rounded-sm">
                    <AdvisorImage src={src} alt={`${countryLabel} — ${seasonData.name}`} />
                  </div>
                  <figcaption className="mt-2 text-center text-xs font-black text-[#1C2E3A]">
                    {countryLabel} · {seasonData.name}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
