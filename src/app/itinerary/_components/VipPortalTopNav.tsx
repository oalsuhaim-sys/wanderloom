'use client';

import { Map, Shirt } from 'lucide-react';

export type PortalSection = 'itinerary' | 'wardrobe';

type VipPortalTopNavProps = {
  active: PortalSection;
  onChange: (section: PortalSection) => void;
  /** عند false يُخفى تبويب أزياء السفر */
  showWardrobe?: boolean;
};

const SECTIONS: { id: PortalSection; label: string; Icon: typeof Map; emoji?: string }[] = [
  { id: 'itinerary', label: 'مسار الرحلة', Icon: Map },
  { id: 'wardrobe', label: 'أزياء السفر', Icon: Shirt, emoji: '👕' },
];

export default function VipPortalTopNav({ active, onChange, showWardrobe = true }: VipPortalTopNavProps) {
  const visibleSections = showWardrobe
    ? SECTIONS
    : SECTIONS.filter((s) => s.id !== 'wardrobe');

  if (visibleSections.length <= 1) return null;

  return (
    <nav
      className="sticky top-0 z-30 -mt-4 mb-6 px-1"
      aria-label="تنقل بوابة العميل"
    >
      <div className="mx-auto flex max-w-lg rounded-2xl border border-[#D4AF37]/30 bg-[#2A362C]/90 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md sm:max-w-xl">
        {visibleSections.map(({ id, label, Icon, emoji }) => {
          const selected = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-current={selected ? 'page' : undefined}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-black transition-all duration-200 ${
                selected
                  ? 'bg-[#D4AF37] text-[#1E2720] shadow-[0_0_18px_rgba(212,175,55,0.35)]'
                  : 'text-white/70 hover:bg-[#D4AF37]/10 hover:text-[#D4AF37]'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={selected ? 2.25 : 2} aria-hidden />
              <span>{label}</span>
              {emoji ? <span aria-hidden>{emoji}</span> : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
