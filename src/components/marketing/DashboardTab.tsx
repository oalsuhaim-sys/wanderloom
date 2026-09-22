'use client';

import { useMemo } from 'react';
import { CheckCircle2, Clapperboard, Lightbulb } from 'lucide-react';

import {
  buildPlatformDistribution,
  buildStageDistribution,
  countMarketingContentByStatus,
  type MarketingPipelineItem,
} from '@/components/marketing/content-data';
import { CRM_CARD_INTERACTIVE, CRM_KPI_CARD, CRM_KPI_VALUE } from '@/lib/crm-luxury-ui';

const PLATFORM_BAR: Record<string, string> = {
  Instagram: 'bg-[#D4AF37]',
  TikTok: 'bg-cyan-500',
  YouTube: 'bg-red-500',
  LinkedIn: 'bg-sky-600',
  X: 'bg-slate-500',
  أخرى: 'bg-slate-400',
};

type DashboardTabProps = {
  items: MarketingPipelineItem[];
};

export default function DashboardTab({ items }: DashboardTabProps) {
  const counts = useMemo(() => countMarketingContentByStatus(items), [items]);
  const platformBars = useMemo(() => buildPlatformDistribution(items), [items]);
  const stageBars = useMemo(() => buildStageDistribution(items), [items]);

  const metrics = [
    {
      id: 'ready',
      label: 'جاهز للنشر',
      value: counts.readyToPublish,
      hint: 'محتوى مكتمل بانتظار الجدولة',
      icon: CheckCircle2,
      tone: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      id: 'production',
      label: 'قيد الإنتاج',
      value: counts.inProduction,
      hint: 'سكريبت · تصميم · مراجعة',
      icon: Clapperboard,
      tone: 'text-amber-600 dark:text-amber-400',
    },
    {
      id: 'ideas',
      label: 'أفكار',
      value: counts.ideas,
      hint: 'أفكار خام لم تدخل الإنتاج بعد',
      icon: Lightbulb,
      tone: 'text-[#D4AF37]',
    },
  ] as const;

  return (
    <section dir="rtl" className="space-y-4" aria-labelledby="dashboard-tab-heading">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C] sm:p-6">
        <p className="text-xs font-semibold tracking-wide text-slate-400 dark:text-[#D4AF37]/80">
          Performance
        </p>
        <h2
          id="dashboard-tab-heading"
          className="mt-1 text-lg font-bold text-slate-900 dark:text-white sm:text-xl"
        >
          لوحة المتابعة
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          أرقام محسوبة مباشرة من جدول المحتوى ({counts.total} عنصر).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article key={metric.id} className={CRM_KPI_CARD}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {metric.label}
                  </p>
                  <p className={`${CRM_KPI_VALUE} mt-2`}>{metric.value}</p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{metric.hint}</p>
                </div>
                <span
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 dark:border-[#2D3F3A] dark:bg-[#1A2421] ${metric.tone}`}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
              </div>
            </article>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article
          className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C] sm:p-6 ${CRM_CARD_INTERACTIVE}`}
        >
          <h3 className="text-base font-bold text-slate-900 dark:text-white">توزيع المنصات</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            نسبة المحتوى حسب القناة من جدول المحتوى
          </p>
          <ul className="mt-5 space-y-4">
            {platformBars.length === 0 ? (
              <li className="text-sm text-slate-400">لا توجد عناصر بعد.</li>
            ) : (
              platformBars.map((item) => (
                <li key={item.label}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {item.label}
                    </span>
                    <span className="tabular-nums text-slate-500 dark:text-slate-400">
                      {item.count} · {item.percent}%
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-[#1A2421]">
                    <div
                      className={`h-full rounded-full ${PLATFORM_BAR[item.label] ?? 'bg-slate-400'}`}
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </li>
              ))
            )}
          </ul>
        </article>

        <article
          className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C] sm:p-6 ${CRM_CARD_INTERACTIVE}`}
        >
          <h3 className="text-base font-bold text-slate-900 dark:text-white">توزيع المراحل</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            أين يقف المحتوى في خط الإنتاج
          </p>
          <ul className="mt-5 space-y-4">
            {stageBars.length === 0 ? (
              <li className="text-sm text-slate-400">لا توجد عناصر بعد.</li>
            ) : (
              stageBars.map((item) => (
                <li key={item.label}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {item.label}
                    </span>
                    <span className="tabular-nums text-slate-500 dark:text-slate-400">
                      {item.count} · {item.percent}%
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-[#1A2421]">
                    <div
                      className="h-full rounded-full bg-slate-800 dark:bg-[#D4AF37]"
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </li>
              ))
            )}
          </ul>
        </article>
      </div>
    </section>
  );
}
