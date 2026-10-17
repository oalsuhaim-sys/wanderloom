'use client';

import { useState } from 'react';

import type { ItineraryTemplateRow } from '@/lib/itinerary-templates';

type ItineraryTemplateManagerProps = {
  currentDayCount?: number;
  availableTemplates?: ItineraryTemplateRow[];
  onApply: (options: {
    templateIds: string[];
    appendToCurrent: boolean;
    clearDayTitles: boolean;
  }) => void;
};

export function ItineraryTemplateManager({
  currentDayCount = 0,
  availableTemplates = [],
  onApply,
}: ItineraryTemplateManagerProps) {
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [appendToCurrent, setAppendToCurrent] = useState(true);
  const [clearDayTitles, setClearDayTitles] = useState(true);

  const handleApplyTemplates = () => {
    if (selectedTemplateIds.length === 0) {
      alert('يرجى اختيار قالب واحد على الأقل للاستدعاء.');
      return;
    }

    onApply({
      templateIds: selectedTemplateIds,
      appendToCurrent,
      clearDayTitles,
    });
    setSelectedTemplateIds([]);
  };

  return (
    <div
      className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 text-right shadow-sm"
      dir="rtl"
    >
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#C59B4B]">
          TEMPLATE ENGINE
        </span>
        <h2 className="text-base font-bold text-[#111827]">إدارة القوالب الجاهزة</h2>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-[#F8F5EE]/50 p-4">
          <label className="block text-xs font-bold text-slate-800">
            استدعي قالب أو عدة قوالب جاهزة:
          </label>

          <div className="max-h-36 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 text-xs font-bold text-slate-700">
            {availableTemplates.length === 0 ? (
              <p className="py-2 text-center text-slate-400">لا توجد قوالب محفوظة حالياً</p>
            ) : (
              availableTemplates.map((tmpl) => {
                const dayCount = Array.isArray(tmpl.days_data)
                  ? tmpl.days_data.length
                  : typeof tmpl.days_data === 'object' &&
                      tmpl.days_data &&
                      Array.isArray((tmpl.days_data as { days?: unknown }).days)
                    ? ((tmpl.days_data as { days: unknown[] }).days.length)
                    : null;
                return (
                  <label
                    key={tmpl.id}
                    className="flex cursor-pointer items-center justify-between rounded-lg p-1.5 hover:bg-slate-50"
                  >
                    <span>
                      {tmpl.title}
                      {tmpl.destination ? ` · ${tmpl.destination}` : ''}
                      {dayCount != null ? ` (${dayCount} أيام)` : ''}
                    </span>
                    <input
                      type="checkbox"
                      checked={selectedTemplateIds.includes(tmpl.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTemplateIds([...selectedTemplateIds, tmpl.id]);
                        } else {
                          setSelectedTemplateIds(
                            selectedTemplateIds.filter((id) => id !== tmpl.id),
                          );
                        }
                      }}
                      className="h-4 w-4 rounded accent-[#C59B4B]"
                    />
                  </label>
                );
              })
            )}
          </div>

          <button
            type="button"
            onClick={handleApplyTemplates}
            className="w-full rounded-xl bg-[#C59B4B] py-3 text-center text-xs font-bold text-slate-900 shadow-sm transition-all hover:bg-[#B2883A]"
          >
            استدعي القوالب إلى المسار
          </button>
        </div>

        <div className="flex flex-col justify-center space-y-4 rounded-2xl border border-slate-200/80 bg-[#F8F5EE]/50 p-4">
          <span className="mb-1 block text-xs font-bold text-slate-800">
            خيارات الإدراج والدمج:
          </span>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3 text-xs font-bold text-slate-800">
            <input
              type="checkbox"
              checked={appendToCurrent}
              onChange={(e) => setAppendToCurrent(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded accent-[#C59B4B]"
            />
            <div>
              <span>إضافة على المسار الحالي كأيام إضافية</span>
              <p className="mt-0.5 text-[10px] font-medium text-slate-500">
                {appendToCurrent
                  ? `تبدأ الأيام القادمة فوراً بعد اليوم الحالي (اليوم ${currentDayCount + 1}) بدون حذف الأيام المكتوبة.`
                  : 'سيتم مسح المسار الحالي واستبداله بالقوالب المختارة فقط.'}
              </p>
            </div>
          </label>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3 text-xs font-bold text-slate-800">
            <input
              type="checkbox"
              checked={clearDayTitles}
              onChange={(e) => setClearDayTitles(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded accent-[#C59B4B]"
            />
            <div>
              <span>تفريغ عناوين الأيام المستدعاة</span>
              <p className="mt-0.5 text-[10px] font-medium text-slate-500">
                تظهر الأيام المستدعاة بعناوين فارغة كأنها يوم جديد مع إبقاء المعالم والأنشطة
                المسجلة بداخل القالب.
              </p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}

export default ItineraryTemplateManager;
