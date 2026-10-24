'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, MessageCircle, Sparkles } from 'lucide-react';

import { useLanguage } from '@/context/LanguageContext';
import { absoluteDnaUrl } from '@/lib/instant-dna-status';

const REDIRECT_SECONDS = 3;
const RING_R = 22;
const RING_C = 2 * Math.PI * RING_R;

type InstantDnaSuccessProps = {
  name: string;
  /** /welcome/{clientId} — null when the client profile could not be prepared */
  dnaPath: string | null;
  phone: string;
  autoWelcomeQueued?: boolean;
  onReset: () => void;
};

function whatsAppSelfHref(phone: string, text: string): string {
  const digits = String(phone ?? '').replace(/\D/g, '');
  const encoded = encodeURIComponent(text);
  return digits.length >= 8 ? `https://wa.me/${digits}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

/**
 * Zero-Wait success screen — the visitor gets their Travel DNA link the moment the request is
 * saved: gold primary CTA, copy, WhatsApp deep link and a cancellable 3-second auto-redirect.
 */
export function InstantDnaSuccess({ name, dnaPath, phone, autoWelcomeQueued, onReset }: InstantDnaSuccessProps) {
  const router = useRouter();
  const { dir, t } = useLanguage();
  const m = t.instant;
  const headingRef = useRef<HTMLHeadingElement>(null);

  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);
  const [paused, setPaused] = useState(false);
  const [copied, setCopied] = useState(false);

  const targetPath = dnaPath ? `${dnaPath}${dnaPath.includes('?') ? '&' : '?'}arrived=1` : null;
  // Rendered only after a client-side submit (never SSR) — window.location is safe here.
  const shareUrl = useMemo(() => (dnaPath ? absoluteDnaUrl(dnaPath) : ''), [dnaPath]);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: false });
  }, []);

  useEffect(() => {
    if (targetPath) router.prefetch(targetPath);
  }, [router, targetPath]);

  const go = useCallback(() => {
    if (targetPath) router.push(targetPath);
  }, [router, targetPath]);

  useEffect(() => {
    if (!targetPath || paused) return;
    if (secondsLeft <= 0) {
      go();
      return;
    }
    const id = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [go, paused, secondsLeft, targetPath]);

  async function copyLink() {
    setPaused(true);
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const area = document.createElement('textarea');
      area.value = shareUrl;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  const firstName = name.trim().split(/\s+/)[0] || '';
  const title = m.successTitle.replace('{name}', firstName).replace(/\s+،/, '،');
  const progress = paused ? 0 : secondsLeft / REDIRECT_SECONDS;

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

        {dnaPath ? (
          <>
            <p className="mx-auto mt-3 max-w-xl text-sm font-bold leading-loose text-gray-600">{m.successBody}</p>

            <button
              type="button"
              onClick={go}
              className="wl-instant-cta group mt-7 inline-flex min-h-[56px] w-full max-w-xl items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-black text-white shadow-[0_14px_30px_-12px_rgba(156,122,60,0.75)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9C7A3C] sm:text-base"
              style={{ background: 'linear-gradient(135deg, #B8913F 0%, #9C7A3C 48%, #7E6230 100%)' }}
            >
              <Sparkles className="h-5 w-5 shrink-0 transition-transform group-hover:rotate-12" aria-hidden />
              <span>{m.successCta}</span>
            </button>

            <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-gray-100 bg-[#F4EFE6]/60 p-3 text-start">
              <p className="px-1 text-[11px] font-black text-[#9C7A3C]">{m.linkLabel}</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <p dir="ltr" className="min-w-0 flex-1 truncate rounded-xl bg-white px-3 py-2.5 text-left font-mono text-[12px] font-bold text-[#1C2E3A] ring-1 ring-gray-200">
                  {shareUrl || dnaPath}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void copyLink()}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-[#1C2E3A]/15 bg-white px-4 text-xs font-black text-[#1C2E3A] transition hover:border-[#9C7A3C]/50 sm:flex-none"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                    {copied ? m.copied : m.copyLink}
                  </button>
                  <a
                    href={whatsAppSelfHref(phone, `${m.whatsAppSelfMessage}\n${shareUrl}`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setPaused(true)}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-[#1FA855] px-4 text-xs font-black text-white transition hover:bg-[#178a45] sm:flex-none"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden />
                    {m.sendWhatsApp}
                  </a>
                </div>
              </div>
            </div>

            <div className="mt-6 flex min-h-[52px] items-center justify-center gap-3" role="status">
              {paused ? (
                <p className="text-xs font-bold text-gray-500">{m.redirectPaused}</p>
              ) : (
                <>
                  <svg width="52" height="52" viewBox="0 0 52 52" className="-rotate-90" aria-hidden>
                    <circle cx="26" cy="26" r={RING_R} fill="none" stroke="#E9E1D2" strokeWidth="3" />
                    <circle
                      cx="26"
                      cy="26"
                      r={RING_R}
                      fill="none"
                      stroke="#9C7A3C"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={RING_C}
                      strokeDashoffset={RING_C * (1 - progress)}
                      style={{ transition: 'stroke-dashoffset 1s linear' }}
                    />
                    <text x="26" y="26" textAnchor="middle" dominantBaseline="central" transform="rotate(90 26 26)" className="fill-[#1C2E3A] text-[15px] font-black">
                      {Math.max(secondsLeft, 0)}
                    </text>
                  </svg>
                  <div className="text-start">
                    <p className="text-xs font-black text-[#1C2E3A]">{m.redirectIn.replace('{s}', String(Math.max(secondsLeft, 0)))}</p>
                    <button type="button" onClick={() => setPaused(true)} className="mt-0.5 text-[11px] font-bold text-gray-500 underline underline-offset-4 hover:text-[#1C2E3A]">
                      {m.redirectCancel}
                    </button>
                  </div>
                </>
              )}
            </div>

            {autoWelcomeQueued ? <p className="mt-2 text-[11px] font-bold text-gray-500">{m.autoWelcome}</p> : null}
          </>
        ) : (
          <p className="mx-auto mt-4 max-w-xl text-sm font-bold leading-loose text-gray-600">{m.noLinkBody}</p>
        )}

        <button type="button" onClick={onReset} className="mt-8 text-[11px] font-bold text-gray-400 underline underline-offset-4 hover:text-[#1C2E3A]">
          {m.newRequest}
        </button>
      </div>
    </section>
  );
}
