'use client'

import type { ContactTabId } from '@/lib/crm-contacts'
import { CONTACT_TABS } from '@/lib/crm-contacts'

type ContactFilterTabsProps = {
  activeTab: ContactTabId
  onChange: (tab: ContactTabId) => void
  counts?: Partial<Record<ContactTabId, number>>
  className?: string
}

export default function ContactFilterTabs({
  activeTab,
  onChange,
  counts,
  className = '',
}: ContactFilterTabsProps) {
  return (
    <div
      dir="rtl"
      className={`flex flex-wrap items-center gap-2 ${className}`}
      role="tablist"
      aria-label="تصفية العملاء"
    >
      {CONTACT_TABS.map((tab) => {
        const active = activeTab === tab.id
        const count = counts?.[tab.id]
        const label = tab.label

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
              active
                ? 'bg-slate-900 text-white shadow-sm dark:border dark:border-[#D4AF37]/50 dark:bg-[#D4AF37]/20 dark:text-[#D4AF37]'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-[#22302C] dark:text-gray-300 dark:ring-[#2D3F3A] dark:hover:border-[#D4AF37]/30'
            }`}
          >
            <span>{label}</span>
            {typeof count === 'number' ? (
              <span
                className={`min-w-[1.25rem] rounded-full px-2 py-0.5 text-center text-xs font-medium ${
                  active
                    ? 'bg-white/15 text-white dark:bg-[#D4AF37]/15 dark:text-[#D4AF37]'
                    : 'bg-slate-50 text-slate-500 dark:bg-[#1A2421] dark:text-slate-400'
                }`}
              >
                {count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
