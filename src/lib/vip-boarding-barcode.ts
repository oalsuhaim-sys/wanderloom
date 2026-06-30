/** عروض أشرطة باركود 1D مُشتقة من PNR أو معرّف المسار */
export function barcodeWidthsFromSeed(seed: string, barCount = 52): number[] {
  const s = seed.trim() || 'WL-VIP';
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const widths: number[] = [];
  for (let i = 0; i < barCount; i++) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    widths.push(1 + (Math.abs(h) % 4));
  }
  return widths;
}

export function resolveBoardingBarcodeLabel(
  flightDetails: Record<string, unknown> | null | undefined,
  fallbackId: string,
): string {
  if (!flightDetails) return fallbackId;
  const keys = ['booking_reference', 'pnr', 'record_locator', 'confirmation', 'flight_number'];
  for (const key of keys) {
    const v = flightDetails[key];
    if (v != null && String(v).trim()) return String(v).trim().toUpperCase();
  }
  return fallbackId;
}
