'use client';

import Link from 'next/link';

type QuizResultProps = {
  kicker: string;
  countryName: string;
  tagline: string;
  description: string;
  vibeTags: string[];
  registerLabel: string;
  persuasionLabel: string;
  restartLabel: string;
  leadHref?: string;
  onOpenPersuasion: () => void;
  onRestart: () => void;
};

/**
 * بطاقة نتيجة الاختبار — بطاقة VIP مستقلة، مركّزة، Quiet Luxury.
 */
export function QuizResult({
  kicker,
  countryName,
  tagline,
  description,
  vibeTags,
  registerLabel,
  persuasionLabel,
  restartLabel,
  leadHref = '/#lead',
  onOpenPersuasion,
  onRestart,
}: QuizResultProps) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <article className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm md:p-12">
        <p className="text-sm font-bold tracking-wide text-[#cda04c]">{kicker}</p>

        <h2 className="mt-3 text-4xl font-black leading-tight text-[#111111] sm:text-5xl md:text-6xl">
          {countryName}
        </h2>

        {tagline ? (
          <p className="mt-3 text-xs font-bold tracking-wide text-gray-500">{tagline}</p>
        ) : null}

        <p className="mx-auto mt-6 max-w-lg text-base font-bold leading-relaxed text-gray-700">
          {description}
        </p>

        {vibeTags.length > 0 ? (
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {vibeTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[#cda04c]/20 bg-[#fffaf1] px-4 py-1.5 text-xs font-bold text-[#1e3f20]"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href={leadHref}
            className="inline-flex w-auto items-center justify-center rounded-lg bg-[#cda04c] px-8 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#b3893d]"
          >
            {registerLabel}
          </Link>

          <button
            type="button"
            onClick={onOpenPersuasion}
            className="inline-flex w-auto items-center justify-center rounded-lg bg-[#1e3f20] px-8 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#163018]"
          >
            {persuasionLabel}
          </button>

          <button
            type="button"
            onClick={onRestart}
            className="inline-flex w-auto items-center justify-center rounded-lg border border-gray-200 bg-white px-8 py-3 text-sm font-bold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            {restartLabel}
          </button>
        </div>
      </article>
    </div>
  );
}
