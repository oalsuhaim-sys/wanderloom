/** yyyy-mm-dd → Date (local midnight) */
export function parseGroupTripDateInput(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const [year, month, day] = trimmed.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toWesternDigits(value: string): string {
  return value
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

function enMonthDay(date: Date): { month: string; day: string } {
  const parts = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).formatToParts(date);
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  return { month, day };
}

function arDay(date: Date): string {
  return new Intl.DateTimeFormat('ar-EG', { day: 'numeric' }).format(date);
}

function arMonthLong(date: Date): string {
  return new Intl.DateTimeFormat('ar-EG', { month: 'long' }).format(date);
}

function arYear(date: Date): string {
  return new Intl.DateTimeFormat('ar-EG', { year: 'numeric' }).format(date);
}

/** Oct 15 - Oct 29, 2026 · 15 - 29 أكتوبر 2026 */
export function formatGroupTripDateRange(
  start: Date,
  end: Date,
): { dates_ar: string; dates_en: string } {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { dates_ar: '', dates_en: '' };
  }

  const startEn = enMonthDay(start);
  const endEn = enMonthDay(end);
  const endYear = end.getFullYear();

  const dates_en = `${startEn.month} ${startEn.day} - ${endEn.month} ${endEn.day}, ${endYear}`;

  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const sameYear = start.getFullYear() === end.getFullYear();

  let dates_ar: string;
  if (sameMonth) {
    dates_ar = `${arDay(start)} - ${arDay(end)} ${arMonthLong(end)} ${arYear(end)}`;
  } else if (sameYear) {
    dates_ar = `${arDay(start)} ${arMonthLong(start)} - ${arDay(end)} ${arMonthLong(end)} ${arYear(end)}`;
  } else {
    dates_ar = `${arDay(start)} ${arMonthLong(start)} ${arYear(start)} - ${arDay(end)} ${arMonthLong(end)} ${arYear(end)}`;
  }

  return { dates_ar: toWesternDigits(dates_ar), dates_en };
}

function parseEnDateRange(value: string): { start: Date; end: Date } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const broken = trimmed.match(
    /^([A-Za-z]{3,9}\s+\d{1,2})\s*-\s*(\d{4})\s*\(day:\s*(\d{1,2})\)$/i,
  );
  if (broken) {
    const [, startPart, yearStr, endDayStr] = broken;
    const year = Number(yearStr);
    const endDay = Number(endDayStr);
    const start = new Date(`${startPart}, ${year}`);
    if (Number.isNaN(start.getTime())) return null;
    let end = new Date(year, start.getMonth(), endDay);
    if (end < start) end = new Date(year, start.getMonth() + 1, endDay);
    return { start, end };
  }

  const standard = trimmed.match(
    /^([A-Za-z]{3,9}\s+\d{1,2})\s*-\s*([A-Za-z]{3,9}\s+\d{1,2}),\s*(\d{4})$/,
  );
  if (standard) {
    const [, startPart, endPart, yearStr] = standard;
    const start = new Date(`${startPart}, ${yearStr}`);
    const end = new Date(`${endPart}, ${yearStr}`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    return { start, end };
  }

  const crossYear = trimmed.match(
    /^([A-Za-z]{3,9}\s+\d{1,2}),\s*(\d{4})\s*-\s*([A-Za-z]{3,9}\s+\d{1,2}),\s*(\d{4})$/,
  );
  if (crossYear) {
    const [, startPart, startYear, endPart, endYear] = crossYear;
    const start = new Date(`${startPart}, ${startYear}`);
    const end = new Date(`${endPart}, ${endYear}`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    return { start, end };
  }

  return null;
}

function parseArDateRange(value: string): { start: Date; end: Date } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const sameMonth = trimmed.match(/^(\d{1,2})\s*-\s*(\d{1,2})\s+(.+?)\s+(\d{4})$/);
  if (sameMonth) {
    const [, startDay, endDay, monthName, yearStr] = sameMonth;
    const probe = new Date(`${monthName} 1, ${yearStr}`);
    if (Number.isNaN(probe.getTime())) return null;
    const month = probe.getMonth();
    const year = Number(yearStr);
    const start = new Date(year, month, Number(startDay));
    const end = new Date(year, month, Number(endDay));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    return { start, end };
  }

  return null;
}

/** يُصلّح النصوص المخزّنة (بما فيها صيغ (day: XX)) ويُعيد تنسيقاً نظيفاً */
export function resolveGroupTripDateDisplay(
  dates_ar?: string | null,
  dates_en?: string | null,
): { dates_ar: string; dates_en: string } {
  const arRaw = String(dates_ar ?? '').trim();
  const enRaw = String(dates_en ?? '').trim();

  const parsed =
    parseEnDateRange(enRaw) ??
    parseArDateRange(arRaw) ??
    null;

  if (parsed) {
    return formatGroupTripDateRange(parsed.start, parsed.end);
  }

  if (enRaw.includes('(day:') || arRaw.includes('(day:')) {
    return { dates_ar: arRaw.replace(/\s*\(day:\s*\d+\)/gi, '').trim(), dates_en: enRaw.replace(/\s*\(day:\s*\d+\)/gi, '').trim() };
  }

  return { dates_ar: arRaw, dates_en: enRaw };
}

function isoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse stored group_trips date strings to ISO yyyy-mm-dd for itinerary forms */
export function parseGroupTripStoredDates(
  dates_ar?: string | null,
  dates_en?: string | null,
): { from: string; to: string } {
  const arRaw = String(dates_ar ?? '').trim();
  const enRaw = String(dates_en ?? '').trim();
  const parsed = parseEnDateRange(enRaw) ?? parseArDateRange(arRaw);
  if (!parsed) return { from: '', to: '' };
  return { from: isoDateLocal(parsed.start), to: isoDateLocal(parsed.end) };
}
