import { collectActiveSupplierRequests, type SupplierRequest } from '@/lib/supplier-requests';

/** طلبات موردين نشطة (غير ملغاة وغير مدفوعة بالكامل) */
export function collectOutstandingSupplierRequests(
  row: Record<string, unknown>,
): SupplierRequest[] {
  return collectActiveSupplierRequests(row).filter((r) => r.status !== 'paid');
}

export function countOutstandingSupplierRequests(row: Record<string, unknown>): number {
  return collectOutstandingSupplierRequests(row).length;
}
