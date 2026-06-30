'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

import { formatWardrobePrice, wardrobeItemCode } from '@/lib/format-wardrobe-price';
import { resolveAgencyWhatsAppDigits } from '@/lib/vip-agency-whatsapp';
import type { PublicItinerary } from '@/lib/public-itinerary';

const WARDROBE_PLACEHOLDER =
  'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=800&auto=format&fit=crop';

function VipGoldHangerIcon({ active, className = '' }: { active?: boolean; className?: string }) {
  const stroke = active ? '#D4AF37' : '#9CA3AF';
  return (
    <svg
      className={className || 'h-5 w-5'}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M12 3.5a2.25 2.25 0 1 1 0 4.5 2.25 2.25 0 0 1 0-4.5Z"
        stroke={stroke}
        strokeWidth="1.6"
      />
      <path
        d="M5.25 11.25 12 7.5l6.75 3.75"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.25 11.25v1.75h13.5v-1.75"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Props = {
  itinerary: PublicItinerary;
  wardrobeItems: Record<string, unknown>[] | null | undefined;
};

function FashionFallback({ message }: { message?: string }) {
  return (
    <div className="col-span-full rounded-2xl border border-dashed border-[#D4AF37]/30 bg-[#FAFAFA] p-8 text-center">
      <VipGoldHangerIcon active className="mx-auto mb-4 h-10 w-10 opacity-40" />
      <p className="text-sm font-semibold text-gray-500">
        {message ?? 'جاري تجهيز تفضيلات الأزياء الخاصة بك...'}
      </p>
    </div>
  );
}

class FashionErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[VipClientFashionTab]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return <FashionFallback />;
    }
    return this.props.children;
  }
}

function FashionGrid({
  itinerary,
  wardrobeItems,
}: {
  itinerary: PublicItinerary;
  wardrobeItems: Record<string, unknown>[];
}) {
  const destination = String(itinerary?.destination ?? '').trim() || 'وجهتك';
  const whatsappPhone = resolveAgencyWhatsAppDigits() || '966544948640';
  const safeItems = Array.isArray(wardrobeItems) ? wardrobeItems : [];

  if (safeItems.length === 0) {
    return (
      <p className="col-span-full py-16 text-center text-sm font-semibold text-gray-600">
        لا توجد قطع مناسبة لوجهتك ({destination}) حالياً.
      </p>
    );
  }

  return (
    <>
      {safeItems.map((item, index) => {
        if (!item || typeof item !== 'object') return null;

        const id = String(item?.id ?? `wardrobe-${index}`);
        const itemCode = wardrobeItemCode(id || `w-${index}`);
        const title = String(item?.name ?? item?.title ?? 'قطعة').trim() || 'قطعة';
        const description = String(item?.material ?? item?.description ?? '').trim();
        const imageRaw = item?.image_url;
        const hasImage =
          typeof imageRaw === 'string' && imageRaw.trim().length > 0;
        const imageUrl = hasImage ? String(imageRaw).trim() : WARDROBE_PLACEHOLDER;
        const priceLabel = formatWardrobePrice(item?.price);
        const waText = encodeURIComponent(
          `مرحباً، أود طلب قطعة الأزياء رمز (${itemCode}) - ${title} لرحلتي`,
        );

        return (
          <div
            key={id}
            className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#D4AF37]/30 bg-[#1E2720] shadow-[0_12px_40px_rgba(30,39,32,0.18)] transition hover:border-[#D4AF37]/50"
          >
            <div className="relative h-64 w-full shrink-0 bg-[#1E2720]">
              <span className="absolute start-3 top-3 z-10 rounded-md border border-[#D4AF37]/25 bg-[#1E2720]/90 px-2 py-1 text-[10px] font-bold tracking-wide text-[#D4AF37]/80 backdrop-blur-sm">
                كود القطعة: {itemCode}
              </span>
              {hasImage ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#1E2720]">
                  <VipGoldHangerIcon active className="h-10 w-10 opacity-40" />
                </div>
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1E2720]/85 via-transparent to-transparent" />
            </div>
            <div className="flex flex-1 flex-col p-6">
              <div className="flex-grow">
                <h3 className="mb-2 text-xl font-black tracking-tight text-white">{title}</h3>
                {description ? (
                  <p className="text-sm leading-relaxed text-white/55">{description}</p>
                ) : null}
              </div>
              <div className="mt-auto flex flex-col gap-4 pt-4">
                <span className="text-base font-black text-[#D4AF37]">{priceLabel}</span>
                <a
                  href={`https://wa.me/${whatsappPhone}?text=${waText}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full rounded-lg bg-[#D4AF37] px-4 py-2.5 text-center text-sm font-black text-[#1E2720]"
                >
                  اطلب القطعة عبر الواتساب
                </a>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

export default function VipClientFashionTab({ itinerary, wardrobeItems }: Props) {
  if (!itinerary?.showFashionServices) {
    return <FashionFallback message="جاري تجهيز تفضيلات الأزياء الخاصة بك..." />;
  }

  const items = Array.isArray(wardrobeItems) ? wardrobeItems : [];

  return (
    <FashionErrorBoundary>
      <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-3">
        <FashionGrid itinerary={itinerary} wardrobeItems={items} />
      </div>
    </FashionErrorBoundary>
  );
}
