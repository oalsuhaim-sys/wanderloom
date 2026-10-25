'use client';

import Link from 'next/link';

import { requestTripDestination } from '@/app/_components/home/loom/destination-intent';
import { useMemo, useState } from 'react';
import {
  Calendar,
  ChevronRight,
  Compass,
  Sparkles,
  Thermometer,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

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

export default function DestinationAdvisor() {
  const { tripDestinations } = useTripDestinations();
  const [step, setStep] = useState<Step>(1);
  const [countryId, setCountryId] = useState<string | null>(null);
  const [seasonKey, setSeasonKey] = useState<SeasonKey | null>(null);

  const advisorCountries = useMemo(() => tripDestinations, [tripDestinations]);

  const countryData = useMemo(() => {
    if (!countryId) return null;
    const label = tripDestinations.find((c) => c.id === countryId)?.labelAr;
    return getCountryAdvisorData(countryId, label);
  }, [countryId, tripDestinations]);

  const seasonData = useMemo(() => {
    if (!countryData || !seasonKey) return null;
    return countryData.seasons[seasonKey];
  }, [countryData, seasonKey]);

  const countryLabel =
    tripDestinations.find((c) => c.id === countryId)?.labelAr ?? countryData?.name ?? '';

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
    <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center bg-transparent px-4">
      <div className="relative z-10 flex w-full flex-col items-center">
      <div className="mb-10 w-full text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-[#D9B238]/55 bg-[#D9B238]/10 px-4 py-1.5 text-xs font-extrabold tracking-wide text-[#8A6A12]">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          مستشار الوجهة · Wanderloom
        </p>
        <h2 className="mt-5 text-[28px] font-black leading-tight text-[#1C2E3A] sm:text-4xl lg:text-[44px]">
          تعرف وجهتك؟ دعنا نرشدك للموسم المثالي
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm font-bold leading-relaxed text-gray-600 sm:text-base">
          أداة تفاعلية فاخرة: اختر الدولة، ثم الموسم، لنكشف لك درجات الحرارة، الأنشطة الحصرية،
          والفعاليات التي لا تجدها على جوجل.
        </p>
      </div>

      <div className="mb-6 flex w-full items-center justify-between gap-4">
        {step > 1 ? (
          <button
            type="button"
            onClick={goBack}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-[#1C2E3A] shadow-sm transition hover:border-[#9C7A3C]/50 hover:bg-[#f4efe6]"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
            رجوع
          </button>
        ) : (
          <span className="w-[72px] shrink-0" aria-hidden />
        )}

        <div className="flex flex-1 items-center justify-center gap-2 text-xs font-black text-[#1C2E3A]">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
              step >= 1 ? 'border-[#D9B238] bg-[#1C2E3A] text-[#F4EFE6]' : 'border-gray-200 bg-white text-gray-400'
            }`}
          >
            1
          </span>
          <span className="hidden sm:inline">الدولة</span>
          <span className="mx-1 inline-block h-0.5 w-6 rounded-full bg-[#D9B238] sm:w-10" aria-hidden />
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
              step >= 2 ? 'border-[#D9B238] bg-[#1C2E3A] text-[#F4EFE6]' : 'border-gray-200 bg-white text-gray-400'
            }`}
          >
            2
          </span>
          <span className="hidden sm:inline">الموسم</span>
          <span className="mx-1 inline-block h-0.5 w-6 rounded-full bg-[#D9B238] sm:w-10" aria-hidden />
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
              step >= 3 ? 'border-[#D9B238] bg-[#D9B238] text-[#1C2E3A] shadow-[0_0_0_4px_rgba(217,178,56,0.2)]' : 'border-gray-200 bg-white text-gray-400'
            }`}
          >
            3
          </span>
          <span className="hidden sm:inline">التوصية</span>
        </div>

        <span className="w-[72px] shrink-0" aria-hidden />
      </div>

      <div className="w-full rounded-[30px] border border-[#D9B238]/30 bg-white p-6 shadow-[0_34px_70px_-46px_rgba(28,46,58,0.6)] sm:p-9">
        {step === 1 ? (
          <div className="flex flex-wrap justify-center gap-3.5 leading-relaxed">
            {advisorCountries.length === 0 ? (
              <p className="text-sm font-bold text-gray-500">
                لا وجهات في بنك الأماكن بعد — أضف أماكن من الخزنة لتظهر هنا.
              </p>
            ) : (
              advisorCountries.map((country) => {
                const id = country.id;
                const label = country.labelAr;
                const isSelected = countryId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => selectCountry(id)}
                    className={`wl-dest-tag inline-flex cursor-pointer select-none rounded-full border px-5 py-2.5 text-sm transition-all duration-300 ${
                      isSelected
                        ? 'border-[#9C7A3C] bg-[#1C2E3A] font-medium text-[#F4EFE6] shadow-md'
                        : 'border-[#1C2E3A]/10 bg-white/90 font-medium text-[#1C2E3A] shadow-sm hover:border-[#9C7A3C] hover:text-[#9C7A3C]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })
            )}
          </div>
        ) : null}

        {step === 2 && countryData ? (
          <div>
            <p className="mb-6 text-center text-sm font-bold text-gray-600">
              اختر موسم السفر لـ{' '}
              <span className="text-[#1C2E3A]">{countryLabel}</span>
            </p>
            <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {SEASON_KEYS.map((key) => {
                const s = countryData.seasons[key];
                const isRec = s.status === 'recommended';
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectSeason(key)}
                    className="wl-lift-card group flex flex-col rounded-2xl border border-gray-200 bg-white p-5 text-start shadow-sm transition-all duration-500 hover:-translate-y-2 hover:border-[#9C7A3C]/50 hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)]"
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="text-lg font-black text-[#1C2E3A]">{SEASON_LABELS[key]}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                          isRec
                            ? 'bg-[#1C2E3A]/10 text-[#1C2E3A]'
                            : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {isRec ? 'موصى به' : 'بحذر'}
                      </span>
                    </div>
                    <p className="mb-2 text-xs font-bold text-[#9C7A3C]">{s.name}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {s.months.map((m) => (
                        <span
                          key={m}
                          className="rounded-md border border-black/10 bg-white px-2 py-0.5 text-[10px] font-bold text-gray-700"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-xs font-bold text-gray-500">{s.avgTemp}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {step === 3 && seasonData && countryData ? (
          <div className="mx-auto grid w-full max-w-4xl gap-8 lg:grid-cols-2">
            <div className="order-2 flex flex-col gap-5 lg:order-1">
              <div className="rounded-[22px] border border-[#9C7A3C]/28 bg-[#F7F2E8] p-6">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <h3 className="text-xl font-black text-[#1C2E3A]">
                    {countryLabel} · {seasonData.name}
                  </h3>
                  {seasonData.status === 'recommended' ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#9C7A3C]/40 bg-gradient-to-l from-[#1C2E3A]/10 to-[#9C7A3C]/15 px-3 py-1 text-[10px] font-black text-[#1C2E3A]">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#9C7A3C]" />
                      موسم موصى به
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[10px] font-black text-amber-900">
                      <AlertCircle className="h-3.5 w-3.5" />
                      ننصح بالتخطيط بعناية
                    </span>
                  )}
                </div>

                <div className="mb-5 flex items-center gap-2 rounded-xl border border-[#1C2E3A]/10 bg-white px-4 py-3">
                  <Thermometer className="h-5 w-5 text-[#9C7A3C]" aria-hidden />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                      متوسط الحرارة
                    </p>
                    <p className="text-sm font-black text-[#1C2E3A]">{seasonData.avgTemp}</p>
                  </div>
                </div>

                <p className="text-sm font-bold leading-[1.9] text-gray-700">{seasonData.advice}</p>

                {seasonData.status === 'recommended' ? (
                  <>
                    <div className="mt-6 rounded-[18px] border border-[#D9B238]/55 bg-[#FBF6EA] p-4">
                      <p className="mb-2 flex items-center gap-2 text-xs font-black text-[#9C7A3C]">
                        <Sparkles className="h-3.5 w-3.5" />
                        فعاليات حصرية
                      </p>
                      <p className="text-sm font-bold leading-relaxed text-[#1C2E3A]">
                        {seasonData.hiddenEvents}
                      </p>
                    </div>
                    <div className="mt-4">
                      <p className="mb-2 text-xs font-black text-[#1C2E3A]">أنشطة مقترحة</p>
                      <ul className="space-y-2">
                        {seasonData.activities.map((act) => (
                          <li
                            key={act}
                            className="flex items-start gap-2 text-sm font-bold text-gray-700"
                          >
                            <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-[#9C7A3C]" />
                            {act}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : (
                  <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/80 p-4">
                    <p className="text-sm font-bold leading-relaxed text-amber-950">
                      {seasonData.advice}
                    </p>
                    <p className="mt-3 text-xs font-bold text-amber-900/80">
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
                className="inline-flex min-h-[56px] items-center justify-center rounded-full bg-[#1C2E3A] px-6 text-[15px] font-black text-[#F4EFE6] shadow-[0_16px_30px_-18px_rgba(28,46,58,0.8)] transition-all hover:bg-[#122029]"
              >
                صمّم رحلتي إلى {countryLabel}
              </Link>
            </div>

            <div className="order-1 grid grid-cols-2 gap-3 lg:order-2">
              {seasonData.images.map((src, i) => (
                <div
                  key={`${src}-${i}`}
                  className={`group overflow-hidden rounded-xl border border-[#1C2E3A]/10 shadow-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] ${
                    i === 0 ? 'col-span-2 aspect-[16/9] sm:col-span-1 sm:aspect-[3/4]' : 'aspect-square'
                  }`}
                >
                  <AdvisorImage
                    src={src}
                    alt={`${countryLabel} — ${seasonData.name}`}
                    className="transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      </div>
    </div>
  );
}
