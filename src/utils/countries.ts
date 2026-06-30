import { CRM_DESTINATIONS_GUIDE } from '@/lib/crm-destinations-guide-data'

export type VipCountry = {
  readonly id: string
  readonly labelAr: string
}

/** دول VIP للمرشّحات في CRM — متزامنة مع `CRM_DESTINATIONS_GUIDE`. */
export const VIP_COUNTRIES: readonly VipCountry[] = [...CRM_DESTINATIONS_GUIDE]
  .map(({ id, labelAr }) => ({ id, labelAr }))
  .sort((a, b) => a.labelAr.localeCompare(b.labelAr, 'ar'))
