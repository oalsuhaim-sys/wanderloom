/** YYYY-MM-DD for "today" in Asia/Riyadh (safe on server and client). */
export function riyadhToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(now);
}
