'use client';

import { Component, Suspense, type ErrorInfo, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';

import { normalizeQuotationId } from '@/lib/crm-quotations';

const QuoteBuilderForm = dynamic(
  () =>
    import('@/app/crm/quotations/_components/QuoteBuilderForm').then((m) => ({
      default: m.QuoteBuilderForm,
    })),
  {
    ssr: false,
    loading: () => <NewQuotationFallback label="جاري تحميل نموذج عرض السعر…" />,
  },
);

function firstSearchParam(searchParams: URLSearchParams, ...keys: string[]): string {
  try {
    for (const key of keys) {
      const value = String(searchParams.get(key) ?? '').trim();
      if (value) return value;
    }
  } catch (err) {
    console.warn('[NewQuotation] search param read:', err);
  }
  return '';
}

function NewQuotationFallback({ label = 'جاري تحميل الشاشة…' }: { label?: string }) {
  return (
    <div
      dir="rtl"
      className="mx-auto flex min-h-[50vh] max-w-4xl items-center justify-center gap-2 px-4 pb-10 font-black text-[#D4AF37]"
    >
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

class QuoteBuilderErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[NewQuotation] Safely caught render error:', error, info);
  }

  render() {
    if (this.state.error) {
      const detail = this.state.error.message?.trim() || 'خطأ غير متوقع أثناء تحميل النموذج';
      return (
        <div
          dir="rtl"
          className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center text-white"
        >
          <AlertCircle className="h-10 w-10 text-[#D4AF37]" aria-hidden />
          <p className="text-base font-bold">تعذّر تحميل نموذج عرض السعر</p>
          <p className="break-words font-mono text-xs text-slate-400">{detail}</p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="inline-flex items-center gap-2 rounded-lg border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-5 py-2.5 text-sm font-bold text-[#D4AF37]"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            إعادة المحاولة
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function NewQuotationContent() {
  const searchParams = useSearchParams();

  const editQuoteId = normalizeQuotationId(searchParams.get('edit'));
  const isEditMode = Boolean(editQuoteId);
  const fromLead =
    searchParams.get('from') === 'lead' ||
    Boolean(String(searchParams.get('leadId') ?? '').trim());
  const initialClientId = normalizeQuotationId(
    searchParams.get('clientId') ?? searchParams.get('client_id'),
  );
  const initialTripTitle = firstSearchParam(searchParams, 'tripTitle', 'title');
  const initialDestination = firstSearchParam(searchParams, 'destination', 'destinations');
  const initialStartDate = firstSearchParam(searchParams, 'startDate', 'start_date').slice(0, 10);
  const initialEndDate = firstSearchParam(searchParams, 'endDate', 'end_date').slice(0, 10);
  const initialClientName = firstSearchParam(searchParams, 'clientName', 'client_name');
  const initialLeadId = firstSearchParam(searchParams, 'leadId', 'lead_id');
  const lockClientFromDna = fromLead && Boolean(initialClientId);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 text-white sm:px-6" dir="rtl">
      <QuoteBuilderErrorBoundary>
        <QuoteBuilderForm
          editQuoteId={editQuoteId}
          isEditMode={isEditMode}
          prefillFromLead={fromLead && !isEditMode}
          initialLeadId={initialLeadId}
          initialClientId={initialClientId}
          lockClientFromDna={lockClientFromDna}
          initialClientName={initialClientName}
          initialTripTitle={initialTripTitle}
          initialDestination={initialDestination}
          initialStartDate={initialStartDate}
          initialEndDate={initialEndDate}
        />
      </QuoteBuilderErrorBoundary>
    </div>
  );
}

export default function NewQuotationClient() {
  return (
    <Suspense fallback={<NewQuotationFallback />}>
      <NewQuotationContent />
    </Suspense>
  );
}
