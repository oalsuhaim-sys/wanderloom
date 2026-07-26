/**
 * تجاوز طوارئ للمالك — يمنح وصولاً كاملاً دون قراءة DB.
 * احذف أو عطّل بعد استقرار RBAC.
 */
export const EMERGENCY_CRM_OWNER_EMAIL = 'oalsuhaim@wanderloomsa.com';

/** يتوافق مع قيمة role في جدول employees (مثلاً Admin أو admin). */
export function isEmployeeAdminRole(role: string | null | undefined): boolean {
  const t = String(role ?? '').trim();
  return t === 'Admin' || t.toLowerCase() === 'admin';
}

/** دور خبير الوجهات — صلاحيات محدودة (عمليات + بنك الموارد) */
export function isEmployeeExpertRole(role: string | null | undefined): boolean {
  const t = String(role ?? '').trim().toLowerCase();
  return t === 'expert' || t === 'destination expert';
}

/**
 * تجاوز مؤقت عند غياب صف employees أو role غير مضبوط:
 * - عيّن `NEXT_PUBLIC_CRM_ADMIN_BYPASS_EMAIL` في `.env.local` (يمكن عدة عناوين مفصولة بفاصلة).
 * - أو ضع بريدك في `CRM_ADMIN_OWNER_EMAIL_BYPASS` أدناه ثم احذفه بعد إصلاح البيانات.
 */
export const CRM_ADMIN_OWNER_EMAIL_BYPASS = EMERGENCY_CRM_OWNER_EMAIL;

function adminBypassEmailList(): string[] {
  const fromEnv = (typeof process.env.NEXT_PUBLIC_CRM_ADMIN_BYPASS_EMAIL === 'string'
    ? process.env.NEXT_PUBLIC_CRM_ADMIN_BYPASS_EMAIL
    : ''
  )
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0 && s.includes('@'));
  const owner = String(CRM_ADMIN_OWNER_EMAIL_BYPASS ?? '')
    .trim()
    .toLowerCase();
  const hard = owner && owner.includes('@') ? [owner] : [];
  return [...new Set([...fromEnv, ...hard])];
}

/** تجاوز طوارئ — بريد المالك فقط */
export function isEmergencyCrmOwnerBypass(email: string | null | undefined): boolean {
  const e = String(email ?? '').trim().toLowerCase();
  return e === EMERGENCY_CRM_OWNER_EMAIL.toLowerCase();
}

/** بريد مسجّل في Auth يُعامل كمدير للوصول إلى /crm/team مؤقتاً */
export function isCrmAdminEmailBypass(email: string | null | undefined): boolean {
  const e = String(email ?? '').trim().toLowerCase();
  if (!e) return false;
  if (isEmergencyCrmOwnerBypass(e)) return true;
  return adminBypassEmailList().includes(e);
}

/** مدير CRM: إما role في employees أو تجاوز بالبريد */
export function hasCrmAdminAccess(role: string | null | undefined, authEmail?: string | null | undefined): boolean {
  return isEmployeeAdminRole(role) || isCrmAdminEmailBypass(authEmail);
}
