'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';

import { useLanguage } from '@/context/LanguageContext';

const WARP_X = [60, 100, 140, 180, 220, 260, 300, 340, 380, 420, 460, 500, 540];
const ROWS = [90, 210, 330, 450];
/** over/under marks where a warp thread passes over the weft */
const OVER = ROWS.flatMap((y, i) => WARP_X.filter((_, j) => (i + j) % 2 === 0 && !(i % 2 === 0 && j === 10)).map((x) => ({ x, y })));
const WEFT =
  'M 30 90 L 560 90 C 600 90 600 210 560 210 L 40 210 C 0 210 0 330 40 330 L 560 330 C 600 330 600 450 560 450 L 40 450 C 0 450 0 560 300 560 L 300 590';

const KNOTS = [
  { x: 460, y: 90, key: 'japan', path: 'M4 11 Q24 15 44 11 M8 18 H40 M13 11 V42 M35 11 V42 M10 26 H38' },
  { x: 140, y: 210, key: 'korea', path: 'M4 20 Q14 22 24 13 Q34 22 44 20 M9 21 V40 M39 21 V40 M17 23 V40 M31 23 V40 M6 40 H42 M12 29 H36' },
  { x: 460, y: 330, key: 'uk', path: 'M18 44 V16 H30 V44 M16 16 H32 M18 16 L24 4 L30 16 M14 44 H34' },
  { x: 140, y: 450, key: 'france', path: 'M24 3 V9 M21 9 H27 M21 9 L13 44 M27 9 L35 44 M17 26 H31 M15 34 H33 M19 44 Q24 36 29 44 M11 44 H37' },
] as const;

const KNOT_CITY = { japan: 'tokyo', korea: 'seoul', uk: 'london', france: 'paris' } as const;

/**
 * «النَّول» hero — a gold weft thread weaves four landmarks into one woven piece: «رحلتك».
 */
export function PublicHomeHero() {
  const { t, dir } = useLanguage();
  const l = t.loom;
  const cities = t.tripLabels.cities as Record<string, Record<string, string>>;
  const Arrow = dir === 'rtl' ? ArrowLeft : ArrowRight;

  return (
    <div data-wl-hero="loom" className="relative mx-auto max-w-6xl px-4 pb-14 pt-12 sm:px-8 sm:pb-16 sm:pt-16 lg:pt-20">
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
        <div className="flex flex-col gap-6 sm:gap-7">
          <p className="inline-flex items-center gap-2.5 text-xs font-extrabold tracking-wide text-[#9C7A3C] sm:text-[13px]">
            <span className="inline-block h-0.5 w-8 bg-[#D9B238]" aria-hidden />
            {l.heroKicker}
          </p>
          <h1 className="text-[40px] font-black leading-[1.15] tracking-tight text-[#1C2E3A] sm:text-6xl lg:text-[72px]">
            {l.heroTitle1}
            <br />
            <span className="text-[#9C7A3C]">{l.heroTitle2}</span>
          </h1>
          <p className="max-w-xl text-base font-medium leading-loose text-[#3E4F5A] sm:text-lg">{l.heroBody}</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              href="/#lead"
              className="wl-gold-cta inline-flex min-h-[56px] items-center justify-center gap-2.5 rounded-full px-8 text-base font-black sm:text-[17px]"
            >
              {l.ctaStart}
              <Arrow className="h-[18px] w-[18px]" strokeWidth={2.4} aria-hidden />
            </Link>
            <Link
              href="/#advisor"
              className="inline-flex min-h-[56px] items-center justify-center rounded-full border-[1.5px] border-[#1C2E3A]/25 px-7 text-[15px] font-extrabold text-[#1C2E3A] transition hover:border-[#9C7A3C] hover:text-[#9C7A3C] sm:text-base"
            >
              {l.ctaDiscover}
            </Link>
          </div>
          <div className="flex flex-wrap gap-x-7 gap-y-3 border-t border-dashed border-[#9C7A3C]/45 pt-5 text-sm font-bold text-[#3E4F5A]">
            <span>
              <strong className="text-xl font-black text-[#1C2E3A]">{l.stat1Value}</strong> {l.stat1Label}
            </span>
            <span>
              <strong className="text-xl font-black text-[#1C2E3A]">{l.stat2Value}</strong> {l.stat2Label}
            </span>
            <span>
              <strong className="text-xl font-black text-[#1C2E3A]">{l.stat3Value}</strong> {l.stat3Label}
            </span>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[520px] lg:max-w-none">
          <svg viewBox="0 0 600 640" className="block h-auto w-full" role="img" aria-label={l.loomAria}>
            {WARP_X.map((x) => (
              <line key={x} x1={x} y1={30} x2={x} y2={560} stroke="#1C2E3A" strokeOpacity={0.14} strokeWidth={1.5} />
            ))}
            <rect x={40} y={18} width={520} height={8} rx={4} fill="#1C2E3A" fillOpacity={0.85} />
            <path
              className="wl-thread-draw"
              d={WEFT}
              fill="none"
              stroke="#D9B238"
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <g fill="#1C2E3A" fillOpacity={0.55}>
              {OVER.map(({ x, y }) => (
                <rect key={`${x}-${y}`} x={x - 1.5} y={y - 8} width={3} height={16} rx={1.5} />
              ))}
            </g>
            {KNOTS.map((k) => (
              <g key={k.key} transform={`translate(${k.x} ${k.y})`}>
                <circle r={38} fill="#F4EFE6" stroke="#9C7A3C" strokeWidth={2} />
                <circle r={31} fill="none" stroke="#9C7A3C" strokeOpacity={0.5} strokeWidth={1} strokeDasharray="3 4" />
                <g
                  transform="translate(-18 -20) scale(0.75)"
                  fill="none"
                  stroke="#1C2E3A"
                  strokeWidth={2.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={k.path} />
                </g>
                <text y={62} textAnchor="middle" fontSize={16} fontWeight={800} fill="#1C2E3A" style={{ fontFamily: 'var(--font-tajawal), Tajawal, sans-serif' }}>
                  {cities[k.key]?.[KNOT_CITY[k.key]] ?? KNOT_CITY[k.key]}
                </text>
              </g>
            ))}
            <g transform="translate(232 580)">
              <rect width={136} height={52} rx={6} fill="#1C2E3A" />
              <g fill="#D9B238">
                {[0, 1, 2].map((r) =>
                  [0, 1, 2, 3].map((c) => (
                    <rect key={`${r}-${c}`} x={(r % 2 === 0 ? 8 : 23) + c * 30} y={8 + r * 14} width={14} height={8} rx={1} />
                  )),
                )}
              </g>
            </g>
            <text
              x={172}
              y={612}
              textAnchor="middle"
              fontSize={17}
              fontWeight={900}
              fill="#9C7A3C"
              style={{ fontFamily: 'var(--font-tajawal), Tajawal, sans-serif' }}
            >
              {l.yourTrip}
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
}
