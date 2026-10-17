'use client';

/** زر تثبيت PWA في الشريط الجانبي — يوجّه للتثبيت من قائمة المتصفح. */
export function CrmPwaInstallWidget() {
  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => {
          alert(
            'يمكنك تثبيت النظام فوراً بالضغط على خيارات المتصفح (⋮) ثم اختيار "تثبيت التطبيق" أو "إضافة للشاشة الرئيسية".',
          );
        }}
        className="w-full rounded-2xl border border-slate-800 bg-[#1B242F] px-5 py-3 text-center text-xs font-bold text-white shadow-sm transition-all hover:bg-[#111827]"
      >
        تثبيت النظام على الجهاز
      </button>
    </div>
  );
}
