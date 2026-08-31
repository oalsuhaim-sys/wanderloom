/** مفاتيح صلاحيات CRM القابلة للتعديل عبر لوحة المدير */
import { hasCrmAdminAccess, isEmployeeAdminRole, isEmployeeExpertRole, isEmergencyCrmOwnerBypass } from '@/lib/crm-roles';

/** أعمدة الوصول القديمة (مسارات CRM) — تُشتق من الصلاحيات الدقيقة عند الحفظ */
export const LEGACY_ACCESS_KEYS = [
  'can_access_dashboard',
  'can_access_clients',
  'can_access_itineraries',
  'can_access_marketing',
  'can_access_payments',
] as const;

/**
 * صلاحيات حسب أقسام اللوحة (أسماء قائمة الرادار / السايدبار)
 * تُخزَّن في employees.permissions كـ JSON array لمفاتيح مفعّلة: ["view_dashboard", ...]
 */
export const GRANULAR_PERMISSION_KEYS = [
  'view_dashboard',
  'access_inbox',
  'access_appointments',
  'access_group_operations',
  'access_itineraries_view',
  'access_itineraries_edit',
  'access_wallet',
  'access_assigned_only',
] as const;

/** مفاتيح قديمة — تُحوَّل تلقائياً عند القراءة */
const LEGACY_GRANULAR_ALIASES: Record<string, (typeof GRANULAR_PERMISSION_KEYS)[number]> = {
  view_assigned_only: 'access_assigned_only',
  manage_clients_workflow: 'access_inbox',
  view_itineraries_readonly: 'access_itineraries_view',
  edit_itineraries: 'access_itineraries_edit',
  manage_groups: 'access_group_operations',
  view_financials: 'access_wallet',
};

export const CRM_PERMISSION_KEYS = [
  ...LEGACY_ACCESS_KEYS,
  ...GRANULAR_PERMISSION_KEYS,
] as const;

export type LegacyAccessKey = (typeof LEGACY_ACCESS_KEYS)[number];
export type GranularPermissionKey = (typeof GRANULAR_PERMISSION_KEYS)[number];
export type CrmPermissionKey = (typeof CRM_PERMISSION_KEYS)[number];

export type CrmPermissions = Record<CrmPermissionKey, boolean>;

export const CRM_PERMISSION_LABELS: Record<CrmPermissionKey, string> = {
  can_access_dashboard: 'لوحة التحكم',
  can_access_clients: 'إدارة العملاء',
  can_access_itineraries: 'مخطط المسارات',
  can_access_marketing: 'مركز التسويق',
  can_access_payments: 'المدفوعات والمالية',
  view_dashboard: '📊 لوحة التحكم والرادار',
  access_inbox: '📥 صندوق الوارد والطلبات',
  access_appointments: '📅 مواعيد المقابلات',
  access_group_operations: '👥 عمليات القروبات وتجهيز الطلبات',
  access_itineraries_view: '🗺️ المسارات وعروض الأسعار (عرض فقط)',
  access_itineraries_edit: '✏️ المسارات وعروض الأسعار (تعديل وإنشاء)',
  access_wallet: '💰 المحفظة والعمولات',
  access_assigned_only: '🔒 مشاهدة العملاء المرتبطين بكود الإحالة فقط',
};

/** خيارات واجهة إضافة/تعديل مستخدم — بأسماء أقسام اللوحة */
export const ACCOUNT_PERMISSION_OPTIONS: {
  id: GranularPermissionKey;
  label: string;
}[] = GRANULAR_PERMISSION_KEYS.map((id) => ({
  id,
  label: CRM_PERMISSION_LABELS[id],
}));

function emptyPermissions(): CrmPermissions {
  return Object.fromEntries(CRM_PERMISSION_KEYS.map((k) => [k, false])) as CrmPermissions;
}

export const DEFAULT_CRM_PERMISSIONS: CrmPermissions = emptyPermissions();

/** خبير / قائد: مرتبطون فقط + عمليات قروبات */
export const EXPERT_CRM_PERMISSIONS: CrmPermissions = {
  ...emptyPermissions(),
  view_dashboard: true,
  access_assigned_only: true,
  access_group_operations: true,
  can_access_dashboard: true,
  can_access_clients: true,
  can_access_itineraries: true,
};

/** موظف مبيعات / عمليات: وارد + مواعيد + قروبات + مسارات عرض فقط */
export const EMPLOYEE_CRM_PERMISSIONS: CrmPermissions = {
  ...emptyPermissions(),
  view_dashboard: true,
  access_inbox: true,
  access_appointments: true,
  access_group_operations: true,
  access_itineraries_view: true,
  can_access_dashboard: true,
  can_access_clients: true,
  can_access_itineraries: true,
};

export const FULL_CRM_PERMISSIONS: CrmPermissions = Object.fromEntries(
  CRM_PERMISSION_KEYS.map((k) => [k, true]),
) as CrmPermissions;

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

export type CrmProfileAccess = {
  is_admin: boolean;
  is_expert: boolean;
  is_suspended: boolean;
  permissions: CrmPermissions;
};

export type CrmRouteGuardKey = CrmPermissionKey | 'is_admin' | 'can_access_partners';

/** يشتق أعلام المسارات القديمة من صلاحيات أقسام اللوحة */
export function deriveLegacyAccessFlags(perms: CrmPermissions): CrmPermissions {
  const next = { ...perms };
  next.can_access_clients = Boolean(
    perms.can_access_clients ||
      perms.access_assigned_only ||
      perms.access_inbox ||
      perms.access_appointments,
  );
  next.can_access_itineraries = Boolean(
    perms.can_access_itineraries ||
      perms.access_itineraries_edit ||
      perms.access_itineraries_view ||
      perms.access_group_operations ||
      perms.access_inbox ||
      perms.access_appointments ||
      perms.view_dashboard,
  );
  next.can_access_payments = Boolean(perms.can_access_payments || perms.access_wallet);
  next.can_access_dashboard = Boolean(
    perms.can_access_dashboard ||
      perms.view_dashboard ||
      next.can_access_clients ||
      next.can_access_itineraries ||
      next.can_access_payments ||
      perms.can_access_marketing,
  );
  next.can_access_marketing = Boolean(perms.can_access_marketing);
  return next;
}

/** يملأ صلاحيات الأقسام من الأعلام القديمة / الأسماء السابقة (توافق خلفي) */
export function expandLegacyToGranular(perms: CrmPermissions): CrmPermissions {
  const next = { ...perms };
  const hasAnyGranular = GRANULAR_PERMISSION_KEYS.some((k) => perms[k]);
  if (hasAnyGranular) return deriveLegacyAccessFlags(next);

  if (perms.can_access_dashboard) next.view_dashboard = true;
  if (perms.can_access_clients) {
    next.access_inbox = true;
    next.access_appointments = true;
  }
  if (perms.can_access_itineraries) {
    next.access_itineraries_edit = true;
    next.access_group_operations = true;
    next.view_dashboard = true;
  }
  if (perms.can_access_payments) {
    next.access_wallet = true;
  }
  return deriveLegacyAccessFlags(next);
}

function applyPermissionId(base: CrmPermissions, rawId: string): void {
  const key = String(rawId ?? '').trim();
  if (!key) return;
  if ((CRM_PERMISSION_KEYS as readonly string[]).includes(key)) {
    base[key as CrmPermissionKey] = true;
    return;
  }
  const modern = LEGACY_GRANULAR_ALIASES[key];
  if (modern) {
    base[modern] = true;
    if (key === 'manage_clients_workflow') {
      base.access_appointments = true;
    }
  }
}

/**
 * يحوّل صلاحيات الواجهة إلى مصفوفة JSON صالحة لعمود employees.permissions
 * (Supabase يتوقع JSON array وليس كائن boolean map).
 */
export function permissionsToDbArray(perms: CrmPermissions | Partial<CrmPermissions> | null | undefined): string[] {
  const normalized = deriveLegacyAccessFlags(normalizeCrmPermissions(perms ?? {}));
  return CRM_PERMISSION_KEYS.filter((k) => Boolean(normalized[k]));
}

/** يضمن دائماً Array نظيفة قبل الإرسال لـ Supabase */
export function ensurePermissionsDbArray(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => String(item ?? '').trim())
      .filter(Boolean);
  }
  if (typeof raw === 'string') {
    try {
      return ensurePermissionsDbArray(JSON.parse(raw || '[]'));
    } catch {
      return [];
    }
  }
  if (raw && typeof raw === 'object') {
    return permissionsToDbArray(normalizeCrmPermissions(raw));
  }
  return [];
}

export function normalizeCrmPermissions(raw: unknown): CrmPermissions {
  const base = emptyPermissions();

  let value: unknown = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value || '[]');
    } catch {
      return base;
    }
  }

  // DB / Auth metadata: ["view_dashboard", "access_inbox", ...]
  if (Array.isArray(value)) {
    for (const item of value) {
      applyPermissionId(base, String(item ?? ''));
    }
    return expandLegacyToGranular(base);
  }

  if (!value || typeof value !== 'object') return base;
  const record = value as Record<string, unknown>;

  for (const key of CRM_PERMISSION_KEYS) {
    if (key in record && typeof record[key] === 'boolean') {
      base[key] = record[key] as boolean;
    }
  }

  // Migrate previous granular key names → menu keys
  for (const [legacy, modern] of Object.entries(LEGACY_GRANULAR_ALIASES)) {
    if (typeof record[legacy] === 'boolean' && record[legacy]) {
      base[modern] = true;
      // workflow previously covered appointments too
      if (legacy === 'manage_clients_workflow') {
        base.access_appointments = true;
      }
    }
  }

  return expandLegacyToGranular(base);
}

export function hasCrmPermission(
  access: CrmProfileAccess | null | undefined,
  key: CrmPermissionKey,
): boolean {
  if (!access || access.is_suspended) return false;
  if (access.is_admin) return true;
  return Boolean(access.permissions[key]);
}

/** Alias واضح للواجهات */
export function hasPermission(
  access: CrmProfileAccess | null | undefined,
  key: CrmPermissionKey,
): boolean {
  return hasCrmPermission(access, key);
}

/**
 * هل يمكن تعديل/إنشاء المسارات وعروض الأسعار؟
 * access_itineraries_edit مطلوب؛ العرض فقط لا يكفي.
 */
export function canEditItineraries(access: CrmProfileAccess | null | undefined): boolean {
  if (!access || access.is_suspended) return false;
  if (access.is_admin) return true;
  if (access.permissions.access_itineraries_view && !access.permissions.access_itineraries_edit) {
    return false;
  }
  return Boolean(access.permissions.access_itineraries_edit);
}

export function isAssignedOnlyScope(access: CrmProfileAccess | null | undefined): boolean {
  if (!access || access.is_suspended || access.is_admin) return false;
  return Boolean(access.permissions.access_assigned_only);
}

/** صلاحيات أقسام الرادار */
export function canAccessRadarInbox(access: CrmProfileAccess | null | undefined): boolean {
  if (!access || access.is_suspended) return false;
  if (access.is_admin) return true;
  return Boolean(access.permissions.access_inbox);
}

export function canAccessRadarAppointments(access: CrmProfileAccess | null | undefined): boolean {
  if (!access || access.is_suspended) return false;
  if (access.is_admin) return true;
  return Boolean(access.permissions.access_appointments);
}

export function canAccessGroupOperations(access: CrmProfileAccess | null | undefined): boolean {
  if (!access || access.is_suspended) return false;
  if (access.is_admin) return true;
  return Boolean(access.permissions.access_group_operations);
}

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

/** مسارات مسموحة لدور Expert فقط (عمليات + بنك الموارد + عملاء مرتبطون عند الصلاحية) */
const EXPERT_ALLOWED_PREFIXES = [
  '/crm/unauthorized',
  '/crm/features',
  '/crm/quotations',
  '/crm/itineraries',
  '/crm/groups',
  '/crm/hotels',
  '/crm/suppliers',
  '/crm/vault',
  '/crm/clients',
  '/crm/customers',
];

/** مسارات محظورة صراحةً على الخبراء حتى لو can_access_itineraries */
const EXPERT_BLOCKED_PREFIXES = [
  '/crm/sessions',
  '/crm/marketing',
  '/crm/radar',
  '/crm/pipeline',
  '/crm/memories',
  '/crm/analytics',
  '/crm/finance',
  '/crm/reports',
  '/crm/admin',
  '/crm/accounts',
  '/crm/settings',
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
  { prefix: '/crm/settings', permission: 'is_admin' },
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

  // Experts: strict allowlist (Operations + Supplier Bank + scoped clients)
  if (access?.is_expert && !access.is_admin) {
    const path = (pathname.split('?')[0] ?? pathname).replace(/\/$/, '') || '/';
    const isClientsPath =
      path === '/crm/clients' ||
      path.startsWith('/crm/clients/') ||
      path === '/crm/customers' ||
      path.startsWith('/crm/customers/');
    if (isClientsPath && !access.permissions.access_assigned_only && !access.permissions.access_inbox) {
      return false;
    }
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
  if (access.is_expert && !access.is_admin) {
    if (access.permissions.access_group_operations) return '/crm/groups';
    return '/crm/itineraries';
  }
  if (access.is_admin) return '/crm';
  const order: { key: CrmPermissionKey; href: string }[] = [
    { key: 'view_dashboard', href: '/crm' },
    { key: 'can_access_dashboard', href: '/crm' },
    { key: 'access_inbox', href: '/crm/radar' },
    { key: 'access_appointments', href: '/crm/radar' },
    { key: 'can_access_itineraries', href: '/crm/itineraries' },
    { key: 'access_itineraries_view', href: '/crm/itineraries' },
    { key: 'can_access_clients', href: '/crm/clients' },
    { key: 'can_access_marketing', href: '/crm/marketing' },
    { key: 'access_wallet', href: '/crm/reports' },
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
  for (const key of LEGACY_ACCESS_KEYS) {
    const value = row?.[key];
    if (typeof value === 'boolean') merged[key] = value;
  }
  return deriveLegacyAccessFlags(merged);
}

function employeeHasExplicitPermissions(row: EmployeeRbacRow | null | undefined): boolean {
  if (!row) return false;
  if (row.permissions && typeof row.permissions === 'object') {
    const parsed = normalizeCrmPermissions(row.permissions);
    if (CRM_PERMISSION_KEYS.some((key) => parsed[key])) return true;
  }
  return LEGACY_ACCESS_KEYS.some((key) => typeof row[key] === 'boolean');
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
    const stored = employeeHasExplicitPermissions(row)
      ? permissionsFromEmployeeColumns(row)
      : { ...EXPERT_CRM_PERMISSIONS };
    return {
      is_admin: false,
      is_expert: true,
      is_suspended: isSuspended,
      permissions: deriveLegacyAccessFlags(stored),
    };
  }

  if (!employeeHasExplicitPermissions(row)) {
    return {
      is_admin: false,
      is_expert: false,
      is_suspended: isSuspended,
      permissions: { ...EMPLOYEE_CRM_PERMISSIONS },
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
  const perms = deriveLegacyAccessFlags(normalizeCrmPermissions(input.permissions));
  const patch: Record<string, unknown> = {
    is_admin: input.is_admin,
    // Always a JSON array — Postgres/PostgREST rejects boolean-map objects ("expected JSON array")
    permissions: permissionsToDbArray(perms),
    role: input.is_admin ? 'Admin' : isExpert ? 'Expert' : 'Advisor',
    job_title: input.is_admin
      ? 'CRM Admin'
      : isExpert
        ? 'Destination Expert'
        : 'Travel Advisor',
  };
  if (typeof input.is_suspended === 'boolean') patch.is_suspended = input.is_suspended;
  if (input.full_name?.trim()) patch.full_name = input.full_name.trim();
  for (const key of LEGACY_ACCESS_KEYS) {
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

/** إعدادات افتراضية حسب دور إنشاء الحساب */
export function defaultPermissionsForAccountRole(
  role: 'employee' | 'expert' | 'admin',
): CrmPermissions {
  if (role === 'admin') return { ...FULL_CRM_PERMISSIONS };
  if (role === 'expert') return { ...EXPERT_CRM_PERMISSIONS };
  return { ...EMPLOYEE_CRM_PERMISSIONS };
}
