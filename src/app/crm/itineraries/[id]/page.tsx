'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/** يوجّه المحرّر إلى المسار الموحّد /edit */
export default function ItineraryIdRedirectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const itineraryId = String(params?.id ?? '').trim();

  useEffect(() => {
    if (itineraryId) {
      router.replace(`/crm/itineraries/${itineraryId}/edit`);
    }
  }, [itineraryId, router]);

  return null;
}
