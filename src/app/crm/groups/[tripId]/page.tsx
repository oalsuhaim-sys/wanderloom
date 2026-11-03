'use client';

import { useParams } from 'next/navigation';

import GroupTripManifestView from '@/app/crm/groups/_components/GroupTripManifestView';
import { ClientErrorBoundary } from '@/components/ClientErrorBoundary';

export default function GroupTripManifestPage() {
  const params = useParams();
  const tripId = String(params?.tripId ?? '').trim();

  return (
    <ClientErrorBoundary
      fallbackTitle="تعذّر تحميل كشف الرحلة الشامل"
      fallbackMessage="حدث خطأ أثناء عرض بيانات الرحلة. حدّث الصفحة أو تحقق من الصلاحيات."
    >
      <div className="min-h-screen bg-[#F6F4F0] p-6 font-sans sm:p-8">
        <div className="mx-auto max-w-6xl">
          {tripId ? (
            <GroupTripManifestView tripId={tripId} />
          ) : (
            <p className="text-sm font-bold text-red-700">معرّف الرحلة غير صالح.</p>
          )}
        </div>
      </div>
    </ClientErrorBoundary>
  );
}
