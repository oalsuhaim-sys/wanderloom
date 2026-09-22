import { buildWanderloomMasterScript } from '@/lib/wanderloom-master-script';
import type {
  MarketingContentStatus,
  MarketingPipelineItem,
} from '@/lib/marketing-content-pipeline';

export type { MarketingContentStatus, MarketingPipelineItem };

/** Shared seed list — every script uses the full 5-section Master Format. */
export const INITIAL_MARKETING_CONTENT_ITEMS: MarketingPipelineItem[] = [
  {
    id: 'WL-1042',
    idea: 'صباح سيول بين القهوة والمطر',
    format: 'ريلز',
    platform: 'Instagram',
    stage: 'سكريبت',
    status: 'قيد الإنتاج',
    metrics: '—',
    destination: 'سيول',
    script: buildWanderloomMasterScript({
      id: 'WL-1042',
      idea: 'صباح سيول بين القهوة والمطر',
      format: 'ريلز',
      platform: 'Instagram',
      stage: 'سكريبت',
      destination: 'سيول',
      audience: 'VIP',
      theme: 'بيع الشعور',
      topic: 'صباح سيول بين القهوة والمطر',
      beats: {
        hook: {
          direction: 'نافذة مقهى + قطرات مطر على الزجاج خلال أول 3 ثوانٍ.',
          line: 'بعض الصباحات… لا تُروى. تُرتشف فقط.',
          alts: 'مطر. قهوة. سيول. هل تشعر بذلك؟',
        },
        reveal: {
          direction: 'كشف الزقاق الضيق وإضاءة الصباح الذهبية.',
          line: 'سيول حين تستيقظ بالمطر… تُصمَّم لا تُصادَف.',
          alts: 'هنا يبدأ الإحساس قبل الخريطة.',
        },
        feel: {
          direction: 'حركة بطيئة نحو الفنجان والبخار والخطوات الهادئة.',
          line: 'لحظة مصمّمة لك — بهدوء الهندسة السياحية الفاخرة.',
          alts: 'هذا ليس روتيناً صباحياً… هذا طقس سفر.',
        },
        softLink: {
          direction: 'ظهور شعار Wanderloom بلطف مع انتقال ناعم.',
          line: 'واندرلوم — نصمّم الصباح كما تُحِب أن تبدأ يومك.',
          alts: 'اترك التخطيط لنا… وعِش المطر.',
        },
      },
      caption: `بعض الصباحات لا تُوصف… تُعاش فقط في سيول.

قهوة، مطر خفيف، وزقاق يهمس بهدوء المدينة.

في Wanderloom نصمّم الإحساس قبل الجدول — لتبدأ رحلتك كما تستحق.`,
      hashtags: ['#Wanderloom', '#واندرلوم', '#سيول', '#سفر_فاخر', '#بيع_الشعور'],
      visualNotes: [
        'إضاءة صباحية باردة مع لمسة ذهبية على البخار.',
        'لقطات قريبة: قطرات المطر، حافة الفنجان، انعكاس الزجاج.',
        'موسيقى هادئة — بيانو خفيف بدون كلمات.',
      ],
      cta: 'اطلب تصميم صباحك في سيول مع Wanderloom — اكتب «سيول» في الرسائل.',
    }),
  },
  {
    id: 'WL-1041',
    idea: 'لماذا الرحلات الجماعية تغيّر التجربة؟',
    format: 'كاروسيل',
    platform: 'Instagram',
    stage: 'تصميم',
    status: 'جاهز للنشر',
    metrics: '2.4k حفظ',
    destination: 'وجهات المجموعة',
    script: buildWanderloomMasterScript({
      id: 'WL-1041',
      idea: 'لماذا الرحلات الجماعية تغيّر التجربة؟',
      format: 'كاروسيل',
      platform: 'Instagram',
      stage: 'تصميم',
      destination: 'وجهات المجموعة',
      audience: 'عوائل',
      theme: 'قروبات',
      topic: 'لماذا الرحلات الجماعية تغيّر التجربة؟',
      beats: {
        hook: {
          direction: 'شريحة عنوان قوي + صورة مجموعة في وجهة مميزة.',
          line: 'الرحلات الجماعية ليست تنازلاً عن الفخامة…',
          alts: 'لماذا يسافر الأذكياء معاً؟',
        },
        reveal: {
          direction: 'ثلاث فوائد مرئية: أمان · صداقات · تجارب مشتركة.',
          line: 'بل مضاعفة للمعنى — بأمان وتنسيق يليق بك.',
          alts: 'مجموعة منتقاة = تجربة أعمق.',
        },
        feel: {
          direction: 'شهادة قصيرة / لقطة ضحك مشتركة على مائدة عشاء.',
          line: 'لأن الذكريات تُصنع أسرع حين يشاركك أحد الإحساس.',
          alts: 'هنا تتحول الوجهة إلى مجتمع صغير فاخر.',
        },
        softLink: {
          direction: 'ختم Wanderloom Groups بهدوء.',
          line: 'واندرلوم — مجموعات مصمّمة… لا مجرّد أرقام على باص.',
          alts: 'انضم لمجموعة تشبه ذوقك.',
        },
      },
      caption: `الرحلة الجماعية ليست تنازلاً عن الفخامة… بل مضاعفة للمعنى.

أمان، صداقات، وتجارب مشتركة — بهندسة Wanderloom.

جاهز لمجموعتك التالية؟`,
      hashtags: ['#Wanderloom', '#رحلات_جماعية', '#قروبات', '#سفر_فاخر'],
      visualNotes: [
        'كاروسيل 4–5 شرائح بنص عربي واضح.',
        'صور مجموعة حقيقية أو ستوك فاخر متناسق الألوان.',
        'تجنّب الازدحام البصري — شريحة واحدة = رسالة واحدة.',
      ],
      cta: 'انضم إلى أقرب مجموعة Wanderloom — اضغط الرابط في البايو أو اكتب «مجموعة».',
    }),
  },
  {
    id: 'WL-1038',
    idea: 'دقيقة واحدة في سوق نامدايمون',
    format: 'ستوري',
    platform: 'TikTok',
    stage: 'فكرة',
    status: 'فكرة',
    metrics: '—',
    destination: 'سيول · نامدايمون',
    script: buildWanderloomMasterScript({
      id: 'WL-1038',
      idea: 'دقيقة واحدة في سوق نامدايمون',
      format: 'ستوري',
      platform: 'TikTok',
      stage: 'فكرة',
      destination: 'سيول · نامدايمون',
      audience: 'مسافرون لأول مرة',
      theme: 'حياة المدينة',
      topic: 'دقيقة واحدة في سوق نامدايمون',
      beats: {
        hook: {
          direction: 'دخول سريع لإيقاع السوق خلال أول 3 ثوانٍ.',
          line: 'دقيقة واحدة… تكفي لتعشق نامدايمون.',
          alts: 'هل تسمع السوق قبل أن تراه؟',
        },
        reveal: {
          direction: 'مرور بين الممرات والألوان والروائح.',
          line: 'سيول الحقيقية لا تختبئ في الفنادق… بل هنا.',
          alts: 'حياة المدينة بنسختها الأكثر صدقاً.',
        },
        feel: {
          direction: 'لقطة قريبة لمشترٍ محلي / تفصيلة يدوية.',
          line: 'إحساس المدينة حين تلمسها لا حين تصوّرها فقط.',
          alts: 'هذا نبض سيول.',
        },
        softLink: {
          direction: 'ستicker/نص ناعم لـ Wanderloom City Moments.',
          line: 'واندرلوم — نأخذك إلى أين تنبض المدينة.',
          alts: 'احجز لحظة مدينة… لا مجرّد جولة.',
        },
      },
    }),
  },
  {
    id: 'WL-1035',
    idea: 'قبل وبعد: حقيبة المسافر الذكية',
    format: 'منشور ثابت',
    platform: 'LinkedIn',
    stage: 'مراجعة',
    status: 'قيد الإنتاج',
    metrics: '186 تفاعل',
    destination: 'ما قبل الرحلة',
    script: buildWanderloomMasterScript({
      id: 'WL-1035',
      idea: 'قبل وبعد: حقيبة المسافر الذكية',
      format: 'منشور ثابت',
      platform: 'LinkedIn',
      stage: 'مراجعة',
      destination: 'ما قبل الرحلة',
      audience: 'رجال أعمال',
      theme: 'قصص العملاء',
      topic: 'قبل وبعد: حقيبة المسافر الذكية',
      beats: {
        hook: {
          direction: 'مقارنة بصرية: فوضى مقابل ترتيب.',
          line: 'قبل: فوضى الأغراض… بعد: هدوء المسافر.',
          alts: 'الفخامة تبدأ قبل بوابة المطار.',
        },
        reveal: {
          direction: 'إظهار قائمة التحقق الذكية وترتيب الحقيبة.',
          line: 'التجهيز الذكي يقلّل الضغط ويُبقي الذوق.',
          alts: 'نظام بسيط… أثر كبير.',
        },
        feel: {
          direction: 'مسافر يمشي بثقة في المطار.',
          line: 'لأن من يبدأ مرتباً… يصل حاضراً للحظة.',
          alts: 'هذا فرق الهندسة السياحية.',
        },
        softLink: {
          direction: 'ختم دليل Wanderloom للتجهيز الفاخر.',
          line: 'واندرلوم — نهتم بما قبل الرحلة كما نهتم بالوجهة.',
          alts: 'اطلب دليل التجهيز الفاخر.',
        },
      },
      caption: `قبل وبعد: حقيبة المسافر الذكية.

الفخامة تبدأ من التجهيز… لا من الوجهة فقط.

في Wanderloom نصمّم ما قبل الإقلاع كما نصمّم أيام الرحلة.`,
      hashtags: ['#Wanderloom', '#تجهيز_السفر', '#سفر_فاخر', '#LinkedInTravel'],
      cta: 'احصل على دليل التجهيز الفاخر من Wanderloom — راسلنا بكلمة «حقيبة».',
    }),
  },
];

export function resolveMarketingScript(item: MarketingPipelineItem): string {
  const existing = String(item.script ?? '').trim();
  if (existing) return existing;
  return buildWanderloomMasterScript({
    id: item.id,
    idea: item.idea,
    format: item.format,
    platform: item.platform,
    stage: item.stage,
    destination: item.destination,
    topic: item.idea,
  });
}
export type MarketingDashboardCounts = {
  readyToPublish: number;
  inProduction: number;
  ideas: number;
  total: number;
};

export function countMarketingContentByStatus(
  items: MarketingPipelineItem[],
): MarketingDashboardCounts {
  return {
    readyToPublish: items.filter((item) => item.status === 'جاهز للنشر').length,
    inProduction: items.filter((item) => item.status === 'قيد الإنتاج').length,
    ideas: items.filter((item) => item.status === 'فكرة').length,
    total: items.length,
  };
}

export type MarketingDistributionBar = {
  label: string;
  count: number;
  percent: number;
};

function percentOf(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 100);
}

const PLATFORM_ORDER = ['Instagram', 'TikTok', 'YouTube', 'LinkedIn', 'X'] as const;

export function buildPlatformDistribution(
  items: MarketingPipelineItem[],
): MarketingDistributionBar[] {
  const total = items.length;
  const counts = new Map<string, number>();

  for (const item of items) {
    const platform = String(item.platform ?? '').trim() || 'أخرى';
    counts.set(platform, (counts.get(platform) ?? 0) + 1);
  }

  const known = PLATFORM_ORDER.filter((p) => counts.has(p)).map((label) => ({
    label,
    count: counts.get(label) ?? 0,
    percent: percentOf(counts.get(label) ?? 0, total),
  }));

  const otherCount = [...counts.entries()]
    .filter(([label]) => !(PLATFORM_ORDER as readonly string[]).includes(label))
    .reduce((sum, [, n]) => sum + n, 0);

  if (otherCount > 0) {
    known.push({
      label: 'أخرى',
      count: otherCount,
      percent: percentOf(otherCount, total),
    });
  }

  return known;
}

const STAGE_ORDER = ['فكرة', 'سكريبت', 'تصميم', 'مراجعة', 'إنتاج', 'نشر'] as const;

export function buildStageDistribution(
  items: MarketingPipelineItem[],
): MarketingDistributionBar[] {
  const total = items.length;
  const counts = new Map<string, number>();

  for (const item of items) {
    const stage = String(item.stage ?? '').trim() || 'أخرى';
    counts.set(stage, (counts.get(stage) ?? 0) + 1);
  }

  const ordered = STAGE_ORDER.filter((s) => counts.has(s)).map((label) => ({
    label,
    count: counts.get(label) ?? 0,
    percent: percentOf(counts.get(label) ?? 0, total),
  }));

  for (const [label, count] of counts) {
    if ((STAGE_ORDER as readonly string[]).includes(label)) continue;
    ordered.push({ label, count, percent: percentOf(count, total) });
  }

  return ordered;
}
