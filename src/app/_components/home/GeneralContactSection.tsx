'use client';

import { Mail, MessageCircle } from 'lucide-react';

import { useLanguage } from '@/context/LanguageContext';
import { WANDERLOOM_CONTACT_EMAIL } from '@/lib/contact-email';

const WA_NUMBER = '966544948640';

export function GeneralContactSection() {
  const { t } = useLanguage();
  const c = t.contact;

  const waHref =
    'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(c.waPresetMessage);
  const mailHref =
    'mailto:' + WANDERLOOM_CONTACT_EMAIL + '?subject=' + encodeURIComponent(c.emailSubject);

  return (
    <div className="mx-auto max-w-3xl px-4 text-center sm:px-8">
      <h2 className="text-2xl font-black text-[#111111] sm:text-3xl md:text-4xl">{c.title}</h2>
      <p className="mx-auto mt-4 max-w-2xl text-sm font-bold leading-[1.9] text-gray-600 sm:mt-6 sm:text-base">
        {c.lead}
      </p>

      <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row sm:flex-wrap">
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full min-w-[220px] items-center justify-center gap-2 rounded-2xl bg-[#cda04c] px-8 py-4 text-sm font-black text-white shadow-lg shadow-[#cda04c]/20 transition hover:bg-[#b3893d] sm:w-auto"
        >
          <MessageCircle className="h-5 w-5" aria-hidden />
          {c.whatsappCta}
        </a>
        <a
          href={mailHref}
          className="inline-flex w-full min-w-[220px] items-center justify-center gap-2 rounded-2xl border border-[#1e3f20] px-8 py-4 text-sm font-black text-[#1e3f20] transition hover:bg-[#f4efe6] sm:w-auto"
        >
          <Mail className="h-5 w-5" aria-hidden />
          {c.emailCta}
        </a>
      </div>
    </div>
  );
}
