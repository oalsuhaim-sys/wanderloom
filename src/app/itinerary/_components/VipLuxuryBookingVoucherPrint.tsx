'use client';

import type { ReactNode } from 'react';

import { barcodeWidthsFromSeed } from '@/lib/vip-boarding-barcode';
import {
  buildVipFlightVoucherFields,
  hasVipFlightVoucherData,
  vipBoardingBarcodeCaption,
  vipFlightLineAny,
  type VipFlightDetails,
} from '@/lib/vip-flight-voucher';
import {
  formatTripDateRange,
  type PublicItinerary,
  type PublicItineraryHotel,
} from '@/lib/public-itinerary';

type Props = {
  trip: PublicItinerary;
  dateRange?: string | null;
};

/** يفرض محاذاة LTR للقيم الإنجليزية/الرقمية داخل جداول RTL */
function LtrValue({
  value,
  wrap,
}: {
  value: string | null | undefined;
  wrap?: boolean;
}) {
  const text = value?.trim() ?? '';
  if (!text || text === '—') {
    return <span className="vip-print-ltr inline-block text-[#1E2720]/40">—</span>;
  }
  const needsLtr = /[A-Za-z0-9]/.test(text) || /[→·\-/:]/.test(text);
  if (!needsLtr) return <>{text}</>;
  return (
    <span
      dir="ltr"
      className={`vip-print-ltr inline-block${wrap ? ' vip-print-ltr-wrap' : ''}`}
    >
      {text}
    </span>
  );
}

function VoucherBarcode({ seed, caption }: { seed: string; caption: string }) {
  const widths = barcodeWidthsFromSeed(seed);
  return (
    <div className="vip-print-barcode" aria-hidden>
      <div className="vip-print-barcode-bars">
        {widths.map((w, i) => (
          <div key={`${seed}-${i}`} className="vip-print-barcode-bar" style={{ width: w }} />
        ))}
      </div>
      <p className="vip-print-barcode-caption">
        <span dir="ltr" className="vip-print-ltr inline-block">
          {caption}
        </span>
      </p>
    </div>
  );
}

function FlightTable({
  fd,
  flightSummary,
}: {
  fd: VipFlightDetails;
  flightSummary: string | null;
}) {
  if (!hasVipFlightVoucherData(fd)) {
    if (flightSummary?.trim()) {
      return <p className="vip-print-muted">{flightSummary}</p>;
    }
    return (
      <p className="vip-print-muted">
        لم تُضف تفاصيل طيران منظّمة بعد — يتواصل معك الكونسيرج قبل السفر.
      </p>
    );
  }

  const f = buildVipFlightVoucherFields(fd);
  const pnr =
    vipFlightLineAny(fd, [
      'booking_reference',
      'pnr',
      'record_locator',
      'confirmation',
    ]) || f.barcodeSeed;

  return (
    <table className="vip-print-table" dir="rtl">
      <thead>
        <tr>
          <th>رقم الرحلة</th>
          <th>المسار</th>
          <th>المغادرة</th>
          <th>الوصول</th>
          <th>البوابة</th>
          <th>المقعد</th>
          <th>PNR</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <LtrValue value={f.flightNumber} />
          </td>
          <td>
            <LtrValue value={f.routeLabel} />
          </td>
          <td>
            <LtrValue value={f.departure} />
          </td>
          <td>
            <LtrValue value={f.arrival} />
          </td>
          <td>
            <LtrValue value={f.gate} />
          </td>
          <td>
            <LtrValue value={f.seat} />
          </td>
          <td>
            <LtrValue value={pnr} />
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function HotelTable({ hotels }: { hotels: PublicItineraryHotel[] }) {
  if (hotels.length === 0) {
    return (
      <p className="vip-print-muted">
        لا توجد فنادق مسجّلة في هذا المسار — راجع الكونسيرج للتأكيدات.
      </p>
    );
  }

  return (
    <table className="vip-print-table" dir="rtl">
      <thead>
        <tr>
          <th>اسم الفندق</th>
          <th>العنوان</th>
          <th>دخول</th>
          <th>خروج</th>
          <th>التأكيد</th>
        </tr>
      </thead>
      <tbody>
        {hotels.map((h) => (
          <tr key={h.id}>
            <td>{h.name}</td>
            <td>
              <LtrValue value={h.address || h.mapsQuery} wrap />
            </td>
            <td>
              <LtrValue value={h.checkIn} />
            </td>
            <td>
              <LtrValue value={h.checkOut} />
            </td>
            <td>
              <LtrValue value={h.bookingReference} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MetaCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="vip-print-client-cell">
      <span className="vip-print-label">{label}</span>
      <p className="vip-print-value">{children}</p>
    </div>
  );
}

/** وثيقة A4 للطباعة فقط — خارج أي عنصر print:hidden */
export default function VipLuxuryBookingVoucherPrint({ trip, dateRange }: Props) {
  const fd = trip.flightDetails as VipFlightDetails;
  const resolvedRange =
    dateRange ??
    (trip.startDate ? formatTripDateRange(trip.startDate, trip.endDate) : null);
  const flightSummary =
    (trip.flight_summary ?? trip.vipSummaries?.flight ?? '').trim() || null;
  const f = buildVipFlightVoucherFields(fd);
  const barcodeSeed = f.barcodeSeed;
  const pnrCaption = vipBoardingBarcodeCaption(
    fd,
    String(trip.magicLinkId ?? trip.id),
  );

  return (
    <div
      id="vip-luxury-booking-voucher-print"
      className="hidden bg-white text-black print:block print:w-full"
      dir="rtl"
      aria-hidden
    >
      <article className="vip-print-document">
        <header className="vip-print-header">
          <h1 className="vip-print-header-title">
            <span dir="ltr" className="vip-print-ltr inline-block">
              WANDERLOOM VIP
            </span>
            <span className="vip-print-header-sep"> — </span>
            وثيقة الحجوزات الرسمية
          </h1>
        </header>

        <div className="vip-print-body">
          <section className="vip-print-client-grid" aria-label="بيانات الضيف">
            <MetaCell label="اسم المسافر">{trip.customerName || '—'}</MetaCell>
            <MetaCell label="الوجهة">{trip.destination || '—'}</MetaCell>
            <MetaCell label="التواريخ">
              {resolvedRange ? <LtrValue value={resolvedRange} /> : '—'}
            </MetaCell>
            <MetaCell label="عنوان الرحلة">{trip.title || '—'}</MetaCell>
          </section>

          <section className="vip-print-section">
            <h2 className="vip-print-section-title">تفاصيل الطيران</h2>
            <FlightTable fd={fd} flightSummary={flightSummary} />
          </section>

          <section className="vip-print-section">
            <h2 className="vip-print-section-title">تفاصيل الفنادق</h2>
            <HotelTable hotels={trip.hotels} />
          </section>
        </div>

        <footer className="vip-print-footer">
          <VoucherBarcode seed={barcodeSeed} caption={pnrCaption} />
          <p className="vip-print-footer-note">
            وثيقة صادرة عن Wanderloom — للعرض عند المطار والفندق فقط.
          </p>
        </footer>
      </article>
    </div>
  );
}
