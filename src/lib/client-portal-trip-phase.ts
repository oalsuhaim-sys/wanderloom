/** نهاية الرحلة (منتصف الليل محلياً) من ISO YYYY-MM-DD */
export function parseTripEndDate(isoDate: string | null | undefined): Date | null {
  if (!isoDate?.trim()) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const end = new Date(y, mo, d, 23, 59, 59, 999);
  return Number.isNaN(end.getTime()) ? null : end;
}

/**
 * الرحلة منتهية عندما يتجاوز اليوم الحالي تاريخ النهاية.
 * بدون end_date تُعامل الرحلة كغير منتهية (عرض المسار للمسارات القديمة).
 */
export function isTripFinished(
  endDate: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const end = parseTripEndDate(endDate);
  if (!end) return false;
  return now.getTime() > end.getTime();
}
