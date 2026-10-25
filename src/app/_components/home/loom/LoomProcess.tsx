'use client';

import { useLanguage } from '@/context/LanguageContext';

const NUMERALS_AR = ['١', '٢', '٣', '٤'];

/** «كيف نعمل» — four steps on a wavy gold thread. */
export function LoomProcess() {
  const { t, locale } = useLanguage();
  const l = t.loom;
  const steps = [
    { title: l.step1Title, body: l.step1Body },
    { title: l.step2Title, body: l.step2Body },
    { title: l.step3Title, body: l.step3Body },
    { title: l.step4Title, body: l.step4Body },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 sm:gap-12 sm:px-8">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div className="flex max-w-2xl flex-col gap-3.5">
          <p className="text-xs font-extrabold tracking-wide text-[#9C7A3C] sm:text-[13px]">{l.weaveKicker}</p>
          <h2 className="text-[28px] font-black leading-tight text-[#1C2E3A] sm:text-4xl lg:text-[44px]">{l.weaveTitle}</h2>
        </div>
        <p className="max-w-md text-base font-medium leading-loose text-[#3E4F5A]">{l.weaveBody}</p>
      </div>

      <div className="relative">
        <svg
          aria-hidden
          viewBox="0 0 1200 60"
          preserveAspectRatio="none"
          className="absolute inset-x-0 top-[34px] hidden h-[60px] w-full lg:block"
        >
          <path
            d="M0 30 C 75 0 75 60 150 30 S 225 0 300 30 S 375 60 450 30 S 525 0 600 30 S 675 60 750 30 S 825 0 900 30 S 975 60 1050 30 S 1125 0 1200 30"
            fill="none"
            stroke="#D9B238"
            strokeWidth={3}
            strokeLinecap="round"
          />
        </svg>
        <ol className="relative grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => {
            const last = i === steps.length - 1;
            return (
              <li
                key={s.title}
                className={`flex flex-col gap-3.5 rounded-[22px] border p-6 pb-7 ${
                  last
                    ? 'border-[#1C2E3A] bg-[#1C2E3A] text-[#F4EFE6] shadow-[0_22px_44px_-26px_rgba(28,46,58,0.8)]'
                    : 'border-[#9C7A3C]/25 bg-white shadow-[0_22px_44px_-32px_rgba(28,46,58,0.5)]'
                }`}
              >
                <span
                  className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl font-black shadow-[0_0_0_6px_#F4EFE6] ${
                    last ? 'bg-[#D9B238] text-[#1C2E3A]' : 'bg-[#1C2E3A] text-[#D9B238]'
                  }`}
                >
                  {locale === 'ar' ? NUMERALS_AR[i] : i + 1}
                </span>
                <h3 className={`text-xl font-black ${last ? 'text-[#F4EFE6]' : 'text-[#1C2E3A]'}`}>{s.title}</h3>
                <p className={`text-[15px] leading-loose ${last ? 'text-[#D6DCE0]' : 'text-[#3E4F5A]'}`}>{s.body}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
