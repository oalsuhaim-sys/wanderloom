'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, BookOpen } from 'lucide-react';

import {
  ExpertHandbookHeader,
  ExpertHandbookPanel,
} from '@/components/crm/ExpertHandbookPanel';
import { parseExpertHandbookTab } from '@/lib/expert-handbook-content';

function ExpertDocsInner() {
  const searchParams = useSearchParams();
  const initialTab = parseExpertHandbookTab(searchParams.get('tab'));

  return (
    <>
      <ExpertHandbookHeader />
      <ExpertHandbookPanel initialTab={initialTab} />
    </>
  );
}

export default function ExpertDocsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8" dir="rtl" lang="ar">
      <Link
        href="/crm"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-[#D4AF37]"
      >
        <ArrowRight className="h-4 w-4" aria-hidden />
        العودة للوحة القيادة
      </Link>

      <Suspense
        fallback={
          <div className="rounded-2xl border border-[#D4AF37]/20 bg-[#FDFBF7] p-8 text-center dark:bg-[#22302C]">
            <BookOpen className="mx-auto h-8 w-8 animate-pulse text-[#D4AF37]" />
            <p className="mt-3 text-sm font-bold text-slate-500">جاري تحميل دليل الخبير…</p>
          </div>
        }
      >
        <ExpertDocsInner />
      </Suspense>
    </div>
  );
}
