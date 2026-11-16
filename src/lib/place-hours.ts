/**
 * Opening hours for places-bank rows, cached in `places.opening_hours`.
 * Filled automatically from OpenStreetMap (free) or typed by staff in the places bank.
 * Pure helpers — safe on the client and the server.
 */

export type HoursPoint = { day: number; hour: number; minute: number };
export type HoursPeriod = { open: HoursPoint; close?: HoursPoint | null };

export type StoredPlaceHours = {
  /** ok = hours known · no_hours = place found without hours · not_found = no match */
  status: 'ok' | 'no_hours' | 'not_found';
  /** Weekday convention: 0 = Sunday … 6 = Saturday */
  periods?: HoursPeriod[];
  businessStatus?: string | null;
  /** manual = typed by staff (never overwritten) · osm = OpenStreetMap */
  source?: 'manual' | 'osm';
  /** Original OpenStreetMap value, for checking */
  raw?: string | null;
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
  return {
    status,
    periods,
    businessStatus: typeof r.businessStatus === 'string' ? r.businessStatus : null,
    source: r.source === 'manual' ? 'manual' : r.source === 'osm' ? 'osm' : undefined,
    raw: typeof r.raw === 'string' ? r.raw : null,
  };
}

// ── OpenStreetMap `opening_hours` → periods ─────────────────────────────────────────────

const OSM_DAYS: Record<string, number> = { su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6 };
const DAY_TOKEN = '(?:Mo|Tu|We|Th|Fr|Sa|Su)';
const UNSUPPORTED = /\b(PH|SH|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|week|sunrise|sunset|dawn|dusk|easter)\b|"|\[/i;

function osmDays(sel: string): number[] | null {
  const out = new Set<number>();
  for (const part of sel.split(',').map((x) => x.trim()).filter(Boolean)) {
    const m = new RegExp(`^(${DAY_TOKEN})(?:\\s*-\\s*(${DAY_TOKEN}))?$`, 'i').exec(part);
    if (!m) return null;
    const a = OSM_DAYS[m[1]!.toLowerCase()]!;
    const b = m[2] ? OSM_DAYS[m[2].toLowerCase()]! : a;
    for (let d = a, n = 0; n < 7; d = (d + 1) % 7, n++) {
      out.add(d);
      if (d === b) break;
    }
  }
  return [...out];
}

/** Week as minute ranges per day (0 = Sunday); `to` may pass 1440 for overnight hours. */
export type WeekRanges = Array<Array<[number, number]>>;

export function weekToPeriods(week: WeekRanges): HoursPeriod[] {
  const allDay = week.every((r) => r.length === 1 && r[0]![0] === 0 && r[0]![1] >= 1440);
  if (allDay) return [{ open: { day: 0, hour: 0, minute: 0 } }];
  const point = (day: number, mins: number): HoursPoint => {
    const extra = Math.floor(mins / 1440);
    const m = mins % 1440;
    return { day: (day + extra) % 7, hour: Math.floor(m / 60), minute: m % 60 };
  };
  return week.flatMap((ranges, day) => ranges.map(([a, b]) => ({ open: point(day, a), close: point(day, b) })));
}

/**
 * Parse the common OpenStreetMap forms: «Mo-Fr 09:00-18:00; Sa 10:00-14:00; Su off», «24/7»,
 * «10:00-22:00», «Tu-Su 11:30-15:00,17:00-22:00», «Fr,Sa 18:00-02:00». Rules with holidays, months
 * or sunrise are ignored. Returns null when nothing usable is left.
 */
export function parseOsmOpeningHours(raw: string | null | undefined): HoursPeriod[] | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  if (/^24\s*\/\s*7$/.test(text)) return [{ open: { day: 0, hour: 0, minute: 0 } }];
  const week: WeekRanges = [[], [], [], [], [], [], []];
  let used = 0;
  const rules = text
    .replace(new RegExp(`(\\d)\\s*,\\s*(?=${DAY_TOKEN}\\b)`, 'g'), '$1;')
    .split(/;|\|\|/)
    .map((r) => r.trim())
    .filter(Boolean);
  for (const rule of rules) {
    if (UNSUPPORTED.test(rule)) continue;
    const m = new RegExp(`^((?:${DAY_TOKEN}(?:\\s*-\\s*${DAY_TOKEN})?\\s*,?\\s*)+)?(.*)$`, 'i').exec(rule);
    if (!m) continue;
    const days = m[1] ? osmDays(m[1].trim().replace(/,$/, '')) : [0, 1, 2, 3, 4, 5, 6];
    const rest = (m[2] ?? '').trim().replace(/^open\s+/i, '');
    if (!days) continue;
    if (/^24\s*\/\s*7$/.test(rest)) {
      for (const d of days) week[d] = [[0, 1440]];
      used += 1;
      continue;
    }
    if (/^(off|closed)$/i.test(rest)) {
      for (const d of days) week[d] = [];
      used += 1;
      continue;
    }
    const ranges: Array<[number, number]> = [];
    let ok = rest.length > 0;
    for (const part of rest.split(',').map((x) => x.trim())) {
      const t = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\+?$/.exec(part);
      if (!t) {
        ok = false;
        break;
      }
      const a = Number(t[1]) * 60 + Number(t[2]);
      let b = Number(t[3]) * 60 + Number(t[4]);
      if (b <= a) b += 1440;
      if (a >= 1440 || b > 2880) {
        ok = false;
        break;
      }
      ranges.push([a, b]);
    }
    if (!ok) continue;
    for (const d of days) week[d] = ranges;
    used += 1;
  }
  return used ? weekToPeriods(week) : null;
}

/** Periods → per-day «HH:MM» rows for the manual editor (first range of each day). */
export function periodsToWeekRows(periods: HoursPeriod[] | undefined): Array<{ closed: boolean; from: string; to: string }> {
  const rows = Array.from({ length: 7 }, () => ({ closed: true, from: '10:00', to: '22:00' }));
  if (!periods?.length) return rows.map((r) => ({ ...r, closed: false }));
  // «00:00» as the closing time means midnight (the time inputs cannot show 24:00)
  if (periods.length === 1 && !periods[0]!.close) return rows.map(() => ({ closed: false, from: '00:00', to: '00:00' }));
  for (const p of periods) {
    const row = rows[p.open.day]!;
    if (!row.closed) continue;
    rows[p.open.day] = { closed: false, from: hm(p.open), to: p.close ? hm(p.close) : '00:00' };
  }
  return rows;
}

/** Manual editor rows → stored hours. */
export function weekRowsToStored(rows: Array<{ closed: boolean; from: string; to: string }>): StoredPlaceHours {
  const week: WeekRanges = rows.map((r) => {
    if (r.closed) return [];
    const a = toMin(r.from);
    let b = r.to.trim() === '24:00' ? 1440 : toMin(r.to);
    if (a == null || b == null) return [];
    if (b <= a) b += 1440;
    return [[a, b]];
  });
  return { status: 'ok', source: 'manual', periods: weekToPeriods(week) };
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
