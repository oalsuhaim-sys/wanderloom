'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { arSA } from 'date-fns/locale';
import { format, parseISO } from 'date-fns';
import { DayPicker, type Matcher } from 'react-day-picker';
import 'react-day-picker/style.css';
import { CalendarDays, Check, Loader2, MapPin } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

import { countryFlagMeta } from '@/lib/partner-intelligence';

type Profile = {
  id: string;
  name: string;
  countryCode: string | null;
  city: string | null;
  initials: string;
};

const DAY_BTN =
  'aspect-square flex w-full items-center justify-center rounded-xl text-sm font-semibold transition-all active:scale-95';

function LeaderCalendarInner() {
  const searchParams = useSearchParams();
  const token = (searchParams.get('token') || '').trim();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [unavailable, setUnavailable] = useState<Set<string>>(() => new Set());
  const [booked, setBooked] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setError('رابط التفرغ ناقص — اطلب رابطاً جديداً من فريق Wanderloom.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/leader-calendar?token=${encodeURIComponent(token)}`, {
        cache: 'no-store',
      });
      const payload = (await res.json()) as {
        ok?: boolean;
        error?: string;
        profile?: Profile;
        unavailableDates?: string[];
        bookedDates?: string[];
      };
      if (!res.ok || !payload.ok || !payload.profile) {
        throw new Error(payload.error || 'تعذر فتح صفحة التفرغ.');
      }
      setProfile(payload.profile);
      setUnavailable(new Set(payload.unavailableDates ?? []));
      setBooked(new Set(payload.bookedDates ?? []));
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر التحميل.');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const bookedMatchers: Matcher[] = useMemo(
    () => [...booked].map((d) => parseISO(d)),
    [booked],
  );
  const unavailableMatchers: Matcher[] = useMemo(
    () => [...unavailable].map((d) => parseISO(d)),
    [unavailable],
  );

  const handleSave = async () => {
    if (!token || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/leader-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          unavailableDates: [...unavailable].sort(),
        }),
      });
      const payload = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || 'تعذر الحفظ.');
      }
      setDirty(false);
      toast.success('تم حفظ فترات تفرغك بنجاح!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذر الحفظ.');
    } finally {
      setSaving(false);
    }
  };

  const location = useMemo(() => {
    if (!profile) return null;
    const meta = countryFlagMeta(profile.countryCode);
    const city = profile.city?.trim();
    if (meta && city) return `${meta.flag} ${meta.name} — ${city}`;
    if (meta) return `${meta.flag} ${meta.name}`;
    return city || null;
  }, [profile]);

  return (
    <div
      className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-[#F8FAFC] px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-6 dark:bg-[#1A2421]"
      dir="rtl"
    >
      <Toaster position="top-center" toastOptions={{ duration: 3200 }} />

      <header className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C]">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400 dark:text-[#D4AF37]/70">
          Leader Availability
        </p>
        {loading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            جاري التحميل…
          </div>
        ) : profile ? (
          <div className="mt-3 flex items-center gap-3">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-lg font-bold text-slate-700 dark:border-[#D4AF37]/30 dark:bg-[#1A2421] dark:text-[#D4AF37]"
              aria-hidden
            >
              {profile.initials}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-slate-900 dark:text-white">
                {profile.name}
              </h1>
              {location ? (
                <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-300">
                  <MapPin className="h-3 w-3 shrink-0 text-[#D4AF37]" aria-hidden />
                  {location}
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  حدّد أيام عدم التفرغ بضغطة
                </p>
              )}
            </div>
          </div>
        ) : null}
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-center text-sm font-medium text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200"
        >
          {error}
        </div>
      ) : null}

      {!error && !loading ? (
        <section className="relative z-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C]">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <CalendarDays className="h-4 w-4 text-[#D4AF37]" aria-hidden />
            تقويم التفرغ
          </div>
          <p className="mb-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            اضغط على اليوم للتبديل بين{' '}
            <span className="font-bold text-emerald-600 dark:text-emerald-400">متاح</span> و{' '}
            <span className="font-bold text-rose-600 dark:text-rose-400">غير متاح</span>.
            الأيام المحجوزة لا يمكن تغييرها.
          </p>

          <div className="leader-availability-calendar w-full overflow-hidden">
            <DayPicker
              mode="multiple"
              locale={arSA}
              selected={[...unavailable].map((d) => parseISO(d))}
              onSelect={(days) => {
                const next = new Set<string>();
                for (const day of days ?? []) {
                  const key = format(day, 'yyyy-MM-dd');
                  if (!booked.has(key)) next.add(key);
                }
                setUnavailable(next);
                setDirty(true);
              }}
              disabled={bookedMatchers}
              modifiers={{
                unavailable: unavailableMatchers,
                booked: bookedMatchers,
              }}
              modifiersClassNames={{
                unavailable:
                  '[&>button]:bg-rose-500/15 [&>button]:font-bold [&>button]:text-rose-600 [&>button]:border [&>button]:border-rose-500/30 dark:[&>button]:text-rose-400',
                booked:
                  '[&>button]:cursor-not-allowed [&>button]:bg-slate-200 [&>button]:text-slate-400 dark:[&>button]:bg-[#2D3F3A]',
              }}
              classNames={{
                root: 'w-full',
                months: 'w-full',
                month: 'w-full space-y-3',
                month_caption: 'relative flex h-10 items-center justify-center px-10',
                caption_label: 'text-sm font-bold text-slate-900 dark:text-white',
                nav: 'absolute inset-x-0 top-0 flex h-10 items-center justify-between px-1',
                button_previous:
                  'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 dark:border-[#2D3F3A] dark:text-slate-300',
                button_next:
                  'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 dark:border-[#2D3F3A] dark:text-slate-300',
                weekdays: 'grid grid-cols-7 gap-1 text-center mb-2',
                weekday: 'text-[11px] font-semibold text-slate-500 dark:text-slate-400',
                weeks: 'block space-y-1',
                week: 'grid grid-cols-7 gap-1 text-center',
                day: 'relative p-0 text-center',
                day_button: `${DAY_BTN} text-slate-800 dark:text-gray-100 hover:bg-emerald-500/10`,
                today: '[&>button]:ring-1 [&>button]:ring-[#D4AF37]/50',
                outside: '[&>button]:text-slate-300 dark:[&>button]:text-slate-600',
                selected:
                  '[&>button]:bg-rose-500/15 [&>button]:font-bold [&>button]:text-rose-600 [&>button]:border [&>button]:border-rose-500/30 dark:[&>button]:text-rose-400',
              }}
            />
          </div>

          <div className="mt-4 flex items-center justify-center gap-4 text-xs font-medium text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              متاح
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
              غير متاح
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
              محجوز
            </span>
          </div>

          <p className="mt-3 text-center text-[11px] text-slate-400 dark:text-slate-500">
            {unavailable.size} يوم غير متاح
            {dirty ? ' · لم يُحفظ بعد' : ''}
          </p>
        </section>
      ) : null}

      {!error && profile ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-[#2D3F3A] dark:bg-[#22302C]/95">
          <div className="mx-auto max-w-lg">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60 dark:border dark:border-[#D4AF37]/40 dark:bg-[#D4AF37]/20 dark:text-[#D4AF37]"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              تأكيد وحفظ أوقات التفرّغ
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function LeaderCalendarPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-[#F8FAFC] dark:bg-[#1A2421]">
          <Loader2 className="h-6 w-6 animate-spin text-[#D4AF37]" />
        </div>
      }
    >
      <LeaderCalendarInner />
    </Suspense>
  );
}
