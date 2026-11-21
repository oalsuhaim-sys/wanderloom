'use client';

import { useState } from 'react';
import { Check, Link2, Loader2, MapPin, Search } from 'lucide-react';

import { toast } from '@/lib/crm-toast';
import { setPlacePositionOverride } from '@/lib/use-place-positions';

type KakaoPlace = { name: string; address: string; category: string; lat: number; lng: number; url: string };

async function authHeader(): Promise<Record<string, string>> {
  const { getClientAccessToken } = await import('@/lib/crm-session-token');
  return { Authorization: `Bearer ${await getClientAccessToken()}` };
}

/**
 * Staff-only, under each stop in the itinerary editor: is this place pinned on the client's map?
 * Fix it by pasting a Google Maps link or picking the place from Kakao (Korea). Saved on the
 * places-bank row, so every itinerary that uses the place gets it.
 */
export default function PlacePositionHint({
  bankId,
  name,
  city,
  position,
  kakao,
}: {
  bankId: string | null;
  name: string;
  city: string;
  position: [number, number] | null | undefined;
  kakao: boolean;
}) {
  const [mode, setMode] = useState<'idle' | 'link' | 'kakao'>('idle');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<KakaoPlace[] | null>(null);

  if (!bankId) return null;

  const save = async (payload: { url: string } | { lat: number; lng: number }) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/crm/place-position/${encodeURIComponent(bankId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; position?: [number, number]; error?: string } | null;
      if (!json?.ok || !json.position) {
        toast.error(
          json?.error === 'no_position'
            ? 'لم أجد الموقع في هذا الرابط — انسخ رابط المكان من Google Maps.'
            : json?.error === 'columns_missing'
              ? 'نفّذ places_coordinates.sql في Supabase أولاً.'
              : 'تعذر حفظ الموقع.',
        );
        return;
      }
      setPlacePositionOverride(bankId, json.position);
      setMode('idle');
      setLink('');
      setResults(null);
      toast.success('تم تثبيت الموقع على الخريطة.');
    } catch {
      toast.error('تعذر حفظ الموقع.');
    } finally {
      setBusy(false);
    }
  };

  const searchKakao = async () => {
    setMode('kakao');
    setBusy(true);
    setResults(null);
    try {
      const res = await fetch(`/api/crm/place-position/search?q=${encodeURIComponent(name)}&city=${encodeURIComponent(city)}`, {
        headers: await authHeader(),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; results?: KakaoPlace[] } | null;
      setResults(json?.ok ? (json.results ?? []) : []);
    } catch {
      setResults([]);
    } finally {
      setBusy(false);
    }
  };

  const btn = 'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition disabled:opacity-60';

  return (
    <div className="mt-2 space-y-1.5" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-2">
        {position ? (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${position[0]},${position[1]}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
            title="افتح الموقع للتأكد"
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
            الموقع مثبّت على الخريطة
          </a>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            لا يظهر على خريطة العميل بعد
          </span>
        )}
        {mode === 'idle' ? (
          <>
            {kakao ? (
              <button type="button" onClick={() => void searchKakao()} className={`${btn} border-[#D4AF37]/50 bg-[#D4AF37]/10 text-[#8a6d1c] hover:bg-[#D4AF37]/20`}>
                <Search className="h-3 w-3" aria-hidden />
                {position ? 'تغيير من Kakao' : 'ابحث في Kakao'}
              </button>
            ) : null}
            <button type="button" onClick={() => setMode('link')} className={`${btn} border-slate-200 text-slate-600 hover:bg-slate-50`}>
              <Link2 className="h-3 w-3" aria-hidden />
              {position ? 'تغيير بالرابط' : 'الصق رابط الخريطة'}
            </button>
          </>
        ) : null}
      </div>

      {mode === 'link' ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
          <input
            type="url"
            dir="ltr"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://maps.app.goo.gl/…"
            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-[#D4AF37]"
          />
          <button
            type="button"
            disabled={busy || !link.trim()}
            onClick={() => void save({ url: link.trim() })}
            className={`${btn} border-[#D4AF37] bg-[#D4AF37] text-slate-900`}
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
            حفظ الموقع
          </button>
          <button type="button" onClick={() => setMode('idle')} className={`${btn} border-slate-200 text-slate-500`}>
            إلغاء
          </button>
        </div>
      ) : null}

      {mode === 'kakao' ? (
        <div className="rounded-xl border border-slate-200 bg-white p-2">
          {busy && !results ? (
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> جاري البحث في Kakao…
            </p>
          ) : results && results.length ? (
            <ul className="space-y-1">
              {results.map((r, i) => (
                <li key={`${r.lat},${r.lng},${i}`} className="flex items-center justify-between gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-50">
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="min-w-0 text-xs" title="افتح في Kakao للتأكد">
                    <span className="block truncate font-bold text-slate-800">{r.name}</span>
                    <span className="block truncate text-[11px] text-slate-500">
                      {[r.category, r.address].filter(Boolean).join(' · ')}
                    </span>
                  </a>
                  <button type="button" disabled={busy} onClick={() => void save({ lat: r.lat, lng: r.lng })} className={`${btn} shrink-0 border-[#D4AF37] bg-[#D4AF37] text-slate-900`}>
                    هذا هو
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">لم يجد Kakao هذا المكان — الصق رابط الخريطة بدلاً من ذلك.</p>
          )}
          <button type="button" onClick={() => setMode('idle')} className="mt-1.5 text-[11px] font-bold text-slate-500 hover:underline">
            إغلاق
          </button>
        </div>
      ) : null}
    </div>
  );
}
