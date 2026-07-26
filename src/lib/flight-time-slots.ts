/** Flight departure/arrival slots — 30-minute steps, 00:00 … 23:30 */
export const FLIGHT_TIME_SLOT_INTERVAL_MINUTES = 30;

export function buildFlightTimeSlots(intervalMinutes = FLIGHT_TIME_SLOT_INTERVAL_MINUTES): string[] {
  const slots: string[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += intervalMinutes) {
      slots.push(
        `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      );
    }
  }
  return slots;
}

/** Normalize stored values (14:5, 14:05:00) to HH:mm for selects. */
export function normalizeFlightTimeValue(value: string | null | undefined): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return raw;

  const hour = Math.min(23, Math.max(0, Number.parseInt(match[1], 10)));
  const minute = Math.min(59, Math.max(0, Number.parseInt(match[2], 10)));
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function flightTimeSelectOptions(
  value: string | null | undefined,
  intervalMinutes = FLIGHT_TIME_SLOT_INTERVAL_MINUTES,
): string[] {
  const slots = buildFlightTimeSlots(intervalMinutes);
  const normalized = normalizeFlightTimeValue(value);
  if (normalized && !slots.includes(normalized)) {
    return [normalized, ...slots];
  }
  return slots;
}
