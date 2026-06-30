import fs from 'node:fs'

const p = new URL('../src/app/crm/clients/page.tsx', import.meta.url)
let s = fs.readFileSync(p, 'utf8')

s = s.replace(
  /<span className="mb-1\.5 block text-xs font-bold text-\[#001f3f\]">كود الإحالة<\/span>\s*<input\s*type="number"\s*min=\{0\}\s*value=\{form\.total_trips\}/,
  '<span className="mb-1.5 block text-xs font-bold text-[#001f3f]">عدد الرحلات</span>\n                    <input\n                      type="number"\n                      min={0}\n                      value={form.total_trips}',
)

s = s.replace(
  /<span className="mb-1\.5 block text-xs font-bold text-\[#001f3f\]">كود الإحالة\?<\/span>\s*<input\s*type="number"\s*min=\{0\}\s*value=\{form\.referrals_count\}/,
  '<span className="mb-1.5 block text-xs font-bold text-[#001f3f]">عدد الإحالات</span>\n                    <input\n                      type="number"\n                      min={0}\n                      value={form.referrals_count}',
)

s = s.replace("'كود الإحالة??'", "'حفظ التعديلات'")

s = s.replace(
  /<Pencil className="h-3\.5 w-3\.5 text-\[#d4af37\]" aria-hidden \/>\s*\n\s*إلغاء\s*\n\s*<\/button>\s*\n\s*<\/div>\s*\n\s*<\/article>/,
  '<Pencil className="h-3.5 w-3.5 text-[#d4af37]" aria-hidden />\n                    تعديل\n                  </button>\n                </div>\n              </article>',
)

fs.writeFileSync(p, s, 'utf8')
console.log('done')
