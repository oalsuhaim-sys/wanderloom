'use client';

import {
  BadgeDollarSign,
  Camera,
  Eye,
  EyeOff,
  ImageIcon,
  Link2,
  Lock,
  MapPin,
  Save,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { WANDERLOOM_8_STEP_BEATS } from '@/lib/expert-handbook-content';

/** Side-by-side: admin pricing inputs vs what the client actually sees. */
export function ProposalAdminClientCompare({ compact = false }: { compact?: boolean }) {
  return (
    <div className="mt-4 space-y-3" dir="rtl">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/15 px-2.5 py-0.5 text-[10px] font-black text-[#5C4A22]">
          مقارنة تفاعلية
        </span>
        <h4 className="text-sm font-black text-[#1C2E3A] dark:text-[#F4EFE6]">
          كيف تنعكس المدخلات للعميل؟
        </h4>
      </div>

      <div
        className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}
      >
        {/* Admin mock */}
        <div className="overflow-hidden rounded-xl border border-slate-300/80 bg-[#1A2421] text-[#F4EFE6] shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-[#22302C] px-3 py-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#D4AF37]">
              <Lock className="h-3 w-3" aria-hidden />
              شاشة الخبير (CRM)
            </span>
            <EyeOff className="h-3.5 w-3.5 text-slate-400" aria-hidden />
          </div>
          <div className="space-y-2 p-3 text-xs">
            <p className="text-[10px] font-bold text-slate-400">مدخلات التسعير الداخلية — لا تُرسل للعميل</p>
            <MockRow label="تكلفة الفندق (Net)" value="٤٬٢٠٠ ر.س" tone="warn" />
            <MockRow label="الطيران (صافي + ضرائب)" value="٦٬٨٠٠ ر.س" tone="warn" />
            <MockRow label="التجارب / الأنشطة" value="١٬٩٥٠ ر.س" tone="warn" />
            <MockRow label="هامش الربح %" value="٢٨٪" tone="danger" />
            <MockRow label="إجمالي التكلفة الداخلية" value="١٢٬٩٥٠ ر.س" tone="muted" />
            <div className="mt-2 rounded-lg border border-rose-400/30 bg-rose-950/40 px-2.5 py-2 text-[10px] font-bold leading-relaxed text-rose-200">
              ⚠️ صفوف التكلفة + الهامش تبقى داخل CRM فقط — تسريبها يكسر بوابة القيمة.
            </div>
          </div>
        </div>

        {/* Client mock */}
        <div className="overflow-hidden rounded-xl border border-[#D4AF37]/35 bg-gradient-to-b from-[#FDFBF7] to-white shadow-sm dark:from-[#1E2A26] dark:to-[#22302C]">
          <div className="flex items-center justify-between gap-2 border-b border-[#D4AF37]/20 bg-[#D4AF37]/10 px-3 py-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#9C7A3C]">
              <Eye className="h-3 w-3" aria-hidden />
              واجهة العميل (/proposal)
            </span>
            <BadgeDollarSign className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
          </div>
          <div className="space-y-3 p-3">
            <div className="rounded-xl border border-[#D4AF37]/25 bg-white/80 p-3 dark:bg-[#1A2421]/70">
              <p className="text-[10px] font-black text-[#9C7A3C]">باقة Wanderloom الفاخرة</p>
              <p className="mt-1 text-lg font-black text-[#1C2E3A] dark:text-[#F4EFE6]">
                ١٨٬٥٠٠{' '}
                <span className="text-sm font-bold text-slate-500">ر.س</span>
              </p>
              <p className="mt-1 text-[10px] font-medium text-slate-500">
                سعر موحّد شامل — بلا بنود تكلفة داخلية
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {['إقامة بوتيك', 'إيقاع حسي يومي', 'تجارب خاصة', 'دعم خبير'].map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-2 py-0.5 text-[10px] font-bold text-[#5C4A22] dark:text-[#E8D5A3]"
                >
                  {chip}
                </span>
              ))}
            </div>
            <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/80 px-2.5 py-2 text-[10px] font-bold leading-relaxed text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-200">
              ✓ لا هامش ربح · لا تكلفة مورد · لا تفصيل صفوف داخلية — فقط قيمة الباقة وشارات ذهبية.
            </div>
          </div>
        </div>
      </div>

      {/* Mini mapping table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#2D3F3A]">
        <table className="w-full min-w-[28rem] text-right text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 dark:border-[#2D3F3A] dark:bg-[#1A2421]">
              <th className="px-3 py-2 font-black text-[#1C2E3A] dark:text-[#F4EFE6]">مدخل الخبير</th>
              <th className="px-3 py-2 font-black text-[#1C2E3A] dark:text-[#F4EFE6]">ما يراه العميل</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#2D3F3A]">
            {[
              ['تكلفة فندق / صافي', 'مُدمَج في الإجمالي — بلا رقم منفصل'],
              ['تفصيل الطيران الداخلي', 'قيمة الرحلة الجوية ضمن الباقة'],
              ['تجارب + تفصيل تكلفة', 'بطاقات تجارب حسية / قيمة'],
              ['هامش الربح %', 'مخفي تماماً (Anti-Leak)'],
              ['الإجمالي الداخلي', 'سعر موحّد + شارات ذهبية'],
            ].map(([admin, client]) => (
              <tr key={admin} className="bg-white/60 dark:bg-[#22302C]/40">
                <td className="px-3 py-2 font-medium text-slate-600 dark:text-slate-300">{admin}</td>
                <td className="px-3 py-2 font-bold text-emerald-700 dark:text-emerald-300">{client}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MockRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'warn' | 'danger' | 'muted';
}) {
  const valueClass =
    tone === 'danger'
      ? 'text-rose-300'
      : tone === 'warn'
        ? 'text-amber-200'
        : 'text-slate-300';
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5">
      <span className="font-medium text-slate-300">{label}</span>
      <span className={`font-black tabular-nums ${valueClass}`} dir="ltr">
        {value}
      </span>
    </div>
  );
}

/** Step-by-step itinerary builder walkthrough with mock UI chips. */
export function ItineraryStepByStepGuide({ compact = false }: { compact?: boolean }) {
  return (
    <div className="mt-4 space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/15 px-2.5 py-0.5 text-[10px] font-black text-[#5C4A22]">
          دليل الحقول خطوة بخطوة
        </span>
        <h4 className="text-sm font-black text-[#1C2E3A] dark:text-[#F4EFE6]">
          بناء يوم المسار في الواجهة
        </h4>
      </div>

      <ol className="space-y-3">
        <StepCard
          n={1}
          title="اختر اليوم والوجهة"
          body="من مساحة بناء المسار: حدّد نوع الرحلة، ثم الدول/المدن، واربط العميل إن وُجد. كل يوم يحتاج مدينة واضحة قبل سحب المحطات."
        >
          <div className="mt-2 flex flex-wrap gap-2">
            <MockChip icon={MapPin} label="اليوم 2 · كيوتو" />
            <MockChip icon={Sparkles} label="ربط العميل: سارة" />
          </div>
        </StepCard>

        <StepCard
          n={2}
          title="اتبع التسلسل الحسي الثماني (القائمة المنسدلة / الترتيب)"
          body="أضف المحطات بالترتيب الرسمي فقط — لا تقدّم القهوة على الشارع ولا العشاء على المنطقة الليلية."
        >
          <div className={`mt-2 grid gap-1.5 ${compact ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
            {WANDERLOOM_8_STEP_BEATS.map((beat, i) => (
              <div
                key={beat.ar}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-slate-200"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#D4AF37] text-[10px] font-black text-[#1A3B2A]">
                  {i + 1}
                </span>
                <span>
                  {beat.ar}{' '}
                  <span className="font-medium text-slate-400">· {beat.en}</span>
                </span>
              </div>
            ))}
          </div>
        </StepCard>

        <StepCard
          n={3}
          title="الصور: Unsplash التلقائي مقابل الرفع المخصص"
          body="عند التوليد بالذكاء أو جلب صورة المحطة، النظام يحاول Unsplash/مسار المنسّق تلقائياً. إن كانت الصورة عامة أو غير مناسبة: استبدلها يدوياً أو ارفع صورة معتمدة."
        >
          <div className={`mt-2 grid gap-2 ${compact ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
            <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/70 p-2.5 dark:border-emerald-800/40 dark:bg-emerald-950/20">
              <p className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-800 dark:text-emerald-200">
                <Camera className="h-3.5 w-3.5" aria-hidden />
                تلقائي (Unsplash / Curator)
              </p>
              <p className="mt-1 text-[10px] font-medium leading-relaxed text-emerald-700/90 dark:text-emerald-300/80">
                يُجلب بعد التوليد أو زر جلب الصورة — راجع الجو والإضاءة قبل الاعتماد.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white/80 p-2.5 dark:border-[#2D3F3A] dark:bg-[#1A2421]">
              <p className="inline-flex items-center gap-1 text-[11px] font-black text-slate-700 dark:text-slate-200">
                <ImageIcon className="h-3.5 w-3.5" aria-hidden />
                رفع مخصص
              </p>
              <p className="mt-1 text-[10px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                استخدمه للصور الحصرية أو عند فشل الجلب — تجنّب لقطات الشاشة وشعارات العلامات.
              </p>
            </div>
          </div>
        </StepCard>

        <StepCard
          n={4}
          title="«تطبيق التعديل على المسار» — دفع التعديلات مباشرة"
          body="بعد تعديل محطة أو يوم: احفظ عبر زر الحفظ / تطبيق التعديل على المسار ليدفع التغييرات إلى المسار المحفوظ. بعدها فقط يصبح الرابط السحري للعميل محدّثاً."
        >
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#D4AF37] px-3 py-2 text-[11px] font-black text-[#1A3B2A] shadow-sm">
              <Save className="h-3.5 w-3.5" aria-hidden />
              تطبيق التعديل على المسار
            </span>
            <span className="text-[10px] font-bold text-slate-500">→ يظهر للعميل بعد الحفظ فقط</span>
          </div>
        </StepCard>
      </ol>

      {/* Mini admin vs client itinerary preview */}
      <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'lg:grid-cols-2'}`}>
        <div className="rounded-xl border border-slate-300 bg-[#1A2421] p-3 text-[#F4EFE6]">
          <p className="text-[10px] font-black text-[#D4AF37]">معاينة خبير — محرر اليوم</p>
          <ul className="mt-2 space-y-1 text-[10px] font-medium text-slate-300">
            <li>07:30 · الصحوة · فئة h · search_keyword داخلي</li>
            <li>08:30 · الإفطار · تكلفة مورد (مخفي)</li>
            <li>… حتى العشاء 20:30</li>
          </ul>
        </div>
        <div className="rounded-xl border border-[#D4AF37]/30 bg-[#FDFBF7] p-3 dark:bg-[#22302C]">
          <p className="text-[10px] font-black text-[#9C7A3C]">معاينة عميل — الخط الزمني الحسي</p>
          <ul className="mt-2 space-y-1 text-[10px] font-medium text-slate-600 dark:text-slate-300">
            <li>صحوة هادئة في إقامة بوتيك</li>
            <li>إفطار محلي · شارع مميز · قهوة مختصة</li>
            <li>ذروة + تجربة خاصة · مساء أنيق · عشاء فاخر</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/** Save & generate client link walkthrough mock. */
export function SaveAndClientLinkSteps() {
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/5 p-3">
      <p className="text-[11px] font-black text-[#5C4A22] dark:text-[#E8D5A3]">
        خطوات «حفظ وإنشاء رابط العميل»
      </p>
      <ol className="space-y-2 text-[11px] font-medium leading-relaxed text-slate-600 dark:text-slate-300">
        <li className="flex gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D4AF37] text-[10px] font-black text-[#1A3B2A]">
            1
          </span>
          أكمل صفوف التسعير والبروشور واربط العميل — ثم اضغط حفظ العرض.
        </li>
        <li className="flex gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D4AF37] text-[10px] font-black text-[#1A3B2A]">
            2
          </span>
          بعد نجاح الحفظ يظهر زر «🔗 نسخ رابط العميل» — انسخه فقط (لا لقطة شاشة من CRM).
        </li>
        <li className="flex gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D4AF37] text-[10px] font-black text-[#1A3B2A]">
            3
          </span>
          أرسل عبر واتساب بصياغة شخصية + الرابط الفاخر (/proposal أو /quote).
        </li>
      </ol>
      <div className="flex flex-wrap gap-2 pt-1">
        <span className="inline-flex items-center gap-1 rounded-lg border border-[#C9A84C]/50 bg-[#D4AF37] px-2.5 py-1.5 text-[10px] font-black text-[#1C4532]">
          <Save className="h-3 w-3" aria-hidden />
          حفظ العرض
        </span>
        <span className="inline-flex items-center gap-1 rounded-lg border border-[#C9A84C]/50 bg-gradient-to-l from-[#FEFDF9] to-[#FFF8E7] px-2.5 py-1.5 text-[10px] font-black text-[#1C4532]">
          <Link2 className="h-3 w-3" aria-hidden />
          نسخ رابط العميل
        </span>
      </div>
    </div>
  );
}

function StepCard({
  n,
  title,
  body,
  children,
}: {
  n: number;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <li className="rounded-xl border border-slate-200/80 bg-white/80 p-3 dark:border-[#2D3F3A] dark:bg-[#1A2421]/50 sm:p-4">
      <div className="flex items-start gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1C2E3A] text-xs font-black text-[#D4AF37]">
          {n}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-[#1C2E3A] dark:text-[#F4EFE6]">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{body}</p>
          {children}
        </div>
      </div>
    </li>
  );
}

function MockChip({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-600 dark:border-[#2D3F3A] dark:bg-[#22302C] dark:text-slate-300">
      <Icon className="h-3 w-3 text-[#D4AF37]" aria-hidden />
      {label}
    </span>
  );
}
