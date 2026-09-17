'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import {
  BookOpen,
  Brain,
  FileText,
  Route,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

import {
  ProposalAdminClientCompare,
  ItineraryStepByStepGuide,
  SaveAndClientLinkSteps,
} from '@/components/crm/ExpertHandbookVisuals';
import {
  EXPERT_HANDBOOK_TABS,
  type ExpertHandbookTabId,
  type ExpertHandbookVisualId,
} from '@/lib/expert-handbook-content';

const TAB_ICONS: Record<ExpertHandbookTabId, LucideIcon> = {
  proposals: FileText,
  itineraries: Route,
  ai: Brain,
  crm: ShieldCheck,
};

function renderSectionVisual(
  visual: ExpertHandbookVisualId | undefined,
  compact: boolean,
): ReactNode {
  if (!visual) return null;
  if (visual === 'proposals-compare') {
    return <ProposalAdminClientCompare compact={compact} />;
  }
  if (visual === 'save-client-link') {
    return <SaveAndClientLinkSteps />;
  }
  if (visual === 'itineraries-steps') {
    return <ItineraryStepByStepGuide compact={compact} />;
  }
  return null;
}

type ExpertHandbookPanelProps = {
  initialTab?: ExpertHandbookTabId;
  /** Compact layout for modal overlay */
  compact?: boolean;
  className?: string;
};

export function ExpertHandbookPanel({
  initialTab = 'proposals',
  compact = false,
  className = '',
}: ExpertHandbookPanelProps) {
  const tabsId = useId();
  const [active, setActive] = useState<ExpertHandbookTabId>(initialTab);

  useEffect(() => {
    setActive(initialTab);
  }, [initialTab]);

  const tab = EXPERT_HANDBOOK_TABS.find((t) => t.id === active) ?? EXPERT_HANDBOOK_TABS[0]!;

  return (
    <div className={className} dir="rtl" lang="ar">
      <div
        role="tablist"
        aria-label="أقسام دليل الخبير"
        className={`flex gap-2 overflow-x-auto pb-1 ${compact ? 'mb-4' : 'mb-6'}`}
      >
        {EXPERT_HANDBOOK_TABS.map((item) => {
          const Icon = TAB_ICONS[item.id];
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`${tabsId}-${item.id}`}
              aria-selected={selected}
              aria-controls={`${tabsId}-panel-${item.id}`}
              onClick={() => setActive(item.id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-right text-xs font-black transition sm:text-sm ${
                selected
                  ? 'border-[#D4AF37]/60 bg-[#D4AF37] text-[#1A3B2A] shadow-sm'
                  : 'border-slate-200 bg-white/80 text-slate-600 hover:border-[#D4AF37]/35 hover:text-slate-900 dark:border-[#2D3F3A] dark:bg-[#22302C] dark:text-slate-300 dark:hover:border-[#D4AF37]/40'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              <span className="max-w-[11rem] truncate sm:max-w-none">{item.label}</span>
            </button>
          );
        })}
      </div>

      <article
        role="tabpanel"
        id={`${tabsId}-panel-${tab.id}`}
        aria-labelledby={`${tabsId}-${tab.id}`}
        className={`rounded-2xl border border-[#D4AF37]/20 bg-gradient-to-b from-[#FDFBF7] to-white p-4 shadow-sm dark:from-[#1E2A26] dark:to-[#22302C] sm:p-6 ${
          compact ? '' : 'sm:p-8'
        }`}
      >
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#9C7A3C]">
          {tab.eyebrow}
        </p>
        <h2
          className={`mt-2 font-black text-[#1C2E3A] dark:text-[#F4EFE6] ${
            compact ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'
          }`}
        >
          {tab.label}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {tab.intro}
        </p>

        <div className={`mt-5 space-y-4 ${compact ? 'sm:mt-5' : 'sm:mt-7 sm:space-y-5'}`}>
          {tab.sections.map((section) => (
            <section
              key={section.title}
              className="rounded-xl border border-slate-200/80 bg-white/70 p-4 dark:border-[#2D3F3A] dark:bg-[#1A2421]/60 sm:p-5"
            >
              <h3 className="flex items-center gap-2 text-sm font-black text-[#1C2E3A] dark:text-[#F4EFE6] sm:text-base">
                <Sparkles className="h-4 w-4 shrink-0 text-[#D4AF37]" aria-hidden />
                {section.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {section.body}
              </p>
              {section.bullets?.length ? (
                <ul className="mt-3 space-y-1.5">
                  {section.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="flex items-start gap-2 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400 sm:text-sm"
                    >
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D4AF37]"
                        aria-hidden
                      />
                      {bullet}
                    </li>
                  ))}
                </ul>
              ) : null}
              {renderSectionVisual(section.visual, compact)}
              {section.callout ? (
                <p className="mt-3 rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-2 text-xs font-bold leading-relaxed text-[#5C4A22] dark:text-[#E8D5A3]">
                  {section.callout}
                </p>
              ) : null}
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}

type ExpertHandbookHeaderProps = {
  compact?: boolean;
};

export function ExpertHandbookHeader({ compact = false }: ExpertHandbookHeaderProps) {
  return (
    <header className={compact ? 'mb-4' : 'mb-6 sm:mb-8'}>
      <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#9C7A3C]">
        Wanderloom Expert Handbook
      </p>
      <h1
        className={`mt-2 flex flex-wrap items-center gap-2 font-black text-[#1C2E3A] dark:text-[#F4EFE6] ${
          compact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'
        }`}
      >
        <BookOpen className="h-6 w-6 text-[#D4AF37] sm:h-7 sm:w-7" aria-hidden />
        دليل خبير واندرلوم 📖
      </h1>
      <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
        مرجع تشغيلي داخلي مع معاينات خبير↔عميل، ودليل حقول المسار خطوة بخطوة.
      </p>
    </header>
  );
}
