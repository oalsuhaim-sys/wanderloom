'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { PremiumInteractiveQuotation } from '@/app/quote/[id]/PremiumInteractiveQuotation';
import type { QuotationRow } from '@/lib/crm-quotations';
import { mapQuotationRow } from '@/lib/crm-quotations';
import {
  createEmptyHotelOption,
  createEmptyTransportOption,
  type QuotationHotelOption,
  type QuotationTransportOption,
} from '@/lib/interactive-quotation';

/** If brochure JSONB empty, lift legacy proposals into selectable options */
function hydrateBrochureFromLegacy(row: QuotationRow): QuotationRow {
  let hotel_options = row.hotel_options;
  let transport_options = row.transport_options;
  let cost_breakdown = row.cost_breakdown;

  if (hotel_options.length === 0 && row.hotel_proposals.length > 0) {
    hotel_options = row.hotel_proposals
      .filter((h) => h.hotel_name || h.city)
      .map(
        (h): QuotationHotelOption => ({
          id: h.id || createEmptyHotelOption().id,
          city: h.city,
          name: h.hotel_name,
          description: h.room_type || '',
          price: Number(h.price) || 0,
          is_selected_by_client: false,
        }),
      );
  }

  if (transport_options.length === 0 && row.transport_proposals.length > 0) {
    transport_options = row.transport_proposals
      .filter((t) => t.description || t.mode)
      .map(
        (t): QuotationTransportOption => ({
          id: t.id || createEmptyTransportOption().id,
          name: t.mode || t.description,
          description:
            t.mode && t.description && t.mode !== t.description ? t.description : '',
          price: Number(t.price) || 0,
          is_selected_by_client: false,
        }),
      );
  }

  if (cost_breakdown.length === 0 && row.service_fee > 0) {
    cost_breakdown = [
      {
        id: 'legacy-fee',
        item_name: 'رسوم الخدمة',
        price: row.service_fee,
      },
    ];
  }

  return { ...row, hotel_options, transport_options, cost_breakdown };
}

function coerceQuotation(payload: unknown): QuotationRow | null {
  if (!payload || typeof payload !== 'object') return null;
  const row = payload as QuotationRow;
  // Already mapped server-side QuotationRow
  if (row.id && Array.isArray(row.hotel_options)) {
    return hydrateBrochureFromLegacy(row);
  }
  try {
    return hydrateBrochureFromLegacy(mapQuotationRow(payload as Record<string, unknown>));
  } catch {
    return null;
  }
}

/** Public client brochure — no CRM shell, no login required */
export default function PublicProposalPage() {
  const params = useParams();
  const rawQuoteId = params?.id ?? (params as { quoteId?: string | string[] })?.quoteId;
  const quoteId = Array.isArray(rawQuoteId) ? rawQuoteId[0] : rawQuoteId;

  const [quotation, setQuotation] = useState<QuotationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [fetchDebug, setFetchDebug] = useState<{
    quoteId: string | undefined;
    status?: number;
    body?: unknown;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setFetchDebug(null);
      setErrorDetail(null);

      if (!quoteId) {
        if (!cancelled) {
          setFetchDebug({ quoteId: undefined });
          setQuotation(null);
          setLoading(false);
        }
        return;
      }

      try {
        const res = await fetch(`/api/proposals/${encodeURIComponent(quoteId)}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        const body = (await res.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
          quotation?: unknown;
          row?: unknown;
        } | null;

        if (cancelled) return;

        setFetchDebug({ quoteId, status: res.status, body });

        if (!res.ok || !body?.ok) {
          setErrorDetail(body?.error || `HTTP ${res.status}`);
          setQuotation(null);
          setLoading(false);
          return;
        }

        const mapped = coerceQuotation(body.quotation ?? body.row);
        if (!mapped) {
          setErrorDetail('تعذر قراءة بيانات العرض');
          setQuotation(null);
          setLoading(false);
          return;
        }

        setQuotation(mapped);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setErrorDetail(err instanceof Error ? err.message : 'تعذر فتح العرض');
        setFetchDebug({
          quoteId,
          body: { message: err instanceof Error ? err.message : String(err) },
        });
        setQuotation(null);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [quoteId]);

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-[#FDFBF7]"
        dir="rtl"
      >
        <Loader2 className="h-8 w-8 animate-spin text-[#b8954d]" aria-hidden />
      </div>
    );
  }

  if (!quotation) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#FDFBF7] px-6 text-center"
        dir="rtl"
      >
        <p className="font-serif text-2xl text-[#243223]">تعذر فتح العرض</p>
        <p className="text-sm text-slate-500">الرابط غير صالح أو العرض غير متاح.</p>
        {errorDetail ? (
          <p className="max-w-md text-xs font-semibold text-slate-400">{errorDetail}</p>
        ) : null}
        {process.env.NODE_ENV === 'development' && fetchDebug ? (
          <pre className="mt-4 max-w-lg overflow-auto rounded-lg bg-slate-900 p-3 text-start text-[10px] text-amber-200">
            {JSON.stringify(fetchDebug, null, 2)}
          </pre>
        ) : null}
      </div>
    );
  }

  return <PremiumInteractiveQuotation quotation={quotation} />;
}
