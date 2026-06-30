'use client';

import { Stethoscope, Video } from 'lucide-react';

import { formatPreTripServiceDatetime, type PreTripService } from '@/lib/public-itinerary';

const MEDICAL_KEYWORDS =
  /طب|طبي|استشارة|كوري|عيادة|clinic|medical|consult|doctor|دكتور|korean/i;

function isMedicalService(service: PreTripService): boolean {
  const blob = `${service.title} ${service.note}`.trim();
  return MEDICAL_KEYWORDS.test(blob);
}

function normalizeUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

type Props = {
  services: PreTripService[];
};

export default function VipMedicalConciergeBanner({ services }: Props) {
  const medical = services.filter(isMedicalService);
  if (!medical.length) return null;

  const primary = medical[0];
  const clinicName = primary.title.trim() || 'الاستشارة الطبية الكورية';
  const appt = formatPreTripServiceDatetime(primary.datetime);
  const zoomUrl = normalizeUrl(primary.location_url);
  const phone = primary.phone?.trim();

  return (
    <section className="relative mb-6 overflow-hidden rounded-2xl border border-sky-400/40 bg-gradient-to-br from-sky-950/90 to-[#1E2720] p-5 shadow-[0_0_20px_rgba(56,189,248,0.2)]">
      <div className="mb-3 flex items-center gap-2">
        <Stethoscope className="h-5 w-5 text-sky-300" aria-hidden />
        <h2 className="text-base font-black text-sky-100">Medical Concierge · الكونسيرج الطبي</h2>
      </div>
      <p className="text-lg font-bold text-white">{clinicName}</p>
      {appt ? <p className="mt-2 text-sm font-semibold text-sky-200/90">🕐 {appt}</p> : null}
      {primary.note?.trim() ? (
        <p className="mt-2 text-sm text-white/70">{primary.note.trim()}</p>
      ) : null}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {zoomUrl ? (
          <a
            href={zoomUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-4 py-3 text-sm font-black text-[#1E2720]"
          >
            <Video className="h-4 w-4" aria-hidden />
            دخول اجتماع الاستشارة
          </a>
        ) : null}
        {phone ? (
          <a
            href={`tel:${phone.replace(/\s+/g, '')}`}
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-sky-300/50 bg-sky-900/50 px-4 py-3 text-sm font-bold text-sky-100"
            dir="ltr"
          >
            {phone}
          </a>
        ) : null}
      </div>
    </section>
  );
}

export function filterNonMedicalPreTripServices(services: PreTripService[]): PreTripService[] {
  return services.filter((s) => !isMedicalService(s));
}
