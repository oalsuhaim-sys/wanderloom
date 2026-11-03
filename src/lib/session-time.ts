/** Normalize HH:mm / HH:mm:ss from DB or form into a `<input type="time">` value. */
export function toSessionTimeInput(value: string | null | undefined): string {
  const match = String(value ?? '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return '';
  const hour = Math.min(23, Math.max(0, Number.parseInt(match[1], 10)));
  const minute = Math.min(59, Math.max(0, Number.parseInt(match[2], 10)));
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Friendly 12-hour label for session cards (e.g. ٨:٠٠ م / 8:00 PM). */
export function formatSessionTimeLabel(
  value: string | null | undefined,
  locale: 'ar' | 'en' = 'ar',
): string {
  const normalized = toSessionTimeInput(value);
  if (!normalized) return '';
  const [h, m] = normalized.split(':').map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
  const d = new Date(2000, 0, 1, h, m, 0, 0);
  return d.toLocaleTimeString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
