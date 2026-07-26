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
      className={`flex flex-wrap items-center gap-2.5 ${className}`}
      role="tablist"
      aria-label="تصفية العملاء"
    >
      {CONTACT_TABS.map((tab) => {
        const active = activeTab === tab.id
        const count = counts?.[tab.id]
        const label = tab.emoji ? `${tab.label} ${tab.emoji}` : tab.label

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all duration-200 sm:px-6 ${
              active
                ? 'bg-[#1c3d27] text-white shadow-md ring-1 ring-[#D4AF37]/25'
                : 'border border-stone-200/90 bg-white/90 text-[#1c3d27]/80 shadow-sm hover:border-[#D4AF37]/40 hover:bg-white hover:text-[#1c3d27] hover:shadow'
            }`}
          >
            <span>{label}</span>
            {typeof count === 'number' ? (
              <span
                className={`min-w-[1.25rem] rounded-full px-2 py-0.5 text-center text-[10px] font-black ${
                  active ? 'bg-white/20 text-white' : 'bg-[#1c3d27]/10 text-[#1c3d27]'
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
