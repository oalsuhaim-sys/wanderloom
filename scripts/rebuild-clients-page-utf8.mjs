import fs from 'node:fs'

const p = new URL('../src/app/crm/clients/page.tsx', import.meta.url)

/** @type {[string, string][]} */
const rep = [
  ['?نظام الولاء? ?نظام الولاء', 'قاعدة العملاء ونظام الولاء'],
  [
    '?نظام الولاء?? ????نظام الولاء? تعديل?نظام الولاء تعديل?? ? ?? ??? ??? DNA تعديل?? ??? ????.',
    'شرائح العملاء، إحصائيات الرحلات والإحالات، وأكواد الإحالة — مع ملف الـ DNA السياحي لكل عميل.',
  ],
  [
    'placeholder="??? ???نظام الولاء?? ??? ????نظام الولاء? ?? تعديلتعديل"',
    'placeholder="بحث بالاسم، الشريحة، كود الإحالة، الهاتف، أو التفضيلات…"',
  ],
  ['???? تعديل ?نظام الولاء??', 'جاري تحميل قاعدة العملاء…'],
  ['?? ???? ?نظام الولاء تعديل.', 'لا توجد نتائج مطابقة للبحث.'],
  ['?? نظام الولاء تعديل', 'لا توجد بيانات اتصال'],
  ['??? ?نظام الولاء ?', 'فتح الملف الكامل ←'],
  ['?نظام الولاء تعديل?', 'تعديل بيانات العميل'],
  ['تعديل تعديل ?? full_name ? name ?? ??نظام الولاء', 'يُحفظ الاسم في full_name و name مع بيانات الولاء'],
  ['?نظام الولاء *', 'الاسم الكامل *'],
  ['??نظام الولاء??', 'الولاء والشرائح'],
  ['تعديل??', 'الشريحة'],
  ['??? تعديل?', 'رقم الهاتف'],
  ['??نظام الولاء????', 'البريد الإلكتروني'],
  ['كود الإحالة??', 'حفظ التعديلات'],
  ['??? تعديل?', 'حفظ العميل'],
  [
    'Supabase ??? ????. ???? ?? ????? NEXT_PUBLIC_SUPABASE_URL ? NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    'Supabase غير متصل. تأكد من إعداد NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY.',
  ],
  ["err.message || '???? ????? ???????.'", "err.message || 'تعذر تحميل العملاء.'"],
  [
    "'تعذر الحفظ — تأكد من أعمدة الولاء (client_tier، total_trips، referrals_count، referral_code) و full_name في Supabase.'",
    "'تعذر الحفظ — تأكد من أعمدة الولاء (client_tier، total_trips، referrals_count، referral_code) و full_name في Supabase.'",
  ],
  ['نظام الولاء', 'جاري الحفظ…'], // saving spinner text - fix below separately
]

let s = fs.readFileSync(p, 'utf8')
for (const [a, b] of rep) {
  if (!s.includes(a)) console.warn('skip:', JSON.stringify(a.slice(0, 60)))
  else s = s.split(a).join(b)
}

// Fix saving loader - only inside Loader2 block
s = s.replace(
  /<Loader2 className="h-4 w-4 animate-spin" aria-hidden \/>\s*\n\s*نظام الولاء/,
  '<Loader2 className="h-4 w-4 animate-spin" aria-hidden />\n                    جاري الحفظ…',
)

// Fix cancel button (was wrongly إلغاء from تعديل map) - last modal footer secondary button
s = s.replace(
  /disabled={saving}\s*className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-3.5 text-sm font-bold text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"\s*>\s*تعديل\s*<\/button>\s*<\/div>\s*<\/div>\s*<\/motionless>/,
  'disabled={saving}\n                className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-3.5 text-sm font-bold text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"\n              >\n                إلغاء\n              </button>\n            </div>\n          </div>\n        </motionless>',
)

// Emojis
if (s.includes('<span aria-hidden>??</span>')) {
  s = s.replace('<span aria-hidden>??</span>', "<span aria-hidden>{'\\u2708\\uFE0F'}</span>")
  s = s.replace('<span aria-hidden>??</span>', "<span aria-hidden>{'\\uD83E\\uDD1D'}</span>")
}

// Form labels that still say كود الإحالة for trip counts
s = s.replace(
  /<span className="mb-1.5 block text-xs font-bold text-\[#001f3f\]">كود الإحالة<\/span>\s*<input\s*type="number"\s*min=\{0\}\s*value=\{form\.total_trips\}/,
  '<span className="mb-1.5 block text-xs font-bold text-[#001f3f]">عدد الرحلات</span>\n                    <input\n                      type="number"\n                      min={0}\n                      value={form.total_trips}',
)
s = s.replace(
  /<span className="mb-1.5 block text-xs font-bold text-\[#001f3f\]">كود الإحالة\?<\/span>\s*<input\s*type="number"\s*min=\{0\}\s*value=\{form\.referrals_count\}/,
  '<span className="mb-1.5 block text-xs font-bold text-[#001f3f]">عدد الإحالات</span>\n                    <input\n                      type="number"\n                      min={0}\n                      value={form.referrals_count}',
)

fs.writeFileSync(p, s, 'utf8')
console.log('ok', s.includes('قاعدة العملاء'))
