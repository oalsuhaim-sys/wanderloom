'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Sparkles } from 'lucide-react';

import { useLanguage } from '@/context/LanguageContext';
import { rememberPendingDna } from '@/lib/instant-dna-status';

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
    'wl-instant-cta group inline-flex min-h-[56px] w-full max-w-xl items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-black text-white shadow-[0_14px_30px_-12px_rgba(156,122,60,0.75)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9C7A3C] sm:text-base';
  const goldBg = { background: 'linear-gradient(135deg, #B8913F 0%, #9C7A3C 48%, #7E6230 100%)' };

  return (
    <section
      dir={dir}
      aria-live="polite"
      className="wl-instant-success relative mx-auto max-w-3xl overflow-hidden rounded-[28px] border border-[#9C7A3C]/25 bg-white px-5 py-9 text-center shadow-[0_20px_60px_-30px_rgba(28,46,58,0.45)] sm:px-10 sm:py-12"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 45% at 50% -10%, rgba(201,164,92,0.22), transparent 70%), radial-gradient(ellipse 40% 30% at 100% 100%, rgba(28,46,58,0.06), transparent)',
        }}
      />

      <div className="relative">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[#9C7A3C]/40 bg-[#F4EFE6] text-[#9C7A3C] wl-instant-pop">
          <Check className="h-7 w-7" strokeWidth={2.5} aria-hidden />
        </div>
        <p className="text-[11px] font-black tracking-[0.2em] text-[#9C7A3C]">{m.successKicker}</p>
        <h2 ref={headingRef} tabIndex={-1} className="mt-2 text-2xl font-black leading-snug text-[#1C2E3A] outline-none sm:text-3xl">
          {title}
        </h2>

        {!dnaPath ? (
          <p className="mx-auto mt-4 max-w-xl text-sm font-bold leading-loose text-gray-600">{m.noLinkBody}</p>
        ) : (
          <>
            <p className="mx-auto mt-3 max-w-xl text-sm font-bold leading-loose text-gray-600">{m.successBody}</p>

            <ul className="mx-auto mt-5 max-w-md space-y-2 text-start">
              {[m.why1, m.why2, m.why3].map((line) => (
                <li key={line} className="flex items-start gap-2.5 rounded-xl bg-[#F4EFE6]/70 px-3.5 py-2.5 text-[13px] font-bold leading-relaxed text-[#1C2E3A]">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#9C7A3C]" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            <button type="button" onClick={goNow} className={`${goldCta} mt-7`} style={goldBg}>
              <Sparkles className="h-5 w-5 shrink-0 transition-transform group-hover:rotate-12" aria-hidden />
              <span>{m.successCta}</span>
            </button>
            <div className="mt-3">
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
