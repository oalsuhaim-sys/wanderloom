'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, LogOut } from 'lucide-react';

import ClientProfileVipDashboard from '@/app/profile/_components/ClientProfileVipDashboard';
import type { ClientItineraryBridge } from '@/lib/client-active-itinerary';
import {
  clearClientProfileUnlock,
  hasClientProfileUnlock,
  persistClientProfileUnlock,
} from '@/lib/client-profile-unlock';
import type {
  ClientMemory,
  ClientProfileDashboardPayload,
  ClientProfileSummary,
} from '@/lib/client-profile-dashboard';

type ProfileDashboardResponse = ClientProfileDashboardPayload & {
  clientId?: string | number;
  profileCode?: string;
  activeItinerarySlug?: string | null;
  error?: string;
  _financeDebug?: unknown;
};

export default function ProfilePortalPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const profileCode = decodeURIComponent(String(params?.code ?? '')).trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [client, setClient] = useState<ClientProfileSummary | null>(null);
  const [clientTrips, setClientTrips] = useState<ClientItineraryBridge[]>([]);
  const [activeTrip, setActiveTrip] = useState<ClientItineraryBridge | null>(null);
  const [pastTrips, setPastTrips] = useState<ClientItineraryBridge[]>([]);
  const [memories, setMemories] = useState<ClientMemory[]>([]);
  const [activeItinerarySlug, setActiveItinerarySlug] = useState<string | null>(null);

  useEffect(() => {
    if (!profileCode) {
      setError('رمز الملف الشخصي غير صالح.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch(
          `/api/portal/profile-dashboard?code=${encodeURIComponent(profileCode)}`,
          { cache: 'no-store' },
        );
        const data = (await res.json()) as ProfileDashboardResponse;

        if (cancelled) return;

        if (!res.ok || !data.ok || !data.client) {
          setError('تعذر فتح الملف الشخصي. تحقق من الرمز أو تواصل مع الكونسيرج.');
          setLoading(false);
          return;
        }

        // Debug: inspect real trip + finance payload in DevTools → Console
        console.log('RAW TRIPS DATA FROM DB:', JSON.stringify(data.trips, null, 2));
        console.log('RAW FINANCE DEBUG:', JSON.stringify(data._financeDebug ?? null, null, 2));
        console.log('CLIENT FINANCIALS:', {
          totalSpent: data.client.totalSpent,
          totalTripCost: data.client.totalTripCost,
          remainingBalance: data.client.remainingBalance,
        });

        persistClientProfileUnlock(data.client.id);
        setClient(data.client);
        setClientTrips(Array.isArray(data.trips) ? data.trips : []);
        setActiveTrip(data.activeTrip ?? null);
        setPastTrips(Array.isArray(data.pastTrips) ? data.pastTrips : []);
        setMemories(Array.isArray(data.memories) ? data.memories : []);
        setActiveItinerarySlug(data.activeItinerarySlug ?? null);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError('تعذر الاتصال. تحقق من الشبكة وحاول مجدداً.');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profileCode]);

  const handleSignOut = () => {
    if (client?.id != null) clearClientProfileUnlock(client.id);
    router.push('/portal');
  };

  if (loading) {
    return (
      <div
        dir="rtl"
        className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#FDFBF7] text-[#1E2720]"
      >
        <Loader2 className="mb-4 h-10 w-10 animate-spin text-[#D4AF37]" aria-hidden />
        <p className="text-sm font-semibold">جاري فتح ملفك الشخصي…</p>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div
        dir="rtl"
        className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[#FDFBF7] px-6 text-center"
      >
        <p className="max-w-md text-sm font-semibold text-gray-700">{error || 'تعذر فتح الملف.'}</p>
        <Link
          href="/portal"
          className="rounded-full bg-[#1E2720] px-5 py-2.5 text-sm font-bold text-[#D4AF37]"
        >
          العودة للخزنة
        </Link>
      </div>
    );
  }

  if (!hasClientProfileUnlock(client.id)) {
    persistClientProfileUnlock(client.id);
  }

  return (
    <div dir="rtl" className="min-h-[100dvh] bg-[#F9F9F6] text-[#1A3B2A]">
      <header className="sticky top-0 z-40 border-b border-[#1A3B2A]/8 bg-[#F9F9F6]/90 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <Link
            href="/portal"
            className="text-xs font-bold text-[#1A3B2A]/70 transition-all duration-300 hover:text-[#C5A059]"
          >
            الخزنة
          </Link>
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#C5A059]">
            VIP Concierge
          </span>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#1A3B2A]/10 px-3 py-1.5 text-xs font-bold text-[#1A3B2A]/70 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#C5A059]/40 hover:text-[#C5A059]"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden />
            خروج
          </button>
        </div>
      </header>

      <main className="pb-10">
        <ClientProfileVipDashboard
          client={client}
          clientTrips={clientTrips}
          pastTrips={pastTrips}
          activeTrip={activeTrip}
          memories={memories}
          activeItinerarySlug={activeItinerarySlug ?? undefined}
          profileCode={profileCode}
          onMemoriesChange={setMemories}
        />
      </main>
    </div>
  );
}
