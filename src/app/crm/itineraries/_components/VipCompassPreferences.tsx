'use client';

import { MOCK_VIP_PREFERENCE_BADGES } from '@/lib/vip-builder-day-insights';

type Props = {
  badges?: readonly string[];
};

export default function VipCompassPreferences({
  badges = MOCK_VIP_PREFERENCE_BADGES,
}: Props) {
  return (
    <div className="mb-5 rounded-xl border border-[#D4AF37]/35 bg-gradient-to-l from-[#FAFAFA] via-white to-[#FAFAFA] px-4 py-3 shadow-sm">
      <p className="mb-2 text-xs font-black tracking-wide text-[#1E2720]">
        🎯 بوصلة تفضيلات الـ VIP
      </p>
      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => (
          <span
            key={badge}
            className="inline-flex items-center rounded-full border border-[#1E2720]/12 bg-white px-3 py-1.5 text-xs font-bold text-[#1E2720] shadow-sm"
          >
            {badge}
          </span>
        ))}
      </div>
    </div>
  );
}
