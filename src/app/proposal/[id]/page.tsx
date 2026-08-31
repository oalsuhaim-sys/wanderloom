'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { PremiumInteractiveQuotation } from '@/app/quote/[id]/PremiumInteractiveQuotation';
import { supabase } from '@/lib/supabase';
import {
  mapQuotationRow,
  PUBLIC_QUOTATION_SELECT,
  type QuotationRow,
} from '@/lib/crm-quotations';
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

/** Public client brochure — no CRM shell, no login required */
export default function PublicProposalPage() {
  const params = useParams();
  const rawQuoteId = params?.id ?? (params as { quoteId?: string | string[] })?.quoteId;
  const quoteId = Array.isArray(rawQuoteId) ? rawQuoteId[0] : rawQuoteId;

  const [quotation, setQuotation] = useState<QuotationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchDebug, setFetchDebug] = useState<{
    quoteId: string | undefined;
    supabaseError: unknown;
    rawData: unknown;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setFetchDebug(null);

      if (!quoteId) {
        if (!cancelled) {
          setFetchDebug({ quoteId: undefined, supabaseError: null, rawData: null });
          setQuotation(null);
          setLoading(false);
        }
        return;
      }

      if (!supabase) {
        if (!cancelled) {
          setFetchDebug({
            quoteId,
            supabaseError: { message: 'Supabase client is not configured.' },
            rawData: null,
          });
          setQuotation(null);
          setLoading(false);
        }
        return;
      }

      let quotationData: Record<string, unknown> | null = null;
      let supabaseError: { message?: string } | null = null;

      const primary = await supabase
        .from('quotations')
        .select(PUBLIC_QUOTATION_SELECT)
        .eq('id', quoteId)
        .single();

      if (!primary.error && primary.data) {
        quotationData = primary.data as Record<string, unknown>;
      } else {
        supabaseError = primary.error;
        const fallback = await supabase
          .from('quotations')
          .select('*, clients(*)')
          .eq('id', quoteId)
          .single();
        if (!fallback.error && fallback.data) {
          quotationData = fallback.data as Record<string, unknown>;
          supabaseError = null;
        } else if (fallback.error) {
          supabaseError = fallback.error;
        }
      }

      if (cancelled) return;

      setFetchDebug({
        quoteId,
        supabaseError,
        rawData: quotationData,
      });

      if (supabaseError || !quotationData) {
        setQuotation(null);
        setLoading(false);
        return;
      }

      const mapped = hydrateBrochureFromLegacy(
        mapQuotationRow(quotationData as Record<string, unknown>),
      );
      setQuotation(mapped);
      setLoading(false);
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
