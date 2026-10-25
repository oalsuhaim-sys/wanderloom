'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookmarkCheck, Check, Copy, MessageCircle, Sparkles } from 'lucide-react';

import { useLanguage } from '@/context/LanguageContext';
import { absoluteDnaUrl, rememberPendingDna } from '@/lib/instant-dna-status';

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
 * Zero-Wait success screen — the Travel DNA link is ready the moment the request is saved.
 * The visitor chooses: continue to the DNA now (gold CTA) or finish it later (link kept on the
 * device + copy / WhatsApp). No forced redirect.
 */
export function InstantDnaSuccess({ name, dnaPath, phone, autoWelcomeQueued, onReset }: InstantDnaSuccessProps) {
  const router = useRouter();
  const { dir, t } = useLanguage();
  const m = t.instant;
  const headingRef = useRef<HTMLHeadingElement>(null);

  const [choice, setChoice] = useState<'pending' | 'later'>('pending');
  const [copied, setCopied] = useState(false);

  const targetPath = dnaPath ? `${dnaPath}${dnaPath.includes('?') ? '&' : '?'}arrived=1` : null;
  // Rendered only after a client-side submit (never SSR) — window.location is safe here.
  const shareUrl = useMemo(() => (dnaPath ? absoluteDnaUrl(dnaPath) : ''), [dnaPath]);
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

  function chooseLater() {
    setChoice('later');
    window.requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
  }

  async function copyLink() {
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

  const title =
    choice === 'later' ? m.laterTitle : m.successTitle.replace('{name}', firstName).replace(/\s+،/, '،');
  const goldCta =
    'wl-instant-cta group inline-flex min-h-[56px] w-full max-w-xl items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-black text-white shadow-[0_14px_30px_-12px_rgba(156,122,60,0.75)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9C7A3C] sm:text-base';
  const goldBg = { background: 'linear-gradient(135deg, #B8913F 0%, #9C7A3C 48%, #7E6230 100%)' };

  const linkCard = (
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
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-[#1FA855] px-4 text-xs font-black text-white transition hover:bg-[#178a45] sm:flex-none"
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            {m.sendWhatsApp}
          </a>
        </div>
      </div>
    </div>
  );

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
        <div
          key={choice}
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[#9C7A3C]/40 bg-[#F4EFE6] text-[#9C7A3C] wl-instant-pop"
        >
          {choice === 'later' ? <BookmarkCheck className="h-7 w-7" strokeWidth={2.2} aria-hidden /> : <Check className="h-7 w-7" strokeWidth={2.5} aria-hidden />}
        </div>
        <p className="text-[11px] font-black tracking-[0.2em] text-[#9C7A3C]">{m.successKicker}</p>
        <h2 ref={headingRef} tabIndex={-1} className="mt-2 text-2xl font-black leading-snug text-[#1C2E3A] outline-none sm:text-3xl">
          {title}
        </h2>

        {!dnaPath ? (
          <p className="mx-auto mt-4 max-w-xl text-sm font-bold leading-loose text-gray-600">{m.noLinkBody}</p>
        ) : choice === 'pending' ? (
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
                onClick={chooseLater}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full px-6 text-sm font-black text-[#1C2E3A]/70 underline-offset-4 transition hover:text-[#1C2E3A] hover:underline"
              >
                {m.laterCta}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mx-auto mt-3 max-w-xl text-sm font-bold leading-loose text-gray-600">{m.laterBody}</p>
            {linkCard}
            {autoWelcomeQueued ? <p className="mt-3 text-[11px] font-bold text-gray-500">{m.autoWelcome}</p> : null}
            <button type="button" onClick={goNow} className={`${goldCta} mt-7`} style={goldBg}>
              <Sparkles className="h-5 w-5 shrink-0" aria-hidden />
              <span>{m.laterNowCta}</span>
            </button>
          </>
        )}

        <button type="button" onClick={onReset} className="mt-8 text-[11px] font-bold text-gray-400 underline underline-offset-4 hover:text-[#1C2E3A]">
          {m.newRequest}
        </button>
      </div>
    </section>
  );
}
