/** عرض سعر قطعة أزياء السفر — آمن ضد null/NaN */
export function formatWardrobePrice(price: unknown): string {
  if (price == null || price === '') return 'السعر عند الطلب';
  const n = typeof price === 'number' ? price : Number(price);
  if (!Number.isFinite(n) || Number.isNaN(n) || n <= 0) return 'السعر عند الطلب';
  return `${n.toLocaleString('ar-SA')} ر.س`;
}

/** كود تشغيلي موحّد — يطابق طلبات الواتساب بين العميل والـ CRM */
export function wardrobeItemCode(itemId: string): string {
  return `WL-${String(itemId).substring(0, 4).toUpperCase()}`;
}
