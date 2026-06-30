'use client'

import {
  CLIENT_DNA_ACTIVITY_OPTIONS,
  CLIENT_DNA_INTEREST_SUGGESTIONS,
  formatDnaInterests,
  parseDnaInterests,
  type ClientDnaAdvancedFields,
} from '@/lib/clientsTravelDna'

const FIELD =
  'w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#001f3f]/40 focus:ring-2 focus:ring-[#d4af37]/45 [color-scheme:light]'

type ClientDnaAdvancedFieldsProps = {
  value: ClientDnaAdvancedFields
  onChange: (next: ClientDnaAdvancedFields) => void
  fieldClassName?: string
}

function toggleInterest(current: string, tag: string): string {
  const list = parseDnaInterests(current)
  const norm = tag.trim()
  if (!norm) return current
  const exists = list.some((x) => x === norm)
  const next = exists ? list.filter((x) => x !== norm) : [...list, norm]
  return formatDnaInterests(next)
}

/** حقول DNA المتقدم — للنماذج */
export default function ClientDnaAdvancedFieldsEditor({
  value,
  onChange,
  fieldClassName = FIELD,
}: ClientDnaAdvancedFieldsProps) {
  const selected = parseDnaInterests(value.dna_interests)

  return (
    <div dir="rtl" className="space-y-4 rounded-2xl border border-[#d4af37]/15 bg-stone-50/60 p-4">
      <p className="text-xs font-black text-[#001f3f]">🧬 DNA متقدم — Solo · Groups · Leaders</p>

      <label className="block">
        <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">اهتمامات السفر</span>
        <input
          value={value.dna_interests}
          onChange={(e) => onChange({ ...value, dna_interests: e.target.value })}
          placeholder="التسوق، العيادات، الفعاليات… (افصل بفاصلة)"
          className={fieldClassName}
          dir="rtl"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {CLIENT_DNA_INTEREST_SUGGESTIONS.map((tag) => {
            const active = selected.includes(tag)
            return (
              <button
                key={tag}
                type="button"
                onClick={() => onChange({ ...value, dna_interests: toggleInterest(value.dna_interests, tag) })}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
                  active
                    ? 'border-[#001f3f] bg-[#001f3f] text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-[#d4af37]/50'
                }`}
              >
                {tag}
              </button>
            )
          })}
        </div>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">مستوى النشاط</span>
        <select
          value={value.dna_activity_level}
          onChange={(e) => onChange({ ...value, dna_activity_level: e.target.value })}
          className={fieldClassName}
        >
          <option value="">— لم يحدد —</option>
          {CLIENT_DNA_ACTIVITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">طلبات خاصة</span>
        <textarea
          value={value.dna_special_requests}
          onChange={(e) => onChange({ ...value, dna_special_requests: e.target.value })}
          placeholder="ملاحظات خاصة للفريق: غرف متصلة، مواعيد طبية، إلخ…"
          rows={3}
          className={`${fieldClassName} resize-y`}
          dir="rtl"
        />
      </label>
    </div>
  )
}
