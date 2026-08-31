'use client';

import {
  BRAND_GOLD,
  BRAND_GOLD_CALLOUT_CLASS,
  brandGoldCalloutStyle,
  brandOliveHeadingStyle,
} from '@/lib/brand-gold';

export const GROUP_TRIP_CHARTER_TITLE = 'دليل الرحلة وميثاق التفاهم المشترك';
export const GROUP_TRIP_CHARTER_SUBTITLE = 'Community Guidelines & Travel Understanding';
export const GROUP_TRIP_CHARTER_INTRO =
  'يسعدنا انضمامك إلى رحلتنا! حرصاً منا في واندرلوم على تقديم تجربة سفر استثنائية ومليئة بالذكريات الجميلة، وضعنا هذا الدليل البسيط لضمان راحة وسلامة كافة أفراد المجموعة.';

/** Short excerpts for inline summary cards */
export const GROUP_TRIP_TERMS_SECTIONS = [
  {
    title: 'البند الأول — بيئة الرحلة والأجواء الإيجابية',
    items: [
      'احترام الخصوصية: استئذان أعضاء المجموعة قبل التقاط الصور أو نشرها.',
      'الالتزام بالأنظمة: الالتزام بالقوانين المحلية والابتعاد عن أي مواد مخالفة.',
    ],
  },
  {
    title: 'البند الثاني — المواعيد وتنظيم جدول الرحلة',
    items: [
      'الالتزام بالمواعيد: مراعاة أوقات التجمع حرصاً على وقت الجميع.',
      'قيادة الرحلة: قائد الرحلة يتكفل بتنظيم اليوم واتخاذ القرارات الميدانية.',
      'راحة الفريق: يحق للشركة اتخاذ إجراءات مناسبة للحفاظ على بيئة آمنة.',
    ],
  },
  {
    title: 'البند الثالث — الظروف الخارجة عن الإرادة',
    items: [
      'تبذل الشركة أقصى جهدها لتنفيذ البرنامج بتميز.',
      'لا تتحمل التبعات الناتجة عن الظروف القاهرة (الأحوال الجوية أو القرارات الحكومية).',
    ],
  },
  {
    title: 'الموافقة على التصوير',
    items: ['يمكنك الموافقة أو الامتناع عن مشاركة صورك في المواد الترويجية — الاختيار لك دائماً.'],
  },
] as const;

type CharterBodyProps = {
  variant?: 'page' | 'modal';
};

export function GroupTripTermsCharterHeader({ variant = 'page' }: CharterBodyProps) {
  if (variant === 'modal') {
    return (
      <div className="min-w-0 pe-2">
        <h2
          id="group-terms-modal-title"
          style={brandOliveHeadingStyle}
          className="text-sm font-extrabold sm:text-base"
        >
          {GROUP_TRIP_CHARTER_TITLE}
        </h2>
        <p className="pt-0.5 text-[10px] font-bold text-slate-400 sm:text-[11px]">
          {GROUP_TRIP_CHARTER_SUBTITLE}
        </p>
      </div>
    );
  }

  return (
    <div className="border-b border-slate-100 pb-4">
      <h1 style={brandOliveHeadingStyle} className="text-lg font-extrabold sm:text-xl">
        {GROUP_TRIP_CHARTER_TITLE}
      </h1>
      <p className="pt-0.5 text-xs font-bold text-slate-400">{GROUP_TRIP_CHARTER_SUBTITLE}</p>
    </div>
  );
}

export function GroupTripTermsCharterIntro({ variant = 'page' }: CharterBodyProps) {
  const className =
    variant === 'modal'
      ? `rounded-2xl border p-3 text-[11px] font-semibold leading-relaxed sm:text-xs ${BRAND_GOLD_CALLOUT_CLASS}`
      : `rounded-2xl border p-4 text-xs font-semibold leading-relaxed sm:text-sm ${BRAND_GOLD_CALLOUT_CLASS}`;

  return <p className={className} style={brandGoldCalloutStyle}>{GROUP_TRIP_CHARTER_INTRO}</p>;
}

type MediaConsentProps = {
  mediaConsent: boolean;
  onMediaConsentChange: (value: boolean) => void;
  inputName?: string;
  compact?: boolean;
};

export function GroupTripTermsMediaConsent({
  mediaConsent,
  onMediaConsentChange,
  inputName = 'fullMediaConsent',
  compact = false,
}: MediaConsentProps) {
  return (
    <div
      className={`space-y-3 rounded-2xl border border-slate-200 bg-slate-50 ${compact ? 'p-3' : 'p-4'}`}
    >
      <p className="font-bold text-slate-900">
        مشاركة لحظات الرحلة في المواد الترويجية{' '}
        <span className="font-semibold text-slate-500">(اختياري)</span>
      </p>
      <p className="text-[11px] font-semibold leading-relaxed text-slate-600">
        نتشرف بتوثيق ذكريات الرحلة — ويمكنك اختيار الموافقة أو الامتناع بكل راحة.
      </p>
      <div className={`flex flex-wrap items-center gap-4 font-bold ${compact ? 'text-xs' : 'text-xs sm:gap-6'}`}>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name={inputName}
            checked={mediaConsent}
            onChange={() => onMediaConsentChange(true)}
            style={{ accentColor: '#C5A059' }}
            className="h-4 w-4"
          />
          <span>أوافق (Opt-in)</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name={inputName}
            checked={!mediaConsent}
            onChange={() => onMediaConsentChange(false)}
            style={{ accentColor: '#C5A059' }}
            className="h-4 w-4"
          />
          <span>لا أوافق (Opt-out)</span>
        </label>
      </div>
    </div>
  );
}

export function GroupTripTermsCharterArticles({ variant = 'page' }: CharterBodyProps) {
  const headingClass =
    variant === 'modal' ? 'text-xs font-extrabold' : 'text-xs font-extrabold sm:text-sm';
  const listClass =
    variant === 'modal'
      ? 'list-disc space-y-1 pr-4'
      : 'list-disc space-y-1 pr-5 sm:space-y-1';
  const bodyClass =
    variant === 'modal'
      ? 'space-y-5 text-xs font-semibold leading-relaxed text-slate-600'
      : 'space-y-5 text-xs font-semibold leading-relaxed text-slate-700 sm:text-sm';

  return (
    <div className={bodyClass}>
      <div className="space-y-1.5">
        <h3 className={headingClass} style={brandOliveHeadingStyle}>
          البند الأول — بيئة الرحلة والأجواء الإيجابية
        </h3>
        <ul className={listClass}>
          <li>
            <strong>احترام الخصوصية:</strong> نجاح الرحلة يعتمد على راحة الجميع؛ يُرجى استئذان
            أعضاء المجموعة قبل التقاط الصور أو نشرها.
          </li>
          <li>
            <strong>الالتزام بالأنظمة:</strong> حرصاً على سلامة المجموعة، نلتزم جميعاً بالقوانين
            المحلية والابتعاد عن أي مواد مخالفة للأنظمة.
          </li>
        </ul>
      </div>

      <div className="space-y-1.5">
        <h3 className={headingClass} style={{ color: BRAND_GOLD.BADGE_TEXT }}>
          البند الثاني — المواعيد وتنظيم جدول الرحلة
        </h3>
        <ul className={listClass}>
          <li>
            <strong>الالتزام بالمواعيد:</strong> يُرجى مراعاة أوقات التجمع المحددة في الجدول حرصاً
            على وقت الجميع ولضمان الاستمتاع بكافة الأنشطة المقررة.
          </li>
          <li>
            <strong>قيادة الرحلة:</strong> يتكفل قائد الرحلة بتنظيم اليوم واتخاذ القرارات الميدانية
            التي تصب في مصلحة وسلامة الجميع.
          </li>
          <li>
            <strong>راحة الفريق:</strong> في الحالات الاستثنائية التي تؤثر على انسجام الفريق، يحق
            للشركة اتخاذ الإجراءات المناسبة للحفاظ على بيئة آمنة للجميع.
          </li>
        </ul>
      </div>

      <div className="space-y-1.5">
        <h3 className={headingClass} style={{ color: BRAND_GOLD.BADGE_TEXT }}>
          البند الثالث — الظروف الخارجة عن الإرادة
        </h3>
        <p>
          تبذل الشركة أقصى جهدها لتنفيذ البرنامج بتميز، ولا تتحمل التبعات الناتجة عن الظروف القاهرة
          الخارجة عن الإرادة (كالأحوال الجوية أو القرارات الحكومية).
        </p>
      </div>
    </div>
  );
}
