import { ar } from '@/messages/ar';

/** تصنيف أخطاء Postgrest/الشبكة لرسائل عربية أوضح للمستخدم. */
export function tripLeadInsertUserMessage(rawMessage: string): { user: string; devSuffix: string } {
  const m = (rawMessage || '').toLowerCase();
  const devSuffix = rawMessage ? ar.errors.trip.dbSaveFailedDetail.replace('{detail}', rawMessage) : '';

  if (
    m.includes('fetch') ||
    m.includes('network') ||
    m.includes('timeout') ||
    m.includes('econnrefused') ||
    m.includes('failed to fetch')
  ) {
    return { user: ar.errors.trip.dbConnection, devSuffix };
  }

  if (m.includes('permission denied') || m.includes('rls') || m.includes('row-level security')) {
    return { user: ar.errors.trip.dbPermission, devSuffix };
  }

  if (m.includes('relation') && m.includes('does not exist')) {
    return { user: ar.errors.trip.dbTableMissing, devSuffix };
  }

  return { user: ar.errors.trip.dbSaveFailed, devSuffix };
}
