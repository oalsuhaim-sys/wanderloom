import fs from 'node:fs'

const AR = {
  loyalty: 'نظام الولاء',
  title: 'قاعدة العملاء ونظام الولاء',
  subtitle:
    'شرائح العملاء، إحصائيات الرحلات والإحالات، وأكواد الإحالة — مع ملف الـ DNA السياحي لكل عميل.',
  addBtn: 'إضافة عميل جديد',
  searchPh: 'بحث بالاسم، الشريحة، كود الإحالة، الهاتف، أو التفضيلات…',
  count: (f, t) => `${f} من ${t} عميل`,
  loading: 'جاري تحميل قاعدة العملاء…',
  empty: 'لا يوجد عملاء بعد — أضف أول عميل من الزر أعلاه.',
  noMatch: 'لا توجد نتائج مطابقة للبحث.',
  noContact: 'لا توجد بيانات اتصال',
  trips: 'عدد الرحلات',
  referrals: 'عدد الإحالات',
  refCode: 'كود الإحالة',
  copyRef: 'نسخ كود الإحالة',
  noRef: 'لا يوجد كود إحالة',
  openProfile: 'فتح الملف الكامل ←',
  edit: 'تعديل',
  editTitle: 'تعديل بيانات العميل',
  addTitle: 'إضافة عميل جديد',
  modalHint: 'يُحفظ الاسم في full_name و name مع بيانات الولاء',
  close: 'إغلاق',
  fullName: 'الاسم الكامل *',
  loyaltySection: 'الولاء والشرائح',
  tier: 'الشريحة',
  phone: 'رقم الهاتف',
  email: 'البريد الإلكتروني',
  saving: 'جاري الحفظ…',
  saveEdit: 'حفظ التعديلات',
  saveNew: 'حفظ العميل',
  cancel: 'إلغاء',
}

const ui = `  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-[#F6F4F0] via-[#FAF8F4] to-[#EDE8DD] pb-16 font-sans">
      <div className="mx-auto max-w-7xl px-4 pt-2 sm:px-6">
        <header className="mb-8 rounded-3xl border border-[#d4af37]/25 bg-gradient-to-br from-white via-white to-amber-50/50 p-8 shadow-[0_24px_64px_-28px_rgba(0,31,63,0.35)]">
          <motionless className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-2">
              <p className="inline-flex items-center gap-2 rounded-full border border-[#d4af37]/40 bg-[#001f3f]/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#001f3f]">
                <Crown className="h-3.5 w-3.5 text-[#d4af37]" aria-hidden />
                ${AR.loyalty}
              </p>
              <h1 className="text-3xl font-black tracking-tight text-[#001f3f] md:text-[2rem]">
                ${AR.title}
              </h1>
              <p className="max-w-lg text-sm font-semibold leading-relaxed text-slate-600">
                ${AR.subtitle}
              </p>
            </div>
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#001f3f] px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-[#001f3f]/20 transition hover:bg-[#002a55] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:ring-offset-2"
            >
              <Plus className="h-5 w-5 text-[#d4af37]" aria-hidden />
              ${AR.addBtn}
            </button>
          </div>
        </header>
`

console.log('fragment start only - extend in page merge')
