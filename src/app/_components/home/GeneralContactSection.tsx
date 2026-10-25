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
      <h2 className="text-[34px] font-black text-[#1C2E3A] sm:text-5xl">{c.title}</h2>
      <p className="mx-auto mt-4 max-w-2xl text-base font-semibold leading-[1.9] text-[#3E4F5A] sm:mt-6 sm:text-lg">
        {c.lead}
      </p>

      <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row sm:flex-wrap">
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="wl-gold-cta inline-flex min-h-[58px] w-full min-w-[260px] items-center justify-center gap-2.5 rounded-full px-8 text-base font-black sm:w-auto"
        >
          <MessageCircle className="h-5 w-5" aria-hidden />
          {c.whatsappCta}
        </a>
        <a
          href={mailHref}
          className="inline-flex min-h-[58px] w-full min-w-[260px] items-center justify-center gap-2.5 rounded-full border-[1.5px] border-[#1C2E3A] bg-white px-8 text-base font-extrabold text-[#1C2E3A] transition hover:bg-[#FBF8F1] sm:w-auto"
        >
          <Mail className="h-5 w-5" aria-hidden />
          {c.emailCta}
        </a>
      </div>
    </div>
  );
}
