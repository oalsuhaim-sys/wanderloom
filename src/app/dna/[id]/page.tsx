import { Suspense } from 'react';

import { fetchGroupLeadForDnaAction } from '@/app/actions/groupOnboardingActions';
import { GroupOnboardingDnaClient } from '@/app/dna/[id]/GroupOnboardingDnaClient';

export const metadata = {
  title: 'ملف DNA | Wanderloom',
  description: 'تعبئة ملف DNA لرحلة جماعية',
};

type Props = {
  params: Promise<{ id: string }>;
};

async function DnaPageContent({ params }: Props) {
  const { id } = await params;
  const result = await fetchGroupLeadForDnaAction(id);

  if (!result.ok) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F9F9F6] px-4" dir="rtl">
        <p className="text-center text-sm font-bold text-rose-700">{result.error}</p>
      </main>
    );
  }

  const lead = result.lead;
  const tripLabel = lead.destinations[0] ?? 'رحلة جماعية';

  return (
    <GroupOnboardingDnaClient
      leadId={lead.id}
      leadName={lead.full_name || 'ضيفنا'}
      leadPhone={lead.phone_wa}
      leadEmail={lead.email}
      tripLabel={tripLabel}
      initialInterests={lead.interests}
      initialPace={lead.daily_pace}
      initialFood={lead.food_preferences}
      initialNotes={lead.final_thoughts}
    />
  );
}

export default function GroupDnaPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#F9F9F6]" dir="rtl">
          <p className="text-sm font-bold text-gray-500">جاري التحميل…</p>
        </main>
      }
    >
      <DnaPageContent {...props} />
    </Suspense>
  );
}
