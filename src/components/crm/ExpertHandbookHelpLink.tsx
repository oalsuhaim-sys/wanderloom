'use client';

import { useState } from 'react';
import { Lightbulb } from 'lucide-react';

import { ExpertHandbookModal } from '@/components/crm/ExpertHandbookModal';
import type { ExpertHandbookTabId } from '@/lib/expert-handbook-content';

type Props = {
  /** Which handbook tab to open in the modal */
  tab: ExpertHandbookTabId;
  className?: string;
};

export function ExpertHandbookHelpLink({ tab, className = '' }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 text-xs font-bold text-[#9C7A3C] transition hover:text-[#D4AF37] ${className}`}
      >
        <Lightbulb className="h-3.5 w-3.5 shrink-0" aria-hidden />
        تحتاج مساعدة؟ اقرأ دليل الخبير 💡
      </button>
      <ExpertHandbookModal open={open} onClose={() => setOpen(false)} initialTab={tab} />
    </>
  );
}
