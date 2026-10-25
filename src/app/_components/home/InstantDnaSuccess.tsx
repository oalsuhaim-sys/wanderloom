'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Sparkles } from 'lucide-react';

import { useLanguage } from '@/context/LanguageContext';
import { absoluteDnaUrl, rememberPendingDna } from '@/lib/instant-dna-status';

type InstantDnaSuccessProps = {
  name: string;
  /** /welcome/{clientId} — null when the client profile could not be prepared */
  dnaPath: string | null;
  onReset: () => void;
  /** «أكملها لاحقاً» — close this screen; the home form shows the saved reminder instead */
  onLater: () => void;
};

/**
 * Zero-Wait success screen — the Travel DNA link is ready the moment the request is saved.
 * The visitor chooses: continue to the DNA now (gold CTA) or finish it later (back to the page,
 * with a reminder kept on the device). No forced redirect, no extra screen.
 */
export function InstantDnaSuccess({ name, dnaPath, onReset, onLater }: InstantDnaSuccessProps) {
  const router = useRouter();
  const { dir, t } = useLanguage();
  const m = t.instant;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!dnaPath) return;
    // Rendered only after a client-side submit (never SSR) — window.location is safe here.
    const url = absoluteDnaUrl(dnaPath);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const area = document.createElement('textarea');
      area.value = url;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  const targetPath = dnaPath ? `${dnaPath}${dnaPath.includes('?') ? '&' : '?'}arrived=1` : null;
  const firstName = name.trim().split(/\s+/)[0] || '';

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: false });
  }, []);

  useEffect(() => {
    if (!targetPath || !dnaPath) return;
    router.prefetch(targetPath);
    // Until the DNA is submitted, the home page gently reminds this visitor.
    rememberPendingDna(dnaPath, firstName);
  }, [router, targetPath, dnaPath, firstName]);

  function goNow() {
    if (targetPath) router.push(targetPath);
  }

  const title = m.successTitle.replace('{name}', firstName).replace(/\s+،/, '،');
  const goldCta =
    'wl-instant-cta wl-gold-cta group inline-flex min-h-[58px] w-full max-w-xl items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9C7A3C] sm:text-base';
  const numerals = dir === 'rtl' ? ['١', '٢', '٣'] : ['1', '2', '3'];

  return (
    <section
      dir={dir}
      aria-live="polite"
      className="wl-instant-success relative mx-auto max-w-3xl overflow-hidden rounded-[30px] border border-[#D9B238]/35 bg-white px-5 py-10 text-center shadow-[0_34px_70px_-40px_rgba(28,46,58,0.55)] sm:px-10 sm:py-12"
    >
      {/* two threads meeting in the golden knot */}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-[95px] flex items-center justify-between px-0 sm:top-[103px]">
        <span className="h-0.5 w-[calc(50%-62px)] bg-[#D9B238]" />
        <span className="h-0.5 w-[calc(50%-62px)] bg-[#D9B238]" />
      </span>

      <div className="relative">
        <svg width="110" height="110" viewBox="0 0 110 110" aria-hidden className="mx-auto mb-3 block">
          <circle cx="55" cy="55" r="44" fill="#F4EFE6" stroke="rgba(156,122,60,0.45)" strokeWidth="1.5" />
          <path
            className="wl-knot-draw"
            d="M18 55 C 30 55 34 36 48 36 C 64 36 64 74 78 74 C 88 74 92 55 92 55 M18 55 C 30 55 34 74 48 74 C 64 74 64 36 78 36 C 88 36 92 55 92 55"
            fill="none"
            stroke="#D9B238"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <circle cx="55" cy="55" r="7" fill="#1C2E3A" />
        </svg>
        <p className="text-xs font-extrabold tracking-[0.08em] text-[#9C7A3C]">{m.successKicker}</p>
        <h2 ref={headingRef} tabIndex={-1} className="mt-2 text-[28px] font-black leading-snug text-[#1C2E3A] outline-none sm:text-4xl">
          {title}
        </h2>

        {!dnaPath ? (
          <p className="mx-auto mt-4 max-w-xl text-sm font-bold leading-loose text-gray-600">{m.noLinkBody}</p>
        ) : (
          <>
            <p className="mx-auto mt-3 max-w-xl text-base font-semibold leading-loose text-[#3E4F5A]">{m.successBody}</p>

            <ol className="mx-auto mt-6 max-w-md text-start">
              {[m.why1, m.why2, m.why3].map((line, i) => {
                const last = i === 2;
                return (
                  <li key={line} className={`relative flex items-start gap-3.5 ${last ? '' : 'pb-[18px]'}`}>
                    <span
                      className={`relative z-[1] flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[13px] font-black shadow-[0_0_0_4px_#fff] ${
                        last ? 'bg-[#D9B238] text-[#1C2E3A]' : 'bg-[#1C2E3A] text-[#D9B238]'
                      }`}
                    >
                      {numerals[i]}
                    </span>
                    {last ? null : (
                      <span aria-hidden className="absolute bottom-0 start-[14px] top-[30px] border-s-2 border-dashed border-[#D9B238]" />
                    )}
                    <span className="pt-1 text-[15px] font-extrabold leading-relaxed text-[#1C2E3A]">{line}</span>
                  </li>
                );
              })}
            </ol>

            <button type="button" onClick={goNow} className={`${goldCta} mt-8`}>
              <Sparkles className="h-5 w-5 shrink-0 transition-transform group-hover:rotate-12" aria-hidden />
              <span>{m.successCta}</span>
            </button>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => void copyLink()}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-[#D9B238]/50 bg-white px-5 text-sm font-black text-[#1C2E3A] transition hover:bg-[#FBF8F1]"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden /> : <Copy className="h-4 w-4 text-[#8A6A12]" aria-hidden />}
                {copied ? m.copied : m.copyLink}
              </button>
              <button
                type="button"
                onClick={onLater}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full px-6 text-sm font-black text-[#1C2E3A]/70 underline-offset-4 transition hover:text-[#1C2E3A] hover:underline"
              >
                {m.laterCta}
              </button>
            </div>
          </>
        )}

        <button type="button" onClick={onReset} className="mt-8 text-[11px] font-bold text-gray-400 underline underline-offset-4 hover:text-[#1C2E3A]">
          {m.newRequest}
        </button>
      </div>
    </section>
  );
}
