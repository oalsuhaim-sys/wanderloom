/** عناصر حقيبة افتراضية لواجهة العميل VIP */
export type VipPackingCheckItem = {
  id: string;
  label: string;
  hint?: string;
};

export const DEFAULT_VIP_PACKING_ITEMS: VipPackingCheckItem[] = [
  { id: 'passport', label: 'جواز السفر', hint: 'ساري المفعول + نسخة احتياطية' },
  { id: 'chargers', label: 'الشواحن', hint: 'شاحن سريع + كابلات' },
  { id: 'formal', label: 'الملابس الرسمية', hint: 'للعشاء والفعاليات الحصرية' },
  { id: 'medicine', label: 'أدوية', hint: 'الوصفات الشخصية والإسعافات' },
  { id: 'currency', label: 'عملة البلد', hint: 'نقد + بطاقة دولية' },
  { id: 'adapter', label: 'محول طاقة', hint: 'مناسب لوجهة الرحلة' },
];

export function packingStorageKey(tripKey: string): string {
  return `wl-vip-packing:${tripKey.trim()}`;
}

export function loadPackingChecked(key: string): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function savePackingChecked(key: string, state: Record<string, boolean>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}
