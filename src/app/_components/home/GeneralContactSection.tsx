'use client';

import { Mail, MessageCircle } from 'lucide-react';

import { ar } from '@/messages/ar';

const h = ar.home;

const WA_NUMBER = '966544948640';

export function GeneralContactSection() {
  /** مصدر واحد للبريد في الواجهة العامة — يحدَّث من `ar.home.contactEmailAddress` (info@wanderloomsa.com). */
  const email = h.contactEmailAddress;
  const waHref =
    'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(h.contactWaPresetMessage);
  const mailHref = 'mailto:' + email + '?subject=' + encodeURIComponent('استفسار — Wanderloom');

  return (
    <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
      <h2 className="text-3xl font-black text-white sm:text-4xl">{h.contactTitle}</h2>
      <p className="mx-auto mt-6 max-w-2xl text-base font-bold leading-[1.9] text-white/55">{h.contactLead}</p>

      <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row sm:flex-wrap">
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full min-w-[220px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-[#7a5f28] to-[#d4b87a] px-8 py-4 text-sm font-black text-[#0a1814] shadow-lg shadow-black/25 transition hover:opacity-95 sm:w-auto"
        >
          <MessageCircle className="h-5 w-5" aria-hidden />
          {h.contactWhatsAppCta}
        </a>
        <a
          href={mailHref}
          className="inline-flex w-full min-w-[220px] items-center justify-center gap-2 rounded-2xl border-2 border-[#c9a84c]/45 bg-white/[0.06] px-8 py-4 text-sm font-black text-[#e8d5a8] backdrop-blur-sm transition hover:bg-white/[0.1] sm:w-auto"
        >
          <Mail className="h-5 w-5" aria-hidden />
          {h.contactEmailCta}
        </a>
      </div>
      <p className="mt-6 text-xs font-bold text-white/35" dir="ltr">
        {email}
      </p>
    </div>
  );
}
