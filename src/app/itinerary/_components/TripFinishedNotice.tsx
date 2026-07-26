'use client';

import { Sparkles } from 'lucide-react';

type TripFinishedNoticeProps = {
  destination: string;
  customerName: string;
  onOpenProfile?: () => void;
  showProfileButton?: boolean;
};

export default function TripFinishedNotice({
  destination,
  customerName,
  onOpenProfile,
  showProfileButton = false,
}: TripFinishedNoticeProps) {
  return (
    <section
      className="rounded-2xl border border-[#D4AF37]/25 bg-gradient-to-br from-[#FFFBF0] via-white to-[#FDFBF7] p-6 text-center shadow-sm"
      aria-label="انتهاء الرحلة"
    >
      <Sparkles className="mx-auto mb-3 h-7 w-7 text-[#D4AF37]" aria-hidden />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#D4AF37]/80">
        رحلة مكتملة
      </p>
      <h2 className="mt-2 text-xl font-black text-[#1E2720]">الحمد لله على السلامة</h2>
      <p className="mx-auto mt-3 max-w-sm text-sm font-semibold leading-relaxed text-gray-600">
        {customerName}، نتمنى أن تكون رحلتك إلى{' '}
        <span className="font-black text-[#1E2720]">{destination}</span> قد أسعدتك. المسار اليومي
        أُخفِي بعد انتهاء الرحلة — ويمكنك الوصول لمحفظتك عبر الملف الشخصي الخاص.
      </p>
      {showProfileButton && onOpenProfile ? (
        <button
          type="button"
          onClick={onOpenProfile}
          className="mt-5 inline-flex rounded-full bg-[#1E2720] px-6 py-2.5 text-sm font-black text-[#D4AF37] shadow-md transition hover:bg-black"
        >
          الملف الشخصي
        </button>
      ) : null}
    </section>
  );
}
