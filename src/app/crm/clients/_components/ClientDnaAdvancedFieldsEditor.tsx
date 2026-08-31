'use client'

import {
  CLIENT_DNA_ACTIVITY_OPTIONS,
  CLIENT_DNA_INTEREST_SUGGESTIONS,
  formatDnaInterests,
  parseDnaInterests,
  type ClientDnaAdvancedFields,
} from '@/lib/clientsTravelDna'

const FIELD =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#D4AF37]/50 focus:ring-2 focus:ring-[#D4AF37]/30 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-gray-100 dark:placeholder:text-slate-500 dark:focus:border-[#D4AF37]/50'

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
    <div
      dir="rtl"
      className="space-y-4 rounded-xl border border-slate-200 bg-slate-100 p-4 text-slate-900 dark:border-[#2D3F3A] dark:bg-[#22302C] dark:text-white"
    >
      <p className="flex items-center gap-2 text-sm font-bold text-[#D4AF37]">
        <span className="inline-block select-none fill-none" aria-hidden>
          🧬
        </span>
        DNA متقدم — Solo · Groups · Leaders
      </p>

      <label className="block">
        <span className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
          اهتمامات السفر
        </span>
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
                onClick={() =>
                  onChange({ ...value, dna_interests: toggleInterest(value.dna_interests, tag) })
                }
                className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
                  active
                    ? 'border-[#D4AF37]/60 bg-[#D4AF37]/20 text-slate-900 dark:text-[#D4AF37]'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-[#D4AF37]/50 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-slate-300'
                }`}
              >
                {tag}
              </button>
            )
          })}
        </div>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
          مستوى النشاط
        </span>
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
        <span className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
          طلبات خاصة
        </span>
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
