'use client';



import { Suspense } from 'react';

import { useSearchParams } from 'next/navigation';

import { Loader2 } from 'lucide-react';



import { normalizeQuotationId } from '@/lib/crm-quotations';

import { QuoteBuilderForm } from '@/app/crm/quotations/_components/QuoteBuilderForm';



function firstSearchParam(searchParams: URLSearchParams, ...keys: string[]): string {

  for (const key of keys) {

    const value = String(searchParams.get(key) ?? '').trim();

    if (value) return value;

  }

  return '';

}



function NewQuotationPageContent() {

  const searchParams = useSearchParams();

  const editQuoteId = normalizeQuotationId(searchParams.get('edit'));

  const isEditMode = Boolean(editQuoteId);

  const fromLead =

    searchParams.get('from') === 'lead' || Boolean(String(searchParams.get('leadId') ?? '').trim());

  const initialClientId = normalizeQuotationId(

    searchParams.get('clientId') ?? searchParams.get('client_id'),

  );

  const initialTripTitle = firstSearchParam(searchParams, 'tripTitle', 'title');

  const initialDestination = firstSearchParam(searchParams, 'destination', 'destinations');

  const initialStartDate = firstSearchParam(searchParams, 'startDate', 'start_date').slice(0, 10);

  const initialEndDate = firstSearchParam(searchParams, 'endDate', 'end_date').slice(0, 10);

  const initialClientName = firstSearchParam(searchParams, 'clientName', 'client_name');



  return (

    <QuoteBuilderForm

      editQuoteId={editQuoteId}

      isEditMode={isEditMode}

      prefillFromLead={fromLead && !isEditMode}

      initialLeadId={firstSearchParam(searchParams, 'leadId', 'lead_id')}

      initialClientId={initialClientId}

      lockClientFromDna={fromLead && Boolean(initialClientId)}

      initialClientName={initialClientName}

      initialTripTitle={initialTripTitle}

      initialDestination={initialDestination}

      initialStartDate={initialStartDate}

      initialEndDate={initialEndDate}

    />

  );

}



function NewQuotationPageFallback() {

  return (

    <div

      dir="rtl"

      className="mx-auto flex min-h-[50vh] max-w-4xl items-center justify-center gap-2 pb-10 font-black text-slate-500"

    >

      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />

      جاري التحميل…

    </div>

  );

}



export default function NewQuotationPage() {

  return (

    <Suspense fallback={<NewQuotationPageFallback />}>

      <NewQuotationPageContent />

    </Suspense>

  );

}

