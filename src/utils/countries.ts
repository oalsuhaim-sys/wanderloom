import { DEFAULT_COUNTRIES } from '@/lib/countries';

export type VipCountry = {
  readonly id: string;
  readonly labelAr: string;
};

/** دول VIP للمرشّحات في CRM — متزامنة مع القائمة المركزية للدول */
export const VIP_COUNTRIES: readonly VipCountry[] = DEFAULT_COUNTRIES.map(({ id, name }) => ({
  id,
  labelAr: name,
})).sort((a, b) => a.labelAr.localeCompare(b.labelAr, 'ar'));
