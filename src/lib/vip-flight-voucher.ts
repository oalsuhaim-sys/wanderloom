export type VipFlightDetails = Record<string, unknown> | null

export function vipFlightLine(fd: VipFlightDetails, key: string): string {
  if (!fd) return ''
  const v = fd[key]
  return v != null && String(v).trim() ? String(v).trim() : ''
}

export function vipFlightLineAny(fd: VipFlightDetails, keys: string[]): string {
  if (!fd) return ''
  for (const key of keys) {
    const v = vipFlightLine(fd, key)
    if (v) return v
  }
  return ''
}

/** مدينة هبوط واحدة فقط — لا تُعرض قائمة مدن المسار مجتمعة */
export function normalizeSingleArrivalCity(raw: unknown): string {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  const parts = s
    .split(/[,،|/·]+/)
    .map((p) => p.trim())
    .filter(Boolean)
  return parts[0] ?? s
}

export function vipFlightArrivalCity(fd: VipFlightDetails): string {
  return vipFlightLineAny(fd, ['arrivalCity', 'to_city', 'flight_to'])
}

export function vipFlightDepartureCity(fd: VipFlightDetails): string {
  return vipFlightLineAny(fd, ['departureCity', 'from_city', 'flight_from'])
}

export function hasVipFlightVoucherData(fd: VipFlightDetails): boolean {
  if (!fd) return false
  return Boolean(
    vipFlightLineAny(fd, ['flight_number', 'flight_from', 'flight_to']) ||
      vipFlightLineAny(fd, ['from_city', 'to_city']) ||
      vipFlightLineAny(fd, ['departure_time', 'flight_time', 'leave_home_time', 'boarding_time']) ||
      vipFlightLineAny(fd, ['seat', 'flight_seat', 'gate', 'terminal', 'airport']),
  )
}

export type VipFlightVoucherFields = {
  flightNumber: string
  routeLabel: string
  departure: string
  arrival: string
  seat: string
  gate: string
  terminal: string
  flightClass: string
  departureCountry: string
  arrivalCountry: string
  airport: string
  barcodeSeed: string
}

export function vipFlightDepartureCountry(fd: VipFlightDetails): string {
  return vipFlightLineAny(fd, ['departure_country', 'departureCountry'])
}

export function vipFlightArrivalCountry(fd: VipFlightDetails): string {
  return vipFlightLineAny(fd, ['arrival_country', 'arrivalCountry'])
}

export function buildVipFlightVoucherFields(fd: VipFlightDetails): VipFlightVoucherFields {
  const from = vipFlightDepartureCity(fd)
  const to = vipFlightArrivalCity(fd)
  const routeLabel = from && to ? `${from} → ${to}` : from || to || '—'

  return {
    flightNumber: vipFlightLineAny(fd, ['flight_number']) || '—',
    routeLabel,
    departure:
      vipFlightLineAny(fd, ['departure_time', 'flight_time', 'leave_home_time']) || '—',
    arrival: vipFlightLineAny(fd, ['arrival_time', 'landing_time']) || '—',
    seat: vipFlightLineAny(fd, ['seat', 'flight_seat']) || '—',
    gate: vipFlightLineAny(fd, ['gate']) || '—',
    terminal: vipFlightLineAny(fd, ['terminal']) || '—',
    flightClass: vipFlightLineAny(fd, ['flight_class', 'flightClass']) || '—',
    departureCountry: vipFlightDepartureCountry(fd) || '—',
    arrivalCountry: vipFlightArrivalCountry(fd) || '—',
    airport: vipFlightLineAny(fd, ['airport']) || '—',
    barcodeSeed:
      vipFlightLineAny(fd, [
        'booking_reference',
        'pnr',
        'record_locator',
        'confirmation',
        'flight_number',
      ]) ||
      `${from}-${to}` ||
      'WANDERLOOM-VIP',
  }
}

/** نص يُعرض تحت الباركود في بطاقة الصعود */
export function vipBoardingBarcodeCaption(
  fd: VipFlightDetails,
  itineraryFallback: string,
): string {
  const pnr = vipFlightLineAny(fd, ['booking_reference', 'pnr', 'record_locator', 'confirmation']);
  if (pnr) return pnr.toUpperCase();
  return itineraryFallback;
}

/** عروض باركود 1D للطباعة — قيم ثابتة لمحاكاة مسح */
export const VIP_VOUCHER_BARCODE_WIDTHS = [
  2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 2, 4, 1, 3, 2, 1, 2, 1, 3, 2, 4, 1, 2, 3, 1, 2, 1, 4, 2,
  3, 1, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1,
] as const
