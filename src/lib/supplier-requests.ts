import type { SupplierPreferredApp } from '@/lib/supplier-contact';

export type SupplierRequestStatus = 'pending_reply' | 'confirmed_unpaid' | 'paid' | 'cancelled';

export type SupplierServiceType = 'hotel' | 'cafe' | 'driver' | 'concierge';

export type SupplierRequest = {
  id: string;
  supplier_id?: string;
  supplier_name: string;
  /** @deprecated use supplier_name — kept for legacy rows */
  title: string;
  service_type: SupplierServiceType;
  service_date: string;
  details: string;
  status: SupplierRequestStatus;
  supplierPhone?: string;
  preferred_app?: SupplierPreferredApp | string;
};

export const SUPPLIER_SERVICE_TYPE_OPTIONS: Array<{ value: SupplierServiceType; label: string }> = [
  { value: 'hotel', label: 'فندق' },
  { value: 'cafe', label: 'كافيه' },
  { value: 'driver', label: 'سائق' },
  { value: 'concierge', label: 'كونسيرج' },
];

export const SUPPLIER_REQUEST_STATUS_OPTIONS: Array<{
  value: SupplierRequestStatus;
  label: string;
}> = [
  { value: 'pending_reply', label: 'بانتظار رد المورد ⏳' },
  { value: 'confirmed_unpaid', label: 'تم التأكيد 🔴' },
  { value: 'paid', label: 'تم الدفع 🟢' },
];

export function supplierServiceTypeLabel(type: SupplierServiceType): string {
  return SUPPLIER_SERVICE_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

export function supplierRequestStatusLabel(status: SupplierRequestStatus): string {
  return SUPPLIER_REQUEST_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

export function createEmptySupplierRequest(): SupplierRequest {
  return {
    id: `sr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    supplier_id: '',
    supplier_name: '',
    title: '',
    service_type: 'hotel',
    service_date: '',
    details: '',
    status: 'pending_reply',
    supplierPhone: '',
  };
}

function normalizeStatus(raw: unknown): SupplierRequestStatus {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'confirmed_unpaid' || s === 'confirmed' || s === 'unpaid') return 'confirmed_unpaid';
  if (s === 'paid') return 'paid';
  if (s === 'cancelled' || s === 'canceled') return 'cancelled';
  return 'pending_reply';
}

function normalizeServiceType(raw: unknown): SupplierServiceType {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'cafe' || s === 'كافيه' || s === 'coffee') return 'cafe';
  if (s === 'driver' || s === 'سائق' || s === 'chauffeur') return 'driver';
  if (s === 'concierge' || s === 'كونسيرج') return 'concierge';
  return 'hotel';
}

export function parseSupplierRequests(raw: unknown): SupplierRequest[] {
  if (raw == null) return [];

  let data: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      data = JSON.parse(trimmed) as unknown;
    } catch {
      return [];
    }
  }

  if (!Array.isArray(data)) return [];

  const requests: SupplierRequest[] = [];
  data.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const row = item as Record<string, unknown>;
    const supplier_name = String(row.supplier_name ?? row.title ?? '').trim();
    if (!supplier_name) return;

    const service_type = normalizeServiceType(row.service_type ?? row.serviceType);
    const service_date = String(row.service_date ?? row.date ?? '').trim().slice(0, 10);

    requests.push({
      id: String(row.id ?? `sr-${index}`),
      supplier_id: String(row.supplier_id ?? row.supplierId ?? '').trim() || undefined,
      supplier_name,
      title: supplier_name,
      service_type,
      service_date,
      details: String(row.details ?? row.note ?? '').trim(),
      status: normalizeStatus(row.status),
      supplierPhone: String(row.supplier_phone ?? row.supplierPhone ?? '').trim() || undefined,
      preferred_app: String(row.preferred_app ?? row.preferredApp ?? '').trim() || undefined,
    });
  });
  return requests;
}

export function serializeSupplierRequests(requests: SupplierRequest[]): Record<string, unknown>[] {
  return requests
    .filter((r) => r.supplier_name.trim() || r.title.trim())
    .map((r) => {
      const supplier_name = (r.supplier_name || r.title).trim();
      return {
        id: r.id,
        supplier_id: r.supplier_id?.trim() || null,
        supplier_name,
        title: supplier_name,
        service_type: r.service_type,
        service_date: r.service_date.trim() || null,
        details: r.details.trim(),
        status: r.status,
        ...(r.supplierPhone?.trim() ? { supplier_phone: r.supplierPhone.trim() } : {}),
        ...(r.preferred_app ? { preferred_app: String(r.preferred_app) } : {}),
      };
    });
}

export function buildSupplierRequestWhatsAppMessage(
  request: SupplierRequest,
  context?: { clientName?: string; destination?: string; tripDates?: string },
): string {
  const name = (request.supplier_name || request.title).trim();
  const lines = [
    'Hello, this is Wanderloom VIP Concierge.',
    '',
    `Supplier: ${name}`,
    `Service: ${supplierServiceTypeLabel(request.service_type)}`,
  ];
  if (request.service_date) lines.push(`Date needed: ${request.service_date}`);
  if (request.details.trim()) lines.push(`Details: ${request.details.trim()}`);
  if (context?.clientName) lines.push(`VIP Client: ${context.clientName}`);
  if (context?.destination) lines.push(`Destination: ${context.destination}`);
  if (context?.tripDates) lines.push(`Travel dates: ${context.tripDates}`);
  lines.push('', 'Please confirm availability and next steps.', '', 'Thank you.', '— Wanderloom VIP');
  return lines.join('\n');
}

export function buildSupplierRequestWhatsAppUrl(
  request: SupplierRequest,
  context?: { clientName?: string; destination?: string; tripDates?: string },
): string {
  const text = buildSupplierRequestWhatsAppMessage(request, context);
  const digits = request.supplierPhone?.replace(/\D/g, '') ?? '';
  const encoded = encodeURIComponent(text);
  if (digits.length >= 8) return `https://wa.me/${digits}?text=${encoded}`;
  return `https://wa.me/?text=${encoded}`;
}

export function collectActiveSupplierRequests(row: Record<string, unknown>): SupplierRequest[] {
  return parseSupplierRequests(row.supplier_requests).filter((r) => r.status !== 'cancelled');
}

export function supplierRequestDisplayName(request: SupplierRequest): string {
  return (request.supplier_name || request.title).trim();
}
