'use client';

import { CalendarDays, Luggage, Ticket } from 'lucide-react';

export type VipClientTab = 'itinerary' | 'bookings' | 'packing';

const TABS: { id: VipClientTab; label: string; Icon: typeof CalendarDays }[] = [
  { id: 'itinerary', label: 'المسار اليومي', Icon: CalendarDays },
  { id: 'bookings', label: 'الحجوزات', Icon: Ticket },
  { id: 'packing', label: 'حقيبة السفر والمالية', Icon: Luggage },
];

type Props = {
  activeTab: VipClientTab;
  onTabChange: (tab: VipClientTab) => void;
};

export default function VipClientTabNav({ activeTab, onTabChange }: Props) {
  return (
    <nav
      className="sticky top-0 z-20 border-b border-gray-200 bg-[#FDFBF7]/95 px-3 py-3 backdrop-blur-md sm:px-4"
      aria-label="تنقل الرحلة"
    >
      <div className="mx-auto flex max-w-lg gap-1.5 sm:max-w-xl sm:gap-2">
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              className={`flex flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2.5 transition sm:flex-row sm:gap-2 sm:px-4 sm:py-3 ${
                active
                  ? 'bg-[#1E2720] text-white shadow-md ring-2 ring-[#D4AF37]/50'
                  : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-[#D4AF37]/40'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${active ? 'text-[#D4AF37]' : 'text-gray-400'}`}
                aria-hidden
              />
              <span className="text-[10px] font-black leading-tight sm:text-xs">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
