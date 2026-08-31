export type AgencyBankDetails = {
  bankName: string
  accountName: string
  iban: string
}

export const EMPTY_BANK_DETAILS: AgencyBankDetails = {
  bankName: '',
  accountName: '',
  iban: '',
}

/** Default Alinma details when DB/env are empty. */
export const DEFAULT_AGENCY_BANK_DETAILS: AgencyBankDetails = {
  bankName: 'مصرف الإنماء',
  accountName: 'عمر عبدالعزيز السحيم',
  iban: 'SA2905000068201801412000',
}

export function mapSystemSettingsBank(row: Record<string, unknown> | null | undefined): AgencyBankDetails {
  if (!row) return { ...EMPTY_BANK_DETAILS }
  return {
    bankName: String(row.bank_name ?? '').trim(),
    accountName: String(row.account_name ?? '').trim(),
    iban: String(row.iban ?? '').trim(),
  }
}

/** Env fallbacks when DB row is empty (legacy). */
export function bankDetailsFromEnv(): AgencyBankDetails {
  return {
    bankName: process.env.NEXT_PUBLIC_BANK_NAME?.trim() || '',
    accountName: process.env.NEXT_PUBLIC_BANK_ACCOUNT_NAME?.trim() || '',
    iban: process.env.NEXT_PUBLIC_BANK_IBAN?.trim() || '',
  }
}

function isPlaceholderBankValue(value: string): boolean {
  const v = value.trim()
  return (
    !v ||
    v === '[أدخل اسم البنك]' ||
    v === '[أدخل اسم المؤسسة]' ||
    v === 'SA0000000000000000000000'
  )
}

export function mergeBankDetails(
  fromDb: AgencyBankDetails,
  fromEnv: AgencyBankDetails = bankDetailsFromEnv(),
): AgencyBankDetails {
  const bankName = !isPlaceholderBankValue(fromDb.bankName)
    ? fromDb.bankName
    : fromEnv.bankName || DEFAULT_AGENCY_BANK_DETAILS.bankName
  const accountName = !isPlaceholderBankValue(fromDb.accountName)
    ? fromDb.accountName
    : fromEnv.accountName || DEFAULT_AGENCY_BANK_DETAILS.accountName
  const iban = !isPlaceholderBankValue(fromDb.iban)
    ? fromDb.iban
    : fromEnv.iban || DEFAULT_AGENCY_BANK_DETAILS.iban
  return { bankName, accountName, iban }
}

export function formatSarAmount(amount: number | null | undefined): string {
  const n = Number(amount)
  if (!Number.isFinite(n) || n <= 0) return '—'
  try {
    return new Intl.NumberFormat('ar-SA', {
      style: 'currency',
      currency: 'SAR',
      maximumFractionDigits: 0,
    }).format(n)
  } catch {
    return `${Math.round(n).toLocaleString('ar-SA')} ر.س`
  }
}
