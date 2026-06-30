import fs from 'node:fs'

const p = new URL('../src/app/crm/clients/page.tsx', import.meta.url)
const AR = {
  loyalty: 'نظام الولاء',
  title: 'قاعدة العملاء ونظام الولاء',
  subtitle:
    'شرائح العملاء، إحصائيات الرحلات والإحالات، وأكواد الإحالة — مع ملف الـ DNA السياحي لكل عميل.',
  searchPh: 'بحث بالاسم، الشريحة، كود الإحالة، الهاتف، أو التفضيلات…',
  loading: 'جاري تحميل قاعدة العملاء…',
  empty: 'لا يوجد عملاء بعد — أضف أول عميل من الزر أعلاه.',
  noMatch: 'لا توجد نتائج مطابقة للبحث.',
  noContact: 'لا توجد بيانات اتصال',
  refCode: 'كود الإحالة',
  edit: 'تعديل',
  editTitle: 'تعديل بيانات العميل',
  modalHint: 'يُحفظ الاسم في full_name و name مع بيانات الولاء',
  trips: 'عدد الرحلات',
  referrals: 'عدد الإحالات',
  email: 'البريد الإلكتروني',
  saveEdit: 'حفظ التعديلات',
  saveNew: 'حفظ العميل',
}

/** @type {[string, string][]} */
const rep = [
  ['                جاري الحفظ…\n              </p>\n              <h1', `                ${AR.loyalty}\n              </p>\n              <h1`],
  ['                قاعدة العملاء وجاري الحفظ…', `                ${AR.title}`],
  [
    '                ?جاري الحفظ…?? ????جاري الحفظ…? إلغاء?جاري الحفظ… الشريحة ? ?? ??? ??? DNA الشريحة ??? ????.',
    `                ${AR.subtitle}`,
  ],
  [
    'placeholder="??? ?الولاء والشرائح ??? ????جاري الحفظ…? ?? الشريحة???"',
    `placeholder="${AR.searchPh}"`,
  ],
  ['???? إلغاء ?جاري الحفظ…??', AR.loading],
  ["? '?? ???? إلغاء ??? ? ??? ??? ???? ?? ???? إلغاء.'", `? '${AR.empty}'`],
  ["'?? ???? ?جاري الحفظ… إلغاء.'", `'${AR.noMatch}'`],
  ['?? جاري الحفظ… إلغاء', AR.noContact],
  ['??? الشريحة', AR.refCode],
  ['??? الشريحة?', AR.referrals],
  ['                    إلغاء\n                  </button>\n                </div>\n              </article>', `                    ${AR.edit}\n                  </button>\n                </div>\n              </article>`],
  ["{isEditing ? '?جاري الحفظ… إلغاء?' : 'إضافة عميل جديد'}", `{isEditing ? '${AR.editTitle}' : 'إضافة عميل جديد'}`],
  ['إلغاء إلغاء ?? full_name ? name ?? ??جاري الحفظ…', AR.modalHint],
  ['الولاء والشرائح??', AR.email],
  ["'??? الشريحة??'", `'${AR.saveEdit}'`],
  ["'رقم الهاتف'", `'${AR.saveNew}'`],
  ['<span className="mb-1.5 block text-xs font-bold text-[#001f3f]">??? الشريحة</span>\n                    <input\n                      type="number"\n                      min={0}\n                      value={form.total_trips}', `<span className="mb-1.5 block text-xs font-bold text-[#001f3f]">${AR.trips}</span>\n                    <input\n                      type="number"\n                      min={0}\n                      value={form.total_trips}`],
]

let s = fs.readFileSync(p, 'utf8')
for (const [a, b] of rep) {
  if (!s.includes(a)) console.warn('skip:', a.slice(0, 55).replace(/\n/g, ' '))
  else s = s.split(a).join(b)
}

fs.writeFileSync(p, s, 'utf8')
console.log('patched', s.includes(AR.title), s.includes(AR.loyalty))
