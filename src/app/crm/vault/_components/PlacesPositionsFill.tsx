'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';

type Stats = { total: number; withPosition: number; google: boolean; kakao: boolean };
type Missed = { id: string; name: string; city: string };

async function authHeader(): Promise<Record<string, string>> {
  const { getClientAccessToken } = await import('@/lib/crm-session-token');
  return { Authorization: `Bearer ${await getClientAccessToken()}` };
}

/**
 * «إحداثيات الأماكن»: how many bank places can be pinned on the client map, and a button that fills
 * the rest in batches (map link → Google → Kakao), with a progress bar and the places it could not find.
 */
export default function PlacesPositionsFill({ onEditPlace }: { onEditPlace?: (id: string) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, link: 0, google: 0, kakao: 0 });
  const [missed, setMissed] = useState<Missed[]>([]);
  const stopRef = useRef(false);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/crm/places-geocode', { headers: await authHeader() });
      const json = (await res.json().catch(() => null)) as ({ ok?: boolean; error?: string } & Partial<Stats>) | null;
      if (json?.error === 'columns_missing') {
        setProblem('نفّذ places_coordinates.sql في Supabase أولاً لإضافة أعمدة الإحداثيات.');
        return;
      }
      if (json?.ok) {
        setProblem(null);
        setStats({ total: json.total ?? 0, withPosition: json.withPosition ?? 0, google: Boolean(json.google), kakao: Boolean(json.kakao) });
      }
    } catch {
      /* optional card */
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadStats());
  }, [loadStats]);

  const run = async () => {
    setRunning(true);
    stopRef.current = false;
    setMissed([]);
    const totals = { processed: 0, link: 0, google: 0, kakao: 0 };
    setProgress(totals);
    const runStartedAt = new Date().toISOString();
    try {
      for (let guard = 0; guard < 400 && !stopRef.current; guard++) {
        const res = await fetch('/api/crm/places-geocode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
          body: JSON.stringify({ runStartedAt }),
        });
        const json = (await res.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
          processed?: number;
          found?: { link: number; google: number; kakao: number };
          missed?: Missed[];
          done?: boolean;
        } | null;
        if (!json?.ok) {
          setProblem(json?.error === 'columns_missing' ? 'نفّذ places_coordinates.sql في Supabase أولاً.' : 'توقّف التعبئة بسبب خطأ — أعد المحاولة.');
          break;
        }
        totals.processed += json.processed ?? 0;
        totals.link += json.found?.link ?? 0;
        totals.google += json.found?.google ?? 0;
        totals.kakao += json.found?.kakao ?? 0;
        setProgress({ ...totals });
        if (json.missed?.length) setMissed((m) => [...m, ...json.missed!]);
        if (json.done || !json.processed) break;
      }
    } finally {
      setRunning(false);
      void loadStats();
    }
  };

  if (!stats && !problem) return null;
  const without = stats ? stats.total - stats.withPosition : 0;
  const pct = stats && stats.total ? Math.round((stats.withPosition / stats.total) * 100) : 0;
  const found = progress.link + progress.google + progress.kakao;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 text-right text-xs shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-[#C59B4B]" aria-hidden />
          <div>
            <p className="text-sm font-bold text-slate-800">إحداثيات الأماكن على الخريطة</p>
            {stats ? (
              <p className="text-slate-500">
                {stats.withPosition} من {stats.total} مكان لها موقع دقيق ({pct}٪)
                {without > 0 ? ` · ${without} بدون موقع` : ''}
              </p>
            ) : null}
          </div>
        </div>
        {stats && without > 0 ? (
          running ? (
            <button type="button" onClick={() => (stopRef.current = true)} className="rounded-2xl border border-slate-300 px-4 py-2 font-bold text-slate-600">
              إيقاف
            </button>
          ) : (
            <button type="button" onClick={() => void run()} className="flex items-center gap-2 rounded-2xl bg-[#C59B4B] px-4 py-2 font-bold text-slate-900 hover:bg-[#B2883A]">
              أكمل الإحداثيات
            </button>
          )
        ) : null}
      </div>

      {stats ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-[#C59B4B] transition-all" style={{ width: `${pct}%` }} />
        </div>
      ) : null}

      {problem ? <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 font-semibold text-amber-800">{problem}</p> : null}

      {stats && !stats.google && !stats.kakao && without > 0 ? (
        <p className="mt-2 text-slate-500">
          بدون مفتاح Google أو Kakao تُؤخذ المواقع من روابط الخريطة المحفوظة فقط.
        </p>
      ) : null}

      {running || progress.processed > 0 ? (
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-semibold text-slate-600">
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#C59B4B]" aria-hidden /> : null}
          <span>تمت معالجة {progress.processed}</span>
          <span className="text-emerald-700">وُجد {found}</span>
          {progress.link ? <span>من الروابط {progress.link}</span> : null}
          {progress.google ? <span>من Google {progress.google}</span> : null}
          {progress.kakao ? <span>من Kakao {progress.kakao}</span> : null}
          {missed.length ? <span className="text-rose-700">لم يُعثر على {missed.length}</span> : null}
        </p>
      ) : null}

      {!running && missed.length ? (
        <details className="mt-2">
          <summary className="cursor-pointer font-bold text-slate-700">أماكن تحتاج موقعاً يدوياً ({missed.length})</summary>
          <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
            {missed.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-slate-50">
                <span className="truncate">
                  <span className="font-bold text-slate-800">{m.name}</span>
                  {m.city ? <span className="text-slate-500"> · {m.city}</span> : null}
                </span>
                {onEditPlace ? (
                  <button type="button" onClick={() => onEditPlace(m.id)} className="shrink-0 font-bold text-[#8a6d1c] hover:underline">
                    تعديل
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-slate-500">لكل مكان: الصق رابط الخريطة من محرر المسار، أو أضف رابطه في بنك الأماكن ثم أعد التعبئة.</p>
        </details>
      ) : null}
    </section>
  );
}
