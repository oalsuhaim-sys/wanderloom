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

  const hello = m.successHello.replace('{name}', firstName).replace(/\s+([،,])/, '$1');
  const numerals = dir === 'rtl' ? ['١', '٢', '٣'] : ['1', '2', '3'];
  const reasons = [m.why1, m.why2, m.why3];

  return (
    <section
      dir={dir}
      aria-live="polite"
      className="wl-instant-success relative mx-auto max-w-3xl overflow-hidden rounded-[30px] bg-white shadow-[0_40px_80px_-44px_rgba(28,46,58,0.65)] ring-1 ring-[#D9B238]/30"
    >
      {/* ── navy woven header: the trip ticket ── */}
      <div className="wl-weave-dark relative px-6 pb-12 pt-10 text-center text-[#F4EFE6] sm:px-10 sm:pt-12">
        <span aria-hidden className="mx-auto mb-5 grid w-max grid-cols-4 gap-1 rounded-md bg-[#15232C] p-2 ring-1 ring-[#D9B238]/40 wl-instant-pop">
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} className={`h-2 w-4 rounded-[2px] ${(Math.floor(i / 4) + i) % 2 === 0 ? 'bg-[#D9B238]' : 'bg-[#D9B238]/25'}`} />
          ))}
        </span>
        <p className="text-xs font-extrabold tracking-[0.12em] text-[#D9B238]">{m.successKicker}</p>
        <h2 ref={headingRef} tabIndex={-1} className="mt-3 text-[30px] font-black leading-tight outline-none sm:text-[42px]">
          {hello}
          <span className="block text-[#E9CB6A]">{m.successStarted}</span>
        </h2>
        <svg aria-hidden width="220" height="16" viewBox="0 0 240 18" className="mx-auto mt-5 block">
          <path d="M0 9 C 20 0 40 18 60 9 S 100 0 120 9 S 160 18 180 9 S 220 0 240 9" fill="none" stroke="#D9B238" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>

      {/* ── perforation ── */}
      <div aria-hidden className="relative h-0">
        <span className="absolute -top-4 -start-4 h-8 w-8 rounded-full bg-[#F4EFE6]" />
        <span className="absolute -top-4 -end-4 h-8 w-8 rounded-full bg-[#F4EFE6]" />
        <span className="absolute inset-x-6 top-0 border-t-2 border-dashed border-[#D9B238]/60" />
      </div>

      <div className="relative px-6 pb-9 pt-9 text-center sm:px-10">
        {!dnaPath ? (
          <p className="mx-auto max-w-xl text-base font-semibold leading-loose text-[#3E4F5A]">{m.noLinkBody}</p>
        ) : (
          <>
            <p className="text-xs font-extrabold tracking-wide text-[#9C7A3C]">{m.lastStep}</p>
            <p className="mx-auto mt-2 max-w-xl text-base font-semibold leading-loose text-[#3E4F5A] sm:text-[17px]">{m.successBody}</p>

            <ol className="relative mx-auto mt-8 grid max-w-2xl grid-cols-1 gap-5 text-start sm:grid-cols-3 sm:gap-4 sm:text-center">
              <span aria-hidden className="absolute inset-x-[16%] top-[19px] hidden border-t-2 border-dashed border-[#D9B238] sm:block" />
              {reasons.map((line, i) => (
                <li key={line} className="relative flex items-start gap-3.5 sm:flex-col sm:items-center sm:gap-3">
                  <span
                    className={`relative z-[1] flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black shadow-[0_0_0_5px_#fff] ${
                      i === 2 ? 'bg-[#D9B238] text-[#1C2E3A]' : 'bg-[#1C2E3A] text-[#D9B238]'
                    }`}
                  >
                    {numerals[i]}
                  </span>
                  <span className="pt-2 text-[15px] font-extrabold leading-relaxed text-[#1C2E3A] sm:pt-0">{line}</span>
                </li>
              ))}
            </ol>

            <button
              type="button"
              onClick={goNow}
              className="wl-gold-cta group mx-auto mt-9 inline-flex min-h-[58px] w-full max-w-xl items-center justify-center gap-2 rounded-full bg-[#D9B238] px-6 py-3.5 text-[15px] font-black text-[#1C2E3A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9C7A3C] sm:text-base"
            >
              <Sparkles className="h-5 w-5 shrink-0 transition-transform group-hover:rotate-12" aria-hidden />
              <span>{m.successCta}</span>
            </button>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => void copyLink()}
                className="inline-flex min-h-[46px] items-center justify-center gap-1.5 rounded-full border border-[#D9B238]/60 bg-white px-5 text-sm font-black text-[#1C2E3A] transition hover:bg-[#FBF8F1]"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden /> : <Copy className="h-4 w-4 text-[#8A6A12]" aria-hidden />}
                {copied ? m.copied : m.copyLink}
              </button>
              <button
                type="button"
                onClick={onLater}
                className="inline-flex min-h-[46px] items-center justify-center rounded-full px-6 text-sm font-black text-[#3E4F5A] underline-offset-4 transition hover:text-[#1C2E3A] hover:underline"
              >
                {m.laterCta}
              </button>
            </div>
          </>
        )}

        <button type="button" onClick={onReset} className="mt-7 text-xs font-bold text-gray-400 underline underline-offset-4 hover:text-[#1C2E3A]">
          {m.newRequest}
        </button>
      </div>
    </section>
  );
}
