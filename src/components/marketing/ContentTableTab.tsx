'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, X } from 'lucide-react';

import {
  resolveMarketingScript,
  type MarketingPipelineItem,
} from '@/components/marketing/content-data';
import {
  CRM_BTN_GHOST,
  CRM_MODAL_OVERLAY,
  CRM_MODAL_PANEL,
  CRM_TABLE,
  CRM_TABLE_SCROLL,
  CRM_TD,
  CRM_TH,
  CRM_TR,
} from '@/lib/crm-luxury-ui';

function statusClass(status: string): string {
  if (status.includes('جاهز')) {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800/40';
  }
  if (status.includes('إنتاج')) {
    return 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-800/40';
  }
  return 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-[#1A2421] dark:text-slate-300 dark:ring-[#2D3F3A]';
}

type ContentTableTabProps = {
  items: MarketingPipelineItem[];
};

type SelectedScript = {
  idea: string;
  content: string;
};

export default function ContentTableTab({ items }: ContentTableTabProps) {
  const [selectedScript, setSelectedScript] = useState<SelectedScript | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!selectedScript) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedScript(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedScript]);

  return (
    <section dir="rtl" className="space-y-4" aria-labelledby="content-table-heading">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C] sm:p-6">
        <p className="text-xs font-semibold tracking-wide text-slate-400 dark:text-[#D4AF37]/80">
          خط إنتاج المحتوى
        </p>
        <h2
          id="content-table-heading"
          className="mt-1 text-lg font-bold text-slate-900 dark:text-white sm:text-xl"
        >
          المحتوى
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          تتبع الأفكار من الصياغة حتى النشر مع حالة المرحلة والمؤشرات.
        </p>
      </div>

      <div className={CRM_TABLE_SCROLL}>
        <table className={CRM_TABLE}>
          <thead>
            <tr>
              <th className={CRM_TH}>المعرف</th>
              <th className={CRM_TH}>الفكرة</th>
              <th className={CRM_TH}>الصيغة</th>
              <th className={CRM_TH}>المنصة</th>
              <th className={CRM_TH}>المرحلة</th>
              <th className={CRM_TH}>الحالة</th>
              <th className={CRM_TH}>الأداء</th>
              <th className={CRM_TH}>السكريبت</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className={CRM_TR}>
                <td className={`${CRM_TD} font-mono text-xs text-slate-500 dark:text-slate-400`}>
                  {row.id}
                </td>
                <td className={`${CRM_TD} max-w-[220px] font-medium`}>{row.idea}</td>
                <td className={CRM_TD}>{row.format}</td>
                <td className={CRM_TD}>
                  <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-[#1A2421] dark:text-slate-300">
                    {row.platform}
                  </span>
                </td>
                <td className={CRM_TD}>{row.stage}</td>
                <td className={CRM_TD}>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${statusClass(row.status)}`}
                  >
                    {row.status}
                  </span>
                </td>
                <td className={`${CRM_TD} text-slate-500 dark:text-slate-400`}>
                  {row.metrics ?? '—'}
                </td>
                <td className={CRM_TD}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedScript({
                        idea: row.idea,
                        content: resolveMarketingScript(row),
                      });
                    }}
                    className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-[#1A2421] dark:text-slate-200 dark:hover:bg-[#2A3834]"
                  >
                    <FileText className="h-3.5 w-3.5" aria-hidden />
                    السكريبت
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {mounted && selectedScript
        ? createPortal(
            <div
              className={CRM_MODAL_OVERLAY}
              role="presentation"
              onClick={() => setSelectedScript(null)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="script-modal-title"
                dir="rtl"
                className={`${CRM_MODAL_PANEL} max-w-lg p-6 text-right dark:border-[#2D3F3A] dark:bg-[#22302C]`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h3
                    id="script-modal-title"
                    className="text-lg font-bold text-slate-900 dark:text-white"
                  >
                    {selectedScript.idea}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setSelectedScript(null)}
                    className={`${CRM_BTN_GHOST} !min-h-9 !px-2 !py-2`}
                    aria-label="إغلاق"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>

                <div className="mb-4 max-h-[28rem] overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-slate-300">
                  {selectedScript.content}
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedScript(null)}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-slate-800 dark:bg-[#D4AF37] dark:text-slate-950 dark:hover:bg-[#B8952B]"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
