'use client';

import { Award, Plane, Share2, Sparkles, X } from 'lucide-react';

const ACHIEVEMENTS = [
  {
    id: 'share-win',
    icon: Share2,
    title: 'شارك واربح',
    badge: 'نمو العلامة',
    description:
      'شجّع العميل على مشاركة رابط الرحلة السحري مع أصدقائه. كل مشاركة تزيد ثقة العلامة وتفتح باب عروض حصرية للعميل القادم.',
    tips: ['انسخ الرابط بعد الحفظ مباشرة', 'أرسله عبر واتساب بصياغة شخصية', 'تتبّع التحويلات من لوحة CRM لاحقاً'],
  },
  {
    id: 'seat-intel',
    icon: Sparkles,
    title: 'ذكاء المقاعد',
    badge: 'تجربة VIP',
    description:
      'املأ التيرمنل، المطار، ووقت الخروج من المنزل في قسم الطيران — تظهر للعميل في البوردينق الرقمي وتنبيه التقويم تلقائياً.',
    tips: ['رقم الرحلة + التيرمنل يقلل مكالمات الدعم', 'وقت الخروج من المنزل يُضاف لتنبيه .ics', 'علم الوجهة يجعل المسار أوضح بصرياً'],
  },
  {
    id: 'boarding-lux',
    icon: Plane,
    title: 'البوردينق الفخم',
    badge: 'هوية Wanderloom',
    description:
      'الرابط السحري يعرض تذكرة رقمية كحليّة وذهبية مع مسار IATA، باركود أنيق، وطباعة PDF للعميل بنقرة واحدة.',
    tips: ['تأكد من مدن الإقلاع والوصول قبل الإرسال', 'راجع البيانات مع العميل قبل موعد السفر', 'استخدم «إضافة للتقويم» مع التذكرة'],
  },
] as const;

type Props = {
  open: boolean;
  onClose: () => void;
};

export function FeaturesAchievementsModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="achievements-modal-title"
      dir="rtl"
      lang="ar"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#050a14]/75 backdrop-blur-sm"
        onClick={onClose}
        aria-label="إغلاق"
      />
      <div className="relative max-h-[92dvh] w-[95%] max-w-2xl overflow-y-auto rounded-t-2xl border border-amber-500/25 bg-gradient-to-b from-[#0f1c35] via-[#0a1428] to-[#060b14] p-4 shadow-[0_32px_80px_rgba(0,0,0,0.55)] ring-1 ring-amber-400/15 sm:max-h-[90vh] sm:rounded-[1.75rem] sm:p-6 md:w-3/4 lg:w-1/2 lg:max-w-2xl md:p-8">
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.35em] text-amber-400/90">System Playbook</p>
            <h2 id="achievements-modal-title" className="mt-2 flex items-center gap-2 text-xl font-black text-white sm:text-2xl">
              <Award className="h-6 w-6 text-amber-400" />
              دليل ميزات النظام 🏆
            </h2>
            <p className="mt-2 text-sm font-medium text-slate-400">دليل الإنجازات — مرجع سريع لا تنساه أثناء بناء الرحلة.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
            aria-label="إغلاق النافذة"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ul className="space-y-4">
          {ACHIEVEMENTS.map((item) => {
            const Icon = item.icon;
            return (
              <li
                key={item.id}
                className="rounded-2xl border border-amber-500/15 bg-[#060b14]/80 p-5 ring-1 ring-white/5"
              >
                <div className="flex flex-wrap items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-black text-amber-50">{item.title}</h3>
                      <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-200/90">
                        {item.badge}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-300">{item.description}</p>
                    <ul className="mt-3 space-y-1">
                      {item.tips.map((tip) => (
                        <li key={tip} className="flex items-start gap-2 text-xs font-medium text-slate-400">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-400/80" aria-hidden />
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 py-3 text-sm font-black text-[#0a0f1a] shadow-lg transition hover:brightness-110"
        >
          فهمت — العودة للعمل
        </button>
      </div>
    </div>
  );
}
