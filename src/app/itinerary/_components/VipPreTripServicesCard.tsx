import {
  formatPreTripServiceDatetime,
  type PreTripService,
} from '@/lib/public-itinerary';

type VipPreTripServicesCardProps = {
  services: PreTripService[];
};

function normalizeMapUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

export default function VipPreTripServicesCard({ services }: VipPreTripServicesCardProps) {
  if (!services.length) return null;

  return (
    <div className="relative mb-10 mt-4">
      <div className="mb-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#D4AF37]/50" />
        <h3 className="text-lg font-bold tracking-wide text-[#D4AF37]">
          ✨ هدايا وخدمات ما قبل السفر
        </h3>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#D4AF37]/50" />
      </div>

      <div className="space-y-4">
        {services.map((service, i) => {
          const mapHref = normalizeMapUrl(service.location_url);
          const datetimeLabel = formatPreTripServiceDatetime(service.datetime);

          return (
            <div
              key={`${service.title}-${i}`}
              className="relative overflow-hidden rounded-xl border border-[#D4AF37]/30 bg-white p-5 shadow-sm"
            >
              <div className="absolute right-0 top-0 h-full w-1.5 bg-[#D4AF37]/80" aria-hidden />

              <h4 className="mb-3 text-xl font-bold text-gray-900">{service.title}</h4>

              <div className="mb-3 grid grid-cols-1 gap-3 text-sm text-gray-600 md:grid-cols-2">
                {datetimeLabel ? (
                  <div className="flex items-center gap-2">
                    <span aria-hidden>🕒</span>
                    <span>{datetimeLabel}</span>
                  </div>
                ) : null}
                {service.phone?.trim() ? (
                  <div className="flex items-center gap-2">
                    <span aria-hidden>📞</span>
                    <a
                      href={`tel:${service.phone.trim().replace(/\s+/g, '')}`}
                      className="font-semibold transition hover:text-[#D4AF37]"
                      dir="ltr"
                    >
                      {service.phone.trim()}
                    </a>
                  </div>
                ) : null}
                {mapHref ? (
                  <div className="flex items-center gap-2 md:col-span-2">
                    <span aria-hidden>📍</span>
                    <a
                      href={mapHref}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-[#D4AF37] transition hover:underline"
                    >
                      عرض الموقع على الخريطة
                    </a>
                  </div>
                ) : null}
              </div>

              {service.note?.trim() ? (
                <p className="mt-3 rounded border-t border-gray-100 bg-gray-50/50 p-2 pt-3 text-sm text-gray-500">
                  {service.note.trim()}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
