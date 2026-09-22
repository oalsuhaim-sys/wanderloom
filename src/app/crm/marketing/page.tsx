'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CalendarDays,
  Clapperboard,
  FolderOpen,
  LayoutDashboard,
  Megaphone,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

import {
  AssetsTab,
  CalendarTab,
  ContentGeneratorTab,
  ContentTableTab,
  DashboardTab,
} from '@/components/marketing';
import { INITIAL_MARKETING_CONTENT_ITEMS } from '@/components/marketing/content-data';
import type { MarketingPipelineItem } from '@/lib/marketing-content-pipeline';
import { getClientAccessToken } from '@/lib/crm-session-token';
import MarketingTripCampaignsClient from '@/app/crm/marketing/campaigns/MarketingTripCampaignsClient';

type MarketingTabId =
  | 'campaigns'
  | 'generate'
  | 'content'
  | 'calendar'
  | 'assets'
  | 'dashboard';

type MarketingTab = {
  id: MarketingTabId;
  label: string;
  icon: LucideIcon;
};

const TABS: MarketingTab[] = [
  { id: 'campaigns', label: 'مولّد الحملات', icon: Megaphone },
  { id: 'generate', label: 'توليد المحتوى', icon: Sparkles },
  { id: 'content', label: 'المحتوى', icon: Clapperboard },
  { id: 'calendar', label: 'التقويم', icon: CalendarDays },
  { id: 'assets', label: 'مكتبة الأصول', icon: FolderOpen },
  { id: 'dashboard', label: 'لوحة المتابعة', icon: LayoutDashboard },
];

function ActiveTabPanel({
  tab,
  contentItems,
  onSaved,
}: {
  tab: MarketingTabId;
  contentItems: MarketingPipelineItem[];
  onSaved: (item: MarketingPipelineItem) => void;
}) {
  switch (tab) {
    case 'campaigns':
      return <MarketingTripCampaignsClient />;
    case 'generate':
      return <ContentGeneratorTab onSaved={onSaved} />;
    case 'content':
      return <ContentTableTab items={contentItems} />;
    case 'calendar':
      return <CalendarTab />;
    case 'assets':
      return <AssetsTab />;
    case 'dashboard':
      return <DashboardTab items={contentItems} />;
  }
}

export default function MarketingPage() {
  const [activeTab, setActiveTab] = useState<MarketingTabId>('campaigns');
  const [contentItems, setContentItems] = useState<MarketingPipelineItem[]>(
    INITIAL_MARKETING_CONTENT_ITEMS,
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshContent = useCallback(async () => {
    try {
      const token = await getClientAccessToken();
      const res = await fetch('/api/generate-content', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = (await res.json()) as {
        ok?: boolean;
        items?: MarketingPipelineItem[];
        error?: string;
      };
      if (data.ok && Array.isArray(data.items) && data.items.length) {
        setContentItems(data.items);
        setLoadError(null);
        return;
      }
      if (data.error) setLoadError(data.error);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'تعذر تحميل المحتوى');
    }
  }, []);

  useEffect(() => {
    void refreshContent();
  }, [refreshContent]);

  const onSaved = useCallback(
    (item: MarketingPipelineItem) => {
      setContentItems((prev) => {
        const without = prev.filter((row) => row.id !== item.id);
        return [item, ...without];
      });
      void refreshContent();
    },
    [refreshContent],
  );

  return (
    <div dir="rtl" className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold tracking-wide text-slate-500 dark:text-[#D4AF37]/80">
          مركز التسويق الشامل
        </p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
          براند · أفراد · جروبات · محتوى
        </h1>
        <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          لوحة واحدة لحملات Claude (DNA والرحلات الخاصة والجروبات)، توليد المحتوى، الأصول،
          والجدولة.
        </p>
        {loadError ? (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            تعذر مزامنة الجدول من قاعدة البيانات — يُعرض المصدر المحلي مؤقتاً. {loadError}
          </p>
        ) : null}
      </header>

      <div
        role="tablist"
        aria-label="أقسام التسويق"
        className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50/80 p-1.5 dark:border-[#2D3F3A] dark:bg-[#1A2421]"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`marketing-tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`marketing-panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 dark:focus-visible:ring-[#D4AF37]/40',
                isActive
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-[#22302C] dark:text-[#D4AF37] dark:shadow-none dark:ring-1 dark:ring-[#D4AF37]/30'
                  : 'text-slate-500 hover:bg-white/70 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-[#22302C]/70 dark:hover:text-slate-200',
              ].join(' ')}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`marketing-panel-${activeTab}`}
        aria-labelledby={`marketing-tab-${activeTab}`}
      >
        <ActiveTabPanel tab={activeTab} contentItems={contentItems} onSaved={onSaved} />
      </div>
    </div>
  );
}
