/** مفاتيح صلاحيات CRM القابلة للتعديل عبر لوحة المدير */
import { hasCrmAdminAccess, isEmployeeAdminRole, isEmployeeExpertRole, isEmergencyCrmOwnerBypass } from '@/lib/crm-roles';

export const CRM_PERMISSION_KEYS = [
  'can_access_dashboard',
  'can_access_clients',
  'can_access_itineraries',
  'can_access_marketing',
  'can_access_payments',
] as const;

export type CrmPermissionKey = (typeof CRM_PERMISSION_KEYS)[number];

export type CrmPermissions = Record<CrmPermissionKey, boolean>;

export const CRM_PERMISSION_LABELS: Record<CrmPermissionKey, string> = {
  can_access_dashboard: 'لوحة التحكم',
  can_access_clients: 'إدارة العملاء',
  can_access_itineraries: 'مخطط المسارات',
  can_access_marketing: 'مركز التسويق',
  can_access_payments: 'المدفوعات والمالية',
};

export const DEFAULT_CRM_PERMISSIONS: CrmPermissions = {
  can_access_dashboard: false,
  can_access_clients: false,
  can_access_itineraries: false,
  can_access_marketing: false,
  can_access_payments: false,
};

/** خبير: عمليات (بدون جلسات/تسويق) + بنك الأماكن/الموردين عبر can_access_itineraries */
export const EXPERT_CRM_PERMISSIONS: CrmPermissions = {
  can_access_dashboard: true,
  can_access_clients: false,
  can_access_itineraries: true,
  can_access_marketing: false,
  can_access_payments: false,
};

export const EMPLOYEE_RBAC_SELECT =
  'id, user_id, full_name, role, job_title, email, is_admin, is_suspended, permissions, can_access_dashboard, can_access_clients, can_access_itineraries, can_access_marketing, can_access_payments, created_at';

export const EMPLOYEE_MINIMAL_SELECT = 'id, user_id, full_name, role, job_title, email, created_at';

export type EmployeeRbacRow = {
  id?: string;
  user_id?: string;
  full_name?: string | null;
  role?: string | null;
  job_title?: string | null;
  email?: string | null;
  is_admin?: boolean | null;
  is_suspended?: boolean | null;
  permissions?: unknown;
  can_access_dashboard?: boolean | null;
  can_access_clients?: boolean | null;
  can_access_itineraries?: boolean | null;
  can_access_marketing?: boolean | null;
  can_access_payments?: boolean | null;
  created_at?: string | null;
};

export const FULL_CRM_PERMISSIONS: CrmPermissions = {
  can_access_dashboard: true,
  can_access_clients: true,
  can_access_itineraries: true,
  can_access_marketing: true,
  can_access_payments: true,
};

export type CrmProfileAccess = {
  is_admin: boolean;
  is_expert: boolean;
  is_suspended: boolean;
  permissions: CrmPermissions;
};

export type CrmRouteGuardKey = CrmPermissionKey | 'is_admin' | 'can_access_partners';

/** مسارات قسم الشركاء — تُفتح لأي موظف CRM مسجّل (غير معلّق) — ما عدا الخبراء */
export function isPartnersCrmPath(pathname: string): boolean {
  const path = (pathname.split('?')[0] ?? pathname).replace(/\/$/, '') || '/';
  const prefixes = [
    '/crm/partners-radar',
    '/crm/partners-directory',
    '/crm/partner-radar',
    '/crm/leaders',
    '/crm/experts',
    '/crm/celebrities',
    '/admin/partners-radar',
    '/admin/partners-directory',
  ];
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
}

/** مسارات مسموحة لدور Expert فقط (عمليات + بنك الموارد) */
const EXPERT_ALLOWED_PREFIXES = [
  '/crm/unauthorized',
  '/crm/features',
  '/crm/quotations',
  '/crm/itineraries',
  '/crm/groups',
  '/crm/hotels',
  '/crm/suppliers',
  '/crm/vault',
];

/** مسارات محظورة صراحةً على الخبراء حتى لو can_access_itineraries */
const EXPERT_BLOCKED_PREFIXES = [
  '/crm/sessions',
  '/crm/marketing',
  '/crm/radar',
  '/crm/pipeline',
  '/crm/clients',
  '/crm/customers',
  '/crm/memories',
  '/crm/analytics',
  '/crm/finance',
  '/crm/reports',
  '/crm/admin',
  '/crm/accounts',
  '/crm/team',
  '/crm/partners-radar',
  '/crm/partners-directory',
  '/crm/partner-radar',
  '/crm/leaders',
  '/crm/experts',
  '/crm/celebrities',
  '/crm/destinations',
  '/crm/experiences',
  '/crm/events',
];

export function isExpertAllowedCrmPath(pathname: string): boolean {
  const path = (pathname.split('?')[0] ?? pathname).replace(/\/$/, '') || '/';
  if (path === '/crm' || path === '/crm/dashboard') return true;
  if (EXPERT_BLOCKED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    return false;
  }
  return EXPERT_ALLOWED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/** أطول بادئة أولاً — لتحديد الصلاحية المطلوبة لمسار CRM */
const CRM_ROUTE_RULES: { prefix: string; permission: CrmRouteGuardKey }[] = [
  { prefix: '/crm/admin', permission: 'is_admin' },
  { prefix: '/crm/accounts', permission: 'is_admin' },
  { prefix: '/crm/team', permission: 'is_admin' },
  { prefix: '/crm/marketing', permission: 'can_access_marketing' },
  { prefix: '/crm/analytics', permission: 'can_access_payments' },
  { prefix: '/crm/finance', permission: 'can_access_payments' },
  { prefix: '/crm/reports', permission: 'can_access_payments' },
  { prefix: '/crm/partners-radar', permission: 'can_access_partners' },
  { prefix: '/crm/partners-directory', permission: 'can_access_partners' },
  { prefix: '/crm/partner-radar', permission: 'can_access_partners' },
  { prefix: '/crm/leaders', permission: 'can_access_partners' },
  { prefix: '/crm/experts', permission: 'can_access_partners' },
  { prefix: '/crm/celebrities', permission: 'can_access_partners' },
  { prefix: '/crm/clients', permission: 'can_access_clients' },
  { prefix: '/crm/customers', permission: 'can_access_clients' },
  { prefix: '/crm/memories', permission: 'can_access_clients' },
  { prefix: '/crm/dashboard', permission: 'can_access_dashboard' },
  { prefix: '/crm/radar', permission: 'can_access_itineraries' },
  { prefix: '/crm/pipeline', permission: 'can_access_itineraries' },
  { prefix: '/crm/quotations', permission: 'can_access_itineraries' },
  { prefix: '/crm/itineraries', permission: 'can_access_itineraries' },
  { prefix: '/crm/groups', permission: 'can_access_itineraries' },
  { prefix: '/crm/sessions', permission: 'can_access_itineraries' },
  { prefix: '/crm/hotels', permission: 'can_access_itineraries' },
  { prefix: '/crm/suppliers', permission: 'can_access_itineraries' },
  { prefix: '/crm/vault', permission: 'can_access_itineraries' },
  { prefix: '/crm/destinations', permission: 'can_access_itineraries' },
  { prefix: '/crm/experiences', permission: 'can_access_itineraries' },
  { prefix: '/crm/events', permission: 'can_access_itineraries' },
  { prefix: '/crm/influencers', permission: 'can_access_itineraries' },
];

/**
 * مسارات مفتوحة لأي موظف CRM مسجّل (بعد تجاوز التعليق فقط).
 * الشركاء هنا صراحةً لكسر 403 الناتج عن صلاحيات clients الضيّقة.
 */
const CRM_OPEN_PREFIXES = [
  '/crm/unauthorized',
  '/crm/features',
  '/crm/partners-radar',
  '/crm/partners-directory',
  '/crm/partner-radar',
  '/crm/leaders',
  '/crm/experts',
  '/crm/celebrities',
];

/** وصول قسم الشركاء — أي جلسة CRM غير معلّقة (ما عدا الخبراء) */
export function hasPartnersCrmAccess(
  access: CrmProfileAccess | null | undefined,
): boolean {
  if (!access || access.is_suspended) return false;
  if (access.is_expert) return false;
  return true;
}

export function normalizeCrmPermissions(raw: unknown): CrmPermissions {
  const base = { ...DEFAULT_CRM_PERMISSIONS };
  if (!raw || typeof raw !== 'object') return base;
  for (const key of CRM_PERMISSION_KEYS) {
    if (key in raw && typeof (raw as Record<string, unknown>)[key] === 'boolean') {
      base[key] = (raw as Record<string, boolean>)[key];
    }
  }
  return base;
}

export function hasCrmPermission(
  access: CrmProfileAccess | null | undefined,
  key: CrmPermissionKey,
): boolean {
  if (!access || access.is_suspended) return false;
  if (access.is_admin) return true;
  return Boolean(access.permissions[key]);
}

export function resolveCrmRoutePermission(pathname: string): CrmRouteGuardKey | null {
  const path = pathname.split('?')[0] ?? pathname;
  if (!path.startsWith('/crm')) return null;
  if (CRM_OPEN_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  if (path === '/crm' || path === '/crm/') return 'can_access_dashboard';

  const sorted = [...CRM_ROUTE_RULES].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const rule of sorted) {
    if (path === rule.prefix || path.startsWith(`${rule.prefix}/`)) {
      return rule.permission;
    }
  }
  return 'can_access_dashboard';
}

export function canAccessCrmPath(
  pathname: string,
  access: CrmProfileAccess | null | undefined,
  authEmail?: string | null,
): boolean {
  if (isEmergencyCrmOwnerBypass(authEmail)) return true;
  if (access?.is_suspended) return false;

  // Experts: strict allowlist (Operations + Supplier Bank) — no partners force-open
  if (access?.is_expert && !access.is_admin) {
    return isExpertAllowedCrmPath(pathname);
  }

  // FORCE: قسم الشركاء متاح لأي مستخدم مسجّل في CRM (بعد التحميل) — غير الخبراء
  if (isPartnersCrmPath(pathname)) {
    if (access == null) return true;
    return hasPartnersCrmAccess(access);
  }

  if (!access) return false;
  if (access.is_admin) return true;
  const required = resolveCrmRoutePermission(pathname);
  if (!required) return true;
  if (required === 'is_admin') return false;
  if (required === 'can_access_partners') return hasPartnersCrmAccess(access);
  return hasCrmPermission(access, required);
}

export function defaultCrmLandingPath(access: CrmProfileAccess | null | undefined): string {
  if (!access || access.is_suspended) return '/crm/unauthorized';
  if (access.is_expert && !access.is_admin) return '/crm/itineraries';
  if (access.is_admin) return '/crm';
  const order: { key: CrmPermissionKey; href: string }[] = [
    { key: 'can_access_dashboard', href: '/crm' },
    { key: 'can_access_itineraries', href: '/crm/itineraries' },
    { key: 'can_access_clients', href: '/crm/clients' },
    { key: 'can_access_marketing', href: '/crm/marketing' },
    { key: 'can_access_payments', href: '/crm/reports' },
  ];
  for (const item of order) {
    if (access.permissions[item.key]) return item.href;
  }
  return '/crm/unauthorized';
}

/** ربط روابط الشريط الجانبي بمفتاح الصلاحية */
export function navHrefPermission(href: string): CrmRouteGuardKey | null {
  return resolveCrmRoutePermission(href);
}

export function mergeProfileAccess(row: {
  is_admin?: boolean | null;
  is_suspended?: boolean | null;
  permissions?: unknown;
  role?: string | null;
} | null): CrmProfileAccess {
  return accessFromEmployeeRow(row, null);
}

function permissionsFromEmployeeColumns(row: EmployeeRbacRow | null | undefined): CrmPermissions {
  const merged = normalizeCrmPermissions(row?.permissions);
  for (const key of CRM_PERMISSION_KEYS) {
    const value = row?.[key];
    if (typeof value === 'boolean') merged[key] = value;
  }
  return merged;
}

function employeeHasExplicitPermissions(row: EmployeeRbacRow | null | undefined): boolean {
  if (!row) return false;
  if (row.permissions && typeof row.permissions === 'object') {
    const parsed = normalizeCrmPermissions(row.permissions);
    if (CRM_PERMISSION_KEYS.some((key) => parsed[key])) return true;
  }
  return CRM_PERMISSION_KEYS.some((key) => typeof row[key] === 'boolean');
}

/** يبني صلاحيات CRM من صف employees */
export function accessFromEmployeeRow(
  row: EmployeeRbacRow | null | undefined,
  authEmail?: string | null,
): CrmProfileAccess {
  if (isEmergencyCrmOwnerBypass(authEmail)) {
    return {
      is_admin: true,
      is_expert: false,
      is_suspended: false,
      permissions: { ...FULL_CRM_PERMISSIONS },
    };
  }

  if (!row) {
    const bypassAdmin = hasCrmAdminAccess(null, authEmail);
    return {
      is_admin: bypassAdmin,
      is_expert: false,
      is_suspended: false,
      permissions: bypassAdmin ? { ...FULL_CRM_PERMISSIONS } : { ...DEFAULT_CRM_PERMISSIONS },
    };
  }

  const isAdmin =
    Boolean(row.is_admin) ||
    isEmployeeAdminRole(row.role) ||
    hasCrmAdminAccess(row.role, authEmail);
  const isExpert = !isAdmin && isEmployeeExpertRole(row.role);
  const isSuspended = Boolean(row.is_suspended);

  if (isAdmin) {
    return {
      is_admin: true,
      is_expert: false,
      is_suspended: isSuspended,
      permissions: { ...FULL_CRM_PERMISSIONS },
    };
  }

  if (isExpert) {
    return {
      is_admin: false,
      is_expert: true,
      is_suspended: isSuspended,
      permissions: { ...EXPERT_CRM_PERMISSIONS },
    };
  }

  if (!employeeHasExplicitPermissions(row)) {
    return {
      is_admin: false,
      is_expert: false,
      is_suspended: isSuspended,
      permissions: { ...FULL_CRM_PERMISSIONS },
    };
  }

  return {
    is_admin: false,
    is_expert: false,
    is_suspended: isSuspended,
    permissions: permissionsFromEmployeeColumns(row),
  };
}

export function employeePatchFromAccess(input: {
  is_admin: boolean;
  is_suspended?: boolean;
  permissions: CrmPermissions;
  full_name?: string;
  is_expert?: boolean;
}): Record<string, unknown> {
  const isExpert = Boolean(input.is_expert) && !input.is_admin;
  const patch: Record<string, unknown> = {
    is_admin: input.is_admin,
    permissions: isExpert ? EXPERT_CRM_PERMISSIONS : input.permissions,
    role: input.is_admin ? 'Admin' : isExpert ? 'Expert' : 'Advisor',
    job_title: input.is_admin
      ? 'CRM Admin'
      : isExpert
        ? 'Destination Expert'
        : 'Travel Advisor',
  };
  if (typeof input.is_suspended === 'boolean') patch.is_suspended = input.is_suspended;
  if (input.full_name?.trim()) patch.full_name = input.full_name.trim();
  const perms = isExpert ? EXPERT_CRM_PERMISSIONS : input.permissions;
  for (const key of CRM_PERMISSION_KEYS) {
    patch[key] = perms[key];
  }
  return patch;
}

export function mapEmployeeToAdminUser(row: EmployeeRbacRow) {
  const userId = String(row.user_id ?? '').trim();
  return {
    id: userId,
    full_name: String(row.full_name ?? '').trim(),
    email: row.email ?? null,
    is_admin: Boolean(row.is_admin) || isEmployeeAdminRole(row.role),
    is_expert: isEmployeeExpertRole(row.role),
    is_suspended: Boolean(row.is_suspended),
    permissions: permissionsFromEmployeeColumns(row),
    created_at: row.created_at ?? null,
  };
}
