'use client';

import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

import { requestTripDestination } from './destination-intent';
import { LandmarkIcon, type LandmarkId } from './LandmarkIcon';

/** Each knot pre-selects its country + signature city in «سجّل رحلتك» via ?dest= */
const STOPS: Array<{ country: Exclude<LandmarkId, 'onsen'>; city: string }> = [
  { country: 'japan', city: 'tokyo' },
  { country: 'korea', city: 'seoul' },
  { country: 'uk', city: 'london' },
  { country: 'france', city: 'paris' },
  { country: 'italy', city: 'rome' },
  { country: 'switzerland', city: 'zermatt' },
];

/** «وجهاتنا» — six landmarks strung on one gold thread. */
export function LoomDestinations() {
  const { t } = useLanguage();
  const l = t.loom;
  const countries = t.tripLabels.countries as Record<string, string>;
  const cities = t.tripLabels.cities as Record<string, Record<string, string>>;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 sm:gap-11 sm:px-8">
      <div className="flex max-w-3xl flex-col gap-3.5">
        <p className="text-xs font-extrabold tracking-wide text-[#9C7A3C] sm:text-[13px]">{l.destKicker}</p>
        <h2 className="text-[28px] font-black leading-tight text-[#1C2E3A] sm:text-4xl lg:text-[44px]">{l.destTitle}</h2>
        <p className="text-base font-medium leading-loose text-[#3E4F5A] sm:text-[17px]">{l.destBody}</p>
      </div>

      <div className="relative">
        <span aria-hidden className="absolute inset-x-[4%] top-[50px] hidden border-t-[3px] border-[#D9B238] sm:block lg:top-[58px]" />
        <ul className="relative grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
          {STOPS.map((s) => (
            <li key={s.country}>
              <Link
                href={`/?dest=${s.country}#lead`}
                onClick={(e) => {
                  if (requestTripDestination(s.country)) e.preventDefault();
                }}
                className="group flex flex-col items-center gap-3 text-center"
              >
                <span className="flex h-[100px] w-[100px] items-center justify-center rounded-full border-2 border-[#9C7A3C] bg-[#F4EFE6] text-[#1C2E3A] shadow-[0_0_0_8px_#F4EFE6,0_14px_30px_-18px_rgba(28,46,58,0.6)] transition-transform duration-300 group-hover:-translate-y-1 group-hover:border-[#D9B238] lg:h-[116px] lg:w-[116px]">
                  <LandmarkIcon id={s.country} size={50} />
                </span>
                <span className="text-lg font-black text-[#1C2E3A]">{cities[s.country]?.[s.city] ?? s.city}</span>
                <span className="text-[13px] font-bold text-[#6B7780]">{countries[s.country] ?? s.country}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col items-start justify-between gap-4 rounded-[20px] border-[1.5px] border-dashed border-[#9C7A3C]/55 bg-[#FBF8F1] px-5 py-5 sm:flex-row sm:items-center sm:px-6">
        <p className="text-[15px] font-bold leading-relaxed text-[#3E4F5A] sm:text-base">{l.quizStrip}</p>
        <Link
          href="/#quiz"
          className="inline-flex min-h-[46px] shrink-0 items-center rounded-full bg-[#1C2E3A] px-6 text-[15px] font-extrabold text-[#F4EFE6] transition hover:bg-[#122029]"
        >
          {l.quizCta}
        </Link>
      </div>
    </div>
  );
}
