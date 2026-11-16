/**
 * Opening hours for places-bank rows (pulled from Google Places and cached in `places.opening_hours`).
 * Pure helpers — safe on the client and the server.
 */

export type HoursPoint = { day: number; hour: number; minute: number };
export type HoursPeriod = { open: HoursPoint; close?: HoursPoint | null };

export type StoredPlaceHours = {
  /** ok = hours known · no_hours = place found but Google has no hours · not_found = no match */
  status: 'ok' | 'no_hours' | 'not_found';
  /** Google weekday convention: 0 = Sunday … 6 = Saturday */
  periods?: HoursPeriod[];
  businessStatus?: string | null;
};

export type DayHours =
  | { kind: 'open'; ranges: Array<{ from: string; to: string }> }
  | { kind: 'allDay' }
  | { kind: 'closed' }
  | { kind: 'closedPermanently' };

export type VisitCheck = 'ok' | 'closed_day' | 'outside_hours' | 'unknown';

const WEEKDAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'] as const;

const pad = (n: number) => String(n).padStart(2, '0');
const hm = (p: HoursPoint) => `${pad(p.hour)}:${pad(p.minute)}`;
const toMin = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

function isPoint(v: unknown): v is HoursPoint {
  const p = v as HoursPoint;
  return Boolean(p) && Number.isInteger(p.day) && Number.isInteger(p.hour) && Number.isInteger(p.minute ?? 0);
}

/** Validate whatever came back from the DB / API. */
export function parseStoredHours(raw: unknown): StoredPlaceHours | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const status = r.status === 'ok' || r.status === 'no_hours' || r.status === 'not_found' ? r.status : null;
  if (!status) return null;
  const periods = Array.isArray(r.periods)
    ? (r.periods as unknown[])
        .map((p) => p as Record<string, unknown>)
        .filter((p) => isPoint(p?.open))
        .map((p) => ({
          open: { ...(p.open as HoursPoint), minute: (p.open as HoursPoint).minute ?? 0 },
          close: isPoint(p.close) ? { ...(p.close as HoursPoint), minute: (p.close as HoursPoint).minute ?? 0 } : null,
        }))
    : [];
  return { status, periods, businessStatus: typeof r.businessStatus === 'string' ? r.businessStatus : null };
}

/** Weekday (0 = Sunday) of a trip day: start date + index. */
export function tripDayWeekday(startDate: string | null | undefined, dayIndex: number): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(startDate ?? '').trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + dayIndex));
  return Number.isNaN(d.getTime()) ? null : d.getUTCDay();
}

export function weekdayLabelAr(weekday: number): string {
  return WEEKDAYS_AR[((weekday % 7) + 7) % 7]!;
}

/** Hours that start on this weekday (a period running past midnight stays on the day it opened). */
export function hoursForWeekday(h: StoredPlaceHours | null | undefined, weekday: number): DayHours | null {
  if (!h) return null;
  if (h.businessStatus === 'CLOSED_PERMANENTLY') return { kind: 'closedPermanently' };
  if (h.status !== 'ok' || !h.periods?.length) return null;
  // Google: open 24/7 = one period, open day 0 00:00, no close
  if (h.periods.length === 1 && !h.periods[0]!.close && h.periods[0]!.open.hour === 0 && h.periods[0]!.open.minute === 0) {
    return { kind: 'allDay' };
  }
  const today = h.periods
    .filter((p) => p.open.day === weekday)
    .sort((a, b) => a.open.hour * 60 + a.open.minute - (b.open.hour * 60 + b.open.minute));
  if (!today.length) return { kind: 'closed' };
  if (today.length === 1 && today[0]!.close && today[0]!.close.day !== weekday && hm(today[0]!.open) === '00:00' && hm(today[0]!.close) === '00:00') {
    return { kind: 'allDay' };
  }
  return { kind: 'open', ranges: today.map((p) => ({ from: hm(p.open), to: p.close ? hm(p.close) : '24:00' })) };
}

/** «10:00ص» — same 12-hour style as the itinerary times. */
export function formatTimeAr(t: string): string {
  const mins = toMin(t);
  if (mins == null) return t;
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const suffix = h24 < 12 ? 'ص' : 'م';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${pad(m)}${suffix}`;
}

/** Client-facing line: «مفتوح 10:00ص – 11:00م» · «مفتوح 24 ساعة» · «مغلق هذا اليوم». */
export function formatDayHoursAr(d: DayHours | null): string | null {
  if (!d) return null;
  if (d.kind === 'allDay') return 'مفتوح 24 ساعة';
  if (d.kind === 'closed') return 'مغلق هذا اليوم';
  if (d.kind === 'closedPermanently') return 'مغلق نهائياً';
  return `مفتوح ${d.ranges.map((r) => `${formatTimeAr(r.from)} – ${formatTimeAr(r.to)}`).join(' · ')}`;
}

/** Is a visit at HH:MM on this weekday inside the opening hours? */
export function checkVisit(h: StoredPlaceHours | null | undefined, weekday: number, visitTime: string | null | undefined): VisitCheck {
  const day = hoursForWeekday(h, weekday);
  if (!day) return 'unknown';
  if (day.kind === 'closedPermanently') return 'closed_day';
  if (day.kind === 'allDay') return 'ok';
  const t = toMin(String(visitTime ?? ''));
  // Early-morning visit inside a period that opened the day before (e.g. open until 02:00)
  const prev = hoursForWeekday(h, (weekday + 6) % 7);
  if (t != null && prev?.kind === 'open' && prev.ranges.some((r) => toMin(r.to)! <= toMin(r.from)! && t < toMin(r.to)!)) return 'ok';
  if (day.kind === 'closed') return 'closed_day';
  if (t == null) return 'ok';
  const inside = day.ranges.some((r) => {
    const from = toMin(r.from)!;
    let to = toMin(r.to)!;
    if (to <= from) to += 24 * 60; // runs past midnight
    return t >= from && t < to;
  });
  return inside ? 'ok' : 'outside_hours';
}

/** Key for matching a stop to a bank row by name when it has no bank id. */
export function hoursNameKey(name: string, city: string): string {
  return `${name.trim().toLowerCase()}|${city.trim().toLowerCase()}`;
}
