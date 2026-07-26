'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CalendarClock,
  Camera,
  ImagePlus,
  Loader2,
  MessageSquareText,
  Send,
  Sparkles,
} from 'lucide-react';

type TripLog = {
  id: string;
  trip_id: string | number;
  leader_id: string;
  log_text: string | null;
  image_url: string | null;
  created_at: string;
};

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ar-SA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function LiveTripLog({
  tripId,
  leaderId,
}: {
  tripId: string | number;
  leaderId: string;
}) {
  const [logs, setLogs] = useState<TripLog[]>([]);
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ trip_id: String(tripId) });
      const response = await fetch(`/api/trips/logs?${query.toString()}`, {
        cache: 'no-store',
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        logs?: TripLog[];
        error?: string;
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'تعذر تحميل يوميات الرحلة.');
      }
      setLogs(Array.isArray(payload.logs) ? payload.logs : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'تعذر تحميل يوميات الرحلة.',
      );
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const postLog = async () => {
    const normalizedText = text.trim();
    if (!normalizedText) {
      setError('اكتب تحديث الرحلة أولاً.');
      return;
    }

    setPosting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/trips/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip_id: tripId,
          leader_id: leaderId,
          log_text: normalizedText,
          image_url: imageUrl.trim() || null,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        log?: TripLog;
        error?: string;
      };
      if (!response.ok || !payload.ok || !payload.log) {
        throw new Error(payload.error || 'تعذر إضافة التحديث.');
      }

      setLogs((current) => [payload.log as TripLog, ...current]);
      setText('');
      setImageUrl('');
      setShowImageInput(false);
      setNotice('تمت إضافة التحديث إلى يوميات الرحلة.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إضافة التحديث.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <section
      className="overflow-hidden rounded-2xl border border-[#C4A464]/25 bg-white shadow-sm"
      dir="rtl"
    >
      <div className="border-b border-[#C4A464]/15 bg-gradient-to-l from-[#10251B] to-[#08140F] px-5 py-4 text-white">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#C4A464]/30 bg-[#C4A464]/10 text-[#D8BD85]">
            <MessageSquareText className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-black">يوميات الرحلة المباشرة</h2>
            <p className="mt-0.5 text-xs font-semibold text-white/50">
              تحديثات ميدانية خاصة بفريق العمليات
            </p>
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="rounded-2xl border border-slate-100 bg-gradient-to-bl from-[#FBF8F1] to-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#10251B] text-[#D8BD85]">
              <Sparkles className="h-4 w-4" />
            </span>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={4}
              maxLength={5_000}
              placeholder="شارك ملاحظة ميدانية، تحديثاً تشغيلياً، أو حالة المجموعة…"
              className="min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-7 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#C4A464] focus:ring-2 focus:ring-[#C4A464]/15"
            />
          </div>

          {showImageInput ? (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
              <ImagePlus className="h-4 w-4 shrink-0 text-[#A88849]" />
              <input
                type="url"
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="https://… رابط صورة اختياري"
                className="min-w-0 flex-1 bg-transparent py-3 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                dir="ltr"
              />
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShowImageInput((current) => !current)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-600 transition hover:border-[#C4A464]/50 hover:text-[#8B6E35]"
            >
              <Camera className="h-4 w-4" />
              {showImageInput ? 'إخفاء رابط الصورة' : 'إرفاق صورة'}
            </button>
            <button
              type="button"
              onClick={() => void postLog()}
              disabled={posting || !text.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#153326] px-5 py-2.5 text-sm font-black text-[#E1C78F] shadow-md transition hover:bg-[#204834] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {posting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              إضافة تحديث
            </button>
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            {notice}
          </p>
        ) : null}

        <div className="mt-7">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h3 className="inline-flex items-center gap-2 text-sm font-black text-slate-900">
              <CalendarClock className="h-4 w-4 text-[#A88849]" />
              سجل التحديثات
            </h3>
            {!loading ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">
                {logs.length}
              </span>
            ) : null}
          </div>

          {loading ? (
            <div className="flex min-h-44 items-center justify-center gap-2 text-sm font-bold text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-[#C4A464]" />
              جاري تحميل اليوميات…
            </div>
          ) : logs.length ? (
            <ol className="relative me-3 border-r border-[#C4A464]/30">
              {logs.map((log) => (
                <li key={log.id} className="relative mb-6 me-6 last:mb-0">
                  <span className="absolute -right-[1.95rem] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#C4A464] ring-4 ring-[#FBF8F1]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#10251B]" />
                  </span>
                  <article className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                    <div className="px-4 py-4">
                      <time className="text-[10px] font-bold text-[#9A7B40]">
                        {formatTimestamp(log.created_at)}
                      </time>
                      <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-7 text-slate-700">
                        {log.log_text}
                      </p>
                    </div>
                    {log.image_url ? (
                      <a
                        href={log.image_url}
                        target="_blank"
                        rel="noreferrer"
                        className="block border-t border-slate-100 bg-slate-50"
                        aria-label="فتح صورة التحديث"
                      >
                        {/* Arbitrary operational image URLs cannot use a fixed Next.js host allowlist. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={log.image_url}
                          alt="مرفق يوميات الرحلة"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="max-h-96 w-full object-cover transition hover:opacity-95"
                        />
                      </a>
                    ) : null}
                  </article>
                </li>
              ))}
            </ol>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-9 text-center">
              <MessageSquareText className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm font-black text-slate-500">
                لا توجد تحديثات ميدانية بعد
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-400">
                سيكون أول تحديث نقطة البداية ليوميات هذه الرحلة.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
